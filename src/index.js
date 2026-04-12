import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ORG } from './config.js';
import { listRepos, listIssues, createIssue, isRepoAllowed, defaultLabelsForTemplateId } from './github.js';
import { getTemplates } from './templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
// Eén reverse-proxy-hop (Coolify/nginx): X-Forwarded-* voor protocol/host
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// env-object leest GITHUB_TOKEN uit process.env
const env = { get GITHUB_TOKEN() { return process.env.GITHUB_TOKEN; } };

// Security headers op alle responses
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  });
  next();
});

app.use(express.json());

// CSRF-bescherming: blokkeer cross-origin POST-verzoeken op basis van de Origin header.
function validateOrigin(req, res) {
  const origin = req.headers['origin'];
  if (!origin) return false; // geen browser / same-origin zonder Origin header
  const requestOrigin = `${req.protocol}://${req.get('host')}`;
  if (origin !== requestOrigin) {
    res.status(403).json({ error: 'Forbidden' });
    return true;
  }
  return false;
}

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
  if (validateOrigin(req, res)) return;

  const { repo, title, body: issueBody, labels, assignees, templateId } = req.body || {};

  // Input validatie
  if (typeof repo !== 'string' || !/^[\w.\-]+(\/[\w.\-]+)?$/.test(repo.trim())) {
    return res.status(400).json({ error: 'Ongeldige repository naam' });
  }
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > 256) {
    return res.status(400).json({ error: 'Titel is verplicht en mag maximaal 256 tekens bevatten' });
  }

  const safeBody = typeof issueBody === 'string' ? issueBody.slice(0, 65_536) : '';
  const safeLabels = Array.isArray(labels)
    ? labels.filter((l) => typeof l === 'string' && l.length > 0 && l.length <= 100)
    : [];
  const safeAssignees = Array.isArray(assignees)
    ? assignees.filter((a) => typeof a === 'string' && /^[\w\-]{1,100}$/.test(a))
    : [];

  const fullRepo = repo.trim().includes('/') ? repo.trim() : `${ORG}/${repo.trim()}`;

  try {
    if (!isRepoAllowed(fullRepo)) {
      return res.status(403).json({ error: 'Issues aanmaken in deze repository is niet toegestaan' });
    }

    let effectiveLabels = safeLabels.slice();
    if (effectiveLabels.length === 0 && templateId) {
      const defaults = defaultLabelsForTemplateId(templateId);
      if (defaults && defaults.length) effectiveLabels = defaults;
    }

    const payload = { title: title.trim(), body: safeBody };
    if (effectiveLabels.length > 0) payload.labels = effectiveLabels;
    if (safeAssignees.length > 0) payload.assignees = safeAssignees;

    const issue = await createIssue(env, fullRepo, payload);
    res.json({ ok: true, url: issue.html_url, number: issue.number, issue });
  } catch {
    res.status(500).json({ error: 'Issue aanmaken mislukt' });
  }
});

// GET /api/repos/:repo/issues
app.get('/api/repos/:repo/issues', async (req, res) => {
  try {
    const repo = decodeURIComponent(req.params.repo);
    const fullRepo = repo.includes('/') ? repo : `${ORG}/${repo}`;

    if (!isRepoAllowed(fullRepo)) {
      return res.status(403).json({ error: 'Toegang tot deze repository is niet toegestaan' });
    }
    const rc = req.query.recentClosed;
    const recentClosed = rc === '1' || String(rc).toLowerCase() === 'true';
    res.json(await listIssues(env, fullRepo, { recentClosed }));
  } catch (err) {
    if (err instanceof URIError) {
      return res.status(400).json({ error: 'Ongeldige repository-parameter' });
    }
    res.status(500).json({ error: 'Issues ophalen mislukt' });
  }
});

// Statische bestanden uit de Vite build
app.use(express.static(join(__dirname, '../dist')));

// SPA fallback — stuur ook de CSP mee voor HTML
app.get('*', (_req, res) => {
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'"
  );
  res.sendFile(join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server draait op poort ${PORT}`);
});
