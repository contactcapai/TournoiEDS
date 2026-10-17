-- Modèle TFT : `{{places}}` porte désormais son unité (« 16 joueurs », « 8 équipes de 2 joueurs »),
-- et le barème dit la règle du moteur : le 1er marque autant de points qu'il y a de joueurs au lobby.
-- Ne touche que le texte d'origine ; les règlements déjà copiés dans un tournoi ne bougent pas.
UPDATE "rules_template"
SET "body" = replace(replace(replace(replace(
  "body",
  '- Capacité : {{places}} joueurs maximum',
  '- Capacité : {{places}} maximum'),
  'Les inscriptions sont closes dès que {{places}} joueurs sont inscrits,',
  'Les inscriptions sont closes dès que toutes les places ({{places}}) sont prises,'),
  E'- 1er : 8 points\n- 2e : 7 points\n- 3e : 6 points\n- 4e : 5 points\n- 5e : 4 points\n- 6e : 3 points\n- 7e : 2 points\n- 8e : 1 point',
  E'À chaque manche, le 1er marque autant de points qu''il y a de joueurs dans son lobby, et chaque place en dessous un point de moins, jusqu''à 1 point pour le dernier :\n\n- lobby de 8 : 8 points au 1er, 7 au 2e… 1 point au 8e ;\n- lobby de 7 : 7 points au 1er, 6 au 2e… 1 point au 7e.'),
  '(+8 pts, total 27)',
  '(+8 pts dans un lobby de 8, total 27)'),
"updated_at" = now()
WHERE "name" = 'Règlement TFT EDS'
  AND "body" LIKE '%- 1er : 8 points%';
