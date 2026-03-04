require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3333;

// GitHub-configuratie: deze kun je in de codebase aanpassen
const ORG = 'Sportvereniging-H-G-V';
// Namen of full-names. Laat leeg ([]) voor alle repos.
const REPO_ALLOWLIST = [
  'hgvhengelo',
  'apenkooitoernooi',
  'hgv-signing',
  'presentielijst-generator',
  'dansstudiohengelo',
  'turnenhengelo',
];

// Alleen het token komt uit de omgeving (.env)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const TEMPLATES_DIR = path.join(__dirname, '.github', 'ISSUE_TEMPLATE');

if (!GITHUB_TOKEN) {
  // Zonder token kan de server geen GitHub-requests doen; vroegtijdig falen is duidelijker
  console.warn('Waarschuwing: GITHUB_TOKEN is niet gezet. GitHub API-calls zullen falen.');
}

app.use(cors());
app.use(express.json());

// API-routes vóór static, zodat /api/* altijd JSON krijgt
function isRepoAllowed(repoIdentifier) {
  if (!REPO_ALLOWLIST || REPO_ALLOWLIST.length === 0) {
    return true;
  }
  if (!repoIdentifier || typeof repoIdentifier !== 'string') {
    return false;
  }

  const trimmed = repoIdentifier.trim();
  const fullName = trimmed.includes('/') ? trimmed : `${ORG}/${trimmed}`;
  const shortName = trimmed.includes('/') ? trimmed.split('/')[1] : trimmed;

  return (
    REPO_ALLOWLIST.includes(shortName) ||
    REPO_ALLOWLIST.includes(fullName)
  );
}

async function githubRequest(method, apiPath, body) {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN ontbreekt in de omgeving');
  }
  const res = await fetch(`https://api.github.com${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'hgv-issues-tool',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = text;
    }
  }

  if (!res.ok) {
    const msg = data && data.message ? data.message : text || `status ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

/** Body van een template splitsen in secties (## Kop + inhoud) */
function parseTemplateSections(body) {
  const sections = [];
  const blocks = body.split(/\n\s*##\s*/).filter((b) => b.trim());
  for (let i = 0; i < blocks.length; i++) {
    let block = blocks[i].trim();
    if (i === 0 && block.startsWith('##')) block = block.replace(/^#+\s*/, '');
    const firstNewline = block.indexOf('\n');
    const heading = firstNewline === -1 ? block.trim() : block.slice(0, firstNewline).trim();
    const placeholder = firstNewline === -1 ? '' : block.slice(firstNewline + 1).trim();
    if (heading) sections.push({ heading, placeholder });
  }
  return sections;
}

/** Issue-templates inlezen (naam, titelprefix, body, secties) */
function loadTemplates() {
  const templates = [];
  const files = ['content-wijziging.md', 'technisch-probleem.md', 'nieuwe-functie.md'];
  for (const file of files) {
    const filePath = path.join(TEMPLATES_DIR, file);
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, 'utf8');
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!match) continue;
    const front = match[1];
    const body = match[2].trim();
    const nameMatch = front.match(/name:\s*(.+)/);
    const titleMatch = front.match(/title:\s*["']?([^"'\n]+)["']?/);
    const sections = parseTemplateSections(body);
    templates.push({
      id: file.replace('.md', ''),
      name: nameMatch ? nameMatch[1].trim() : file,
      titlePrefix: titleMatch ? titleMatch[1].trim() : '',
      body,
      sections,
    });
  }
  return templates;
}

/** Lijst repos in de organisatie (via GitHub API) */
app.get('/api/repos', async (req, res) => {
  try {
    const repos = await githubRequest(
      'GET',
      `/orgs/${encodeURIComponent(ORG)}/repos?per_page=100`
    );
    let mapped = repos.map((r) => ({
      name: r.name,
      description: r.description,
      url: r.html_url,
      full_name: r.full_name,
      avatarUrl: r.owner && r.owner.avatar_url,
    }));

    if (REPO_ALLOWLIST && REPO_ALLOWLIST.length > 0) {
      mapped = mapped.filter((r) => {
        return (
          REPO_ALLOWLIST.includes(r.name) ||
          REPO_ALLOWLIST.includes(r.full_name)
        );
      });
    }

    res.json(mapped);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: 'Kon repos niet ophalen',
      detail: e.message,
    });
  }
});

/** Issue-templates ophalen */
app.get('/api/templates', (req, res) => {
  try {
    const templates = loadTemplates();
    res.json(templates);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Templates laden mislukt', detail: e.message });
  }
});

/** Issues van een repo ophalen (via gh) */
app.get('/api/repos/:repo/issues', async (req, res) => {
  const repo = req.params.repo;
  const fullRepo = repo.includes('/') ? repo : `${ORG}/${repo}`;
  try {
    if (!isRepoAllowed(fullRepo)) {
      return res.status(403).json({
        error: 'Toegang tot deze repository is niet toegestaan',
      });
    }

    const [owner, repoName] = fullRepo.split('/');
    const issues = await githubRequest(
      'GET',
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repoName
      )}/issues?state=all&per_page=50`
    );
    const onlyIssues = issues.filter((i) => !i.pull_request);
    const mapped = onlyIssues.map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      url: i.html_url,
      createdAt: i.created_at,
    }));
    res.json(mapped);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: 'Issues ophalen mislukt',
      detail: e.message,
    });
  }
});

function defaultLabelsForTemplateId(id) {
  switch (id) {
    case 'content-wijziging':
      return ['content'];
    case 'technisch-probleem':
      return ['bug'];
    case 'nieuwe-functie':
      return ['enhancement'];
    default:
      return [];
  }
}

/** Issue aanmaken in gekozen repo (via GitHub API) */
app.post('/api/issues', async (req, res) => {
  const { repo, title, body, labels, assignees, templateId } = req.body;
  if (!repo || !title) {
    return res.status(400).json({
      error: 'repo en title zijn verplicht',
    });
  }
  const fullRepo = repo.includes('/') ? repo : `${ORG}/${repo}`;
  try {
    if (!isRepoAllowed(fullRepo)) {
      return res.status(403).json({
        error: 'Issues aanmaken in deze repository is niet toegestaan',
      });
    }

    const [owner, repoName] = fullRepo.split('/');

    let effectiveLabels = Array.isArray(labels) ? labels.slice() : [];
    if ((!effectiveLabels || effectiveLabels.length === 0) && templateId) {
      const defaults = defaultLabelsForTemplateId(templateId);
      if (defaults && defaults.length) {
        effectiveLabels = defaults;
      }
    }

    const payload = {
      title,
      body: body || '',
    };
    if (Array.isArray(effectiveLabels) && effectiveLabels.length > 0) {
      payload.labels = effectiveLabels;
    }
    if (Array.isArray(assignees) && assignees.length > 0) {
      payload.assignees = assignees;
    }

    const issue = await githubRequest(
      'POST',
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repoName
      )}/issues`,
      payload
    );

    res.json({
      ok: true,
      url: issue.html_url,
      number: issue.number,
      issue,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: 'Issue aanmaken mislukt',
      detail: e.message,
    });
  }
});

// Static bestanden (na API)
app.use(express.static(path.join(__dirname, 'public')));

// Pretty URLs voor repos, bv. /hgvhengelo
app.get('/:repo', (req, res, next) => {
  const repo = req.params.repo;
  if (!REPO_ALLOWLIST.includes(repo)) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'repo.html'));
});

// 404 fallback voor alles wat overblijft
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
  console.log(`Server op http://localhost:${PORT}`);
});
