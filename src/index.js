import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ORG } from './config.js';
import { listRepos, listIssues, createIssue, isRepoAllowed, defaultLabelsForTemplateId } from './github.js';
import { getTemplates } from './templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// env-object leest GITHUB_TOKEN uit process.env
const env = { get GITHUB_TOKEN() { return process.env.GITHUB_TOKEN; } };

app.use(express.json());

// GET /api/repos
app.get('/api/repos', async (_req, res) => {
  try {
    res.json(await listRepos(env));
  } catch {
    res.status(500).json({ error: 'Kon repos niet ophalen' });
  }
});

// GET /api/templates
app.get('/api/templates', (_req, res) => {
  try {
    res.json(getTemplates());
  } catch {
    res.status(500).json({ error: 'Templates laden mislukt' });
  }
});

// POST /api/issues
app.post('/api/issues', async (req, res) => {
  const { repo, title, body: issueBody, labels, assignees, templateId } = req.body || {};

  if (!repo || !title) {
    return res.status(400).json({ error: 'repo en title zijn verplicht' });
  }

  const fullRepo = repo.includes('/') ? repo : `${ORG}/${repo}`;

  try {
    if (!isRepoAllowed(fullRepo)) {
      return res.status(403).json({ error: 'Issues aanmaken in deze repository is niet toegestaan' });
    }

    let effectiveLabels = Array.isArray(labels) ? labels.slice() : [];
    if (effectiveLabels.length === 0 && templateId) {
      const defaults = defaultLabelsForTemplateId(templateId);
      if (defaults && defaults.length) effectiveLabels = defaults;
    }

    const payload = { title, body: issueBody || '' };
    if (effectiveLabels.length > 0) payload.labels = effectiveLabels;
    if (Array.isArray(assignees) && assignees.length > 0) payload.assignees = assignees;

    const issue = await createIssue(env, fullRepo, payload);
    res.json({ ok: true, url: issue.html_url, number: issue.number, issue });
  } catch {
    res.status(500).json({ error: 'Issue aanmaken mislukt' });
  }
});

// GET /api/repos/:repo/issues
app.get('/api/repos/:repo/issues', async (req, res) => {
  const repo = decodeURIComponent(req.params.repo);
  const fullRepo = repo.includes('/') ? repo : `${ORG}/${repo}`;

  try {
    if (!isRepoAllowed(fullRepo)) {
      return res.status(403).json({ error: 'Toegang tot deze repository is niet toegestaan' });
    }
    res.json(await listIssues(env, fullRepo));
  } catch {
    res.status(500).json({ error: 'Issues ophalen mislukt' });
  }
});

// Statische bestanden uit de Vite build
app.use(express.static(join(__dirname, '../dist')));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server draait op poort ${PORT}`);
});
