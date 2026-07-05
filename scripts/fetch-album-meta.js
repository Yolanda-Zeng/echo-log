/**
 * 专辑信息采集脚本（MusicBrainz + Cover Art Archive + Deezer 回退）
 * 从 MusicBrainz 免费 API 获取专辑曲目列表和元数据。
 * 封面优先从 Cover Art Archive 获取，缺失时 Deezer API 回退。
 * 无需 API Key，无需部署任何服务。
 *
 * 用法：node scripts/fetch-album-meta.js
 *
 * 前置条件：data/seed-albums.json 已准备好 100 张专辑列表
 *
 * 数据源说明：
 *   - MusicBrainz API   : 专辑搜索 + 曲目列表（免费，需设置 User-Agent）
 *   - Cover Art Archive : 专辑封面图（免费，通过 MusicBrainz release MBID 获取）
 *
 * 速率限制：MusicBrainz 要求每秒不超过 1 个请求，本脚本自动控制。
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALBUMS_PATH = join(root, 'data', 'seed-albums.json');
const OUTPUT_PATH = join(root, 'data', 'album-meta.json');
const MATCH_QUEUE_PATH = join(root, 'data', 'match-queue.json');

// MusicBrainz 要求的 User-Agent 格式：应用名/版本 (联系邮箱)
const USER_AGENT = 'EchoLog/1.0 (echo-log@localhost)';
const MB_BASE = 'https://musicbrainz.org/ws/2';
const DEEZER_BASE = 'https://api.deezer.com';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 速率限制：MusicBrainz 要求 ≤1 req/s，此处保守取 1.2s */
function reqDelay() {
  return 1200;
}

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 调用 MusicBrainz API
 */
