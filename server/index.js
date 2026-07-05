import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { db, albumSummary } from './database.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
app.use(express.json());
app.use('/audio', express.static(join(root, 'public', 'audio')));

// 加载 Deezer 预览片段缓存（95%+ 曲目覆盖率）
let deezerPreviews = {};
let albumMeta = {};
const previewsPath = join(root, 'data', 'deezer-previews.json');
try {
  if (existsSync(previewsPath)) {
    deezerPreviews = JSON.parse(readFileSync(previewsPath, 'utf-8'));
    console.info(`[deezer] 已加载 ${Object.keys(deezerPreviews).length} 条预览片段`);
  }
} catch (e) {
  console.warn('[deezer] 预览数据加载失败:', e.message);
}

try {
  const albumMetaPath = join(root, 'data', 'album-meta.json');
  if (existsSync(albumMetaPath)) albumMeta = JSON.parse(readFileSync(albumMetaPath, 'utf-8'));
} catch (e) {
  console.warn('[deezer] 专辑元数据加载失败:', e.message);
}

function isPreviewUrlFresh(url) {
  if (!url) return false;
  const expiry = url.match(/exp=(\d+)/)?.[1];
  // Deezer 的预览链接带短期签名；预留一分钟，避免播放过程中刚好过期。
  return !expiry || Number(expiry) * 1000 > Date.now() + 60_000;
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[‘’“”'']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchDeezerJSON(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'EchoLog/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Deezer API ${response.status}`);
  const payload = await response.json();
  if (payload?.error) throw new Error(payload.error.message || 'Deezer API error');
  return payload;
}

const deezerRefreshes = new Map();

async function refreshDeezerAlbum(albumId) {
  if (deezerRefreshes.has(albumId)) return deezerRefreshes.get(albumId);

  const task = (async () => {
    const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(albumId);
    if (!album) throw new Error('Album not found');

    const metaKey = `${album.title}|${album.artist}|${album.year}`;
    let deezerAlbumId = albumMeta[metaKey]?.deezer_id;

    if (!deezerAlbumId) {
      const query = encodeURIComponent(`${album.title} ${album.artist}`);
      const search = await fetchDeezerJSON(`https://api.deezer.com/search/album?q=${query}&limit=5`);
      const title = normalizeTitle(album.title);
      const artist = normalizeTitle(album.artist);
      const candidates = search?.data || [];
      const matched = candidates.find((item) => (
        normalizeTitle(item.title) === title
        && normalizeTitle(item.artist?.name).includes(artist)
      )) || candidates.find((item) => {
        const remoteTitle = normalizeTitle(item.title);
        const remoteArtist = normalizeTitle(item.artist?.name);
        return (remoteTitle.includes(title) || title.includes(remoteTitle))
          && (remoteArtist.includes(artist) || artist.includes(remoteArtist));
      });
      deezerAlbumId = matched?.id;
    }

    if (!deezerAlbumId) throw new Error('Deezer album match failed');

    const remote = await fetchDeezerJSON(`https://api.deezer.com/album/${deezerAlbumId}/tracks`);
    const remoteTracks = remote?.data || [];
    const localTracks = db.prepare('SELECT * FROM tracks WHERE album_id = ? ORDER BY track_number').all(albumId);
    let refreshed = 0;

    for (const track of localTracks) {
      const title = normalizeTitle(track.title);
      const matched = remoteTracks.find((item) => normalizeTitle(item.title_short || item.title) === title)
        || remoteTracks.find((item) => Number(item.track_position) === Number(track.track_number));
      if (matched?.preview) {
        deezerPreviews[`${albumId}-${track.track_number}`] = matched.preview;
        refreshed += 1;
      }
    }

    if (!refreshed) throw new Error('Deezer track match failed');
    console.info(`[deezer] 已为专辑 ${albumId} 刷新 ${refreshed} 条真实试听链接`);
    return refreshed;
  })();

  deezerRefreshes.set(albumId, task);
  try {
    return await task;
  } finally {
    deezerRefreshes.delete(albumId);
  }
}

async function resolveTrackSource(track) {
  if (track.netease_id) {
    const cached = db.prepare(
      "SELECT play_url, expires_at FROM play_cache WHERE track_id = ? AND expires_at > datetime('now')"
    ).get(track.id);
    if (cached?.play_url) return { url: cached.play_url, source: 'netease-cached', notice: '网易云真实音源' };
  }

  if (process.env.NETEASE_API_BASE && track.netease_id) {
    try {
      const response = await fetch(`${process.env.NETEASE_API_BASE}/song/url/v1?id=${track.netease_id}&level=standard`, {
        signal: AbortSignal.timeout(8000),
      });
      const payload = await response.json();
      const url = payload?.data?.[0]?.url;
      if (url) {
        db.prepare(
          "INSERT OR REPLACE INTO play_cache (track_id, play_url, expires_at) VALUES (?, ?, datetime('now', '+15 minutes'))"
        ).run(track.id, url);
        return { url, source: 'netease', notice: '网易云真实音源' };
      }
    } catch (error) {
      console.warn('[netease] 获取音源失败:', error.message);
    }
  }

  const previewKey = `${track.album_id}-${track.track_number}`;
  let previewUrl = deezerPreviews[previewKey];
  if (!isPreviewUrlFresh(previewUrl)) {
    await refreshDeezerAlbum(track.album_id);
    previewUrl = deezerPreviews[previewKey];
  }
  if (isPreviewUrlFresh(previewUrl)) {
    return { url: previewUrl, source: 'deezer', notice: 'Deezer 真实歌曲 30 秒试听' };
  }

  throw new Error('No real audio source available');
}

// 判断当前数据模式
function getDataMode() {
  if (existsSync(join(root, 'data', 'seed-data.json'))) return 'seed-json';
  return 'demo';
}

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  database: 'sqlite',
  mode: getDataMode(),
  neteaseConfigured: Boolean(process.env.NETEASE_API_BASE),
}));

