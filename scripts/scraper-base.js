/**
 * 爬虫基类
 * 提供统一的延迟控制、错误重试、日志输出和请求头管理
 *
 * 所有乐评爬虫（豆瓣/Pitchfork/AOTY）继承此基类
 */

export class ScraperBase {
  constructor(name, options = {}) {
    this.name = name;
    this.minDelay = options.minDelay || 2000;   // 最小请求间隔（毫秒）
    this.maxDelay = options.maxDelay || 5000;   // 最大请求间隔（毫秒）
    this.maxRetries = options.maxRetries || 3;   // 最大重试次数
    this.retryDelay = options.retryDelay || 5000; // 重试等待（毫秒）
    this.userAgent =
      options.userAgent ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
  }

  /**
   * 随机延迟（模拟人类浏览行为）
   */
  async delay() {
    const ms = this.minDelay + Math.floor(Math.random() * (this.maxDelay - this.minDelay));
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 带重试的 HTTP 请求
   */
  async fetch(url, options = {}) {
    const headers = {
      'User-Agent': this.userAgent,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      ...options.headers,
    };

    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
          // 429 Too Many Requests 或 403 Forbidden → 等待更长时间后重试
          if (response.status === 429 || response.status === 403) {
            this.log(`HTTP ${response.status}，等待 ${this.retryDelay * 2}ms 后重试...`);
            await new Promise((r) => setTimeout(r, this.retryDelay * 2));
            continue;
          }
          throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        return text;
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          this.log(`请求失败 (尝试 ${attempt + 1}/${this.maxRetries + 1}): ${err.message}`);
          await new Promise((r) => setTimeout(r, this.retryDelay));
        }
      }
    }
    throw lastError;
  }

  /**
   * 规范化字符串（用于比较专辑名/艺人名）
   */
  normalize(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 专辑名相似度匹配
   * 规则匹配（一期方案），不做 Levenshtein 模糊匹配
   */
  matchAlbumName(sourceName, targetName) {
    const s = this.normalize(sourceName);
    const t = this.normalize(targetName);
    return s === t || s.includes(t) || t.includes(s);
  }

  log(msg) {
    console.log(`[${this.name}] ${msg}`);
  }

  error(msg) {
    console.error(`[${this.name}] ${msg}`);
  }
}
