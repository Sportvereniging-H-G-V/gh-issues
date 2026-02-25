const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3333;
const ORG = 'Sportvereniging-H-G-V';
const TEMPLATES_DIR = path.join(__dirname, '.github', 'ISSUE_TEMPLATE');

app.use(cors());
app.use(express.json());

// API-routes vóór static, zodat /api/* altijd JSON krijgt

function runGh(cmdString) {
  return new Promise((resolve, reject) => {
    exec(`gh ${cmdString}`, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || stdout || err.message));
      resolve(stdout.trim());
    });
  });
}

function runGhArgs(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('gh', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => { out += d; });
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(err || out || `exit ${code}`));
      resolve(out.trim());
    });
  });
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
    const aboutMatch = front.match(/about:\s*(.+)/);
    const titleMatch = front.match(/title:\s*["']?([^"'\n]+)["']?/);
    const labelMatch = front.match(/labels:\s*(.+)/);
    const sections = parseTemplateSections(body);
    templates.push({
      id: file.replace('.md', ''),
      name: nameMatch ? nameMatch[1].trim() : file,
      about: aboutMatch ? aboutMatch[1].trim() : '',
      titlePrefix: titleMatch ? titleMatch[1].trim() : '',
      label: labelMatch ? labelMatch[1].trim() : '',
      body,
      sections,
    });
  }
  return templates;
}

/** Lijst repos in de organisatie (via gh) */
app.get('/api/repos', async (req, res) => {
  try {
    const out = await runGh(
      `repo list ${ORG} --json name,description,url --limit 100`
    );
    const repos = JSON.parse(out);
    res.json(repos);
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

/** Lijst org-leden (voor toewijzen aan issue) */
app.get('/api/org-members', async (req, res) => {
  try {
    const out = await runGh(
      `api "orgs/${ORG}/members?per_page=100" -q '.[].login'`
    );
    const logins = out ? out.trim().split(/\s+/).filter(Boolean) : [];
    res.json(logins);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: 'Org-leden ophalen mislukt',
      detail: e.message,
    });
  }
});

/** Issues van een repo ophalen (via gh) */
app.get('/api/repos/:repo/issues', async (req, res) => {
  const repo = req.params.repo;
  const fullRepo = repo.includes('/') ? repo : `${ORG}/${repo}`;
  try {
    const out = await runGh(
      `issue list --repo ${fullRepo} --state all --limit 50 --json number,title,state,url,createdAt`
    );
    const issues = JSON.parse(out);
    res.json(issues);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: 'Issues ophalen mislukt',
      detail: e.message,
    });
  }
});

/** Issue aanmaken in gekozen repo (via GitHub API, zodat labels correct worden gezet) */
app.post('/api/issues', async (req, res) => {
  const { repo, title, body, label, assignees } = req.body;
  if (!repo || !title) {
    return res.status(400).json({
      error: 'repo en title zijn verplicht',
    });
  }
  const fullRepo = repo.includes('/') ? repo : `${ORG}/${repo}`;
  let bodyFile;
  try {
    if (body) {
      bodyFile = path.join(os.tmpdir(), `gh-issue-body-${Date.now()}.txt`);
      fs.writeFileSync(bodyFile, body, 'utf8');
    }
    const endpoint = `repos/${fullRepo}/issues`;
    const apiArgs = ['api', endpoint, '--method', 'POST', '-f', `title=${title}`];
    if (bodyFile) {
      apiArgs.push('-F', `body=@${bodyFile}`);
    }
    if (label) {
      const labels = String(label).split(',').map((l) => l.trim()).filter(Boolean);
      labels.forEach((l) => apiArgs.push('-F', `labels[]=${l}`));
    }
    if (assignees && Array.isArray(assignees) && assignees.length > 0) {
      assignees.forEach((login) => {
        if (login && String(login).trim()) apiArgs.push('-F', `assignees[]=${String(login).trim()}`);
      });
    }
    const out = await runGhArgs(apiArgs);
    if (bodyFile) try { fs.unlinkSync(bodyFile); } catch (_) {}
    let parsed;
    try {
      parsed = JSON.parse(out);
    } catch (_) {
      parsed = {};
    }
    const urlMatch = out.match(/https:\/\/github\.com\/[^\s"']+/);
    const url = parsed.html_url || (urlMatch ? urlMatch[0] : null);
    res.json({
      ok: true,
      url: url || out,
      message: out,
    });
  } catch (e) {
    if (bodyFile) try { fs.unlinkSync(bodyFile); } catch (_) {}
    console.error(e);
    res.status(500).json({
      error: 'Issue aanmaken mislukt',
      detail: e.message,
    });
  }
});

// Static bestanden (na API)
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Server op http://localhost:${PORT}`);
});
