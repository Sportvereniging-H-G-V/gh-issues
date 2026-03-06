import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import RepoPage from './pages/RepoPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/:repoName" element={<RepoPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
