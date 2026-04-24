#!/bin/sh
# docker/smoke-test.sh — Verification end-to-end post-deploy backend.
#
# Usage :  ./smoke-test.sh [base_url]
#   base_url par defaut : https://api-tournoi.esportdessacres.fr
#
# Testable en local (Docker Desktop) avec :
#   ./smoke-test.sh http://localhost   (apres avoir ajoute 127.0.0.1 api-tournoi... au hosts)
#
# Sortie : affiche chaque check ; exit 0 si tous passent, 1 sinon.

set -u

BASE_URL="${1:-https://api-tournoi.esportdessacres.fr}"
HOST="$(echo "$BASE_URL" | sed -E 's#^https?://##' | sed 's#/.*##')"
FAIL=0

pass() { printf "  \033[32mOK\033[0m  %s\n" "$1"; }
fail() { printf "  \033[31mKO\033[0m  %s\n" "$1"; FAIL=$((FAIL + 1)); }

echo "== Smoke test : $BASE_URL (host=$HOST) =="

# 1. /api/health HTTPS
body="$(curl -fsS "$BASE_URL/api/health" 2>/dev/null || echo "")"
if echo "$body" | grep -q '"status":"ok"'; then
  pass "GET $BASE_URL/api/health -> 200 status=ok"
else
  fail "GET $BASE_URL/api/health -> attendu {status:ok}, recu: $body"
fi

# 2. Redirection HTTP -> HTTPS
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

# 5. Tournament state endpoint
tstate_code="$(curl -fsS -o /dev/null -w "%{http_code}" "$BASE_URL/api/tournament/current" 2>/dev/null || echo "000")"
if [ "$tstate_code" = "200" ]; then
  pass "GET $BASE_URL/api/tournament/current -> 200"
else
  fail "GET $BASE_URL/api/tournament/current -> attendu 200, recu $tstate_code"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "SUCCES : tous les checks passent."
  exit 0
else
  echo "ECHEC : $FAIL check(s) en erreur."
  exit 1
fi
