import { Link } from 'react-router-dom';

export default function Nav({ backLink }) {
  return (
    <nav className="nav">
      <Link to="/" className="logo" aria-label="Terug naar H.G.V. website-/applicatiebeheer">
        <img src="/favicon.svg" alt="" />
        {!backLink && <span className="logo-text">H.G.V. website-/applicatiebeheer</span>}
      </Link>
      {backLink && (
        <>
          <div className="nav-sep" />
          <Link className="nav-back" to="/">← Repositories</Link>
        </>
      )}
    </nav>
  );
}
