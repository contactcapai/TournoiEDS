-- Le premier modèle : le règlement du TFT de mai 2026 (ancienne app, PDF v1.0), mis à jour pour le site.
INSERT INTO "rules_template" ("name", "body") VALUES ('Règlement TFT EDS', $reglement$- Organisateur : Esport des Sacres (EDS), association loi 1901
- Siège : Tinqueux (51430), Marne, Grand Est
- Jeu : {{jeu}} (Riot Games), PEGI 12
- Lieu : {{lieu}}, serveur EU West (EUW)
- Début : {{date}} à {{heure}}
- Capacité : {{places}} joueurs maximum
- Tarif : {{tarif}}
- Dotation : {{lots}}

# Préambule

Le présent règlement régit le tournoi « {{nom du tournoi}} » organisé par l'association Esport des Sacres (ci-après « EDS »), dont la première manche commence le {{date}} (ci-après « le Tournoi »). Il est établi conformément au cadre légal applicable aux compétitions de jeux vidéo en France, et notamment :

- Décret n° 2017-871 du 9 mai 2017 relatif à l'organisation des compétitions de jeux vidéo ;
- Articles L.321-9 et suivants et R.321-40 et suivants du Code de la sécurité intérieure ;
- Guide de l'organisateur d'un événement esport publié par France Esports (version d'octobre 2025) ;
- Conditions de la licence communautaire Teamfight Tactics accordée par Riot Games.

S'agissant d'une compétition organisée exclusivement en ligne, avec des inscriptions gratuites et une dotation inférieure à 10 000 €, elle ne requiert ni déclaration préalable au ministère de l'Intérieur, ni mise sous séquestre des gains (hormis pour les joueurs mineurs, voir Article 7.3).

# Article 1 — Objet du règlement

Le présent règlement a pour objet de définir les modalités d'organisation, les conditions de participation et les règles sportives applicables au Tournoi. L'inscription au Tournoi entraîne l'acceptation pleine et entière du présent règlement par le participant. Tout joueur qui ne souhaiterait pas accepter une ou plusieurs dispositions de ce règlement est invité à ne pas s'inscrire.

# Article 2 — Conditions de participation

## 2.1 — Âge des participants

Conformément à l'article R.321-43 du Code de la sécurité intérieure et au Guide France Esports, la participation à une compétition de jeux vidéo avec récompense monétaire est encadrée selon l'âge :

- Moins de 16 ans : participation non acceptée pour ce Tournoi, afin de simplifier la gestion administrative des gains des mineurs.
- Entre 16 et 17 ans : participation acceptée, sous réserve de la remise au staff EDS, avant le début du Tournoi (par Discord ou par e-mail), d'une autorisation écrite du responsable légal accompagnée d'une copie d'un titre d'identité valide. Ces documents seront conservés par EDS pendant un (1) an.
- 18 ans et plus : participation libre.

Le site ne demande pas l'âge à l'inscription : le staff EDS peut le vérifier à tout moment avant ou pendant le Tournoi, et écarter un participant qui ne remplit pas ces conditions.

## 2.2 — Compte et plateforme

- Chaque joueur doit disposer d'un compte Riot Games en règle, actif sur le serveur EU West (EUW).
- Le client Teamfight Tactics doit être à jour au moment de chaque manche.
- Aucun niveau, rang ou division n'est requis. Le Tournoi est ouvert à tous les niveaux.
- Le joueur s'engage à respecter les Conditions d'utilisation de Riot Games et le Code de conduite du jeu.

## 2.3 — Matériel et connexion

Le joueur est seul responsable de son matériel (ordinateur, périphériques), de sa connexion internet et de son environnement de jeu. EDS ne saurait être tenu responsable d'un problème technique du côté du participant (voir Article 9).

# Article 3 — Inscriptions

## 3.1 — Modalités

- Plateforme officielle d'inscription : {{adresse de la fiche}}
- L'inscription se fait depuis cette page, avec un compte sur le site de l'association. Les inscriptions envoyées par message privé Discord, par e-mail ou par un autre canal ne sont pas traitées.
- Tarif : {{tarif}}. Aucun paiement n'est demandé en ligne.
- L'inscription est confirmée à l'écran et reste visible sur la page du Tournoi. Le joueur peut se désinscrire depuis la même page tant qu'aucune manche ne l'a placé.

## 3.2 — Informations requises

Pour s'inscrire, le joueur renseigne sur le site :

- Le pseudo sous lequel il apparaîtra dans les résultats ;
- Son Riot ID complet (format Pseudo#TAG) et son pseudo Discord, renseignés dans son profil ;
- Le cas échéant, les pièces prévues à l'article 2.1 pour les joueurs de 16 à 17 ans, remises au staff EDS ;
- Un moyen de contact pour le versement des gains (RIB ou adresse PayPal) sera demandé uniquement aux joueurs classés dans le Top 3.

## 3.3 — Clôture des inscriptions

Les inscriptions sont closes dès que {{places}} joueurs sont inscrits, ou au plus tard le {{clôture des inscriptions}}. Il n'y a pas de liste d'attente : une place libérée par une désinscription redevient disponible sur le site.

# Article 4 — Format de la compétition

## 4.1 — Phase de qualification ({{jour des qualifications}})

- Check-in obligatoire des participants sur le Discord EDS avant la première manche.
- {{nombre de manches de qualification}} manches au total, en lobbies de 8 joueurs répartis en parallèle.
- Redistribution des lobbies entre chaque manche selon un principe proche du système suisse (pondération en fonction des points acquis).
- À l'issue des manches de qualification, les {{nombre de finalistes}} joueurs ayant le total de points le plus élevé sont qualifiés pour la finale.

## 4.2 — Finale ({{jour de la finale}}, format matchpoint)

- Check-in des finalistes sur le Discord EDS.
- Les finalistes s'affrontent en lobby unique. Le nombre de manches n'est pas fixé à l'avance : la finale se joue jusqu'à désignation du vainqueur selon la règle du matchpoint (ci-dessous).
- Les points des qualifications ne sont pas reportés : chaque finaliste démarre la finale à 0 point.

## 4.2.1 — Règle du matchpoint

Le vainqueur du Tournoi est le premier joueur à remplir les deux conditions suivantes au cours d'une même manche :

- Condition 1 — Seuil de points : le joueur doit entamer la manche en comptabilisant au minimum {{seuil du matchpoint}} points cumulés sur la finale.
- Condition 2 — Top 1 : le joueur doit terminer cette manche à la 1re place du lobby.

Un joueur qui atteint {{seuil du matchpoint}} points mais ne termine pas Top 1 reste éligible : il conserve son statut de « matchpoint » et pourra être sacré vainqueur dès qu'il décrochera un Top 1 lors d'une manche ultérieure.

## 4.2.2 — Exemples (seuil à 20 points)

- Joueur A (22 pts en début de manche) termine 1er : il remplit les deux conditions, il est vainqueur du Tournoi.
- Joueur B (19 pts en début de manche) termine 1er (+8 pts, total 27) : il n'avait pas atteint le seuil au début de la manche, il n'est pas vainqueur et la finale continue. Il sera en matchpoint dès la manche suivante.
- Joueur C (25 pts) termine 3e : en matchpoint mais pas Top 1, la finale continue.

## 4.2.3 — Classement des 2e et 3e places

Une fois le vainqueur désigné, la finale s'arrête immédiatement après la manche qui l'a décidé. Les 2e et 3e places sont attribuées sur la base du total de points cumulés à l'issue de cette dernière manche, tous finalistes confondus. En cas d'égalité, le départage s'effectue selon la hiérarchie de l'article 4.4.

## 4.3 — Barème de points (qualifications et finale)

- 1er : 8 points
- 2e : 7 points
- 3e : 6 points
- 4e : 5 points
- 5e : 4 points
- 6e : 3 points
- 7e : 2 points
- 8e : 1 point

## 4.4 — Départage en cas d'égalité

En cas d'égalité de points au classement général, les joueurs sont départagés selon la hiérarchie suivante :

- Meilleur placement moyen sur l'ensemble des manches jouées ;
- Meilleur placement sur la dernière manche disputée ;
- Tirage au sort par le staff EDS, en dernier recours.

# Article 5 — Déroulement des manches

## 5.1 — Codes lobby

- Les codes de lobby sont communiqués par le staff EDS aux joueurs concernés via un salon dédié du Discord EDS, au plus tard 10 minutes avant le début de chaque manche.
- Les joueurs doivent rejoindre le lobby dans les 10 minutes suivant la diffusion du code.
- Tout joueur n'ayant pas rejoint son lobby à l'expiration de ce délai est considéré forfait sur la manche concernée et se voit attribuer 0 point pour celle-ci.

## 5.2 — Déconnexions et incidents techniques

- Déconnexion ponctuelle : le joueur est invité à se reconnecter au plus vite ; la partie se poursuit et le placement final détermine les points acquis.
- Crash serveur Riot confirmé : la manche concernée est annulée et rejouée à la discrétion du staff EDS.
- Abandon volontaire : une 8e place est attribuée au joueur concerné.

## 5.3 — Communication en cours de tournoi

- Tous les participants doivent rester connectés au Discord officiel pendant toute la durée du Tournoi.
- Les annonces officielles (codes lobby, classements intermédiaires, consignes) y sont communiquées ; le classement est aussi consultable sur la page du Tournoi.
- Les participants s'engagent à vérifier régulièrement le salon d'annonces et à répondre aux sollicitations du staff dans un délai raisonnable.

# Article 6 — Fair-play et sanctions

## 6.1 — Comportements interdits

Les comportements suivants sont strictement prohibés :

- Collusion : entente, partage d'informations stratégiques ou coordination entre joueurs en cours de partie.
- Win-trading ou match-fixing : toute manipulation volontaire d'un résultat.
- Utilisation d'outils non autorisés : logiciels tiers, bots, scripts, overlays interdits par Riot Games, outils de tracking illicites.
- Streamsniping : utilisation d'une diffusion du Tournoi (ou de tout autre flux) pour obtenir des informations stratégiques sur d'autres participants en temps réel.
- Ghosting : communication avec un joueur tiers non autorisé pour recevoir des informations sur la partie en cours.
- Comportement abusif : insultes, harcèlement, propos discriminatoires, sexistes, racistes, homophobes ou haineux, que ce soit en jeu, sur Discord ou sur une diffusion.

## 6.2 — Échelle de sanctions

Selon la gravité des faits, et à l'entière discrétion du staff EDS, les sanctions suivantes peuvent être appliquées :

- Avertissement (faute mineure, première occurrence) ;
- Pénalité en points (retrait partiel ou total des points d'une manche) ;
- Disqualification du Tournoi (faute grave ou récidive) ;
- Interdiction de participer aux futurs événements EDS (cas les plus graves, notamment harcèlement, tricherie avérée, fraude).

## 6.3 — Procédure d'appel

Un joueur sanctionné peut faire appel auprès du bureau d'EDS dans un délai de 48 heures suivant la notification de la sanction, par message écrit adressé au staff via Discord ou e-mail. La décision du bureau est rendue dans les 7 jours et est définitive.

# Article 7 — Dotation et versement

## 7.1 — Répartition

{{répartition de la dotation}}

Les gains sont versés par virement bancaire ou PayPal.

## 7.2 — Modalités de versement

- Le versement intervient dans un délai maximum de 15 jours ouvrés suivant la fin du Tournoi.
- Les coordonnées bancaires ou PayPal sont à transmettre au staff EDS dans les 7 jours suivant la fin du Tournoi.
- À défaut de coordonnées transmises dans ce délai, le gain sera considéré comme abandonné au profit de l'association.

## 7.3 — Cas particulier des mineurs

Conformément au Guide France Esports, pour tout lauréat mineur de 16 à 17 ans, la dotation peut être, à la demande expresse et écrite du responsable légal, convertie en carte cadeau d'un montant équivalent. Cette option évite la mise sous séquestre à la Caisse des dépôts et consignations et permet un versement immédiat.

# Article 8 — Diffusion en direct et droits d'image

## 8.1 — Diffusion

Le Tournoi peut faire l'objet d'une diffusion en direct. Le cas échéant, la chaîne et le lien sont annoncés sur le Discord EDS à l'approche de l'événement.

## 8.2 — Autorisation de diffusion

En s'inscrivant, chaque participant autorise expressément EDS et son éventuel diffuseur à :

- Afficher publiquement son pseudo et son Riot ID sur la page du Tournoi et pendant la diffusion ;
- Retransmettre en direct ses parties (plateau de jeu, interface, mouvements) ;
- Réaliser des captures d'écran et extraits vidéo à des fins de promotion de l'événement et de l'association (réseaux sociaux, site internet, supports de communication), sans limitation de durée.

## 8.3 — Cas des mineurs

Pour les participants de 16 à 17 ans, l'autorisation parentale prévue à l'article 2.1 inclut explicitement le droit à l'image dans le cadre de la diffusion du Tournoi.

## 8.4 — Droit de retrait

Tout participant peut demander le retrait ciblé d'un contenu le concernant (ex. : clip diffusé sur les réseaux sociaux) en contactant le staff EDS, qui procédera au retrait dans les meilleurs délais.

# Article 9 — Responsabilité et force majeure

## 9.1 — Limite de responsabilité

EDS ne saurait être tenu responsable :

- Des problèmes techniques côté joueur : panne de matériel, coupure internet, panne électrique, crash client individuel, etc. ;
- Des comportements, propos ou actes des participants entre eux ou vis-à-vis de tiers ;
- D'une indisponibilité prolongée des serveurs de Riot Games.

## 9.2 — Force majeure

En cas de force majeure ou d'événement majeur empêchant le bon déroulement du Tournoi (panne serveur Riot prolongée, incident technique massif sur Discord, etc.), EDS se réserve le droit :

- De reporter une ou plusieurs manches ;
- De modifier le format ou le calendrier du Tournoi ;
- D'annuler tout ou partie du Tournoi. Dans ce cas, la dotation pourra être répartie au prorata des phases effectivement disputées, ou reversée au(x) gagnant(s) de la dernière phase valablement achevée.

# Article 10 — Données personnelles (RGPD)

Dans le cadre de l'organisation du Tournoi, EDS traite les données personnelles suivantes : pseudo, Riot ID, pseudo Discord, adresse e-mail du compte, coordonnées bancaires ou PayPal (pour les lauréats uniquement), et, le cas échéant, pièce d'identité et autorisation parentale pour les participants de 16 à 17 ans.

Ces données sont utilisées exclusivement pour l'organisation du Tournoi, le versement des gains et le respect des obligations légales. Elles ne sont ni cédées, ni vendues à des tiers commerciaux.

Durée de conservation : les documents relatifs aux participants mineurs (autorisation parentale, pièce d'identité) sont conservés un (1) an suivant le Tournoi, conformément à l'article R.321-43 du Code de la sécurité intérieure. Les coordonnées de paiement des lauréats sont conservées pour des raisons comptables conformément à la réglementation en vigueur. Le pseudo et les résultats restent affichés dans l'historique du Tournoi.

Conformément au RGPD, chaque participant dispose d'un droit d'accès, de rectification, d'effacement et d'opposition sur ses données. La politique de confidentialité du site détaille ces droits et la façon de les exercer.

# Article 11 — Licence éditeur et mentions légales

Le Tournoi est organisé sous le régime de la licence communautaire pour petits tournois mise à disposition par Riot Games pour le jeu Teamfight Tactics. Il respecte les plafonds et conditions de cette licence (organisateur non commercial, dotation limitée, absence d'activation de marque).

Mention obligatoire : « Ce tournoi n'est ni organisé ni soutenu par Riot Games, Inc. Teamfight Tactics est une marque déposée de Riot Games, Inc. Tous droits réservés. »

# Article 12 — Acceptation et modifications du règlement

- L'inscription au Tournoi vaut acceptation pleine et entière du présent règlement.
- EDS se réserve le droit de modifier le règlement jusqu'au début du Tournoi. Toute modification fera l'objet d'une notification aux participants inscrits via Discord.
- Toute situation non prévue par le présent règlement sera tranchée par le staff EDS, dans le respect de l'équité sportive et de l'esprit de la compétition.
- La version de référence du règlement est celle publiée à l'adresse {{adresse du règlement}}.
$reglement$) ON CONFLICT ("name") DO NOTHING;
