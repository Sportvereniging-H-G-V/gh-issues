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
  if (!origin) return false;
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

// GET /api/templates
app.get('/api/templates', (_req, res) => {
  try {
    res.json(getTemplates());
  } catch {
    res.status(500).json({ error: 'Templates laden mislukt' });
  }
});

// POST /api/issues — Paperclip-intake (body: title, body, email, category)
app.post('/api/issues', async (req, res) => {
  if (validateOrigin(req, res)) return;

  const { title, body: issueBody, email, category } = req.body || {};

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

  const {
    PAPERCLIP_API_URL,
    PAPERCLIP_API_KEY,
    PAPERCLIP_COMPANY_ID,
    PAPERCLIP_PROJECT_ID,
    PAPERCLIP_HELPDESK_AGENT_ID,
  } = process.env;

  if (!PAPERCLIP_API_URL || !PAPERCLIP_API_KEY || !PAPERCLIP_COMPANY_ID || !PAPERCLIP_HELPDESK_AGENT_ID) {
    console.error('Paperclip env vars niet geconfigureerd');
    return res.status(500).json({ error: 'Server configuratie ontbreekt' });
  }

  const description = [
    safeBody,
    '',
    '---',
    '',
    `**E-mail melder:** ${email.trim()}`,
    `**Categorie:** ${category}`,
  ].join('\n');

  try {
    const payload = {
      title: title.trim(),
      description,
      assigneeAgentId: PAPERCLIP_HELPDESK_AGENT_ID,
    };
    if (PAPERCLIP_PROJECT_ID) payload.projectId = PAPERCLIP_PROJECT_ID;

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
