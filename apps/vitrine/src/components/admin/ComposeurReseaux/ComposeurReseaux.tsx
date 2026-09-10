"use client";

import { useState, useTransition } from "react";

import { Button } from "@repo/ui";

import { ChoixImage } from "@/components/admin/ChoixImage/ChoixImage";

import { X_MAX, type MessagesReseaux } from "@/lib/message-reseaux";
import { CLES_CABLEES, RESEAUX, type CleReseau } from "@/lib/reseaux";
import { RESEAUX_CABLES } from "@/lib/reseaux";
import type { ImageChoisissable } from "@/server/db/queries/photos";
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

/**
 * Ce que chaque réseau impose à la SAISIE. ⚠️ La liste des réseaux, elle, vient de
 * `lib/reseaux.ts` — c'est elle qui sait lequel est raccordé, et le paquet en dépend. Garder
 * ici une seconde liste ferait diverger l'ordre d'affichage de l'ordre des destinations.
 */
const AIDE_PAR_RESEAU: Record<keyof MessagesReseaux, string> = {
  discord: "Le markdown est rendu (## titre, **gras**).",
  x: `${X_MAX} caractères maximum — au-delà, X refuse.`,
  facebook: "Texte simple, le lien est cliquable.",
  instagram: "Aucun lien cliquable en légende : renvoyez à la bio.",
};

const VIDE: MessagesReseaux = { discord: "", x: "", facebook: "", instagram: "" };

export function ComposeurReseaux({
  evenements,
  images,
}: {
  evenements: EvenementChoisissable[];
  /** Les images de la médiathèque (15.1) — le 3ᵉ consommateur de `ChoixImage`. */
  images: readonly ImageChoisissable[];
}) {
  const [eventId, setEventId] = useState("");
  const [contexte, setContexte] = useState("");
  const [messages, setMessages] = useState<MessagesReseaux>(VIDE);
  // 🔴 LES RACCORDÉS SONT COCHÉS AU DÉPART, ET SEULEMENT EUX. Le cas courant est « j'annonce
  // partout où c'est possible » : le décochage est le geste rare, donc c'est lui qu'on demande.
  const [cibles, setCibles] = useState<readonly CleReseau[]>(CLES_CABLEES);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enProposition, proposer] = useTransition();
  const [enEnvoi, envoyer] = useTransition();
  // 🔴 UNE RÉFÉRENCE À LA MÉDIATHÈQUE, PLUS UN FICHIER DE PASSAGE (Story 15.1). L'image
  // choisie ici EXISTE désormais sur le site, avec une URL publique — et c'est exactement ce
  // qu'Instagram exige, lui qui refuse un post sans image. Ce n'est pas un effet de bord :
  // c'était le blocage ① mesuré de la 7.6, et il tombe de lui-même.
  // ⚠️ Cet écran n'est PAS un `<form>` : il appelle ses actions à la main (deux gestes
  // distincts, « proposer » et « envoyer »). Il tient donc l'identifiant choisi lui-même,
  // via le rappel de `ChoixImage` — plutôt que de relire le DOM au moment de soumettre.
  const [photoId, setPhotoId] = useState("");

  const rienASoumettre = Object.values(messages).every((texte) => texte.trim() === "");
  const evenementChoisi = evenements.find((evenement) => evenement.id === eventId);

  function lancerProposition() {
    setErreur(null);
    setSucces(null);
    const donnees = new FormData();
    donnees.set("contexte", contexte);
    donnees.set("eventId", eventId);
    // « Aucune image » vaut la chaîne vide, que l'action traite comme « pas d'image ».
    donnees.set("photoId", photoId);

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
        const resultat = await annoncerTextesRelus({ eventId: eventId || null, messages, reseaux: cibles });
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

          {/* 🔴 L'IMAGE VIENT DE LA MÉDIATHÈQUE, ET ELLE Y RESTE (15.1). Elle était jusqu'ici
              un fichier de passage : lu pour écrire le texte, jamais conservé — la phrase à
              l'écran le disait, et elle était juste. Ce n'est plus le cas, donc elle change.
              ⚠️ Ce n'est pas qu'un rangement : une image qui EXISTE sur le site a une URL
              publique, et c'est ce qu'Instagram exige. Le blocage ① de la 7.6 tombe ici. */}
          <ChoixImage
            nom="photoId"
            valeurInitiale={null}
            images={images}
            label="Une image (facultatif)"
            onChange={setPhotoId}
          />

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

          {/* ══════════════════════════════════════════════════════════════════════════
              🔴 OÙ ÇA PART — ET UN RÉSEAU NON RACCORDÉ N'EST PAS PROPOSABLE
              ══════════════════════════════════════════════════════════════════════════
              Un réseau sans nœud dans n8n ne publie rien. L'offrir à cocher promettrait une
              parution qui n'aurait pas lieu, et l'écran dirait « annoncé » — le défaut exact
              que la PR #118 a corrigé sur cette page. On le montre donc **désactivé, avec sa
              raison écrite** plutôt que masqué : le bénévole doit comprendre POURQUOI il ne
              peut pas, sans quoi il croit à un bug. */}
          <fieldset className={styles.cibles}>
            <legend className={form.label}>Où publier</legend>
            <div className={styles.ciblesListe}>
              {RESEAUX.map((reseau) => {
                const coche = cibles.includes(reseau.cle);
                return (
                  <label
                    className={styles.cible}
                    key={reseau.cle}
                    /* Le titre porte la raison au survol ; la mention écrite juste après la
                       porte pour tout le monde (le survol n'existe pas au tactile). */
                    title={reseau.cable ? undefined : "Pas encore raccordé"}
                  >
                    <input
                      type="checkbox"
                      checked={coche}
                      disabled={!reseau.cable}
                      onChange={(e) =>
                        setCibles((actuel) =>
                          e.target.checked
                            ? [...actuel, reseau.cle]
                            : actuel.filter((c) => c !== reseau.cle),
                        )
                      }
                    />
                    {reseau.libelle}
                    {reseau.cable ? null : (
                      <span className={styles.pasRaccorde}>pas encore raccordé</span>
                    )}
                  </label>
                );
              })}
            </div>
            {/* ⚠️ L'AVERTISSEMENT NE S'AFFICHE QU'AU MOMENT OÙ IL SERT — décocher les quatre
                cases est un état atteignable, et « Envoyer » y serait un faux succès. */}
            {cibles.length === 0 ? (
              <p className={form.erreur}>
                Aucun réseau sélectionné : l&rsquo;annonce ne paraîtrait nulle part.
              </p>
            ) : null}
          </fieldset>

          {RESEAUX.map((reseau) => {
            const texte = messages[reseau.cle];
            const aide = AIDE_PAR_RESEAU[reseau.cle];
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
                  {aide}{" "}
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
