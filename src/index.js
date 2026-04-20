import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getTemplates } from './templates.js';
import { PROJECTS } from './config.js';

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

// GET /api/projects — hardcoded project-lijst (onafhankelijk van externe API's)
app.get('/api/projects', (_req, res) => {
  res.json(PROJECTS.map(({ projectKey, name, image, favicon }) => ({ projectKey, name, image, favicon })));
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

  const configProject = PROJECTS.find((p) => p.projectKey === projectKey);
  if (!configProject) {
    return res.status(400).json({ error: 'Kies een geldig project' });
  }

  let selectedProjectId;
  const projectLabel = configProject.name;
  try {
    const companyProjects = await fetchPaperclipProjects();
    const match = companyProjects.find(
      (p) => !p.archivedAt && typeof p.urlKey === 'string' && p.urlKey.trim() === projectKey
    );
    if (match) {
      if (typeof match.id !== 'string' || !match.id.trim()) {
        return res.status(500).json({ error: 'Project-ID ongeldig' });
      }
      selectedProjectId = match.id;
    }
  } catch {
    // Paperclip niet bereikbaar — issue wordt aangemaakt zonder projectId
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
      ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
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

// ─── SportHengelo public intake ──────────────────────────────────────────────

const SPORTHENGELO_ORIGIN = 'https://sporthengelo.nl';
const INTAKE_ALLOWED_CATEGORIES = new Set(['regulier', 'aangepast', 'weet_ik_niet']);
const INTAKE_CATEGORY_LABELS = { regulier: 'Regulier', aangepast: 'Aangepast', weet_ik_niet: 'Weet ik niet' };

// Simple in-memory rate limiter: max 10 requests per IP per 15 minutes
const intakeRateMap = new Map();
function checkIntakeRate(ip) {
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const limit = 10;
  const entry = intakeRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    intakeRateMap.set(ip, { count: 1, resetAt: now + window });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of intakeRateMap.entries()) {
    if (now > val.resetAt) intakeRateMap.delete(key);
  }
}, 30 * 60 * 1000).unref();

function setCorsSporthengelo(res) {
  res.set('Access-Control-Allow-Origin', SPORTHENGELO_ORIGIN);
  res.set('Vary', 'Origin');
}

app.options('/api/intake/sporthengelo', (req, res) => {
  if (req.headers['origin'] === SPORTHENGELO_ORIGIN) {
    setCorsSporthengelo(res);
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '86400');
  }
  res.status(204).end();
});

app.post('/api/intake/sporthengelo', async (req, res) => {
  if (req.headers['origin'] === SPORTHENGELO_ORIGIN) setCorsSporthengelo(res);

  const intakeToken = process.env.INTAKE_TOKEN_SPORTHENGELO;
  if (!intakeToken) {
    console.error('[sporthengelo intake] INTAKE_TOKEN_SPORTHENGELO niet geconfigureerd');
    return res.status(503).json({ error: 'Service niet geconfigureerd' });
  }

  const authHeader = req.headers['authorization'] ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!bearerToken || bearerToken !== intakeToken) {
    return res.status(401).json({ error: 'Ongeautoriseerd' });
  }

  if (!checkIntakeRate(req.ip)) {
    return res.status(429).json({ error: 'Te veel verzoeken, probeer het later opnieuw' });
  }

  const { sport_naam, categorie, contactpersoon, omschrijving } = req.body ?? {};

  if (typeof sport_naam !== 'string' || !sport_naam.trim() || sport_naam.length > 256) {
    return res.status(400).json({ error: 'Naam sport of vereniging is verplicht (max. 256 tekens)' });
  }
  if (typeof categorie !== 'string' || !INTAKE_ALLOWED_CATEGORIES.has(categorie)) {
    return res.status(400).json({ error: 'Kies een geldige categorie' });
  }
  if (typeof omschrijving !== 'string' || !omschrijving.trim() || omschrijving.length > 10_000) {
    return res.status(400).json({ error: 'Omschrijving is verplicht (max. 10.000 tekens)' });
  }
  const safeContactpersoon = typeof contactpersoon === 'string' ? contactpersoon.slice(0, 256).trim() : '';

  const { PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID, PAPERCLIP_HELPDESK_AGENT_ID, configured } =
    paperclipIntakeEnv();
  if (!configured) {
    console.error('[sporthengelo intake] Paperclip omgevingsvariabelen ontbreken');
    return res.status(503).json({ error: 'Service tijdelijk niet beschikbaar' });
  }

  let projectId;
  try {
    const projects = await fetchPaperclipProjects();
    const match = projects.find((p) => !p.archivedAt && p.urlKey === 'sporthengelo');
    if (match) projectId = match.id;
  } catch {
    // Proceed without projectId
  }

  const description = [
    'Nieuwe melding via het SportHengelo contactformulier.',
    '',
    '## Naam sport of vereniging',
    sport_naam.trim(),
    '',
    '## Categorie',
    INTAKE_CATEGORY_LABELS[categorie] ?? categorie,
    '',
    '## Contactpersoon',
    safeContactpersoon || '_Niet opgegeven_',
    '',
    '## Omschrijving',
    omschrijving.trim(),
  ].join('\n');

  try {
    const payload = {
      title: `[SportHengelo] Melding: ${sport_naam.trim()}`,
      description,
      assigneeAgentId: PAPERCLIP_HELPDESK_AGENT_ID,
      ...(projectId ? { projectId } : {}),
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
      console.error('[sporthengelo intake] Paperclip API', paperclipRes.status, errText);
      return res.status(500).json({ error: 'Issue aanmaken mislukt' });
    }

    const issue = await paperclipRes.json();
    res.json({ ok: true, identifier: issue.identifier });
  } catch (err) {
    console.error('[sporthengelo intake]', err);
    res.status(500).json({ error: 'Issue aanmaken mislukt' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

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