/**
 * 管理接口认证中间件
 * 通过 x-admin-key 请求头验证 ADMIN_KEY 环境变量
 */
function adminAuth(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return res.status(501).json({ error: '管理接口未配置（请设置 ADMIN_KEY 环境变量）' });
  }
  const providedKey = req.headers['x-admin-key'];
  if (!providedKey || providedKey !== adminKey) {
    return res.status(401).json({ error: '认证失败' });
  }
  next();
}

app.get('/api/albums', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 100);
  const rows = db.prepare('SELECT * FROM albums ORDER BY billboard_rank LIMIT ?').all(limit);
  res.json({ items: rows.map(albumSummary), count: rows.length, updatedAt: new Date().toISOString() });
});

app.get('/api/albums/:id', (req, res) => {
  const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(req.params.id);
  if (!album) return res.status(404).json({ error: 'Album not found' });
  const reviews = db.prepare('SELECT * FROM reviews WHERE album_id = ? ORDER BY score_normalized DESC').all(album.id);
  const tracks = db.prepare('SELECT * FROM tracks WHERE album_id = ? ORDER BY track_number').all(album.id);
  res.json({ ...albumSummary(album), reviews, tracks });
});

app.get('/api/tracks/:id/play', async (req, res) => {
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'Track not found' });
  try {
    res.json(await resolveTrackSource(track));
  } catch (error) {
    console.warn(`[audio] 曲目 ${track.id} 获取真实音源失败:`, error.message);
    res.status(503).json({ error: '暂时无法获取这首歌曲的真实试听音源。' });
  }
});

