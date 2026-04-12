# Security Vulnerability Report

**Date**: 2026-03-22
**Codebase**: Sportvereniging-H-G-V/gh-issues
**Tech Stack**: React 19, Cloudflare Pages Functions (Node.js), Vite, GitHub Actions

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 2 |
| Medium | 5 |
| Low / Low-Medium | 8 |

---

## Critical

### 1. Command Injection via External Script Download — GitHub Actions

**File**: `.github/workflows/cursor-review.yml` line 28
**Severity**: Critical
**Type**: Command Injection / Arbitrary Code Execution

**Vulnerable code**:
```bash
curl https://cursor.com/install -fsS | bash
```

**Description**: The workflow downloads and pipes a remote shell script directly to `bash` without any integrity verification. A compromised `cursor.com` domain, a CDN cache-poisoning attack, or a MITM could substitute malicious code that runs with full access to the runner environment, including `GITHUB_TOKEN` and `CURSOR_API_KEY`.

**Fix**:
```yaml
# Option A — pin a checksum
- name: Install Cursor
  run: |
    curl -fsSL https://cursor.com/install -o install-cursor.sh
    echo "EXPECTED_SHA256  install-cursor.sh" | sha256sum --check
    bash install-cursor.sh

# Option B — vendor the script inside the repo
- name: Install Cursor
  run: bash .github/scripts/install-cursor.sh
```

---

## High

### 2. Missing Security Headers on All HTTP Responses

**File**: `src/index.js` lines 7–17
**Severity**: High
**Type**: Missing Security Headers

**Vulnerable code**:
```javascript
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function html() {
  return new Response(indexHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
```

**Description**: Responses are missing `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, and `Referrer-Policy`. Without a CSP, any XSS finding is automatically escalated in severity.

**Fix**:
```javascript
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS,
    },
  });
}

function html() {
  return new Response(indexHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
      ...SECURITY_HEADERS,
    },
  });
}
```

---

### 3. No CSRF Protection on State-Changing Endpoints

**File**: `src/index.js` lines 43–82
**Severity**: High
**Type**: Cross-Site Request Forgery

**Vulnerable code**:
```javascript
if (path === '/api/issues' && request.method === 'POST') {
  // ... no origin / CSRF check
}
```

**Description**: The `POST /api/issues` endpoint accepts requests from any origin. A malicious page could silently create GitHub issues on behalf of any authenticated user.

**Fix** (origin-header validation — simplest for a Cloudflare Worker):
```javascript
const allowedOrigins = new Set(['https://your-domain.pages.dev', 'https://your-custom-domain.com']);

function validateOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins.has(origin)) {
    return json({ error: 'Forbidden' }, 403);
  }
  return null;
}

if (path === '/api/issues' && request.method === 'POST') {
  const originError = validateOrigin(request);
  if (originError) return originError;
  // ... rest of handler
}
```

---

## Medium

### 4. No Rate Limiting on API Endpoints

**File**: `src/index.js` lines 26–97
**Severity**: Medium
**Type**: Denial of Service / GitHub API Exhaustion

**Description**: All API endpoints (`POST /api/issues`, `GET /api/repos/:repo/issues`, `GET /api/repos`) have no rate limiting. An attacker can exhaust the GitHub API token's hourly quota (5 000 requests) or create thousands of issues.

**Fix** (Cloudflare Rate Limiting rule or Workers KV):
```javascript
async function checkRateLimit(env, ip) {
  const key = `rl:${ip}`;
  const count = parseInt(await env.KV.get(key) || '0', 10);
  if (count >= 20) return false;          // 20 req / minute
  await env.KV.put(key, String(count + 1), { expirationTtl: 60 });
  return true;
}

