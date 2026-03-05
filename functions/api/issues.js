import { ORG } from '../_config';
import { createIssue, defaultLabelsForTemplateId, isRepoAllowed } from '../_github';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { repo, title, body: issueBody, labels, assignees, templateId } = body;

  if (!repo || !title) {
    return new Response(
      JSON.stringify({
        error: 'repo en title zijn verplicht',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  const fullRepo = repo.includes('/') ? repo : `${ORG}/${repo}`;

  try {
    if (!isRepoAllowed(fullRepo)) {
      return new Response(
        JSON.stringify({
          error: 'Issues aanmaken in deze repository is niet toegestaan',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let effectiveLabels = Array.isArray(labels) ? labels.slice() : [];
    if ((!effectiveLabels || effectiveLabels.length === 0) && templateId) {
      const defaults = defaultLabelsForTemplateId(templateId);
      if (defaults && defaults.length) {
        effectiveLabels = defaults;
      }
    }

    const payload = {
      title,
      body: issueBody || '',
    };

    if (Array.isArray(effectiveLabels) && effectiveLabels.length > 0) {
      payload.labels = effectiveLabels;
    }
    if (Array.isArray(assignees) && assignees.length > 0) {
      payload.assignees = assignees;
    }

    const issue = await createIssue(env, fullRepo, payload);

    return new Response(
      JSON.stringify({
        ok: true,
        url: issue.html_url,
        number: issue.number,
        issue,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: 'Issue aanmaken mislukt',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

