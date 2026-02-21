# GitHub Issues – Sportvereniging H.G.V.

Simpele pagina om GitHub issues aan te maken voor alle repositories van de organisatie **Sportvereniging-H-G-V**.

## Vereisten

- Node.js (v16+)
- [GitHub CLI (`gh`)](https://cli.github.com/) geïnstalleerd en ingelogd:
  ```bash
  gh auth login
  ```

## Starten

```bash
cd gh-issues-creator
npm install
npm start
```

Open daarna in je browser: **http://localhost:3333**

## Gebruik

1. **Homepage** – Op de startpagina staat uitleg en een overzicht van alle repositories. Klik op een repository om naar de bijbehorende pagina te gaan.
2. **Repopagina** – Per repository kun je:
   - **Nieuw issue aanmaken**: kies één van de drie templates (Content wijziging, Technisch probleem, Nieuwe functie). Het formulier wordt ingevuld met de bijbehorende vragen; pas aan en verstuur.
   - **Bestaande issues bekijken**: onder het formulier staat een lijst van open en gesloten issues met links naar GitHub.

De templates staan in `.github/ISSUE_TEMPLATE/` en worden automatisch aangeboden bij het aanmaken van een issue.

## API

- `GET /api/repos` – lijst van repos in de organisatie (via `gh`)
- `GET /api/templates` – de drie issue-templates (naam, titelprefix, body)
- `GET /api/repos/:repo/issues` – lijst van issues in die repo (open + gesloten)
- `POST /api/issues` – body: `{ "repo": "naam-repo", "title": "...", "body": "..." }` – maakt een issue aan
