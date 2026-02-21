const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3333;
const ORG = 'Sportvereniging-H-G-V';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

/** Issue aanmaken in gekozen repo (via gh) */
app.post('/api/issues', async (req, res) => {
  const { repo, title, body } = req.body;
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
    const args = [
      'issue', 'create',
      '--repo', fullRepo,
      '--title', title,
    ];
    if (bodyFile) args.push('--body-file', bodyFile);
    const out = await runGhArgs(args);
    if (bodyFile) try { fs.unlinkSync(bodyFile); } catch (_) {}
    const urlMatch = out.match(/https:\/\/github\.com\/[^\s]+/);
    res.json({
      ok: true,
      url: urlMatch ? urlMatch[0] : out,
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

app.listen(PORT, () => {
  console.log(`Server op http://localhost:${PORT}`);
});
