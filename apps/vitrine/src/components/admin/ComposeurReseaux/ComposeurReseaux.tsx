"use client";

import { useRef, useState, useTransition } from "react";

import { Button } from "@repo/ui";

import { X_MAX, type MessagesReseaux } from "@/lib/message-reseaux";
import { RESEAUX_CABLES } from "@/lib/reseaux";
import { annoncerTextesRelus, proposerTextesPourReseaux } from "@/server/actions/reseaux";
import form from "@/styles/admin-form.module.css";
import styles from "./ComposeurReseaux.module.css";

/**
 * Composer une annonce, la relire, l'envoyer (Story 7.6).
 *
 * 🔴 DEUX GESTES, JAMAIS UN SEUL. « Proposer » n'écrit rien et ne publie rien ; « Envoyer »
 * part avec ce qui est à l'écran. Les fondre publierait un texte que personne n'a lu — et un
 * modèle qui se trompe écrit une phrase parfaitement crédible.
 */

export interface EvenementChoisissable {
  id: string;
  libelle: string;
  publie: boolean;
}

/** L'ordre d'affichage. Discord d'abord : c'est le réseau le plus proche des joueurs. */
const RESEAUX = [
  { cle: "discord", libelle: "Discord", aide: "Le markdown est rendu (## titre, **gras**)." },
  { cle: "x", libelle: "X", aide: `${X_MAX} caractères maximum — au-delà, X refuse.` },
  { cle: "facebook", libelle: "Facebook", aide: "Texte simple, le lien est cliquable." },
  {
    cle: "instagram",
    libelle: "Instagram",
    aide: "Aucun lien cliquable en légende : renvoyez à la bio.",
  },
] as const satisfies readonly { cle: keyof MessagesReseaux; libelle: string; aide: string }[];

const VIDE: MessagesReseaux = { discord: "", x: "", facebook: "", instagram: "" };

