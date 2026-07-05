/**
 * 数据合并脚本
 * 将各数据源的采集结果合并为统一的种子数据文件（seed-data.json）
 *
 * 用法：node scripts/merge-seed-data.js
 *
 * 输入文件（选填，缺失的来源会被跳过）：
 *   data/seed-albums.json      — 100 张专辑列表（必填）
 *   data/album-meta.json       — 专辑元数据（封面 + 曲目，来自 MusicBrainz/Cover Art Archive）
 *   data/reviews-douban.json   — 豆瓣评分
 *   data/reviews-pitchfork.json — Pitchfork 评分
 *   data/reviews-aoty.json     — AOTY 评分
 *
 * 输出文件：
 *   data/seed-data.json        — 最终种子数据
 *   data/unmatched.json        — 匹配失败的条目
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PATHS = {
  albums: join(root, 'data', 'seed-albums.json'),
  meta: join(root, 'data', 'album-meta.json'),
  douban: join(root, 'data', 'reviews-douban.json'),
  pitchfork: join(root, 'data', 'reviews-pitchfork.json'),
  aoty: join(root, 'data', 'reviews-aoty.json'),
  output: join(root, 'data', 'seed-data.json'),
  unmatched: join(root, 'data', 'unmatched.json'),
};

// 预设调色板
const PALETTES = [
  ['#B7FF40','#151515','#F4F1E8'], ['#FF5C35','#32140D','#F2C94C'], ['#8E75FF','#1D1638','#8EF0E7'],
  ['#F5A5C7','#2D4835','#FFF0D7'], ['#2A66FF','#0B1536','#F2E9DA'], ['#C7A45D','#291D12','#63A48D'],
  ['#FF6978','#341C46','#FFD166'], ['#9FCEE8','#233248','#E8BE9D'], ['#E9E3D5','#1E2A42','#D6A756'],
  ['#D75B33','#142B2A','#E2D4B7'], ['#395DD8','#180D2B','#F5B3C8'], ['#D6A535','#0E1518','#B83A35'],
];

// 默认曲目模板（当没有真实音轨数据时的占位）
const DEFAULT_TRACKS = [
  { title: 'Track 1', duration: 210, track_number: 1 },
  { title: 'Track 2', duration: 195, track_number: 2 },
  { title: 'Track 3', duration: 224, track_number: 3 },
  { title: 'Track 4', duration: 188, track_number: 4 },
  { title: 'Track 5', duration: 246, track_number: 5 },
];

function makeKey(title, artist, year) {
  return `${title}|${artist}|${year}`;
}

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim();
}

function loadJSON(path) {
  if (!existsSync(path)) {
    console.warn(`⚠ 文件不存在，跳过: ${path}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    console.warn(`⚠ 文件解析失败: ${path} — ${err.message}`);
    return null;
  }
}

/**
 * 在对象中按 key 查找最佳匹配
 * metaData 的 key 格式: "MatchedTitle|MatchedArtist|year"
 * albumKey 格式: "title|artist|year"
 */
function findInMeta(metaData, album) {
  if (!metaData) return null;

  const exactKey = makeKey(album.title, album.artist, album.year);
  if (metaData[exactKey]) return metaData[exactKey];

  // 尝试模糊匹配
  const normalizedAlbumKey = normalize(makeKey(album.title, album.artist, album.year));
  for (const key of Object.keys(metaData)) {
    if (normalize(key) === normalizedAlbumKey) {
      return metaData[key];
    }
  }
  return null;
}

/**
 * 在乐评数据中查找匹配的评分
 */
function findReview(reviewsData, album) {
  if (!reviewsData) return null;

  const exactKey = makeKey(album.title, album.artist, album.year);
  if (reviewsData[exactKey] && !reviewsData[exactKey]._not_found && !reviewsData[exactKey]._error) {
    return reviewsData[exactKey];
  }

  // 模糊匹配
  const normalizedAlbumKey = normalize(makeKey(album.title, album.artist, album.year));
  for (const key of Object.keys(reviewsData)) {
    if (normalize(key) === normalizedAlbumKey) {
      const entry = reviewsData[key];
      if (entry && !entry._not_found && !entry._error) return entry;
    }
  }
  return null;
}