app.get('/api/tracks/:id/audio', async (req, res) => {
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  const controller = new AbortController();
  const connectTimeout = setTimeout(() => controller.abort(), 10000);
  const abortUpstream = () => controller.abort();
  req.once('aborted', abortUpstream);

  try {
    const source = await resolveTrackSource(track);
    const headers = { 'User-Agent': 'EchoLog/1.0' };
    if (req.headers.range) headers.Range = req.headers.range;
    // 超时只限制建立连接；响应开始后允许 30 秒试听完整传输。
    const upstream = await fetch(source.url, { headers, signal: controller.signal });
    clearTimeout(connectTimeout);
    if (!upstream.ok || !upstream.body) throw new Error(`Audio upstream ${upstream.status}`);

    res.status(upstream.status);
    for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Echo-Source', source.source);
    // pipeline 会捕获客户端暂停、切歌或离开页面造成的流中断，避免进程崩溃。
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    const clientClosed = req.aborted || res.destroyed || error.code === 'ERR_STREAM_PREMATURE_CLOSE';
    if (!clientClosed) console.warn(`[audio] 曲目 ${track.id} 转发真实音源失败:`, error.message);
    if (!clientClosed && !res.headersSent) res.status(502).json({ error: '真实试听音源暂时不可用。' });
  } finally {
    clearTimeout(connectTimeout);
    req.off('aborted', abortUpstream);
  }
});

/**
 * 管理接口：手动刷新数据
 * POST /api/admin/refresh
 * Headers: x-admin-key: <ADMIN_KEY>
 */
app.post('/api/admin/refresh', adminAuth, (_req, res) => {
  res.json({
    message: '数据刷新功能已就绪。请通过独立脚本更新数据：',
    steps: [
      '1. node scripts/fetch-album-meta.js   (采集专辑封面和 netease_id)',
      '2. node scripts/fetch-douban.js       (采集豆瓣评分)',
      '3. node scripts/fetch-pitchfork.js    (采集 Pitchfork 评分)',
      '4. node scripts/fetch-aoty.js         (采集 AOTY 评分)',
      '5. node scripts/merge-seed-data.js    (合并数据)',
      '6. 删除 data/echo-log.db 并重启服务    (重新导入种子数据)',
    ],
  });
});

/**
 * 管理接口：查看数据统计
 * GET /api/admin/stats
 * Headers: x-admin-key: <ADMIN_KEY>
 */
app.get('/api/admin/stats', adminAuth, (_req, res) => {
  const albumCount = db.prepare('SELECT COUNT(*) AS count FROM albums').get().count;
  const reviewCount = db.prepare('SELECT COUNT(*) AS count FROM reviews').get().count;
  const reviewBySource = db.prepare('SELECT source, COUNT(*) AS count FROM reviews GROUP BY source').all();
  const trackCount = db.prepare('SELECT COUNT(*) AS count FROM tracks').get().count;
  const cacheCount = db.prepare('SELECT COUNT(*) AS count FROM play_cache').get().count;
  const unmatchedCount = db.prepare("SELECT COUNT(*) AS count FROM match_queue WHERE status != 'resolved'").get().count;

  res.json({
    mode: getDataMode(),
    albums: albumCount,
    reviews: { total: reviewCount, bySource: reviewBySource },
    tracks: trackCount,
    playCache: cacheCount,
    unmatchedQueue: unmatchedCount,
  });
});

if (process.env.CRON_ENABLED === 'true') {
  cron.schedule('15 3 * * *', () => console.info('[review-sync] scheduled adapter hook', new Date().toISOString()));
}

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(root, 'dist')));
  app.use((_req, res) => res.sendFile(join(root, 'dist', 'index.html')));
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Echo Log encountered an unexpected error.' });
});

function maskKey(key, showChars = 4) {
  if (!key) return '(未设置)';
  if (key.length <= showChars * 2) return '*'.repeat(key.length);
  return key.slice(0, showChars) + '*'.repeat(Math.max(key.length - showChars * 2, 4)) + key.slice(-showChars);
}

app.listen(port, '127.0.0.1', () => {
  console.info(`Echo Log API listening at http://127.0.0.1:${port}`);
  console.info(`  数据模式:   ${getDataMode()}`);
  console.info(`  网易云 API: ${process.env.NETEASE_API_BASE ? maskKey(process.env.NETEASE_API_BASE) : '(未配置)'}`);
  console.info(`  管理接口:   ${process.env.ADMIN_KEY ? '已启用' : '(未配置 ADMIN_KEY)'}`);
  console.info(`  定时任务:   ${process.env.CRON_ENABLED === 'true' ? '已启用' : '已禁用'}`);
});
