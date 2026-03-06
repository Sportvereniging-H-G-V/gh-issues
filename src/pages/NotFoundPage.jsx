import { Link } from 'react-router-dom';
import Nav from '../components/Nav';

export default function NotFoundPage() {
  return (
    <>
      <nav className="nav">
        <Link to="/" className="logo" aria-label="Terug naar H.G.V. issues startpagina">
          <img src="/favicon.svg" alt="" />
        </Link>
        <div className="nav-sep" />
        <span className="nav-label">Website-/applicatiebeheer</span>
      </nav>
      <div className="not-found">
        <div className="card">
          <div className="kicker">Sportvereniging H.G.V.</div>
          <div className="code">404 – Pagina niet gevonden</div>
          <h1>We konden deze pagina niet vinden.</h1>
          <p className="body-text">
            De link die je hebt geopend bestaat niet (meer) in deze tool.
            Het kan zijn dat je een tikfout hebt gemaakt, of dat de pagina is verplaatst.
          </p>
          <div className="actions">
            <Link to="/" className="btn btn-primary">← Terug naar overzicht</Link>
            <a href="https://www.hgvhengelo.nl" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              Naar hgvhengelo.nl
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
