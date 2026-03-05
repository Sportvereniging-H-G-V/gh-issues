import { ORG } from '../../../_config';
import { isRepoAllowed, listIssues } from '../../../_github';

export async function onRequestGet({ params, env }) {
  const repo = params.repo;
  const fullRepo = repo.includes('/') ? repo : `${ORG}/${repo}`;

  try {
    if (!isRepoAllowed(fullRepo)) {
      return new Response(
        JSON.stringify({
          error: 'Toegang tot deze repository is niet toegestaan',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const issues = await listIssues(env, fullRepo);
    return new Response(JSON.stringify(issues), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: 'Issues ophalen mislukt',
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

