// 从 Deezer API 为 Olivia Rodrigo 新专辑获取元数据
import { readFileSync, writeFileSync } from 'node:fs';

async function fetchDeezerAlbum(title, artist) {
  const q = encodeURIComponent(`${title} ${artist}`);
  const res = await fetch(`https://api.deezer.com/search/album?q=${q}&limit=3`);
  const data = await res.json();
  
  for (const album of data.data || []) {
    const aTitle = album.title.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    const aArtist = (album.artist?.name || '').toLowerCase();
    if (aArtist.includes('rodrigo')) {
      // Get full album details with tracks
      const detail = await fetch(`https://api.deezer.com/album/${album.id}`);
      const d = await detail.json();
      console.log('Album ID:', d.id);
      console.log('Title:', d.title);
      console.log('Cover:', d.cover_big || d.cover_xl);
      console.log('Tracks:', d.tracks?.data?.length);
      if (d.tracks?.data) {
        d.tracks.data.forEach(t => console.log(`  ${t.track_position}. ${t.title} (${t.duration}s)`));
      }
      
      // Build meta record
      const meta = {
        source: 'deezer',
        deezer_id: d.id,
        cover_url: d.cover_big || d.cover_xl || d.cover_medium,
        matched_title: d.title,
        matched_artist: d.artist?.name,
        matched_year: new Date(d.release_date).getFullYear(),
        tracks: (d.tracks?.data || []).map((t, i) => ({
          title: t.title,
          duration: t.duration,
          track_number: t.track_position || t.position || (i + 1),
        })),
        billboard_rank: 0,
      };
      
      const existing = JSON.parse(readFileSync('data/album-meta.json', 'utf-8'));
      const key = `you seem pretty sad for a girl so in love|Olivia Rodrigo|2026`;
      existing[key] = meta;
      writeFileSync('data/album-meta.json', JSON.stringify(existing, null, 2));
      console.log('\n✅ Saved to album-meta.json');
      return;
    }
  }
  console.log('❌ Not found on Deezer');
}

fetchDeezerAlbum('you seem pretty sad for a girl so in love', 'Olivia Rodrigo');
