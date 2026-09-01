import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { RETOUR_PAR_DEFAUT, destinationApresConnexion } from "./retour";

const refuse = (valeur: unknown, pourquoi: string) =>
  assert.equal(destinationApresConnexion(valeur), RETOUR_PAR_DEFAUT, pourquoi);

describe("retour après connexion — ce qui est REFUSÉ (Story 12.2)", () => {
  it("🔴 toute URL absolue : c'est le montage d'un redirecteur ouvert", () => {
    refuse("https://ailleurs.example/piege", "URL absolue");
    refuse("http://ailleurs.example", "URL absolue en clair");
  });

  it("🔴 un chemin en `//` est une URL protocol-relative — un AUTRE domaine", () => {
    refuse("//ailleurs.example/piege", "protocol-relative");
  });

  it("🔴 `..` : `/admin/../../ailleurs` satisfait n'importe quel préfixe", () => {
    refuse("/admin/../../ailleurs", "remontée");
    refuse("/agenda/..%2Failleurs", "remontée encodée dans la chaîne brute");
  });

  it("l'antislash, que certains navigateurs traitent comme `/`", () => {
    refuse(String.raw`/admin\ailleurs`, "antislash");
  });

  it("une racine INCONNUE, et une racine seulement PRÉFIXE d'une autorisée", () => {
    refuse("/medias/secret.jpg", "racine inconnue");
    // 🔴 `/tournois-pieges` commence bien par « /tournois » en tant que CHAÎNE, et n'est pas
    // la même page. C'est pourquoi la comparaison porte sur des RACINES, pas des préfixes.
    refuse("/tournois-pieges", "préfixe de chaîne, pas une racine");
  });

  it("l'absence, le vide, et ce qui n'est pas une chaîne", () => {
    refuse(undefined, "absent");
    refuse("", "vide");
    refuse(["/agenda"], "tableau — Next rend un string[] sur un paramètre répété");
  });
});

describe("la destination par défaut", () => {
  it("est /profil, la seule surface que TOUT compte connecté possède", () => {
    // 🔴 CE TEST FIGE UNE VALEUR, PAS UN COMPORTEMENT, ET C'EST DÉLIBÉRÉ. Tous les autres
    // tests de ce fichier comparent à `RETOUR_PAR_DEFAUT` — donc la valeur pouvait changer
    // sans qu'AUCUN ne rougisse. Elle valait `/admin` : se connecter sans `next` déposait un
    // joueur sur le tableau de bord du back-office, où il n'a aucun rôle et ne voit rien.
    // La 12.4 l'a portée à `/profil` ; sans cette ligne, la ramener à `/admin` serait un
    // changement muet, vert de bout en bout.
    assert.equal(RETOUR_PAR_DEFAUT, "/profil");
  });

  it("est elle-même une racine admise — sinon la garde se refuserait sa propre issue", () => {
    // Un défaut hors de `RACINES_DE_RETOUR` produirait une destination que la fonction
    // rejetterait si on la lui repassait : la garde ne serait plus idempotente.
    assert.equal(destinationApresConnexion(RETOUR_PAR_DEFAUT), RETOUR_PAR_DEFAUT);
  });
});

describe("retour après connexion — ce qui est ADMIS", () => {
  it("les racines autorisées, elles-mêmes et ce qui est dessous", () => {
    for (const chemin of ["/admin", "/admin/tournois", "/profil", "/agenda", "/tournois/tft"]) {
      assert.equal(destinationApresConnexion(chemin), chemin, chemin);
    }
  });

  it("l'accueil, en ÉGALITÉ STRICTE — le prendre comme racine autoriserait tout", () => {
    assert.equal(destinationApresConnexion("/"), "/");
  });

  it("la query est conservée, mais ne décide pas de l'admission", () => {
    assert.equal(destinationApresConnexion("/agenda?jour=2026-09-03"), "/agenda?jour=2026-09-03");
    // La racine se juge sur le CHEMIN seul : sans la coupure, ce `?` masquerait la vraie racine.
    refuse("/medias/x?next=/agenda", "la query ne rachète pas une racine refusée");
  });
});