export function ComposeurReseaux({ evenements }: { evenements: EvenementChoisissable[] }) {
  const [eventId, setEventId] = useState("");
  const [contexte, setContexte] = useState("");
  const [messages, setMessages] = useState<MessagesReseaux>(VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enProposition, proposer] = useTransition();
  const [enEnvoi, envoyer] = useTransition();
  const imageRef = useRef<HTMLInputElement>(null);

  const rienASoumettre = Object.values(messages).every((texte) => texte.trim() === "");
  const evenementChoisi = evenements.find((evenement) => evenement.id === eventId);

  function lancerProposition() {
    setErreur(null);
    setSucces(null);
    const donnees = new FormData();
    donnees.set("contexte", contexte);
    donnees.set("eventId", eventId);
    const fichier = imageRef.current?.files?.[0];
    if (fichier) donnees.set("image", fichier);

    proposer(async () => {
      try {
        const resultat = await proposerTextesPourReseaux(donnees);
        if (resultat.ok) setMessages(resultat.data);
        else setErreur(resultat.error);
      } catch {
        // Voir `EventActions` : `exigerRoleAction` LÈVE, elle ne rend pas `{ ok: false }`.
        setErreur("Votre session n'est plus valide. Rechargez la page et reconnectez-vous.");
      }
    });
  }

  function lancerEnvoi() {
    setErreur(null);
    setSucces(null);
    envoyer(async () => {
      try {
        const resultat = await annoncerTextesRelus({ eventId: eventId || null, messages });
        if (!resultat.ok) {
          setErreur(resultat.error);
          return;
        }
        setSucces(
          RESEAUX_CABLES.length === 0
            ? "Envoyé à l'outil de publication — aucun réseau n'y est raccordé, l'annonce n'a paru nulle part."
            : "Envoyé. Vérifiez que l'annonce est bien parue avant de fermer cette page.",
        );
        if (!resultat.data.traceEcrite) {
          setErreur(
            "⚠️ L'envoi est parti mais la trace n'a pas pu être enregistrée : l'agenda dira " +
              "« jamais transmis ». Notez-le, et ne renvoyez pas sans vérifier.",
          );
        }
      } catch {
        setErreur("Votre session n'est plus valide. Rechargez la page et reconnectez-vous.");
      }
    });
  }

  return (
    <div className={styles.composeur}>
      {/* 🔴 La source à GAUCHE, le résultat à DROITE — c'est l'usage réel : on ajuste le
          contexte, on régénère, on compare sans faire défiler. Les messages d'état restent
          HORS de la grille, en pleine largeur : une erreur logée dans une colonne se lirait
          comme le défaut de cette colonne-là. */}
      <div className={styles.colonnes}>
        <section className={styles.bloc}>
          <h2 className={styles.titreBloc}>De quoi on parle</h2>

          <div className={form.champ}>
            <label className={form.label} htmlFor="evenement">
              Un événement de l&rsquo;agenda <span className={styles.facultatif}>(facultatif)</span>
            </label>
            <select
              id="evenement"
              className={form.saisie}
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              <option value="">— Aucun, j&rsquo;écris librement —</option>
              {evenements.map((evenement) => (
                <option key={evenement.id} value={evenement.id}>
                  {evenement.libelle}
                  {evenement.publie ? "" : " (brouillon)"}
                </option>
              ))}
            </select>
            <p className={form.regle}>
              🔴 Ses faits — date, lieu, jeux, tarif — sont repris <strong>tels quels</strong>. Le
              service de rédaction écrit les phrases, il n&rsquo;invente aucun fait.
            </p>
            {evenementChoisi && !evenementChoisi.publie ? (
              <p className={form.avertissement}>
                ⚠️ Cet événement est un brouillon : l&rsquo;envoi sera refusé tant qu&rsquo;il
                n&rsquo;est pas publié, sinon l&rsquo;annonce renverrait vers une page où il ne
                figure pas.
              </p>
            ) : null}
          </div>

          <div className={form.champ}>
            <label className={form.label} htmlFor="contexte">
              Le contexte, ou un début de texte
            </label>
            <textarea
              id="contexte"
              className={form.zone}
              rows={4}
              value={contexte}
              maxLength={2000}
              placeholder="Ex. : on fête les deux ans de l'asso, ambiance conviviale, insister sur le fait que les débutants sont bienvenus."
              onChange={(e) => setContexte(e.target.value)}
            />
          </div>

          <div className={form.champ}>
            <label className={form.label} htmlFor="image">
              Une image <span className={styles.facultatif}>(facultatif)</span>
            </label>
            <input
              id="image"
              ref={imageRef}
              className={form.fichier}
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
            <p className={form.regle}>
              JPEG, PNG ou WebP, 8 Mo maximum. ⚠️ Elle est <strong>lue pour écrire le texte</strong>{" "}
              et n&rsquo;est pas conservée : elle ne sera pas publiée avec l&rsquo;annonce.
            </p>
          </div>

          <div className={form.actions}>
            <Button type="button" onClick={lancerProposition} disabled={enProposition || enEnvoi}>
              {enProposition ? "Rédaction en cours…" : "Proposer les textes"}
            </Button>
          </div>
        </section>

        <section className={styles.bloc}>
          <h2 className={styles.titreBloc}>Les quatre textes</h2>
                    {/* ⚠️ Au chargement les quatre zones sont VIDES : « relisez ce qui partira » y
              parlait de rien. Une phrase vraie qui se lit à contretemps (motif PR #100). */}
          <p className={form.regle}>
            {rienASoumettre ? (
              <>
                Rien n&rsquo;est encore proposé. Remplissez la colonne de gauche, ou écrivez
                directement ici.
              </>
            ) : (
              <>
                Relisez et corrigez : c&rsquo;est <strong>ce qui est ici</strong> qui partira,
                mot pour mot.
              </>
            )}
          </p>

          {RESEAUX.map((reseau) => {
            const texte = messages[reseau.cle];
            const trop = reseau.cle === "x" && texte.length > X_MAX;
            return (
              <div className={form.champ} key={reseau.cle}>
                <label className={form.label} htmlFor={`texte-${reseau.cle}`}>
                  {reseau.libelle}
                </label>
                <textarea
                  id={`texte-${reseau.cle}`}
                  className={form.zone}
                  rows={reseau.cle === "x" ? 4 : 6}
                  value={texte}
                  onChange={(e) =>
                    setMessages((actuel) => ({ ...actuel, [reseau.cle]: e.target.value }))
                  }
                />
                <p className={form.regle}>
                  {reseau.aide}{" "}
                  <span className={trop ? styles.compteurDepasse : form.compteur}>
                    {texte.length}
                    {reseau.cle === "x" ? ` / ${X_MAX}` : " caractères"}
                  </span>
                </p>
              </div>
            );
          })}

          <div className={form.actions}>
            <Button
              type="button"
              onClick={lancerEnvoi}
              disabled={enEnvoi || enProposition || rienASoumettre}
            >
              {enEnvoi ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </section>
      </div>

      {erreur ? (
        <p className={form.erreur} role="alert">
          {erreur}
        </p>
      ) : null}
      {succes ? (
        <p className={styles.succes} role="status">
          {succes}
        </p>
      ) : null}
    </div>
  );
}
