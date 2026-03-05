export async function fetchRepos() {
  const res = await fetch('/api/repos');
  if (!res.ok) throw new Error((await res.json()).error || 'Fout bij ophalen');
  return res.json();
}

export async function fetchTemplates() {
  const res = await fetch('/api/templates');
  if (!res.ok) throw new Error((await res.json()).error || 'Templates laden mislukt');
  return res.json();
}

export async function fetchIssues(repo) {
  const res = await fetch(`/api/repos/${encodeURIComponent(repo)}/issues`);
  if (!res.ok) throw new Error((await res.json()).error || 'Issues ophalen mislukt');
  return res.json();
}

export async function createIssue(payload) {
  const res = await fetch('/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Issue aanmaken mislukt');
  return data;
}
