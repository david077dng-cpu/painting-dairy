/**
 * 网站监控服务
 * 功能：健康检查、SSL证书监控、页面加载速度测试
 */

const axios = require('axios');
const https = require('https');
const { URL } = require('url');

class WebsiteMonitor {
  constructor() {
    this.siteUrl = process.env.SITE_URL || 'https://xlilian.art';
    this.checkInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL) || 5;
    this.sslCheckInterval = parseInt(process.env.SSL_CHECK_INTERVAL) || 1440;
    this.results = [];
    this.maxResults = 100;
  }

  /**
   * 健康检查
   */
  async checkHealth() {
    const startTime = Date.now();
    const result = {
      url: this.siteUrl,
      timestamp: new Date().toISOString(),
      healthy: false,
      statusCode: null,
      responseTime: 0,
      error: null,
    };

    try {
      const response = await axios.get(this.siteUrl, {
        timeout: 30000,
        validateStatus: (status) => status < 500,
      });

      result.statusCode = response.status;
      result.responseTime = Date.now() - startTime;
      result.healthy = response.status === 200;

      // 额外检查关键页面
      const criticalPages = ['/posts', '/posts/demo'];
      for (const page of criticalPages) {
        try {
          const pageResponse = await axios.get(`${this.siteUrl}${page}`, {
            timeout: 10000,
          });
          if (pageResponse.status !== 200) {
            console.warn(`Critical page ${page} returned ${pageResponse.status}`);
          }
        } catch (err) {
          console.warn(`Failed to check critical page ${page}:`, err.message);
        }
      }
    } catch (error) {
      result.error = error.message;
      result.responseTime = Date.now() - startTime;

      if (error.code === 'ENOTFOUND') {
        result.error = '域名解析失败，请检查 DNS 配置';
      } else if (error.code === 'ECONNREFUSED') {
        result.error = '连接被拒绝，服务器可能已下线';
      } else if (error.code === 'ETIMEDOUT') {
        result.error = '连接超时，服务器响应过慢';
      }
    }

    // 保存结果
    this.results.push(result);
    if (this.results.length > this.maxResults) {
      this.results.shift();
    }

    return result;
  }

  /**
   * SSL 证书检查
   */
  async checkSSL() {
    const url = new URL(this.siteUrl);
    const options = {
      hostname: url.hostname,
      port: 443,
      method: 'GET',
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        const cert = res.socket.getPeerCertificate();

        if (!cert || !cert.valid_from) {
          reject(new Error('无法获取 SSL 证书信息'));
          return;
        }

        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const now = new Date();
        const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

        resolve({
          domain: url.hostname,
          issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
          subject: cert.subject?.CN || url.hostname,
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          daysUntilExpiry,
          serialNumber: cert.serialNumber,
          fingerprint: cert.fingerprint,
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  /**
   * 页面加载速度测试
   */
  async testPageSpeed(path = '/') {
    const startTime = Date.now();
    const metrics = {
      url: `${this.siteUrl}${path}`,
      timestamp: new Date().toISOString(),
      totalTime: 0,
      dnsTime: 0,
      connectTime: 0,
      ttfb: 0,
      downloadTime: 0,
      status: null,
      size: 0,
    };

    try {
      // 使用 axios 测量各个阶段的时间
      const dnsStart = Date.now();
      const response = await axios.get(metrics.url, {
        timeout: 30000,
        responseType: 'arraybuffer',
        // 自定义代理来测量时间
        httpAgent: new (require('http').Agent)({ keepAlive: false }),
        httpsAgent: new (require('https').Agent)({ keepAlive: false }),
      });

      metrics.totalTime = Date.now() - startTime;
      metrics.status = response.status;
      metrics.size = response.data.length;

      // 尝试从响应头获取更多信息
      if (response.headers['x-response-time']) {
        metrics.ttfb = parseInt(response.headers['x-response-time']);
      }

      return metrics;
    } catch (error) {
      metrics.totalTime = Date.now() - startTime;
      metrics.status = error.response?.status || 0;
      metrics.error = error.message;
      return metrics;
    }
  }

  /**
   * 获取历史监控数据
   */
  getHistory(startTime, endTime) {
    return this.results.filter(
      (r) =>
        new Date(r.timestamp) >= new Date(startTime) &&
        new Date(r.timestamp) <= new Date(endTime)
    );
  }

  /**
   * 获取统计摘要
   */
  getStats(timeRange = 24) {
    // 默认最近24小时
    const cutoff = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    const recent = this.results.filter((r) => new Date(r.timestamp) >= cutoff);

    if (recent.length === 0) {
      return {
        total: 0,
        healthy: 0,
        unhealthy: 0,
        avgResponseTime: 0,
        uptime: 0,
      };
    }

    const healthy = recent.filter((r) => r.healthy).length;
    const avgResponseTime =
      recent.reduce((sum, r) => sum + r.responseTime, 0) / recent.length;

    return {
      total: recent.length,
      healthy,
      unhealthy: recent.length - healthy,
      avgResponseTime: Math.round(avgResponseTime),
      uptime: (healthy / recent.length) * 100,
    };
  }
}

module.exports = { WebsiteMonitor };
