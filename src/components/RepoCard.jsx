import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function RepoCard({ repo, index }) {
  const [imgError, setImgError] = useState(false);
  const [iconSrc, setIconSrc] = useState(`/images/repos/${encodeURIComponent(repo.name)}-favicon.png`);
  const [iconFallback, setIconFallback] = useState(0);

  const iconSources = [
    `/images/repos/${encodeURIComponent(repo.name)}-favicon.png`,
    `/images/repos/${encodeURIComponent(repo.name)}-favicon.svg`,
    `/images/repos/${encodeURIComponent(repo.name)}-favicon.ico`,
  ];

  function handleIconError() {
    const next = iconFallback + 1;
    if (next < iconSources.length) {
      setIconFallback(next);
      setIconSrc(iconSources[next]);
    } else {
      setIconSrc(null);
    }
  }

  return (
    <Link
      to={`/${encodeURIComponent(repo.name)}`}
      className="repo-card"
      style={{ animationDelay: `${0.04 + index * 0.04}s` }}
    >
      {!imgError && (
        <div className="repo-image-wrapper">
          <img
            className="repo-image"
            loading="lazy"
            src={`/images/repos/${encodeURIComponent(repo.name)}.webp`}
            alt={`Screenshot van ${repo.name}`}
            onError={() => setImgError(true)}
          />
        </div>
      )}
      <div className="repo-content">
        <span className="repo-icon" aria-hidden="true">
          {iconSrc ? (
            <img alt="" loading="lazy" src={iconSrc} onError={handleIconError} />
          ) : null}
        </span>
        <span className="repo-info">
          <span className="name">{repo.name}</span>
          {repo.description && <span className="desc">{repo.description}</span>}
        </span>
        <span className="repo-arrow" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </span>
      </div>
    </Link>
  );
}
