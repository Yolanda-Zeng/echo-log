import { Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AlbumPage from './pages/AlbumPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/album/:id" element={<AlbumPage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
