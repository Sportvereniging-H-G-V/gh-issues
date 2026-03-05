import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Nav from '../components/Nav';
import SectionDivider from '../components/SectionDivider';
import { fetchRepos, fetchTemplates, fetchIssues, createIssue } from '../api';

const TEMPLATE_META = {
  'content-wijziging': { emoji: '✏️', accent: '#FF5200' },
  'technisch-probleem': { emoji: '🐛', accent: '#FF3535' },
  'nieuwe-functie': { emoji: '✨', accent: '#4080FF' },
};

function formatDate(s) {
  try {
    return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return s; }
}

export default function RepoPage() {
  const { repoName } = useParams();
  const repo = decodeURIComponent(repoName);

  const [repoInfo, setRepoInfo] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [templatesError, setTemplatesError] = useState(null);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [issues, setIssues] = useState(null);
  const [issuesError, setIssuesError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const titleRef = useRef();
  const sectionsRef = useRef();

  useEffect(() => {
    fetchRepos()
      .then((repos) => {
        const r = repos.find((x) => x.name === repo);
        if (r) setRepoInfo(r);
      })
      .catch(() => {});
  }, [repo]);

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .catch((e) => setTemplatesError(e.message));
  }, []);

  function loadIssues() {
    fetchIssues(repo)
      .then(setIssues)
      .catch((e) => setIssuesError(e.message));
  }

  useEffect(loadIssues, [repo]);

  function selectTemplate(t) {
    setActiveTemplate(t);
    setMessage(null);
    if (titleRef.current) {
      titleRef.current.value = t.titlePrefix || '';
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);
    const title = titleRef.current?.value.trim();
    if (!title) return;

    const parts = [];
    if (sectionsRef.current) {
      sectionsRef.current.querySelectorAll('textarea').forEach((ta) => {
        const heading = ta.getAttribute('data-heading');
        const value = (ta.value || '').trim();
        if (heading) parts.push(`## ${heading}\n\n${value || '(niet ingevuld)'}`);
      });
    }

    setSubmitting(true);
    try {
      const payload = { repo, title, body: parts.join('\n\n') };
      if (activeTemplate) payload.templateId = activeTemplate.id;
      const data = await createIssue(payload);
      setMessage({ type: 'success', text: 'Issue aangemaakt.', url: data.url });
      if (titleRef.current) titleRef.current.value = activeTemplate?.titlePrefix || '';
      if (sectionsRef.current) sectionsRef.current.querySelectorAll('textarea').forEach((ta) => { ta.value = ''; });
      loadIssues();
    } catch (err) {
      setMessage({ type: 'error', text: 'Fout: ' + err.message });
    } finally {
      setSubmitting(false);
    }
  }

  const sections = activeTemplate?.sections?.length
    ? activeTemplate.sections
    : activeTemplate?.body
      ? [{ heading: 'Beschrijving', placeholder: 'Vul de beschrijving in…' }]
      : [];

  return (
    <>
      <Nav backLink />
      <div className="container narrow">
        <div className="repo-header">
          <div className="kicker">Website / applicatie</div>
          <h1 className="display small">{repoInfo?.name || repo}</h1>
          {repoInfo?.description && <p className="repo-desc">{repoInfo.description}</p>}
        </div>

        <SectionDivider label="Nieuwe melding insturen" />

        <div className="templates">
          {!templates && !templatesError && <div className="loading">Templates laden…</div>}
          {templatesError && <p className="error-box">{templatesError}</p>}
          {templates && templates.map((t) => {
            const meta = TEMPLATE_META[t.id] || { emoji: '📋', accent: '#1E40AF' };
            return (
              <div
                key={t.id}
                className={`template-card${activeTemplate?.id === t.id ? ' active' : ''}`}
                style={{ '--card-accent': meta.accent }}
                onClick={() => selectTemplate(t)}
              >
                <span className="tc-icon" aria-hidden="true">{meta.emoji}</span>
                <span className="name">{t.name}</span>
                <span className="hint">{t.titlePrefix || 'Nieuwe melding insturen'}</span>
              </div>
            );
          })}
        </div>

        {activeTemplate && (
          <div className="form-panel">
            <form onSubmit={handleSubmit}>
              <div className="form-section">
                <label htmlFor="title">Titel</label>
                <input
                  type="text"
                  id="title"
                  ref={titleRef}
                  required
                  placeholder={activeTemplate.titlePrefix ? `${activeTemplate.titlePrefix}…` : 'Korte beschrijving'}
                  defaultValue={activeTemplate.titlePrefix || ''}
                />
              </div>
              <div ref={sectionsRef}>
                {sections.map((sec, i) => (
                  <div className="form-section" key={i}>
                    <label htmlFor={`section-${i}`}>{sec.heading}</label>
                    <textarea
                      id={`section-${i}`}
                      data-heading={sec.heading}
                      rows={4}
                      placeholder={sec.placeholder || ''}
                    />
                  </div>
                ))}
              </div>
              <div className="form-actions">
                <button type="submit" className="primary" disabled={submitting}>
                  Melding insturen
                </button>
              </div>
            </form>
            {message && (
              <div className={`message ${message.type}`}>
                {message.text}
                {message.url && (
                  <>
                    {' '}
                    <a href={message.url} target="_blank" rel="noopener noreferrer">Bekijk melding →</a>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="issues-section">
          <SectionDivider label="Bestaande meldingen" />
          <div>
            {!issues && !issuesError && <div className="loading">Meldingen laden…</div>}
            {issuesError && <p className="error-box">{issuesError}</p>}
            {issues && issues.length === 0 && (
              <div className="loading" style={{ '--spinner-display': 'none' }}>
                Er zijn nog geen meldingen voor deze website of app.
              </div>
            )}
            {issues && issues.map((issue) => (
              <div className="issue-item" key={issue.number}>
                <span className={`state ${issue.state === 'open' ? 'open' : 'closed'}`}>
                  {issue.state === 'open' ? 'Open' : 'Gesloten'}
                </span>
                <a href={issue.url} target="_blank" rel="noopener noreferrer">{issue.title}</a>
                <span className="date">#{issue.number} · {formatDate(issue.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
