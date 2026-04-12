import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Nav from '../components/Nav';
import SectionDivider from '../components/SectionDivider';
import { fetchRepos, fetchTemplates, fetchIssues, createIssue } from '../api';

const TEMPLATE_META = {
  'content-wijziging': {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
    accent: '#0284C7',
    hint: 'Teksten, afbeeldingen of andere content op de pagina aanpassen',
  },
  'technisch-probleem': {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.31 0-6-2.69-6-6v-1h12v1c0 3.31-2.69 6-6 6Z"/><path d="M12 11.12V12"/><path d="M16 11.12v1"/><path d="M8 11.12v1"/><path d="M18 13h1"/><path d="M18 17h1"/><path d="M23 15h-1"/><path d="M5 13H4"/><path d="M5 17H4"/><path d="M1 15h1"/>
      </svg>
    ),
    accent: '#DC2626',
    hint: 'Een foutmelding, kapot onderdeel of iets dat niet werkt zoals verwacht',
  },
  'nieuwe-functie': {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12l4 6-10 12L2 9Z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><path d="M2 9h20"/>
      </svg>
    ),
    accent: '#059669',
    hint: 'Een idee voor een nieuwe functie of verbetering aan de website of app',
  },
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
  const [showRecentClosed, setShowRecentClosed] = useState(false);
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
    setIssuesError(null);
    fetchIssues(repo, { recentClosed: showRecentClosed })
      .then(setIssues)
      .catch((e) => setIssuesError(e.message));
  }

  useEffect(() => {
    setIssues(null);
    setIssuesError(null);
    let cancelled = false;
    fetchIssues(repo, { recentClosed: showRecentClosed })
      .then((data) => {
        if (!cancelled) setIssues(data);
      })
      .catch((e) => {
        if (!cancelled) setIssuesError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [repo, showRecentClosed]);

  function selectTemplate(t) {
    setActiveTemplate(t);
    setMessage(null);
    if (titleRef.current) {
      titleRef.current.value = '';
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
      if (titleRef.current) titleRef.current.value = '';
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
          <div className="kicker">Melding doen voor</div>
          <h1 className="display small">{repoInfo?.name || repo}</h1>
          {repoInfo?.description && <p className="repo-desc">{repoInfo.description}</p>}
        </div>

        <SectionDivider label="Nieuwe melding insturen" />

        <div className="templates">
          {!templates && !templatesError && <div className="loading">Templates laden…</div>}
          {templatesError && <p className="error-box">{templatesError}</p>}
          {templates && templates.map((t) => {
            const meta = TEMPLATE_META[t.id] || { 
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>
                </svg>
              ), 
              accent: '#0284C7' 
            };
            return (
              <div
                key={t.id}
                className={`template-card${activeTemplate?.id === t.id ? ' active' : ''}`}
                style={{ '--card-accent': meta.accent }}
                onClick={() => selectTemplate(t)}
              >
                <span className="tc-icon" aria-hidden="true" style={{ color: meta.accent }}>
                  {meta.icon}
                </span>
                <span className="name">{t.name}</span>
                <span className="hint">{meta.hint || 'Nieuwe melding insturen'}</span>
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
                  placeholder="Korte beschrijving"
                  defaultValue=""
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
                  {submitting ? 'Bezig met insturen…' : 'Melding insturen'}
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
          <div className="issues-filter">
            <label className="issues-filter-label">
              <input
                type="checkbox"
                checked={showRecentClosed}
                onChange={(e) => setShowRecentClosed(e.target.checked)}
              />
              Toon ook recent gesloten meldingen (laatste 14 dagen)
            </label>
          </div>
          <div>
            {!issues && !issuesError && <div className="loading">Meldingen laden…</div>}
            {issuesError && <p className="error-box">{issuesError}</p>}
            {issues && issues.length === 0 && (
              <div className="loading" style={{ '--spinner-display': 'none' }}>
                {showRecentClosed
                  ? 'Er zijn nog geen meldingen voor deze website of app.'
                  : 'Er zijn geen open meldingen. Vink hierboven aan om recent gesloten te tonen.'}
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
