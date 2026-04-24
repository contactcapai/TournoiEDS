export default function MentionsLegales() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-heading text-2xl text-eds-cyan mb-8 sm:text-3xl break-words">
        MENTIONS LÉGALES & POLITIQUE DE CONFIDENTIALITÉ
      </h1>

      {/* Section 1 : Responsable de traitement */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          1. Responsable de traitement
        </h2>
        <div className="font-body text-eds-light leading-relaxed space-y-1">
          <p>Association : Esport des Sacrés (EDS)</p>
          <p>Siège : Reims, France</p>
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
            tournoi TFT Esport des Sacrés.
          </p>
          <p>
            Les pseudos Discord et Riot sont nécessaires pour identifier les
            joueurs dans le tournoi.
          </p>
          <p>
            L'adresse email est utilisée pour communiquer des informations
            relatives au tournoi.
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
          <li>Pseudo Riot</li>
          <li>Adresse email</li>
        </ul>
      </section>

      {/* Section 4 : Base légale */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          4. Base légale
        </h2>
        <p className="font-body text-eds-light leading-relaxed">
          Consentement du joueur lors de l'inscription volontaire au tournoi.
        </p>
      </section>

      {/* Section 5 : Durée de conservation */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          5. Durée de conservation
        </h2>
        <p className="font-body text-eds-light leading-relaxed">
          Les données sont conservées pour la durée du tournoi et supprimées
          dans un délai raisonnable après la fin de l'édition (maximum 6 mois).
        </p>
      </section>

      {/* Section 6 : Droits des joueurs */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          6. Vos droits (RGPD articles 15-21)
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

      {/* Section 7 : Hébergement */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          7. Hébergement
        </h2>
        <ul className="font-body text-eds-light leading-relaxed list-disc list-inside space-y-1">
          <li>Frontend : Hostinger (hébergeur web)</li>
          <li>Backend et base de données : VPS en France</li>
        </ul>
      </section>

      {/* Section 8 : Cookies */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-eds-gold mb-3">
          8. Cookies
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
    </main>
  );
}
