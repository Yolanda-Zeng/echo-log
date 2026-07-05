import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = join(root, 'data', 'echo-log.db');
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL,
    year INTEGER, cover_url TEXT, netease_id TEXT, billboard_rank INTEGER,
    palette TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY, album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    source TEXT NOT NULL, score REAL NOT NULL, score_normalized REAL NOT NULL,
    excerpt TEXT, source_url TEXT, fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(album_id, source)
  );
  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY, album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    title TEXT NOT NULL, duration INTEGER NOT NULL, track_number INTEGER NOT NULL,
    netease_id TEXT
  );
  CREATE TABLE IF NOT EXISTS play_cache (
    track_id INTEGER PRIMARY KEY, play_url TEXT, expires_at TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS match_queue (
    id INTEGER PRIMARY KEY, source TEXT, source_title TEXT, source_artist TEXT,
    source_year INTEGER, payload TEXT, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// ---------------------------------------------------------------------------
// 种子数据加载
// 优先从 data/seed-data.json 加载真实数据，缺失时回退到演示数据
// ---------------------------------------------------------------------------

const DEMO_PALETTES = [
  '#B7FF40,#151515,#F4F1E8', '#FF5C35,#32140D,#F2C94C', '#8E75FF,#1D1638,#8EF0E7',
  '#F5A5C7,#2D4835,#FFF0D7', '#2A66FF,#0B1536,#F2E9DA', '#C7A45D,#291D12,#63A48D',
  '#FF6978,#341C46,#FFD166', '#9FCEE8,#233248,#E8BE9D', '#E9E3D5,#1E2A42,#D6A756',
  '#D75B33,#142B2A,#E2D4B7', '#395DD8,#180D2B,#F5B3C8', '#D6A535,#0E1518,#B83A35',
];

function seedFromJSON() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM albums').get().count;
  if (count) return;

  const seedPath = join(root, 'data', 'seed-data.json');
  if (!existsSync(seedPath)) {
    console.warn('[seed] seed-data.json 不存在，回退到演示数据');
    seedDemo();
    return;
  }

  let data;
  try {
    data = JSON.parse(readFileSync(seedPath, 'utf-8'));
  } catch (err) {
    console.error('[seed] seed-data.json 解析失败:', err.message);
    seedDemo();
    return;
  }

  const { albums, reviews, tracks } = data;
  if (!albums || !albums.length) {
    console.warn('[seed] seed-data.json 无专辑数据，回退到演示数据');
    seedDemo();
    return;
  }

  console.info(`[seed] 从 seed-data.json 加载 ${albums.length} 张专辑, ${reviews?.length || 0} 条乐评, ${tracks?.length || 0} 首曲目`);

  const insertAlbum = db.prepare(
    'INSERT INTO albums (id,title,artist,year,cover_url,netease_id,billboard_rank,palette) VALUES (?,?,?,?,?,?,?,?)'
  );
  const insertReview = db.prepare(
    'INSERT OR IGNORE INTO reviews (album_id,source,score,score_normalized,excerpt,source_url) VALUES (?,?,?,?,?,?)'
  );
  const insertTrack = db.prepare(
    'INSERT INTO tracks (album_id,title,duration,track_number,netease_id) VALUES (?,?,?,?,?)'
  );

  db.exec('BEGIN');
  try {
    for (const album of albums) {
      const paletteStr = Array.isArray(album.palette) ? album.palette.join(',') : (album.palette || DEMO_PALETTES[Math.abs(album.id) % DEMO_PALETTES.length]);
      insertAlbum.run(
        album.id, album.title, album.artist, album.year,
        album.cover_url || null, album.netease_id || null,
        album.billboard_rank, paletteStr
      );
    }

    if (reviews) {
      for (const review of reviews) {
        insertReview.run(
          review.album_id, review.source, review.score,
          review.score_normalized, review.excerpt || null, review.source_url || null
        );
      }
    }

    if (tracks) {
      for (const track of tracks) {
        insertTrack.run(
          track.album_id, track.title, track.duration,
          track.track_number, track.netease_id || null
        );
      }
    }

    db.exec('COMMIT');
    console.info(`[seed] ✅ 真实数据导入完成`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('[seed] 导入失败，回滚:', err.message);
    throw err;
  }
}

function seedDemo() {
  console.info('[seed] 使用演示数据填充数据库');
  const insertAlbum = db.prepare('INSERT INTO albums (id,title,artist,year,billboard_rank,palette) VALUES (?,?,?,?,?,?)');
  const insertReview = db.prepare('INSERT INTO reviews (album_id,source,score,score_normalized,excerpt,source_url) VALUES (?,?,?,?,?,?)');
  const insertTrack = db.prepare('INSERT INTO tracks (album_id,title,duration,track_number) VALUES (?,?,?,?)');

  const demoAlbums = [
    ['BRAT', 'Charli xcx', 2024], ['GNX', 'Kendrick Lamar', 2024],
    ['Imaginal Disk', 'Magdalena Bay', 2024], ['Charm', 'Clairo', 2024],
    ['Hit Me Hard and Soft', 'Billie Eilish', 2024], ['Cowboy Carter', 'Beyoncé', 2024],
    ['The Rise and Fall of a Midwest Princess', 'Chappell Roan', 2023], ['SOS', 'SZA', 2022],
    ['Blonde', 'Frank Ocean', 2016], ['Currents', 'Tame Impala', 2015],
    ['Melodrama', 'Lorde', 2017], ['To Pimp a Butterfly', 'Kendrick Lamar', 2015],
    ['Vespertine', 'Björk', 2001], ['In Rainbows', 'Radiohead', 2007],
    ['Titanic Rising', 'Weyes Blood', 2019], ['Sometimes I Might Be Introvert', 'Little Simz', 2021],
  ];

  const sources = ['douban', 'aoty', 'pitchfork'];
  for (let i = 1; i <= 100; i += 1) {
    const base = demoAlbums[i - 1] || [`Archive Entry ${String(i).padStart(3, '0')}`, `Echo Artist ${Math.ceil(i / 4)}`, 2025 - (i % 12)];
    insertAlbum.run(i, ...base, i, DEMO_PALETTES[(i - 1) % DEMO_PALETTES.length]);
    sources.forEach((source, s) => {
      const normalized = Number((7.1 + ((i * 13 + s * 7) % 24) / 10).toFixed(1));
      const raw = source === 'douban' ? normalized : Math.round(normalized * 10);
      const excerpts = [
        '声音像一组不断折返的镜面，在熟悉与陌生之间留下漂亮的缝隙。',
        '编曲的细节经得起反复聆听，情绪却始终保持着克制而清晰的轮廓。',
        '一张拥有完整世界观的唱片；高潮并不喧哗，却会在结束后继续回响。',
      ];
      insertReview.run(i, source, raw, normalized, excerpts[(i + s) % excerpts.length], `https://example.com/${source}/${i}`);
    });
    ['Opening Signal', 'Glass Rooms', 'Afterimage', 'Soft Static', 'Return'].forEach((title, t) => {
      insertTrack.run(i, title, 168 + ((i * 11 + t * 29) % 96), t + 1);
    });
  }
}

seedFromJSON();

export function albumSummary(row) {
  const reviews = db.prepare('SELECT source, score, score_normalized FROM reviews WHERE album_id = ?').all(row.id);
  const aggregate = reviews.length ? reviews.reduce((sum, r) => sum + r.score_normalized, 0) / reviews.length : null;
  return { ...row, palette: row.palette.split(','), aggregate: aggregate && Number(aggregate.toFixed(1)), reviews };
}
