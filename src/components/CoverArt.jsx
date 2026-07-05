export default function CoverArt({ album, className = '', compact = false }) {
  const colors = album.palette || ['#d7ff42', '#151515', '#f5f1e8'];
  const hasRealCover = Boolean(album.cover_url);

  return (
    <div className={`cover-art ${className}`} style={{ '--c1': colors[0], '--c2': colors[1], '--c3': colors[2] }}>
      {hasRealCover ? (
        <img
          className="cover-real-image"
          src={album.cover_url}
          alt={`${album.title} - ${album.artist}`}
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextElementSibling.style.display = 'block';
          }}
        />
      ) : null}
      <div className="cover-fallback" style={{ display: hasRealCover ? 'none' : 'block' }}>
        <div className="cover-orbit cover-orbit-a" />
        <div className="cover-orbit cover-orbit-b" />
      </div>
      {!compact && <><span className="cover-rank">E/{String(album.billboard_rank).padStart(3, '0')}</span><span className="cover-title">{album.title}</span><span className="cover-artist">{album.artist}</span></>}
    </div>
  );
}