async function mbFetch(path) {
  const url = `${MB_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`MusicBrainz HTTP ${res.status}`);
  return res.json();
}

/**
 * 在 MusicBrainz 中搜索专辑（release）
 * 返回匹配的 release 列表
 */
async function searchRelease(title, artist) {
  const query = encodeURIComponent(`release:"${title}" AND artist:"${artist}"`);
  const data = await mbFetch(`/release/?query=${query}&limit=8&fmt=json`);
  return data.releases || [];
}

/**
 * 获取 release 详情（包含曲目列表）
 */
async function getReleaseDetail(mbid) {
  const data = await mbFetch(`/release/${mbid}?inc=recordings+artist-credits&fmt=json`);
  return data;
}

/**
 * 尝试获取封面图 URL
 * Cover Art Archive: https://coverartarchive.org/release/MBID
 */
async function getCoverUrl(mbid) {
  try {
    const res = await fetch(`https://coverartarchive.org/release/${mbid}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // 取 front 封面，优先 500px 大图
    const front = data.images?.find((img) => img.front);
    if (front) {
      // 找合适尺寸的缩略图 URL
      const thumb = front.thumbnails?.['500'] || front.thumbnails?.['250'] || front.image;
      return thumb || front.image || null;
    }
    // 没有 front 标记，取第一张
    if (data.images?.length) {
      const img = data.images[0];
      return img.thumbnails?.['500'] || img.thumbnails?.['250'] || img.image || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Deezer API 封面回退
 * 当 Cover Art Archive 没有封面时，从 Deezer 免费 API 获取
 * Deezer API 完全免费、无需认证，覆盖几乎所有主流专辑
 */
async function getCoverFromDeezer(title, artist) {
  try {
    // Deezer 不支持 Lucene 语法，直接用简单关键词搜索
    const q = encodeURIComponent(`${title} ${artist}`);
    const res = await fetch(`${DEEZER_BASE}/search/album?q=${q}&limit=5`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.data?.length) return null;

    const nTitle = normalize(title);
    const nArtist = normalize(artist);

    // 匹配：标题精确 + 艺人模糊
    for (const album of data.data) {
      const aTitle = normalize(album.title);
      const aArtist = normalize(album.artist?.name || '');
      if (aTitle === nTitle && (aArtist.includes(nArtist) || nArtist.includes(aArtist))) {
        return album.cover_big || album.cover_xl || album.cover_medium || null;
      }
    }
    // 第二遍：标题模糊匹配
    for (const album of data.data) {
      const aTitle = normalize(album.title);
      const aArtist = normalize(album.artist?.name || '');
      if ((aTitle.includes(nTitle) || nTitle.includes(aTitle)) &&
          (aArtist.includes(nArtist) || nArtist.includes(aArtist))) {
        return album.cover_big || album.cover_xl || album.cover_medium || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 从候选 release 列表中匹配最佳结果
 * 按优先级：标题+艺人名精确匹配 > 标题+艺人名模糊匹配 > 年份匹配
 */
function matchBestRelease(releases, title, artist, year) {
  if (!releases.length) return null;

  const nTitle = normalize(title);
  const nArtist = normalize(artist);

  // 第一轮：标题和艺人名都精确匹配 + 年份匹配
  for (const r of releases) {
    const rTitle = normalize(r.title);
    const rArtist = normalize(r['artist-credit']?.[0]?.name || '');
    const rYear = r.date ? parseInt(r.date.slice(0, 4), 10) : null;
    if (rTitle === nTitle && rArtist === nArtist && (!year || !rYear || rYear === year)) {
      return r;
    }
  }

  // 第二轮：标题精确匹配 + 艺人名模糊
  for (const r of releases) {
    const rTitle = normalize(r.title);
    const rArtist = normalize(r['artist-credit']?.[0]?.name || '');
    if (rTitle === nTitle && (rArtist.includes(nArtist) || nArtist.includes(rArtist))) {
      return r;
    }
  }

  // 第三轮：标题模糊匹配
  for (const r of releases) {
    const rTitle = normalize(r.title);
    const rArtist = normalize(r['artist-credit']?.[0]?.name || '');
    if ((rTitle.includes(nTitle) || nTitle.includes(rTitle)) &&
        (rArtist.includes(nArtist) || nArtist.includes(rArtist))) {
      return r;
    }
  }

  // 第四轮：仅标题模糊（兜底）
  for (const r of releases) {
    const rTitle = normalize(r.title);
    if (rTitle.includes(nTitle) || nTitle.includes(rTitle)) {
      return r;
    }
  }

  return null;
}

/**
 * 将 duration 从毫秒转为秒（整数）
 */
function msToSec(ms) {
  return ms ? Math.round(ms / 1000) : 180;
}

/**
 * 优先保留与 release 同名的主介质，避免把附带单曲/bonus 盘误并入专辑曲目。
 * 若没有可明确识别的主介质，则回退为全部介质。
 */
function selectPrimaryMedia(media = [], releaseTitle = '') {
  if (!media.length) return [];
  const normalizedReleaseTitle = normalize(releaseTitle);
  const matchingMedia = media.filter((medium) => (
    medium.title && normalize(medium.title) === normalizedReleaseTitle
  ));
  return matchingMedia.length ? matchingMedia : media;
}

async function main() {
  console.log('=== 专辑信息采集（MusicBrainz + Cover Art Archive）===\n');

  if (!existsSync(ALBUMS_PATH)) {
    console.error(`专辑列表文件不存在: ${ALBUMS_PATH}`);
    process.exit(1);
  }
  const albums = JSON.parse(readFileSync(ALBUMS_PATH, 'utf-8'));

  // 读取已有缓存
  let existingMeta = {};
  if (existsSync(OUTPUT_PATH)) {
    existingMeta = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
    console.log(`已有缓存: ${Object.keys(existingMeta).length} 条记录`);
  }

  const results = { ...existingMeta };
  const unmatched = [];
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (let i = 0; i < albums.length; i++) {
    const album = albums[i];
    const key = `${album.title}|${album.artist}|${album.year}`;

    // 已有缓存且封面已存在 → 跳过
    if (results[key] && results[key].cover_url) {
      skipCount++;
      continue;
    }

    // 未知或错误记录 → 跳过（不做无意义重试）
    if (results[key] && (results[key]._not_found || results[key]._error)) {
      skipCount++;
      continue;
    }

    // 已有缓存但缺封面 → 仅尝试 Deezer 回退
    if (results[key] && !results[key].cover_url) {
      let deezerCover = null;
      try {
        deezerCover = await getCoverFromDeezer(album.title, album.artist);
      } catch { /* ignore */ }
      if (deezerCover) {
        results[key].cover_url = deezerCover;
        results[key].cover_source = 'deezer';
        console.log(`[${i + 1}/${albums.length}] ${album.title} - ${album.artist}`);
        console.log(`  🎵 Deezer 回退补全封面`);
        writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
      }
      skipCount++;
      await sleep(reqDelay());
      continue;
    }

    console.log(`[${i + 1}/${albums.length}] ${album.title} - ${album.artist}`);

    try {
      // 1. 搜索 release
      const releases = await searchRelease(album.title, album.artist);
      const matched = matchBestRelease(releases, album.title, album.artist, album.year);

      if (!matched) {
        unmatched.push({
          source: 'musicbrainz',
          source_title: album.title,
          source_artist: album.artist,
          source_year: album.year,
          status: 'unmatched',
        });
        failCount++;
        console.log('  ✗ 未找到匹配');
        // 记录空结果避免重复搜索
        results[key] = { _not_found: true, source: 'musicbrainz' };
      } else {
        // 2. 获取 release 详情（含曲目）
        let detail = null;
        let tracks = [];
        try {
          detail = await getReleaseDetail(matched.id);
          const media = selectPrimaryMedia(detail.media || [], matched.title);
          let trackNum = 0;
          for (const medium of media) {
            for (const track of medium.tracks || []) {
              trackNum++;
              tracks.push({
                title: track.recording?.title || track.title || `Track ${trackNum}`,
                duration: msToSec(track.length || track.recording?.length),
                track_number: trackNum,
              });
            }
          }
        } catch (err) {
          console.log(`  ⚠ 获取曲目详情失败: ${err.message}`);
        }

        // 3. 获取封面（CAA 优先，Deezer 回退）
        let coverUrl = null;
        try {
          coverUrl = await getCoverUrl(matched.id);
        } catch (err) {
          // 封面获取失败不阻塞
        }
        if (!coverUrl) {
          try {
            coverUrl = await getCoverFromDeezer(album.title, album.artist);
            if (coverUrl) console.log(`  🎵 Deezer 回退成功`);
          } catch {
            // Deezer 回退失败也不阻塞
          }
        }

        const matchedArtist = matched['artist-credit']?.[0]?.name || album.artist;
        const matchedYear = matched.date ? parseInt(matched.date.slice(0, 4), 10) : album.year;

        results[key] = {
          source: 'musicbrainz',
          mbid: matched.id,
          cover_url: coverUrl,
          cover_source: coverUrl ? (coverUrl.includes('deezer') ? 'deezer' : 'caa') : null,
          matched_title: matched.title,
          matched_artist: matchedArtist,
          matched_year: matchedYear,
          tracks: tracks.length > 0 ? tracks : undefined,
          billboard_rank: album.billboard_rank,
        };

        successCount++;
        const trackInfo = tracks.length ? `${tracks.length} 首曲目` : '无曲目';
        const coverInfo = coverUrl ? '有封面' : '无封面';
        console.log(`  ✓ ${matched.title} (${matchedYear}) | ${coverInfo} | ${trackInfo}`);
        console.log(`    MBID: ${matched.id}`);
      }
    } catch (err) {
      unmatched.push({
        source: 'musicbrainz',
        source_title: album.title,
        source_artist: album.artist,
        source_year: album.year,
        payload: JSON.stringify({ error: err.message }),
        status: 'error',
      });
      failCount++;
      console.error(`  ✗ 错误: ${err.message}`);
      results[key] = { _error: err.message, source: 'musicbrainz' };
    }

    // 每成功 10 条或每 15 条总处理量保存一次中间结果
    if ((successCount + failCount) % 10 === 0 && (successCount + failCount) > 0) {
      writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
      console.log(`  💾 已保存中间结果 (${successCount + skipCount + failCount}/${albums.length})`);
    }

    // MusicBrainz 速率限制
    await sleep(reqDelay());
  }

  // 写入最终结果
  writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
  if (unmatched.length) {
    writeFileSync(MATCH_QUEUE_PATH, JSON.stringify(unmatched, null, 2), 'utf-8');
  }

  console.log('\n=== 采集完成 ===');
  console.log(`总计: ${albums.length} | 成功: ${successCount} | 跳过(缓存): ${skipCount} | 失败: ${failCount}`);
  console.log(`结果文件: ${OUTPUT_PATH}`);
  if (unmatched.length) console.log(`待处理队列: ${MATCH_QUEUE_PATH} (${unmatched.length} 条)`);

  // 估算下次全量更新时间
  if (successCount > 0) {
    const estMinutes = Math.ceil((100 * reqDelay()) / 1000 / 60);
    console.log(`\n💡 提示: 100 条全量采集预计需要约 ${estMinutes} 分钟（MusicBrainz 限制 1 req/s）`);
  }
}

main().catch((err) => {
  console.error('脚本异常:', err);
  process.exit(1);
});
