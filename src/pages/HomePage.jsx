import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import SpiralGallery from '../components/SpiralGallery';
import CoverArt from '../components/CoverArt';

export default function HomePage() {
  const [albums, setAlbums] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => { api('/albums?limit=100').then((data) => setAlbums(data.items)).catch((e) => setError(e.message)); }, []);

  function select(album) {
    setSelected(album);
    window.setTimeout(() => navigate(`/album/${album.id}`), 850);
  }

  return (
    <main className="home-page">
      <header className="site-header">
        <a className="brand" href="/"><i />回响录 <span>Echo Log</span></a>
        <div className="archive-meta"><span>聆听档案</span><b>001—100</b></div>
        <div className="live-pill"><i /> DATASET ONLINE</div>
      </header>

      <section className="home-intro">
        <p className="kicker">BILLBOARD ARCHIVE / 100 ENTRIES</p>
        <h1>散落的声音，<br /><em>重新回响。</em></h1>
        <p className="intro-copy">旋转、探索并打开一张唱片。<br />每个坐标都收录评分、短评与一段声音。</p>
      </section>

      <div className="gallery-shell">
        {albums.length ? <SpiralGallery albums={albums} onSelect={select} /> : (
          <div className="loading-state"><i /><span>{error || '正在整理唱片档案…'}</span></div>
        )}
        <div className="gallery-vignette" />
      </div>

      <aside className="gallery-help"><span>DRAG</span><i>↔</i><span>ROTATE</span><b>点击封面进入档案</b></aside>
      <footer className="home-footer"><span>© 2026 ECHO LOG</span><p>A log of echoes — where scattered listening becomes a shared archive.</p><span>SHANGHAI / CN</span></footer>

      {selected && (
        <div className="selection-overlay">
          <div className="selection-card">
            <CoverArt album={selected} compact />
            <div><span className="eyebrow">OPENING ARCHIVE {String(selected.billboard_rank).padStart(3, '0')}</span><h2>{selected.title}</h2><p>{selected.artist} · {selected.year}</p></div>
            <strong>{selected.aggregate}</strong>
          </div>
        </div>
      )}
    </main>
  );
}
