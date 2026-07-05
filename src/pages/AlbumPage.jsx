import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import AudioPlayer from '../components/AudioPlayer';
import CoverArt from '../components/CoverArt';
import { usePlayer } from '../store';

const sourceName = { douban: '豆瓣音乐', aoty: 'Album of the Year', pitchfork: 'Pitchfork' };
const sourceScale = { douban: '10 分制', pitchfork: '10 分制', aoty: '100 分制' };

export default function AlbumPage() {
  const { id } = useParams();
  const [album, setAlbum] = useState(null);
  const [error, setError] = useState('');
  const { isPlaying } = usePlayer();
  useEffect(() => { window.scrollTo(0, 0); api(`/albums/${id}`).then(setAlbum).catch((e) => setError(e.message)); }, [id]);
  if (!album) return <main className="detail-loading"><Link to="/">← 返回档案</Link><div className="loading-state"><i /><span>{error || '正在打开唱片…'}</span></div></main>;

  return (
    <main className="detail-page">
      <header className="detail-header">
        <Link className="brand" to="/"><i />回响录 <span>Echo Log</span></Link>
        <Link className="back-link" to="/">← 返回 3D 档案塔</Link>
        <span className="record-number">ARCHIVE / {String(album.billboard_rank).padStart(3, '0')}</span>
      </header>

      <section className="album-hero">
        <div className="album-visual"><span className="vertical-label">ECHO LOG — LISTENING ARCHIVE</span><CoverArt album={album} /><div className={`vinyl${isPlaying ? ' spinning' : ''}`} aria-hidden="true"><span className="vinyl-label"><b>ECHO</b><small>33⅓ RPM</small></span><i /></div></div>
        <div className="album-heading">
          <span className="eyebrow">ALBUM / {album.year}</span>
          <h1>{album.title}</h1>
          <p>{album.artist}</p>
          <div className="aggregate"><strong>{album.aggregate}</strong><div><span>综合评分</span><small>基于 {album.reviews.length} 个乐评来源</small></div></div>
        </div>
      </section>

      <section className="detail-grid">
        <AudioPlayer tracks={album.tracks} />
        <div className="scores-panel">
          <div className="section-heading"><span className="eyebrow">CRITICAL INDEX</span><h2>评分切片</h2></div>
          <div className="score-list">
            {album.reviews.map((review) => (
              <article key={review.id}>
                <div className="score-source"><i className={`source-dot ${review.source}`} /><span>{sourceName[review.source]}</span><small>{sourceScale[review.source] || '10 分制'}</small></div>
                <strong>{review.score}</strong><div className="score-bar"><i style={{ width: `${review.score_normalized * 10}%` }} /></div>
              </article>
            ))}
          </div>
          <p className="normalization-note">所有来源均同时保存原始评分，并归一化至 10 分制后计算综合分。</p>
        </div>
      </section>

      <section className="reviews-section">
        <div className="section-heading"><span className="eyebrow">SELECTED NOTES</span><h2>余音里的注脚</h2><p>跨越不同来源，摘录那些仍在耳边停留的片刻。</p></div>
        <div className="review-cards">
          {album.reviews.map((review, index) => (
            <article key={review.id}>
              <div className="quote-mark">“</div><blockquote>{review.excerpt}</blockquote>
              <footer><span><i className={`source-dot ${review.source}`} />{sourceName[review.source]}</span><b>0{index + 1}</b></footer>
            </article>
          ))}
        </div>
      </section>

      <footer className="detail-footer"><Link to="/">← 继续浏览档案</Link><span>ECHO LOG / {new Date().getFullYear()}</span></footer>
    </main>
  );
}
