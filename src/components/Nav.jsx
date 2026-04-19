import { Link } from 'react-router-dom';

export default function Nav() {
  return (
    <nav className="nav">
      <Link to="/" className="logo" aria-label="Naar startpagina H.G.V. Beheer">
        <img src="/favicon.svg" alt="" />
        <span className="logo-text">H.G.V. Beheer</span>
      </Link>
    </nav>
  );
}
