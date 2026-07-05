/**
 * Album of the Year 乐评爬虫
 * 从 AOTY 搜索并采集专辑的 Critic Score 和编辑摘要
 *
 * 用法：node scripts/fetch-aoty.js
 *
 * 前置条件：data/seed-albums.json 已准备好 100 张专辑列表
 */

import 'dotenv/config';
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScraperBase } from './scraper-base.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALBUMS_PATH = join(root, 'data', 'seed-albums.json');
const OUTPUT_PATH = join(root, 'data', 'reviews-aoty.json');

class AOTYScraper extends ScraperBase {
  constructor() {
    super('aoty', { minDelay: 2000, maxDelay: 4000 });
  }

  /**
   * 在 AOTY 搜索专辑
   * AOTY 搜索：https://www.albumoftheyear.org/search/?q=xxx
   */
  async searchAlbum(title, artist) {
    const query = encodeURIComponent(`${artist} ${title}`);
    const searchUrl = `https://www.albumoftheyear.org/search/?q=${query}`;

    this.log(`搜索: ${title} - ${artist}`);
    const html = await this.fetch(searchUrl);
    const $ = cheerio.load(html);

    const results = [];

    // 解析搜索结果中的专辑条目
    $('.searchResultRow, .albumBlock').each((_, el) => {
      const linkEl = $(el).find('a[href*="/album/"]').first();
      if (linkEl.length) {
        const href = linkEl.attr('href');
        const text = linkEl.text().trim();
        if (href && text && text.length > 2) {
          const fullUrl = href.startsWith('http') ? href : `https://www.albumoftheyear.org${href}`;
          results.push({ title: text, url: fullUrl });
        }
      }
    });

    // 备选解析
    if (results.length === 0) {
      $('a[href*="/album/"]').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href && text.length > 3 && !href.includes('user')) {
          const fullUrl = href.startsWith('http') ? href : `https://www.albumoftheyear.org${href}`;
          results.push({ title: text, url: fullUrl });
        }
      });
    }

    return results;
  }

  /**
   * 采集专辑详情页的 Critic Score 和摘要
   * AOTY 专辑页：https://www.albumoftheyear.org/album/xxx/
   */
  async fetchAlbumDetail(url) {
    const html = await this.fetch(url);
    const $ = cheerio.load(html);

    // 提取 Critic Score（0-100）
    let score = null;
    // AOTY 页面结构：大号数字通常是 Critic Score
    const scoreSelectors = [
      '.criticScore .scoreValue',
      '.criticScoreContainer .scoreValue',
      '.averageCriticScore',
      '.albumCriticScoreBox .score',
      '.criticScore',
    ];
    for (const sel of scoreSelectors) {
      const el = $(sel).first();
      if (el.length) {
        const scoreText = el.text().trim();
        const parsed = parseInt(scoreText, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
          score = parsed;
          break;
        }
      }
    }

    // 提取编辑摘要/描述
    let excerpt = null;
    const descEl = $('.albumTopBox .description p, .albumDescription p').first();
    if (descEl.length) {
      const text = descEl.text().trim();
      if (text.length > 30) {
        excerpt = text;
      }
    }

    // 归一化：100 分制 → 10 分制
    const normalized = score ? Number((score / 10).toFixed(1)) : null;

    return {
      score: score,           // 原始分（100 分制）
      score_normalized: normalized, // 归一化到 10 分制
      excerpt: excerpt ? excerpt.slice(0, 300) : null,
      source_url: url,
    };
  }

  async run(albums) {
    let existing = {};
    if (existsSync(OUTPUT_PATH)) {
      existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
      this.log(`已有缓存: ${Object.keys(existing).length} 条记录`);
    }

    const results = { ...existing };
    let found = 0;
    let notFound = 0;
    let skipped = 0;

    for (let i = 0; i < albums.length; i++) {
      const album = albums[i];
      const key = `${album.title}|${album.artist}|${album.year}`;

      if (results[key]) {
        skipped++;
        continue;
      }

      try {
        const searchResults = await this.searchAlbum(album.title, album.artist);

        if (searchResults.length === 0) {
          notFound++;
          this.log(`[${i + 1}/${albums.length}] ✗ 未找到: ${album.title}`);
          results[key] = { score: null, score_normalized: null, excerpt: null, source_url: null, _not_found: true };
        } else {
          const matched = searchResults.find((r) =>
            this.matchAlbumName(r.title, album.title)
          ) || searchResults[0];

          const detail = await this.fetchAlbumDetail(matched.url);
          results[key] = detail;
          found++;
          this.log(`[${i + 1}/${albums.length}] ✓ ${album.title}: score=${detail.score || 'N/A'}`);
        }
      } catch (err) {
        this.error(`[${i + 1}/${albums.length}] 错误: ${album.title} - ${err.message}`);
        results[key] = { score: null, score_normalized: null, excerpt: null, source_url: null, _error: err.message };
        notFound++;
      }

      if ((found + notFound) % 5 === 0) {
        writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
        this.log(`💾 已保存中间结果`);
      }

      await this.delay();
    }

    writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
    this.log(`\n=== 采集完成 ===`);
    this.log(`总计: ${albums.length} | 成功: ${found} | 跳过: ${skipped} | 未找到: ${notFound}`);
  }
}

async function main() {
  if (!existsSync(ALBUMS_PATH)) {
    console.error(`专辑列表文件不存在: ${ALBUMS_PATH}`);
    process.exit(1);
  }

  const albums = JSON.parse(readFileSync(ALBUMS_PATH, 'utf-8'));
  const scraper = new AOTYScraper();
  await scraper.run(albums);
}

main().catch((err) => {
  console.error('脚本异常:', err);
  process.exit(1);
});
