/**
 * 从 Deezer API 批量采集 30 秒预览片段 URL
 * 
 * 策略：按专辑搜索 → 获取曲目列表 → 按曲名模糊匹配 → 保存预览 URL
 * 速率：Deezer 限制 50 次 / 5 秒，本脚本每次请求间隔 250ms
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DEEZER_BASE = 'https://api.deezer.com';
const DELAY_MS = 250; // 250ms 间隔 ≈ 4 req/s，安全速率

// ---- 工具函数 ----

/** 规范化字符串用于模糊匹配 */
function normalize(s) {
  return (s || '').toLowerCase()
    .replace(/[‘’“”'']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 带重试的 fetch */
async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'EchoLog/1.0' } });
      if (res.status === 429) {
        console.warn('  ⚠️  Rate limited, waiting 10s...');
        await sleep(10000);
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      if (i < retries) { console.warn('  ⚠️  Fetch error, retrying...', e.message); await sleep(2000); }
      else console.error('  ❌ Fetch failed:', e.message);
    }
  }
  return null;
}

// ---- 主逻辑 ----

async function main() {
  console.log('=== Deezer 预览片段采集 ===\n');

  // 1. 加载种子数据
  const seedPath = join(ROOT, 'data', 'seed-data.json');
  const seed = JSON.parse(readFileSync(seedPath, 'utf-8'));
  const { albums, tracks } = seed;
  console.log(`专辑: ${albums.length} | 曲目: ${tracks.length}\n`);

  // 2. 建立曲目索引：album_id → [track, ...]
  const tracksByAlbum = {};
  for (const track of tracks) {
    if (!tracksByAlbum[track.album_id]) tracksByAlbum[track.album_id] = [];
    tracksByAlbum[track.album_id].push(track);
  }

  /** 生成曲目唯一 key：album_id-track_number */
  function trackKey(track) {
    return `${track.album_id}-${track.track_number}`;
  }

  // 3. 加载已有结果（支持断点续传）
  const outPath = join(ROOT, 'data', 'deezer-previews.json');
  let previews = {};
  try { previews = JSON.parse(readFileSync(outPath, 'utf-8')); } catch { /* 首次运行 */ }
  const initialCount = Object.keys(previews).length;
  if (initialCount > 0) console.log(`已有 ${initialCount} 条预览记录，断点续传\n`);

  let apiCalls = 0;
  let matchedAlbums = 0;
  let matchedTracks = 0;
  let unmatchedAlbums = 0;

  for (const album of albums) {
    const albumTracks = tracksByAlbum[album.id] || [];
    if (albumTracks.length === 0) continue;

    // 检查是否所有曲目都已采集
    const missingTracks = albumTracks.filter(t => !previews[trackKey(t)]);
    if (missingTracks.length === 0) {
      console.log(`✅ [${album.id}] ${album.title} — 已全部采集，跳过`);
      continue;
    }

    process.stdout.write(`🔍 [${album.id}] ${album.title} (${album.artist}) ... `);

    // 搜索 Deezer 专辑
    const q = encodeURIComponent(`${album.title} ${album.artist}`);
    const searchData = await fetchWithRetry(`${DEEZER_BASE}/search/album?q=${q}&limit=5`);
    apiCalls++;
    await sleep(DELAY_MS);

    if (!searchData?.data?.length) {
      console.log('❌ 未搜索到');
      unmatchedAlbums++;
      continue;
    }

    // 匹配最佳专辑
    const nTitle = normalize(album.title);
    const nArtist = normalize(album.artist);
    let bestAlbum = null;

    // 精确匹配
    for (const da of searchData.data) {
      if (normalize(da.title) === nTitle && normalize(da.artist?.name || '').includes(nArtist)) {
        bestAlbum = da; break;
      }
    }
    // 模糊匹配
    if (!bestAlbum) {
      for (const da of searchData.data) {
        const daTitle = normalize(da.title);
        const daArtist = normalize(da.artist?.name || '');
        if ((daTitle.includes(nTitle) || nTitle.includes(daTitle)) &&
            (daArtist.includes(nArtist) || nArtist.includes(daArtist))) {
          bestAlbum = da; break;
        }
      }
    }

    if (!bestAlbum) {
      console.log('❌ 未匹配到');
      unmatchedAlbums++;
      continue;
    }

    // 获取曲目列表
    const trackData = await fetchWithRetry(`${DEEZER_BASE}/album/${bestAlbum.id}/tracks`);
    apiCalls++;
    await sleep(DELAY_MS);

    if (!trackData?.data?.length) {
      console.log('❌ 无曲目数据');
      unmatchedAlbums++;
      continue;
    }

    // 匹配曲目
    const deezerTracks = trackData.data;
    let matched = 0;

    for (const ourTrack of albumTracks) {
      const key = trackKey(ourTrack);
      if (previews[key]) { matched++; continue; }

      const nOurTitle = normalize(ourTrack.title);

      // 精确匹配
      let best = deezerTracks.find(dt => normalize(dt.title_short || dt.title) === nOurTitle);
      // 模糊匹配（包含关系）
      if (!best) {
        best = deezerTracks.find(dt => {
          const dtTitle = normalize(dt.title_short || dt.title);
          return dtTitle.includes(nOurTitle) || nOurTitle.includes(dtTitle);
        });
      }

      if (best?.preview) {
        previews[key] = best.preview;
        matched++;
      }
    }

    if (matched > 0) {
      console.log(`✅ ${matched}/${albumTracks.length} 首`);
      matchedTracks += matched;
      matchedAlbums++;
    } else {
      console.log('⚠️  无预览');
    }

    // 每处理 10 张专辑保存一次（防丢）
    if (matchedAlbums % 10 === 0) {
      writeFileSync(outPath, JSON.stringify(previews, null, 2));
    }
  }

  // 最终保存
  writeFileSync(outPath, JSON.stringify(previews, null, 2));

  const totalPreviews = Object.keys(previews).length;
  console.log(`\n=== 采集完成 ===`);
  console.log(`API 调用: ${apiCalls}`);
  console.log(`匹配专辑: ${matchedAlbums}/${albums.length}`);
  console.log(`匹配曲目: ${totalPreviews}/${tracks.length} (${(totalPreviews/tracks.length*100).toFixed(1)}%)`);
  console.log(`输出文件: ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
