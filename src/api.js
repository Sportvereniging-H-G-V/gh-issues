async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function fetchTemplates() {
  const res = await fetch('/api/templates');
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || 'Templates laden mislukt');
  return data;
}

export async function fetchProjects() {
  const res = await fetch('/api/projects');
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || 'Projecten laden mislukt');
  return data;
}

export async function submitIntake(payload) {
  const res = await fetch('/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || 'Melding insturen mislukt');
  return data;
}