// In fetch handler:
const ip = request.headers.get('cf-connecting-ip') || 'unknown';
if (!(await checkRateLimit(env, ip))) {
  return json({ error: 'Too many requests' }, 429);
}
```

---

### 5. Verbose GitHub API Errors Forwarded to Client

**File**: `src/github.js` lines 55–64
**Severity**: Medium
**Type**: Information Disclosure

**Vulnerable code**:
```javascript
const msg = data && data.message ? data.message : text || `status ${res.status}`;
throw new Error(msg);
```

**Description**: Raw GitHub API error messages (which can include org/repo details, quota limits, token scope information) are surfaced directly to the end-user.

**Fix**:
```javascript
if (!res.ok) {
  console.error('[GitHub API]', res.status, data); // server-side only
  const userMsg =
    res.status === 401 ? 'Authentication failed' :
    res.status === 403 ? 'Access denied' :
    res.status === 404 ? 'Not found' :
    res.status >= 500 ? 'GitHub server error' :
    'Request failed';
  throw new Error(userMsg);
}
```

---

### 6. Repository Name Parsed Without Strict Validation

**File**: `src/github.js` lines 97, 124
**Severity**: Medium
**Type**: Input Validation / Potential Request Forgery

**Vulnerable code**:
```javascript
const [owner, repoName] = fullRepo.split('/');
```

**Description**: If `fullRepo` contains more than one `/` or ends with `/`, the destructure yields unexpected values that could bypass the allowlist check or produce empty owner/repo strings in the GitHub API URL.

**Fix**:
```javascript
const parts = fullRepo.split('/');
if (parts.length !== 2 || !parts[0] || !parts[1]) {
  throw new Error('Invalid repository format: expected "owner/repo"');
}
const [owner, repoName] = parts;
```

---

### 7. Missing Input Validation on `repo`, `title`, `body`

**File**: `src/index.js` lines 52–75
**Severity**: Medium
**Type**: Insufficient Input Validation

**Vulnerable code**:
```javascript
const { repo, title, body: issueBody, labels, assignees, templateId } = body;
if (!repo || !title) {
  return json({ error: 'repo en title zijn verplicht' }, 400);
}
```

**Description**: Only truthiness is checked. Non-string types (arrays, objects), excessively long strings, and null bytes are all accepted and passed to the GitHub API.

**Fix**:
```javascript
if (typeof repo !== 'string' || !/^[\w.\-]+\/[\w.\-]+$/.test(repo)) {
  return json({ error: 'Invalid repository name' }, 400);
}
if (typeof title !== 'string' || title.trim().length === 0 || title.length > 256) {
  return json({ error: 'Invalid title' }, 400);
}
const safeBody = typeof issueBody === 'string' ? issueBody.slice(0, 65_536) : '';
```

---

### 8. No Validation on `assignees` and `labels` Array Elements

**File**: `src/index.js` lines 65–75
**Severity**: Medium
**Type**: Insufficient Input Validation

**Vulnerable code**:
```javascript
let effectiveLabels = Array.isArray(labels) ? labels.slice() : [];
if (Array.isArray(assignees) && assignees.length > 0) payload.assignees = assignees;
```

**Description**: Array elements are never type-checked. Sending `{"assignees": [{}, null, 99999]}` forwards non-string values to the GitHub API call, potentially causing unexpected behaviour or server errors that leak API details.

**Fix**:
```javascript
const safeAssignees = Array.isArray(assignees)
  ? assignees.filter(a => typeof a === 'string' && /^[\w\-]{1,100}$/.test(a))
  : [];
const safeLabels = Array.isArray(labels)
  ? labels.filter(l => typeof l === 'string' && l.length <= 100)
  : [];
```

---

## Low

### 9. Static Asset Routing via `path.includes('.')` — Overly Broad

**File**: `src/index.js` lines 100–102
**Severity**: Low
**Type**: Routing Logic Issue

**Vulnerable code**:
```javascript
if (path.includes('.')) {
  return env.ASSETS.fetch(request);
}
```

**Description**: Any path containing a dot (e.g. `/api.endpoint`) is routed to the static asset handler rather than the API. This can mask API routes or serve unexpected files.

**Fix**:
```javascript
const STATIC_EXT = /\.(js|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|map)$/i;
if (STATIC_EXT.test(path)) {
  return env.ASSETS.fetch(request);
}
```

---

### 10. Secrets Passed as Env Vars in GitHub Actions (Potential Log Leakage)

**File**: `.github/workflows/cursor-review.yml` lines 46–51
**Severity**: Low
**Type**: Credential Exposure Risk

**Description**: Secrets injected as environment variables are accessible to every subprocess and can appear in debug logs if any tool prints its environment. GitHub masks known secret values, but derived values (e.g. base64-encoded tokens) are not masked.

**Fix**: Prefer passing secrets as direct arguments to trusted commands and avoid `env:` for secrets used only in one step:
```yaml
- name: Run agent
  run: agent --some-flag
  env:
    # Only expose the secret to the exact step that needs it
    CURSOR_API_KEY: ${{ secrets.CURSOR_API_KEY }}
```

---

### 11. `split('/')[1]` Can Return Empty String on Trailing Slash

**File**: `src/github.js` line 13
**Severity**: Low
**Type**: Edge-Case Input Handling

**Vulnerable code**:
```javascript
const shortName = trimmed.includes('/') ? trimmed.split('/')[1] : trimmed;
```

**Description**: Input `"org/"` produces `shortName = ""`, which can silently pass into downstream logic.

**Fix**:
```javascript
const match = trimmed.match(/^[^/]+\/([^/]+)$/);
const shortName = match ? match[1] : trimmed;
```

---

## Priority Remediation Order

1. **Critical** — Pin/verify the Cursor install script in `cursor-review.yml`
2. **High** — Add security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
3. **High** — Add origin-based CSRF validation to `POST /api/issues`
4. **Medium** — Strict input validation (`repo`, `title`, `body`, `labels`, `assignees`)
5. **Medium** — Sanitize/classify error messages before sending to clients
6. **Medium** — Implement rate limiting (Cloudflare Rate Limiting rule or KV)
7. **Medium** — Validate repository name format strictly before splitting
8. **Low** — Tighten static asset routing regex
9. **Low** — Restrict secret exposure scope in GitHub Actions workflows
