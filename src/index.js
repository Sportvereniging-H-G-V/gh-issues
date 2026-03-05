import { ORG } from './config';
import { listRepos, listIssues, createIssue, isRepoAllowed, defaultLabelsForTemplateId } from './github';
import { getTemplates } from './templates';

import indexHtml from '../dist/index.html';

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
      let body;
      try {
        body = await request.json();
      } catch {
        body = {};
      }

      const { repo, title, body: issueBody, labels, assignees, templateId } = body;

      if (!repo || !title) {
        return json({ error: 'repo en title zijn verplicht' }, 400);
      }

      const fullRepo = repo.includes('/') ? repo : `${ORG}/${repo}`;

      try {
        if (!isRepoAllowed(fullRepo)) {
          return json({ error: 'Issues aanmaken in deze repository is niet toegestaan' }, 403);
        }

        let effectiveLabels = Array.isArray(labels) ? labels.slice() : [];
        if (effectiveLabels.length === 0 && templateId) {
          const defaults = defaultLabelsForTemplateId(templateId);
          if (defaults && defaults.length) {
            effectiveLabels = defaults;
          }
        }

        const payload = { title, body: issueBody || '' };
        if (effectiveLabels.length > 0) payload.labels = effectiveLabels;
        if (Array.isArray(assignees) && assignees.length > 0) payload.assignees = assignees;

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
    if (path.includes('.')) {
      return env.ASSETS.fetch(request);
    }

    // SPA fallback: serve index.html for all client-side routes
    return html();
  },
};
