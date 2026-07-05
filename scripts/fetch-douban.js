/**
 * 豆瓣音乐爬虫
 * 从豆瓣音乐搜索并采集专辑评分和热门短评
 *
 * 用法：node scripts/fetch-douban.js
 *
 * 前置条件：
 *   1. data/seed-albums.json 已准备好 100 张专辑列表
 *   2. 可选：设置 DOUBAN_COOKIE 环境变量（携带登录态 cookie 提高稳定性）
 */

import 'dotenv/config';
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScraperBase } from './scraper-base.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALBUMS_PATH = join(root, 'data', 'seed-albums.json');
const OUTPUT_PATH = join(root, 'data', 'reviews-douban.json');

class DoubanScraper extends ScraperBase {
  constructor() {
    super('douban', { minDelay: 3000, maxDelay: 6000 });
  }

  /**
   * 在豆瓣搜索专辑
   * 豆瓣搜索页：https://search.douban.com/music/subject_search?search_text=xxx
   */
  async searchAlbum(title, artist) {
    const query = encodeURIComponent(`${artist} ${title}`);
    const searchUrl = `https://search.douban.com/music/subject_search?search_text=${query}`;

    this.log(`搜索: ${title} - ${artist}`);
    const html = await this.fetch(searchUrl);

    const $ = cheerio.load(html);
    const results = [];

    // 解析搜索结果列表
    $('.sc-bwzfXH, .item-root, .result').each((_, el) => {
      const titleEl = $(el).find('.title-text, .subject-title, h3 a').first();
      const subjectTitle = titleEl.text().trim();
      const subjectLink = titleEl.attr('href') || $(el).find('a[href*="/subject/"]').first().attr('href') || '';

      if (subjectTitle && subjectLink) {
        results.push({ title: subjectTitle, url: subjectLink });
      }
    });

    return results;
  }

  /**
   * 采集专辑详情页的评分和短评
   * 豆瓣专辑页：https://music.douban.com/subject/xxxxx/
   */
  async fetchAlbumDetail(url) {
    const html = await this.fetch(url);
    const $ = cheerio.load(html);

    // 提取评分
    let score = null;
    const ratingEl = $('.rating_num').first();
    if (ratingEl.length) {
      const scoreText = ratingEl.text().trim();
      score = parseFloat(scoreText);
      if (isNaN(score)) score = null;
    }

    // 提取热门短评（取点赞数最高的 1-2 条）
    const excerpts = [];
    $('.comment-item, .short-comment-item').each((_, el) => {
      if (excerpts.length >= 2) return false;
      const commentText = $(el).find('.comment-content, .short').text().trim();
      if (commentText && commentText.length > 20) {
        excerpts.push(commentText);
      }
    });

    return {
      score: score ? Number(score.toFixed(1)) : null,
      score_normalized: score ? Number(score.toFixed(1)) : null, // 豆瓣 10 分制，无需转换
      excerpt: excerpts[0] || null,
      source_url: url,
    };
  }

  /**
   * 入口：遍历专辑列表并采集
   */
  async run(albums) {
    // 读取已有缓存
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
          // 记录空结果，避免重复搜索
          results[key] = { score: null, score_normalized: null, excerpt: null, source_url: null, _not_found: true };
        } else {
          // 尝试匹配最佳搜索结果
          const matched = searchResults.find((r) =>
            this.matchAlbumName(r.title, album.title)
          ) || searchResults[0];

          const detail = await this.fetchAlbumDetail(matched.url);
          results[key] = detail;
          found++;
          this.log(
            `[${i + 1}/${albums.length}] ✓ ${album.title}: score=${detail.score || 'N/A'}`
          );
        }
      } catch (err) {
        this.error(`[${i + 1}/${albums.length}] 错误: ${album.title} - ${err.message}`);
        results[key] = { score: null, score_normalized: null, excerpt: null, source_url: null, _error: err.message };
        notFound++;
      }

      // 每 5 条保存一次中间结果
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
  const scraper = new DoubanScraper();
  await scraper.run(albums);
}

main().catch((err) => {
  console.error('脚本异常:', err);
  process.exit(1);
});
