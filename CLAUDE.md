# ClientHub
CRM + activity tracker. Spec: docs/ClientHub_CRM_spec.md

## Arhitectură
Urmează STRICT convențiile din docs/CONVENTIONS.md
(preluate din proiectul AdProfit). Nu inventa pattern-uri noi
pentru probleme deja rezolvate acolo.

## Reguli
- Toate tabelele au RLS. Rulează npm run test:rls după orice migrare.
- Arată-mi SQL-ul de migrare înainte de aplicare.
- Costurile și sumele: net, fără TVA. Datele: DD.MM.YYYY. UI: română cu diacritice.