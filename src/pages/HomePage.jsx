import { useState, useEffect, useMemo } from 'react';
import Nav from '../components/Nav';
import SectionDivider from '../components/SectionDivider';
import { fetchTemplates, fetchProjects, submitIntake } from '../api';

function buildIssueTitle(template, description) {
  const first =
    description
      .trim()
      .split(/\n/)
      .find((line) => line.trim()) || '';
  const snippet = first.trim().slice(0, 200);
  const prefix = template?.titlePrefix || (template?.name ? `[${template.name}] ` : '');
  const raw = `${prefix}${snippet}`.trim();
  if (raw.length <= 256) return raw || `${prefix}Melding`.trim().slice(0, 256);
  return raw.slice(0, 256);
}

function buildIssueBody(name, description) {
  return `## Melder\n\n${name}\n\n## Omschrijving\n\n${description}`;
}

export default function HomePage() {
  const [templates, setTemplates] = useState(null);
  const [templatesError, setTemplatesError] = useState(null);
  const [projects, setProjects] = useState(null);
  const [projectsError, setProjectsError] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchTemplates()
      .then((list) => {
        setTemplates(list);
        if (list?.length) setCategory((c) => c || list[0].id);
      })
      .catch((e) => setTemplatesError(e.message));
  }, []);

  useEffect(() => {
    fetchProjects()
      .then((list) => {
        setProjects(list);
        if (list?.length) setProjectKey((k) => k || list[0].projectKey);
      })
      .catch((e) => setProjectsError(e.message));
  }, []);

  const selectedTemplate = useMemo(
    () => templates?.find((t) => t.id === category),
    [templates, category]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);
    const reporterName = name.trim();
    if (!reporterName) {
      setMessage({ type: 'error', text: 'Vul uw naam in.' });
      return;
    }
    const addr = email.trim();
    if (!addr) {
      setMessage({ type: 'error', text: 'Vul uw e-mailadres in.' });
      return;
    }
    const desc = description.trim();
    if (!desc) {
      setMessage({ type: 'error', text: 'Vul een omschrijving in.' });
      return;
    }
    if (!selectedTemplate) {
      setMessage({ type: 'error', text: 'Kies een categorie.' });
      return;
    }
    if (!projectKey || !projects?.some((p) => p.projectKey === projectKey)) {
      setMessage({ type: 'error', text: 'Kies voor welke website of afdeling de melding is.' });
      return;
    }

    const title = buildIssueTitle(selectedTemplate, desc);
    const body = buildIssueBody(reporterName, desc);

    setSubmitting(true);
    try {
      await submitIntake({
        title,
        body,
        email: addr,
        category: selectedTemplate.id,
        projectKey,
      });
      setMessage({
        type: 'success',
        text: 'Bedankt! Je melding is ontvangen. We nemen zo nodig contact met je op via e-mail.',
      });
      setName('');
      setEmail('');
      setDescription('');
      if (templates?.length) setCategory(templates[0].id);
      if (projects?.length) setProjectKey(projects[0].projectKey);
    } catch (err) {
      setMessage({ type: 'error', text: 'Fout: ' + err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Nav />
      <div className="container narrow">
        <div style={{ marginBottom: '2.5rem' }}>
          <div className="kicker">Sportvereniging H.G.V.</div>
          <h1 className="display small">Melding<br /><em>indienen</em></h1>
          <p className="hero-body">
            Stuur hier een melding naar het team. Of het nu gaat om een fout, een tekstwijziging of een
            nieuw idee: we horen het graag. Je ontvangt zo nodig terugkoppeling op het e-mailadres dat je
            opgeeft.
          </p>
        </div>

        <SectionDivider label="Formulier" />

        <div className="form-panel">
          {(!templates || !projects) && !templatesError && !projectsError && (
            <div className="loading">Formulier laden…</div>
          )}
          {templatesError && <p className="error-box">{templatesError}</p>}
          {projectsError && <p className="error-box">{projectsError}</p>}

          {templates && templates.length === 0 && (
            <p className="error-box">Er zijn geen categorieën beschikbaar. Probeer het later opnieuw.</p>
          )}

          {projects && projects.length === 0 && !projectsError && (
            <p className="error-box">
              Er zijn geen Paperclip-projecten beschikbaar voor meldingen. Neem contact op met het team.
            </p>
          )}

          {templates && templates.length > 0 && projects && projects.length > 0 && (
            <form onSubmit={handleSubmit}>
              <div className="form-section">
                <label htmlFor="reporter-name">Uw naam</label>
                <input
                  type="text"
                  id="reporter-name"
                  name="reporter-name"
                  autoComplete="name"
                  required
                  placeholder="Voor- en achternaam"
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                />
              </div>
              <div className="form-section">
                <label htmlFor="reporter-email">E-mailadres</label>
                <input
                  type="email"
                  id="reporter-email"
                  name="reporter-email"
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  required
                  placeholder="naam@voorbeeld.nl"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                />
              </div>
              <div className="form-section">
                <label htmlFor="project">Voor welke website / afdeling?</label>
                <select
                  id="project"
                  name="project"
                  required
                  value={projectKey}
                  onChange={(ev) => setProjectKey(ev.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.projectKey} value={p.projectKey}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-section">
                <label htmlFor="category">Categorie</label>
                <select
                  id="category"
                  name="category"
                  required
                  value={category}
                  onChange={(ev) => setCategory(ev.target.value)}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-section">
                <label htmlFor="description">Omschrijving</label>
                <textarea
                  id="description"
                  name="description"
                  rows={8}
                  required
                  placeholder="Beschrijf je melding zo duidelijk mogelijk…"
                  value={description}
                  onChange={(ev) => setDescription(ev.target.value)}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="primary" disabled={submitting}>
                  {submitting ? 'Bezig met insturen…' : 'Melding insturen'}
                </button>
              </div>
            </form>
          )}

          {message && <div className={`message ${message.type}`}>{message.text}</div>}
        </div>
      </div>
    </>
  );
}
