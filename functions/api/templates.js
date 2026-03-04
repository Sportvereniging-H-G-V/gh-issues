import { getTemplates } from '../_templates';

export async function onRequestGet() {
  try {
    const templates = getTemplates();
    return new Response(JSON.stringify(templates), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: 'Templates laden mislukt',
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

