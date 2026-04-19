import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getTemplates } from './templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

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

function validateOrigin(req, res) {
  const origin = req.headers['origin'];
  if (!origin) return false; // non-browser clients (curl, server-to-server) have no Origin
  const requestOrigin = `${req.protocol}://${req.get('host')}`;
  if (origin !== requestOrigin) {
    res.status(403).json({ error: 'Forbidden' });
    return true;
  }
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function allowedCategoryIds() {
  return new Set(getTemplates().map((t) => t.id));
}

function paperclipIntakeEnv() {
  const {
    PAPERCLIP_API_URL,
    PAPERCLIP_API_KEY,
    PAPERCLIP_COMPANY_ID,
    PAPERCLIP_HELPDESK_AGENT_ID,
  } = process.env;
  const configured =
    PAPERCLIP_API_URL && PAPERCLIP_API_KEY && PAPERCLIP_COMPANY_ID && PAPERCLIP_HELPDESK_AGENT_ID;
  return { PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID, PAPERCLIP_HELPDESK_AGENT_ID, configured };
}

async function fetchPaperclipProjects() {
  const { PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID, configured } = paperclipIntakeEnv();
  if (!configured) return [];
  const res = await fetch(`${PAPERCLIP_API_URL}/api/companies/${PAPERCLIP_COMPANY_ID}/projects`, {
    headers: { Authorization: `Bearer ${PAPERCLIP_API_KEY}` },
  });
  if (!res.ok) {
    const t = await res.text();
    console.error('[Paperclip projects]', res.status, t);
    throw new Error('projects_fetch_failed');
  }
  return res.json();
}

// GET /api/templates
app.get('/api/templates', (_req, res) => {
  try {
    res.json(getTemplates());
  } catch {
    res.status(500).json({ error: 'Templates laden mislukt' });
  }
});

// GET /api/projects — actieve Paperclip-projecten (voor project-selector)
app.get('/api/projects', async (_req, res) => {
  try {
    if (!paperclipIntakeEnv().configured) {
      return res.json([
        {
          projectKey: '__no_paperclip__',
          name: 'Lokaal testen (geen Paperclip-koppeling)',
        },
      ]);
    }
    const list = await fetchPaperclipProjects();
    const projects = list
      .filter(
        (p) =>
          p &&
          typeof p.id === 'string' &&
          typeof p.urlKey === 'string' &&
          p.urlKey.trim() &&
          !p.archivedAt
      )
      .map((p) => ({
        projectKey: p.urlKey.trim(),
        name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : p.urlKey,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'nl'));
    res.json(projects);
  } catch {
    res.status(500).json({ error: 'Projecten laden mislukt' });
  }
});

// POST /api/issues — Paperclip-intake (body: title, body, email, category, projectKey)
app.post('/api/issues', async (req, res) => {
  if (validateOrigin(req, res)) return;

  const { title, body: issueBody, email, category, projectKey: projectKeyRaw } = req.body || {};

  if (typeof title !== 'string' || title.trim().length === 0 || title.length > 256) {
    return res.status(400).json({ error: 'Titel is verplicht en mag maximaal 256 tekens bevatten' });
  }
  const safeBody = typeof issueBody === 'string' ? issueBody.slice(0, 65_536) : '';
  if (!safeBody.trim()) {
    return res.status(400).json({ error: 'Omschrijving is verplicht' });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Geldig e-mailadres is verplicht' });
  }
  if (typeof category !== 'string' || !allowedCategoryIds().has(category)) {
    return res.status(400).json({ error: 'Kies een geldige categorie' });
  }

  const { PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID, PAPERCLIP_HELPDESK_AGENT_ID, configured } =
    paperclipIntakeEnv();

  if (!configured) {
    console.error('[intake] Paperclip server-omgeving ontbreekt — intake geweigerd');
    return res.status(503).json({ error: 'Service tijdelijk niet beschikbaar. Probeer het later opnieuw.' });
  }

  if (typeof projectKeyRaw !== 'string' || !projectKeyRaw.trim()) {
    return res.status(400).json({ error: 'Kies een geldig project' });
  }
  const projectKey = projectKeyRaw.trim();

  let selectedProjectId;
  let projectLabel = projectKey;
  try {
    const companyProjects = await fetchPaperclipProjects();
    const match = companyProjects.find(
      (p) => !p.archivedAt && typeof p.urlKey === 'string' && p.urlKey.trim() === projectKey
    );
    if (!match) {
      return res.status(400).json({ error: 'Kies een geldig project' });
    }
    if (typeof match.id !== 'string' || !match.id.trim()) {
      return res.status(500).json({ error: 'Project-ID ongeldig' });
    }
    selectedProjectId = match.id;
    projectLabel =
      typeof match.name === 'string' && match.name.trim() ? match.name.trim() : match.urlKey || projectKey;
  } catch {
    return res.status(500).json({ error: 'Projecten valideren mislukt' });
  }

  const description = [
    safeBody,
    '',
    '---',
    '',
    `**E-mail melder:** ${email.trim()}`,
    `**Categorie:** ${category}`,
    `**Project:** ${projectLabel}`,
  ].join('\n');

  try {
    const payload = {
      title: title.trim(),
      description,
      assigneeAgentId: PAPERCLIP_HELPDESK_AGENT_ID,
      projectId: selectedProjectId,
    };

    const paperclipRes = await fetch(
      `${PAPERCLIP_API_URL}/api/companies/${PAPERCLIP_COMPANY_ID}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAPERCLIP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!paperclipRes.ok) {
      const errText = await paperclipRes.text();
      console.error('[Paperclip API]', paperclipRes.status, errText);
      return res.status(500).json({ error: 'Issue aanmaken bij Paperclip mislukt' });
    }

    const issue = await paperclipRes.json();
    res.json({ ok: true, identifier: issue.identifier });
  } catch (err) {
    console.error('[Issue aanmaken]', err);
    res.status(500).json({ error: 'Issue aanmaken mislukt' });
  }
});

app.use(express.static(join(__dirname, '../dist')));

app.get('/{*splat}', (_req, res) => {
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'"
  );
  res.sendFile(join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server draait op poort ${PORT}`);
});
