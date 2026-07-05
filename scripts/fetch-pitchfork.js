/**
 * Pitchfork 乐评爬虫
 * 从 Pitchfork 搜索并采集专辑评分和编辑摘要
 *
 * 用法：node scripts/fetch-pitchfork.js
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
const OUTPUT_PATH = join(root, 'data', 'reviews-pitchfork.json');

class PitchforkScraper extends ScraperBase {
  constructor() {
    super('pitchfork', { minDelay: 2000, maxDelay: 4000 });
  }

  /**
   * 在 Pitchfork 搜索专辑
   * Pitchfork 搜索：https://pitchfork.com/search/?query=xxx
   */
  async searchAlbum(title, artist) {
    const query = encodeURIComponent(`${artist} ${title}`);
    const searchUrl = `https://pitchfork.com/search/?query=${query}`;

    this.log(`搜索: ${title} - ${artist}`);
    const html = await this.fetch(searchUrl);
    const $ = cheerio.load(html);

    const results = [];

    // 解析搜索结果中的专辑条目
    $('.search-result__content, .search-results__item').each((_, el) => {
      const linkEl = $(el).find('a[href*="/reviews/albums/"]').first();
      if (linkEl.length) {
        const href = linkEl.attr('href');
        const text = linkEl.text().trim();
        if (href && text) {
          // 确保 URL 完整
          const fullUrl = href.startsWith('http') ? href : `https://pitchfork.com${href}`;
          results.push({ title: text, url: fullUrl });
        }
      }
    });

    // 另一种页面结构的备选解析
    if (results.length === 0) {
      $('a[href*="/reviews/albums/"]').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href && text && text.length > 3) {
          const fullUrl = href.startsWith('http') ? href : `https://pitchfork.com${href}`;
          results.push({ title: text, url: fullUrl });
        }
      });
    }

    return results;
  }

  /**
   * 采集专辑详情页的评分和摘要
   * Pitchfork 专辑评论页：https://pitchfork.com/reviews/albums/xxx/
   */
  async fetchAlbumDetail(url) {
    const html = await this.fetch(url);
    const $ = cheerio.load(html);

    // 提取评分（Pitchfork 新页面结构）
    let score = null;
    // 尝试多种选择器适配不同页面结构
    const scoreSelectors = [
      '.ScoreCircle__circle__score',
      '.score-circle__score',
      '.Rating__rating',
      '[data-testid="review-score"]',
      '.score',
    ];
    for (const sel of scoreSelectors) {
      const el = $(sel).first();
      if (el.length) {
        const scoreText = el.text().trim();
        const parsed = parseFloat(scoreText);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 10) {
          score = parsed;
          break;
        }
      }
    }

    // 提取编辑摘要（取第一段有意义的文字）
    let excerpt = null;
    // Pitchfork 新结构
    const abstractEl = $('.review-detail__abstract p, .ReviewAbstract p').first();
    if (abstractEl.length) {
      excerpt = abstractEl.text().trim();
    }
    // 备选
    if (!excerpt) {
      $('.review-body p, .article-content p').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 50 && !excerpt) {
          excerpt = text;
          return false;
        }
      });
    }

    return {
      score: score ? Number(score.toFixed(1)) : null,
      score_normalized: score ? Number(score.toFixed(1)) : null, // Pitchfork 10 分制
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
  const scraper = new PitchforkScraper();
  await scraper.run(albums);
}

main().catch((err) => {
  console.error('脚本异常:', err);
  process.exit(1);
});
