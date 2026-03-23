import { ORG } from './config';
import { listRepos, listIssues, createIssue, isRepoAllowed, defaultLabelsForTemplateId } from './github';
import { getTemplates } from './templates';

import indexHtml from '../dist/index.html';

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
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'",
      ...SECURITY_HEADERS,
    },
  });
}

// Reject requests where the Origin header doesn't match the app's own origin.
// Browsers always send Origin on cross-site POST requests, so this stops CSRF.
function validateOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return null; // non-browser / same-origin request without Origin header
  const requestOrigin = new URL(request.url).origin;
  if (origin !== requestOrigin) {
    return json({ error: 'Forbidden' }, 403);
  }
  return null;
}

const STATIC_EXT = /\.(js|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|map|txt|json)$/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API: GET /api/repos
    if (path === '/api/repos' && request.method === 'GET') {
      try {
        return json(await listRepos(env));
      } catch {
        return json({ error: 'Kon repos niet ophalen' }, 500);
      }
    }

    // API: GET /api/templates
    if (path === '/api/templates' && request.method === 'GET') {
      try {
        return json(getTemplates());
      } catch {
        return json({ error: 'Templates laden mislukt' }, 500);
      }
    }

    // API: POST /api/issues
    if (path === '/api/issues' && request.method === 'POST') {
      const csrfError = validateOrigin(request);
      if (csrfError) return csrfError;

      let body;
      try {
        body = await request.json();
      } catch {
        body = {};
      }

      const { repo, title, body: issueBody, labels, assignees, templateId } = body;

      // --- input validation ---
      if (typeof repo !== 'string' || !/^[\w.\-]+(\/[\w.\-]+)?$/.test(repo.trim())) {
        return json({ error: 'Ongeldige repository naam' }, 400);
      }
      if (typeof title !== 'string' || title.trim().length === 0 || title.length > 256) {
        return json({ error: 'Titel is verplicht en mag maximaal 256 tekens bevatten' }, 400);
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
          return json({ error: 'Issues aanmaken in deze repository is niet toegestaan' }, 403);
        }

        let effectiveLabels = safeLabels.slice();
        if (effectiveLabels.length === 0 && templateId) {
          const defaults = defaultLabelsForTemplateId(templateId);
          if (defaults && defaults.length) {
            effectiveLabels = defaults;
          }
        }

        const payload = { title: title.trim(), body: safeBody };
        if (effectiveLabels.length > 0) payload.labels = effectiveLabels;
        if (safeAssignees.length > 0) payload.assignees = safeAssignees;

        const issue = await createIssue(env, fullRepo, payload);
        return json({ ok: true, url: issue.html_url, number: issue.number, issue });
      } catch {
        return json({ error: 'Issue aanmaken mislukt' }, 500);
      }
    }

    // API: GET /api/repos/:repo/issues
    const repoIssuesMatch = path.match(/^\/api\/repos\/([^\/]+)\/issues$/);
    if (repoIssuesMatch && request.method === 'GET') {
      const repo = decodeURIComponent(repoIssuesMatch[1]);
      const fullRepo = repo.includes('/') ? repo : `${ORG}/${repo}`;

      try {
        if (!isRepoAllowed(fullRepo)) {
          return json({ error: 'Toegang tot deze repository is niet toegestaan' }, 403);
        }
        return json(await listIssues(env, fullRepo));
      } catch {
        return json({ error: 'Issues ophalen mislukt' }, 500);
      }
    }

    // Static assets (js, css, images, etc.)
    if (STATIC_EXT.test(path)) {
      return env.ASSETS.fetch(request);
    }

    // SPA fallback: serve index.html for all client-side routes
    return html();
  },
};
