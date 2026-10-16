-- Le modèle des mini-tournois joués sur place (Game'in Reims 2026) : lots en nature, matériel fourni.
INSERT INTO "rules_template" ("name", "body") VALUES ('Règlement mini-tournoi sur place', $reglement$- Organisateur : Esport des Sacres (EDS), association loi 1901
- Jeu : {{jeu}} ({{éditeur du jeu}})
- Format : {{format d'équipe}}
- Lieu : {{lieu}}
- Début : {{date}} à {{heure}}
- Places : {{places}}
- Tarif : {{tarif}}
- Lots : {{lots}}

# Article 1 — Objet du règlement

Le présent règlement régit le tournoi « {{nom du tournoi}} », organisé sur place par l'association Esport des Sacres (ci-après « EDS ») le {{date}} (ci-après « le Tournoi »). C'est un tournoi amateur et convivial, ouvert à tous les niveaux, doté de lots en nature et sans récompense en argent.

La participation au Tournoi vaut acceptation pleine et entière du présent règlement.

# Article 2 — Conditions de participation

## 2.1 — Âge des participants

- Le Tournoi est ouvert à tous.
- Les participants de moins de 16 ans doivent avoir l'accord d'un parent ou responsable légal : présent sur place, ou ayant remis une autorisation écrite au staff EDS avant le début du Tournoi.
- Le staff EDS peut demander l'âge d'un participant à tout moment, et écarter un participant qui ne remplit pas ces conditions.

## 2.2 — Format et équipes

- Le Tournoi se joue en {{format d'équipe}}.
- La composition d'une équipe est fixée à l'inscription. Un remplacement n'est possible qu'avec l'accord du staff EDS, avant la première rencontre de l'équipe.
- Un même joueur ne peut appartenir qu'à une seule équipe du Tournoi.

# Article 3 — Inscriptions et présence

## 3.1 — Inscriptions

- Les inscriptions se font depuis la page du Tournoi ({{adresse de la fiche}}) lorsqu'elle le propose, ou auprès du staff EDS au stand.
- Nombre de places : {{places}}. Les inscriptions se ferment quand toutes les places sont prises, et au plus tard au début du Tournoi. Il n'y a pas de liste d'attente.
- Chaque joueur ou équipe s'inscrit sous le nom qui apparaîtra dans les résultats.

## 3.2 — Présence

- Les participants se présentent au stand EDS au plus tard 15 minutes avant le début du Tournoi ({{heure}}) pour le pointage. Un participant absent au pointage peut voir sa place attribuée à un autre.
- À l'appel d'une rencontre, un joueur ou une équipe absent dispose de 5 minutes pour se présenter ; passé ce délai, la rencontre est perdue par forfait.

# Article 4 — Déroulement

{{déroulé}}

- Mode de jeu et réglages : {{mode de jeu et réglages}}
- Durée indicative d'une rencontre : {{durée d'un match}}
- Les horaires sont indicatifs : le staff EDS peut les adapter au rythme de la journée et aux contraintes du salon.
- Les résultats sont saisis par le staff EDS et affichés sur la page du Tournoi. Le classement de chaque phase est celui qui y est affiché.
- En cas d'égalité qui décide d'une qualification ou d'une place sur le podium, le staff EDS peut organiser une rencontre décisive.

# Article 5 — Matériel et comptes

## 5.1 — Matériel

- Le Tournoi se joue exclusivement sur le matériel fourni par EDS et ses partenaires : ordinateurs ou consoles, écrans, périphériques et manettes.
- Aucun périphérique personnel ne peut être branché, et aucun logiciel ne peut être installé.
- Les participants prennent soin du matériel. Toute dégradation volontaire entraîne l'exclusion du Tournoi.
- En cas de panne, le joueur prévient immédiatement le staff EDS, qui décide de poursuivre, de reprendre ou de rejouer la rencontre.

## 5.2 — Comptes de jeu

{{comptes de jeu}}

# Article 6 — Fair-play et sanctions

- Sont interdits : la triche, l'utilisation de logiciels tiers, l'exploitation volontaire de bugs, l'entente entre participants et tout comportement abusif (insultes, harcèlement, propos discriminatoires, sexistes, racistes, homophobes ou haineux), en jeu comme sur le stand.
- Selon la gravité, le staff EDS peut prononcer un avertissement, la perte d'une rencontre ou l'exclusion du Tournoi, et refuser la participation aux futurs événements EDS.
- Les participants respectent le public, les autres joueurs, les bénévoles et le règlement du salon.
- Toute situation de litige est tranchée par le staff EDS ; sa décision est définitive.

# Article 7 — Lots

- Lots : {{lots}}
- Les lots sont remis aux gagnants présents. Un lot non réclamé lors de la remise reste à l'association.

# Article 8 — Image et données personnelles

- Le Tournoi se déroule dans un lieu public : des photos et vidéos peuvent être prises et diffusées par EDS (site internet, réseaux sociaux) pour présenter l'événement et l'association.
- Le nom des joueurs ou des équipes et leurs résultats sont affichés sur la page du Tournoi.
- EDS ne traite que les données nécessaires au Tournoi : pseudo, composition des équipes et, le cas échéant, l'adresse e-mail du compte utilisé pour s'inscrire sur le site et l'autorisation parentale.
- Tout participant peut demander le retrait d'un contenu le concernant en contactant le staff EDS. La politique de confidentialité du site détaille les droits de chacun et la façon de les exercer.

# Article 9 — Responsabilité

- EDS ne saurait être tenu responsable des objets personnels perdus ou volés sur le salon.
- En cas d'imprévu (panne générale, contrainte du salon, retard important), EDS peut modifier le format ou les horaires, ou annuler tout ou partie du Tournoi.

# Article 10 — Mention de l'éditeur

{{mention de l'éditeur}}

# Article 11 — Acceptation et modifications du règlement

- La participation au Tournoi vaut acceptation pleine et entière du présent règlement.
- Toute situation non prévue par le présent règlement est tranchée par le staff EDS, dans le respect de l'équité sportive.
- La version de référence du règlement est celle publiée à l'adresse {{adresse du règlement}}.
$reglement$) ON CONFLICT ("name") DO NOTHING;
