# UX & Design — Tournoi TFT EDS

## Charte graphique Esport des Sacres

### Couleurs principales

| Nom | HEX | RGB | Usage |
|-----|-----|-----|-------|
| Bleu nuit | `#29265B` | 41, 38, 91 | Couleur principale du logo, fonds sombres |
| Cyan clair | `#80E2ED` | 128, 226, 237 | Couleur d'accent, éléments interactifs |
| Gris bleuté | `#787C86` | 120, 124, 134 | Textes secondaires, bordures |
| Blanc bleuté | `#EDEFFD` | 237, 239, 253 | Fonds clairs, cartes |
| Ocre / Or | `#DAB265` | 218, 178, 101 | Accents, mise en avant (1ère place, titres) |
| Blanc | `#FFFFFF` | 255, 255, 255 | Fonds, textes sur fond sombre |

### Typographies

- **Titres** : Bebas Neue Bold (capitales, impact fort)
- **Sous-titres** : Bebas Neue Regular
- **Corps de texte** : Roboto Regular / Italic / Bold
- Les deux polices sont disponibles sur Google Fonts

### Identité visuelle

- Style à mi-chemin entre univers esport (punch, mouvement) et identité propre EDS
- Éléments graphiques : brush strokes, motifs en losange, habillages vectoriels avec découpage/décalage
- Texturing pour donner du relief aux visuels
- Textes titres soulignés ou mis en contour pour un repérage rapide
- Pictogrammes toujours aux couleurs EDS (sauf logos partenaires)

## Direction UX pour le site tournoi

### Ambiance générale

- **Dark mode** par défaut (fond bleu nuit `#29265B` ou très sombre)
- Ambiance esport / gaming, mais propre et lisible
- Les couleurs d'accent (cyan `#80E2ED`, ocre `#DAB265`) servent à guider l'œil sur les éléments importants
- Sobre sur le contenu, impactant sur les titres

### Page 1 — Présentation + Inscription

- Hero section avec le nom du tournoi en Bebas Neue Bold, gros titre
- Infos essentielles visibles immédiatement : dates, format, cash prize
- Formulaire d'inscription simple et visible (3 champs : pseudo Discord, pseudo Riot, email)
- CTA clair pour s'inscrire
- Règlement accessible (accordéon ou lien)

### Page 2 — Tableau des résultats (qualifications)

- C'est la page la plus importante visuellement, elle sera affichée pendant le cast
- **Tableau lisible** : lignes alternées (`bg-white/5`), bonne lisibilité même à distance (taille de police généreuse, `font-body`)
- **Structure de colonnes** (implémentée dans `components/ranking/RankingTable.tsx`) :
  - Colonnes fixes (sticky à gauche pour rester visibles au scroll horizontal) : **Rang**, **Pseudo**, **Total**
  - Colonnes dynamiques regroupées par journée : **Journée 1 → R1 Place / R1 Pts / R2 Place / R2 Pts…**, **Journée 2 → R1 Place / R1 Pts…**
  - Colonnes finales : **Moy**, **Top 1**, **Top 4**, **Dern.**
- **En-tête à 3 niveaux** : ligne "Journée N" (en `text-eds-gold`, colSpan = nbRounds × 2) / ligne "R1 R2 R3" / ligne "Place / Pts"
- **Séparateur visuel entre journées** : bordure gauche `border-l-2 border-l-eds-gold/60` sur la première colonne de chaque nouvelle journée
- **Mise en valeur du Top 8** : bordure gauche cyan (`border-l-2 border-eds-cyan`) sur les lignes rang ≤ 8, rang affiché en `text-eds-cyan`, séparateur doré (ligne 2 px `bg-eds-gold/60`) entre le rang 8 et le rang 9
- **Joueurs droppés** : ligne en `opacity-40 text-eds-gray`, pseudo en `line-through` — score conservé dans le classement
- Le tableau doit être responsive — optimisé en priorité pour un affichage desktop/stream (16:9) mais utilisable sur mobile grâce aux sticky columns (Rang / Pseudo / Total restent visibles pendant le scroll des colonnes de rounds)

### Page 3 — Finale

- Réutilise le même pattern `RankingTable` que la page Qualifications (mêmes couleurs, sticky columns, lignes alternées), adapté à 8 joueurs
- En finale il n'y a qu'une seule "journée" donc le regroupement par journée peut être simplifié (un seul `DayGroup` dans la structure)
- Mise en avant de la condition de victoire : barre de progression ou indicateur (points ≥ 20 + top 1)
- Quand un joueur remplit la condition → animation ou mise en valeur forte (ocre/or `#DAB265`)
- Affichage du cash prize à côté du classement final

### Backoffice

- UX sobre et fonctionnelle (pas besoin d'être beau, doit être rapide)
- La saisie des placements est l'action principale : doit pouvoir se faire très vite (dropdown ou clic rapide)
- Vue d'ensemble d'un round : voir tous les lobbies + tous les joueurs d'un coup
- Gros boutons pour les actions clés : "Générer les lobbies", "Valider le round", "Marquer drop"

### Responsive

- Priorité desktop (le cast et l'orga sont sur PC)
- Le site public doit rester consultable sur mobile (joueurs qui vérifient les résultats sur leur téléphone)
- Le backoffice peut être desktop-only
