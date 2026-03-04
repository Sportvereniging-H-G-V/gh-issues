# GitHub Issues – Sportvereniging H.G.V.

Simpele pagina om GitHub issues aan te maken voor geselecteerde repositories van de organisatie **Sportvereniging-H-G-V**.

## Vereisten

- Node.js (v16+)
- Een GitHub token (`GITHUB_TOKEN`) met voldoende rechten om issues aan te maken
  - Bij voorkeur van een apart bot-account
  - Scopes: minimaal `repo` voor de betreffende organisatie-repositories

## Cloudflare Pages deployment

Deze repo is voorbereid om via **Cloudflare Pages** te draaien:

- De statische frontend staat in `public`.
- De backend-API draait als **Pages Functions** in de map `functions/`:
  - `GET /api/repos` – lijst van repos in de organisatie.
  - `GET /api/templates` – de drie issue-templates (naam, titelprefix, body + secties).
  - `GET /api/repos/:repo/issues` – lijst van issues in die repo (open + gesloten).
  - `POST /api/issues` – maakt een issue aan in de gekozen repo.

### Benodigde secrets/vars in Cloudflare Pages

In het Cloudflare Pages project:

- Zet een Pages **Environment variable** of **Secret**:
  - `GITHUB_TOKEN` – zelfde token als lokaal gebruikt.

De organisatie (`ORG`) en de toegestane repositories (`REPO_ALLOWLIST`) staan in `functions/_config.js`.

### Koppelen in het Cloudflare dashboard

1. Maak een nieuw **Pages project** aan en koppel het aan deze GitHub-repository.
2. Build settings:
   - **Build command**: leeg laten (of `npm install` als je Wrangler lokaal nodig hebt, maar is voor Pages zelf niet nodig).
   - **Build output directory**: `public`
3. Framework preset: **None**.
4. Voeg de omgevingvariabele `GITHUB_TOKEN` toe.
5. Deploy. De routes `/`, `/:repo` en `/api/*` werken dan via Cloudflare Pages + Functions.

### Lokaal testen met Cloudflare Pages

Voor lokaal testen kun je Wrangler gebruiken (Node wordt alleen hiervoor gebruikt, niet in productie):

```bash
npm install
npm run pages:dev
```

Dit start een lokale Pages-omgeving op `http://127.0.0.1:8788` met:

- de statische site uit `public/`
- de API-routes uit `functions/`

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

