import { Link } from 'react-router-dom';

export default function Nav({ backLink }) {
  return (
    <nav className="nav">
      <Link to="/" className="logo" aria-label="Terug naar H.G.V. Beheer">
        <img src="/favicon.svg" alt="" />
        <span className="logo-text">H.G.V. Beheer</span>
      </Link>
      {backLink && (
        <>
          <div className="nav-sep" aria-hidden="true" />
          <Link className="nav-back" to="/">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span>Overzicht</span>
          </Link>
        </>
      )}
    </nav>
  );
}
