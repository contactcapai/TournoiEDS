-- Le départage de l'article 4.4 n'était pas celui du moteur (`classer`, lib/tournoi/classement.ts) :
-- points, puis nombre de top 1, puis places en moitié haute, puis dernier résultat.
-- Ne touche que le texte d'origine : un modèle retouché à la main n'est pas réécrit.
UPDATE "rules_template"
SET "body" = replace(
  "body",
  E'- Meilleur placement moyen sur l''ensemble des manches jouées ;\n- Meilleur placement sur la dernière manche disputée ;\n- Tirage au sort par le staff EDS, en dernier recours.',
  E'- Nombre de premières places ;\n- Nombre de places dans la première moitié du lobby (le top 4 dans un lobby de 8) ;\n- Meilleur placement sur la dernière manche disputée.'
),
"updated_at" = now()
WHERE "name" = 'Règlement TFT EDS'
  AND "body" LIKE '%Meilleur placement moyen sur l''ensemble des manches jouées ;%';
