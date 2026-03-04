# GitHub Issues – Sportvereniging H.G.V.

Simpele pagina om GitHub issues aan te maken voor geselecteerde repositories van de organisatie **Sportvereniging-H-G-V**.

## Vereisten

- Node.js (v16+)
- Een GitHub token (`GITHUB_TOKEN`) met voldoende rechten om issues aan te maken
  - Bij voorkeur van een apart bot-account
  - Scopes: minimaal `repo` voor de betreffende organisatie-repositories

## Configuratie

- De organisatie en toegestane repositories staan in `server.js`:
  - `ORG` – standaard `Sportvereniging-H-G-V`
  - `REPO_ALLOWLIST` – array met repo-namen of full-names  
    Laat je deze leeg (`[]`), dan worden alle repos uit de organisatie opgehaald.

Voorbeeld:

```js
const ORG = 'Sportvereniging-H-G-V';
const REPO_ALLOWLIST = [
  'website',
  'backend',
  'Sportvereniging-H-G-V/speciale-repo',
];
```

## Starten

1. Kopieer `.env.example` naar `.env` en vul je token in:

   ```bash
   cp .env.example .env
   # vervolgens GITHUB_TOKEN invullen in .env
   ```

2. Installeer en start de app:

   ```bash
   cd gh-issues-creator
   npm install
   npm start
   ```

Open daarna in je browser: **http://localhost:3333**

## Gebruik

1. **Homepage** – Op de startpagina staat uitleg en een overzicht van de toegestane repositories. Klik op een repository om naar de bijbehorende pagina te gaan.
2. **Repopagina** – Per repository kun je:
   - **Nieuw issue aanmaken** met één van de drie templates (Content wijziging, Technisch probleem, Nieuwe functie).
   - **Bestaande issues bekijken** (open en gesloten) met links naar GitHub.

De templates staan in `.github/ISSUE_TEMPLATE/` en worden automatisch aangeboden bij het aanmaken van een issue.

## API

- `GET /api/repos` – lijst van repos in de organisatie (via GitHub REST API; gefilterd op `REPO_ALLOWLIST` uit `server.js`)
- `GET /api/templates` – de drie issue-templates (naam, titelprefix, body)
- `GET /api/repos/:repo/issues` – lijst van issues in die repo (open + gesloten)
- `POST /api/issues` – body:

  ```json
  {
    "repo": "naam-repo-of-fullname",
    "title": "Titel",
    "body": "Beschrijving",
    "labels": ["bug"],
    "assignees": ["github-gebruiker"]
  }
  ```

  Maakt een issue aan met optionele labels en assignees.