function main() {
  console.log('=== 数据合并脚本 ===\n');

  // 加载所有数据源
  const albums = loadJSON(PATHS.albums);
  if (!albums) {
    console.error('❌ 专辑列表文件不存在，无法继续');
    process.exit(1);
  }

  const metaData = loadJSON(PATHS.meta);
  const doubanData = loadJSON(PATHS.douban);
  const pitchforkData = loadJSON(PATHS.pitchfork);
  const aotyData = loadJSON(PATHS.aoty);

  console.log(`专辑列表: ${albums.length} 条`);
  console.log(`专辑元数据: ${metaData ? Object.keys(metaData).length : 0} 条`);
  console.log(`豆瓣评分: ${doubanData ? Object.keys(doubanData).length : 0} 条`);
  console.log(`Pitchfork 评分: ${pitchforkData ? Object.keys(pitchforkData).length : 0} 条`);
  console.log(`AOTY 评分: ${aotyData ? Object.keys(aotyData).length : 0} 条`);
  console.log('');

  const outputAlbums = [];
  const outputReviews = [];
  const outputTracks = [];
  const unmatched = [];

  for (const album of albums) {
    const id = album.billboard_rank;
    const palette = PALETTES[(id - 1) % PALETTES.length];

    // 查找专辑元数据（MusicBrainz）
    const meta = findInMeta(metaData, album);

    // 构建专辑记录
    const albumRecord = {
      id,
      title: album.title,
      artist: album.artist,
      year: album.year,
      cover_url: meta?.cover_url || null,
      netease_id: meta?.netease_id || null,
      billboard_rank: id,
      palette,
    };
    outputAlbums.push(albumRecord);

    // 构建乐评记录
    const sources = [
      { source: 'douban', data: doubanData, findFn: () => findReview(doubanData, album) },
      { source: 'pitchfork', data: pitchforkData, findFn: () => findReview(pitchforkData, album) },
      { source: 'aoty', data: aotyData, findFn: () => findReview(aotyData, album) },
    ];

    for (const { source, data, findFn } of sources) {
      if (!data) {
        // 该数据源未采集，跳过
        continue;
      }

      const review = findFn();
      if (review && review.score != null) {
        outputReviews.push({
          album_id: id,
          source,
          score: review.score,
          score_normalized: review.score_normalized,
          excerpt: review.excerpt || null,
          source_url: review.source_url || null,
        });
      } else {
        // 记录未匹配的专辑
        const reviewRaw = findInMeta(data, album) || {};
        if (!reviewRaw._not_found && !reviewRaw._error) {
          // 存在条目但无有效评分
        }
        if (reviewRaw._not_found) {
          unmatched.push({
            source,
            album_title: album.title,
            album_artist: album.artist,
            album_year: album.year,
            reason: 'not_found',
          });
        }
      }
    }

    // 构建曲目记录：优先使用 MusicBrainz 真实曲目，否则用占位曲目
    const realTracks = meta?.tracks;
    if (realTracks && realTracks.length > 0) {
      for (const track of realTracks) {
        outputTracks.push({
          album_id: id,
          title: track.title,
          duration: track.duration || 180,
          track_number: track.track_number || (realTracks.indexOf(track) + 1),
          netease_id: null,
        });
      }
    } else {
      // 无真实曲目数据时的占位
      const numTracks = Math.min(5 + (id % 6), 15);
      for (let t = 0; t < numTracks; t++) {
        outputTracks.push({
          album_id: id,
          title: `Track ${t + 1}`,
          duration: 180 + ((id * 13 + t * 17) % 180),
          track_number: t + 1,
          netease_id: null,
        });
      }
    }
  }

  // 输出最终种子数据
  const seedData = {
    _meta: {
      generated_at: new Date().toISOString(),
      album_count: outputAlbums.length,
      review_count: outputReviews.length,
      track_count: outputTracks.length,
      source_stats: {
        douban: outputReviews.filter((r) => r.source === 'douban').length,
        pitchfork: outputReviews.filter((r) => r.source === 'pitchfork').length,
        aoty: outputReviews.filter((r) => r.source === 'aoty').length,
      },
    },
    albums: outputAlbums,
    reviews: outputReviews,
    tracks: outputTracks,
  };

  writeFileSync(PATHS.output, JSON.stringify(seedData, null, 2), 'utf-8');
  console.log(`✅ 种子数据已生成: ${PATHS.output}`);
  console.log(`   专辑: ${outputAlbums.length} | 乐评: ${outputReviews.length} | 曲目: ${outputTracks.length}`);

  if (unmatched.length) {
    writeFileSync(PATHS.unmatched, JSON.stringify(unmatched, null, 2), 'utf-8');
    console.log(`⚠ 未匹配条目: ${unmatched.length} 条 → ${PATHS.unmatched}`);
  }
}

main();
