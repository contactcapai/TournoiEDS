import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  etatInscriptionEnLigne,
  placesRestantes,
  type ConditionsInscription,
} from "./inscription-en-ligne";

/** Un tournoi individuel, ouvert, sans capacité annoncée, vu par quelqu'un de connecté. */
const OUVERT: ConditionsInscription = {
  registrationState: "ouvertes",
  teamSize: 1,
  capacity: null,
  inscrits: 0,
  connecte: true,
  dejaInscrit: false,
};

describe("ce que la fiche propose sur un tournoi en mode interne (Story 12.3)", () => {
  it("propose le formulaire quand tout est ouvert", () => {
    assert.deepEqual(etatInscriptionEnLigne(OUVERT), { cas: "formulaire" });
  });

  it("mène à la connexion quand il n'y a pas de compte", () => {
    assert.deepEqual(etatInscriptionEnLigne({ ...OUVERT, connecte: false }), {
      cas: "connexion",
    });
  });

  it("🔴 « déjà inscrit » l'emporte sur TOUT — sinon le bouton d'annulation disparaît quand il sert", () => {
    // Les inscriptions ont été refermées, le tournoi affiche complet, et la personne est
    // inscrite : elle doit voir son inscription et pouvoir s'en retirer. Tester la
    // disponibilité d'abord serait une porte d'entrée sans porte de sortie.
    const inscritEtFerme: ConditionsInscription = {
      ...OUVERT,
      registrationState: "fermees",
      capacity: 8,
      inscrits: 12,
      dejaInscrit: true,
    };
    assert.deepEqual(etatInscriptionEnLigne(inscritEtFerme), { cas: "inscrit" });
  });

  it("dit POURQUOI c'est indisponible, jamais rien de muet", () => {
    for (const conditions of [
      { ...OUVERT, registrationState: "fermees" as const },
      { ...OUVERT, registrationState: "completes" as const },
      { ...OUVERT, teamSize: 2 },
      { ...OUVERT, capacity: 8, inscrits: 8 },
    ]) {
      const etat = etatInscriptionEnLigne(conditions);
      assert.equal(etat.cas, "indisponible");
      assert.ok(
        etat.cas === "indisponible" && etat.raison.length > 0,
        "une indisponibilité sans raison écrite est un bouton éteint",
      );
    }
  });

  it("🔴 un ANONYME devant un tournoi complet lit « complet », il n'est pas envoyé se connecter", () => {
    // On n'envoie personne créer un compte pour découvrir ensuite qu'il n'y a plus de place.
    const complet = { ...OUVERT, connecte: false, capacity: 8, inscrits: 8 };
    assert.deepEqual(etatInscriptionEnLigne(complet), {
      cas: "indisponible",
      raison: "Toutes les places sont prises.",
    });
  });

  it("⚠️ `capacity` à `null` ne veut pas dire zéro place", () => {
    // Aucun nombre annoncé ⇒ rien à borner. Le confondre avec « complet » fermerait
    // l'inscription de tous les tournois qui n'annoncent pas de capacité, c'est-à-dire du cas
    // le plus courant.
    assert.deepEqual(etatInscriptionEnLigne({ ...OUVERT, capacity: null, inscrits: 999 }), {
      cas: "formulaire",
    });
  });

  it("la dernière place est prenable, la suivante non", () => {
    assert.deepEqual(etatInscriptionEnLigne({ ...OUVERT, capacity: 8, inscrits: 7 }), {
      cas: "formulaire",
    });
    assert.equal(etatInscriptionEnLigne({ ...OUVERT, capacity: 8, inscrits: 8 }).cas, "indisponible");
  });
});

describe("les places restantes affichées", () => {
  it("rend `null` sans capacité annoncée", () => {
    assert.equal(placesRestantes(null, 12), null);
  });

  it("⚠️ ne descend JAMAIS sous zéro — le bénévole peut saisir au-delà de la capacité", () => {
    // Sa saisie manuelle (10.5) n'est pas bornée, et c'est voulu : il a la salle sous les yeux.
    // « −3 places » serait un chiffre faux affiché au public.
    assert.equal(placesRestantes(8, 11), 0);
    assert.equal(placesRestantes(8, 8), 0);
    assert.equal(placesRestantes(24, 7), 17);
  });
});
