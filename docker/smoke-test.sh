#!/bin/sh
# docker/smoke-test.sh — Verification end-to-end post-deploy backend + frontend.
#
# Usage :  ./smoke-test.sh [base_url] [frontend_url]
#   base_url       par defaut : https://api-tournoi.esportdessacres.fr
#   frontend_url   par defaut : https://tournoi.esportdessacres.fr
#
# Testable en local (Docker Desktop) avec :
#   ./smoke-test.sh http://localhost http://localhost
#   (apres avoir ajoute 127.0.0.1 api-tournoi... + tournoi... au hosts si test via nom DNS)
#
# Sortie : affiche chaque check ; exit 0 si tous passent, 1 sinon.

set -u

BASE_URL="${1:-https://api-tournoi.esportdessacres.fr}"
FRONTEND_URL="${2:-https://tournoi.esportdessacres.fr}"
HOST="$(echo "$BASE_URL" | sed -E 's#^https?://##' | sed 's#/.*##')"
FAIL=0

pass() { printf "  \033[32mOK\033[0m  %s\n" "$1"; }
fail() { printf "  \033[31mKO\033[0m  %s\n" "$1"; FAIL=$((FAIL + 1)); }

echo "== Smoke test : backend=$BASE_URL  frontend=$FRONTEND_URL =="

# 1. /api/health HTTPS
body="$(curl -fsS "$BASE_URL/api/health" 2>/dev/null || echo "")"
if echo "$body" | grep -q '"status":"ok"'; then
  pass "GET $BASE_URL/api/health -> 200 status=ok"
else
  fail "GET $BASE_URL/api/health -> attendu {status:ok}, recu: $body"
fi

# 2. Redirection HTTP -> HTTPS (backend)
http_url="$(echo "$BASE_URL" | sed 's#^https://#http://#')"
code="$(curl -fsS -o /dev/null -w "%{http_code}" "$http_url/api/health" 2>/dev/null || echo "000")"
if [ "$code" = "301" ] || [ "$code" = "308" ]; then
  pass "GET $http_url/api/health -> redirection $code"
else
  fail "GET $http_url/api/health -> attendu 301/308, recu $code"
fi

# 3. Handshake Socket.IO polling
sio="$(curl -fsS "$BASE_URL/socket.io/?EIO=4&transport=polling" 2>/dev/null || echo "")"
if echo "$sio" | grep -q '^0{"sid"'; then
  pass "Socket.IO handshake polling -> 200 + sid"
else
  fail "Socket.IO handshake polling -> payload inattendu : $sio"
fi

# 4. Certificat TLS : issuer Let's Encrypt (prod, pas staging)
if command -v openssl >/dev/null 2>&1; then
  issuer="$(echo | openssl s_client -connect "$HOST:443" -servername "$HOST" 2>/dev/null | openssl x509 -noout -issuer 2>/dev/null || echo "")"
  case "$issuer" in
    *"Let's Encrypt"*"STAGING"*|*"Fake"*)
      fail "Cert issuer STAGING detecte (bascule prod non faite) : $issuer"
      ;;
    *"Let's Encrypt"*)
      pass "Cert issuer Let's Encrypt prod : $issuer"
      ;;
    *)
      fail "Cert issuer inattendu : $issuer"
      ;;
  esac
else
  echo "  --  openssl absent, skip verification cert"
fi

# 5. Rankings endpoint (valide que la DB est joignable et que Prisma repond)
rankings_code="$(curl -fsS -o /dev/null -w "%{http_code}" "$BASE_URL/api/rankings" 2>/dev/null || echo "000")"
if [ "$rankings_code" = "200" ]; then
  pass "GET $BASE_URL/api/rankings -> 200 (DB + Prisma OK)"
else
  fail "GET $BASE_URL/api/rankings -> attendu 200, recu $rankings_code"
fi

# 6. Frontend homepage : SPA HTML servi
home_body="$(curl -fsS "$FRONTEND_URL/" 2>/dev/null || echo "")"
if echo "$home_body" | grep -q '<div id="root">'; then
  pass "GET $FRONTEND_URL/ -> 200 + SPA HTML (<div id=\"root\">)"
else
  fail "GET $FRONTEND_URL/ -> attendu <div id=\"root\">, recu (extrait): $(echo "$home_body" | head -c 120)"
fi

# 7. Frontend fallback SPA : route /qualifications doit etre servie 200 (pas 404)
spa_code="$(curl -fsS -o /dev/null -w "%{http_code}" "$FRONTEND_URL/qualifications" 2>/dev/null || echo "000")"
if [ "$spa_code" = "200" ]; then
  pass "GET $FRONTEND_URL/qualifications -> 200 (fallback SPA try_files OK)"
else
  fail "GET $FRONTEND_URL/qualifications -> attendu 200, recu $spa_code (config nginx try_files cassee ?)"
fi

# 8. Redirection HTTP -> HTTPS (frontend)
front_http_url="$(echo "$FRONTEND_URL" | sed 's#^https://#http://#')"
front_code="$(curl -fsS -o /dev/null -w "%{http_code}" "$front_http_url/" 2>/dev/null || echo "000")"
if [ "$front_code" = "301" ] || [ "$front_code" = "308" ]; then
  pass "GET $front_http_url/ -> redirection $front_code (frontend HTTP->HTTPS OK)"
else
  fail "GET $front_http_url/ -> attendu 301/308, recu $front_code"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "SUCCES : tous les checks passent."
  exit 0
else
  echo "ECHEC : $FAIL check(s) en erreur."
  exit 1
fi
