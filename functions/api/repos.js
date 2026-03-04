import { listRepos } from '../_github';

export async function onRequestGet({ env }) {
  try {
    const repos = await listRepos(env);
    return new Response(JSON.stringify(repos), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: 'Kon repos niet ophalen',
        detail: e.message,
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

