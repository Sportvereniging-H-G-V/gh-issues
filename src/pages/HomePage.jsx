import { useState, useEffect } from 'react';
import Nav from '../components/Nav';
import SectionDivider from '../components/SectionDivider';
import RepoCard from '../components/RepoCard';
import { fetchRepos } from '../api';

export default function HomePage() {
  const [repos, setRepos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRepos().then(setRepos).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Nav />
      <div className="container">
        <div style={{ marginBottom: '3.5rem' }}>
          <div className="kicker">Sportvereniging H.G.V.</div>
          <h1 className="display">Website of app<br /><em>kiezen</em></h1>
          <p className="hero-body">
            Kies hieronder de website of applicatie waarvoor je een melding wilt doen.
            Je kunt bijvoorbeeld een fout doorgeven, een tekstwijziging aanvragen of een idee voor een verbetering insturen.
          </p>
        </div>

        <SectionDivider label="Websites en applicaties" />

        <div className="repo-grid">
          {!repos && !error && <div className="loading">Websites en applicaties laden…</div>}
          {error && <p className="error-box">Fout: {error}</p>}
          {repos && repos.length === 0 && <p className="error-box">Geen repositories gevonden.</p>}
          {repos && repos.map((r, i) => <RepoCard key={r.name} repo={r} index={i} />)}
        </div>
      </div>
    </>
  );
}
