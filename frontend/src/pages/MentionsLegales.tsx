export default function MentionsLegales() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-heading text-2xl text-eds-cyan mb-8 sm:text-3xl break-words">
        MENTIONS LÉGALES &amp; POLITIQUE DE CONFIDENTIALITÉ
      </h1>

      {/* Section 1 : Responsable de traitement */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          1. Responsable de traitement
        </h2>
        <div className="font-body text-eds-light leading-relaxed space-y-1">
          <p>Association : Esport des Sacres (EDS) — association loi 1901</p>
          <p>Siège : Tinqueux (51430), Marne — Grand Est</p>
          <p>
            Contact :{' '}
            <a
              href="mailto:contact@esportdessacres.fr"
              className="text-eds-cyan hover:underline"
            >
              contact@esportdessacres.fr
            </a>
          </p>
        </div>
      </section>

      {/* Section 2 : Finalité de la collecte */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          2. Finalité de la collecte
        </h2>
        <div className="font-body text-eds-light leading-relaxed space-y-2">
          <p>
            Les données sont collectées dans le cadre de l'organisation du
            tournoi TFT Esport des Sacres (Set 17 — 16 &amp; 17 mai 2026).
          </p>
          <p>
            Les pseudos Discord et Riot ID sont nécessaires pour identifier les
            joueurs dans le tournoi et constituer les lobbies.
          </p>
          <p>
            L'adresse email est utilisée pour communiquer la confirmation
            d'inscription et les informations relatives au tournoi.
          </p>
          <p>
            Les coordonnées bancaires ou PayPal des lauréats du Top 3 sont
            collectées exclusivement pour le versement des dotations.
          </p>
        </div>
      </section>

      {/* Section 3 : Données collectées */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          3. Données collectées
        </h2>
        <ul className="font-body text-eds-light leading-relaxed list-disc list-inside space-y-1">
          <li>Pseudo Discord</li>
          <li>Riot ID (Pseudo#TAG)</li>
          <li>Adresse email</li>
          <li>
            Coordonnées de paiement (RIB ou PayPal) — uniquement pour les
            lauréats du Top 3
          </li>
          <li>
            Pour les joueurs mineurs (16–17 ans) : copie d'un titre d'identité
            valide et autorisation parentale
          </li>
        </ul>
      </section>

      {/* Section 4 : Base légale */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          4. Base légale
        </h2>
        <p className="font-body text-eds-light leading-relaxed">
          Consentement du joueur lors de l'inscription volontaire au tournoi, et
          obligations légales applicables aux compétitions de jeux vidéo
          (article R.321-43 du Code de la sécurité intérieure).
        </p>
      </section>

      {/* Section 5 : Durée de conservation */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          5. Durée de conservation
        </h2>
        <ul className="font-body text-eds-light leading-relaxed list-disc list-inside space-y-1">
          <li>
            Données générales (pseudos, email, âge) : supprimées dans un délai
            de 3 mois suivant la fin du tournoi.
          </li>
          <li>
            Documents relatifs aux participants mineurs (autorisation
            parentale, pièce d'identité) : conservés 1 an, conformément à
            l'article R.321-43 du Code de la sécurité intérieure.
          </li>
          <li>
            Coordonnées de paiement des lauréats : conservées pour la durée
            requise par les obligations comptables en vigueur.
          </li>
        </ul>
      </section>

      {/* Section 6 : Droits des joueurs */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          6. Vos droits (RGPD articles 15–21)
        </h2>
        <div className="font-body text-eds-light leading-relaxed space-y-2">
          <p>Conformément au RGPD, vous disposez des droits suivants :</p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <span className="text-eds-cyan">Droit d'accès</span> : obtenir
              une copie de vos données personnelles
            </li>
            <li>
              <span className="text-eds-cyan">Droit de rectification</span> :
              corriger vos données si elles sont inexactes
            </li>
            <li>
              <span className="text-eds-cyan">Droit de suppression</span> :
              demander la suppression de vos données
            </li>
            <li>
              <span className="text-eds-cyan">Droit d'opposition</span> :
              vous opposer au traitement de vos données
            </li>
          </ul>
          <p>
            Pour exercer ces droits, contactez l'association par email à{' '}
            <a
              href="mailto:contact@esportdessacres.fr"
              className="text-eds-cyan hover:underline"
            >
              contact@esportdessacres.fr
            </a>
            .
          </p>
        </div>
      </section>

      {/* Section 7 : Diffusion en direct et droits d'image */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          7. Diffusion en direct et droits d'image
        </h2>
        <div className="font-body text-eds-light leading-relaxed space-y-2">
          <p>
            Le Tournoi fait l'objet d'une diffusion en direct sur la chaîne de
            Skydow les deux jours de la compétition.
          </p>
          <p>
            En s'inscrivant, chaque participant autorise EDS et son diffuseur à
            afficher publiquement son Riot ID et son pseudo Discord, à
            retransmettre ses parties en direct, et à réaliser des captures
            d'écran et extraits vidéo à des fins de promotion de l'événement
            et de l'association.
          </p>
          <p>
            <span className="text-eds-cyan">Droit de retrait</span> : tout
            participant peut demander le retrait ciblé d'un contenu le
            concernant en contactant le staff EDS, qui procédera au retrait
            dans les meilleurs délais.
          </p>
          <p>
            Pour les participants mineurs (16–17 ans), l'autorisation parentale
            inclut explicitement le droit à l'image dans le cadre de la
            diffusion du Tournoi.
          </p>
        </div>
      </section>

      {/* Section 8 : Hébergement */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          8. Hébergement
        </h2>
        <ul className="font-body text-eds-light leading-relaxed list-disc list-inside space-y-1">
          <li>Frontend : Hostinger (hébergeur web)</li>
          <li>Backend et base de données : VPS en France</li>
        </ul>
      </section>

      {/* Section 9 : Cookies */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          9. Cookies
        </h2>
        <div className="font-body text-eds-light leading-relaxed space-y-2">
          <p>
            Le site n'utilise pas de cookies de tracking ou publicitaires.
          </p>
          <p>
            Seuls des cookies techniques nécessaires au fonctionnement du site
            sont utilisés, le cas échéant.
          </p>
        </div>
      </section>

      {/* Section 10 : Mention licence éditeur */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          10. Licence éditeur
        </h2>
        <p className="font-body text-eds-light leading-relaxed italic">
          Ce tournoi n'est ni organisé ni soutenu par Riot Games, Inc.
          Teamfight Tactics est une marque déposée de Riot Games, Inc. Tous
          droits réservés.
        </p>
      </section>
    </main>
  );
}
