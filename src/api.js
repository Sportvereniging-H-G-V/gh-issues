export async function fetchTemplates() {
  const res = await fetch('/api/templates');
  if (!res.ok) throw new Error((await res.json()).error || 'Templates laden mislukt');
  return res.json();
}

export async function submitIntake(payload) {
  const res = await fetch('/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Melding insturen mislukt');
  return data;
}
