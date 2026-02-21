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

1. Kies een repository uit de dropdown (repos worden via `gh repo list Sportvereniging-H-G-V` opgehaald).
2. Vul een **titel** in (verplicht).
3. Optioneel: vul een **beschrijving** in.
4. Klik op **Issue aanmaken**. Het issue wordt via `gh issue create` in de gekozen repo aangemaakt.

## API

- `GET /api/repos` – lijst van repos in de organisatie (via `gh`)
- `POST /api/issues` – body: `{ "repo": "naam-repo", "title": "...", "body": "..." }` – maakt een issue aan
