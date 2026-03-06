import { ORG, REPO_ALLOWLIST } from './config';

export function isRepoAllowed(repoIdentifier) {
  if (!REPO_ALLOWLIST || REPO_ALLOWLIST.length === 0) {
    return true;
  }
  if (!repoIdentifier || typeof repoIdentifier !== 'string') {
    return false;
  }

  const trimmed = repoIdentifier.trim();
  const fullName = trimmed.includes('/') ? trimmed : `${ORG}/${trimmed}`;
  const shortName = trimmed.includes('/') ? trimmed.split('/')[1] : trimmed;

  return (
    REPO_ALLOWLIST.includes(shortName) ||
    REPO_ALLOWLIST.includes(fullName)
  );
}

export function defaultLabelsForTemplateId(id) {
  switch (id) {
    case 'content-wijziging':
      return ['content'];
    case 'technisch-probleem':
      return ['bug'];
    case 'nieuwe-functie':
      return ['enhancement'];
    default:
      return [];
  }
}

async function githubRequest(env, method, apiPath, body) {
  const token = env && env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN ontbreekt in de omgeving');
  }

  const res = await fetch(`https://api.github.com${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'hgv-issues-tool',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = text;
    }
  }

  if (!res.ok) {
    const msg = data && data.message ? data.message : text || `status ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export async function listRepos(env) {
  const repos = (await githubRequest(
    env,
    'GET',
    `/orgs/${encodeURIComponent(ORG)}/repos?per_page=100`
  )) || [];

  let mapped = repos.map((r) => ({
    name: r.name,
    description: r.description,
    url: r.html_url,
    full_name: r.full_name,
    avatarUrl: r.owner && r.owner.avatar_url,
  }));

  if (REPO_ALLOWLIST && REPO_ALLOWLIST.length > 0) {
    mapped = mapped.filter((r) => {
      return (
        REPO_ALLOWLIST.includes(r.name) ||
        REPO_ALLOWLIST.includes(r.full_name)
      );
    });
  }

  return mapped;
}

export async function listIssues(env, fullRepo) {
  const [owner, repoName] = fullRepo.split('/');
  const issues = (await githubRequest(
    env,
    'GET',
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repoName
    )}/issues?state=all&per_page=50`
  )) || [];

  const onlyIssues = issues.filter((i) => !i.pull_request);
  return onlyIssues.map((i) => ({
    number: i.number,
    title: i.title,
    state: i.state,
    url: i.html_url,
    createdAt: i.created_at,
  }));
}

export async function createIssue(env, fullRepo, payload) {
  const [owner, repoName] = fullRepo.split('/');
  return githubRequest(
    env,
    'POST',
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repoName
    )}/issues`,
    payload
  );
}

