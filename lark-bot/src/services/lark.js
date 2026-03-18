/**
 * 飞书 API 服务
 * 用于发送消息、卡片、告警等
 */

const axios = require('axios');

class LarkBot {
  constructor() {
    this.appId = process.env.LARK_APP_ID;
    this.appSecret = process.env.LARK_APP_SECRET;
    this.webhookUrl = process.env.LARK_WEBHOOK_URL;
    this.accessToken = null;
    this.tokenExpireTime = 0;
  }

  /**
   * 获取飞书访问令牌
   */
  async getAccessToken() {
    // 如果 token 还没过期，直接返回
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        {
          app_id: this.appId,
          app_secret: this.appSecret,
        }
      );

      if (response.data.code === 0) {
        this.accessToken = response.data.tenant_access_token;
        // token 有效期为 2 小时，提前 5 分钟刷新
        this.tokenExpireTime = Date.now() + (response.data.expire - 300) * 1000;
        return this.accessToken;
      } else {
        throw new Error(`Failed to get access token: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  }

  /**
   * 发送普通文本消息
   */
  async sendMessage(chatId, text) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.post(
        'https://open.feishu.cn/open-apis/im/v1/messages',
        {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text }),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            receive_id_type: 'chat_id',
          },
        }
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to send message: ${response.data.msg}`);
      }

      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * 发送交互式卡片消息
   */
  async sendCardMessage(chatId, cardContent) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.post(
        'https://open.feishu.cn/open-apis/im/v1/messages',
        {
          receive_id: chatId,
          msg_type: 'interactive',
          content: JSON.stringify(cardContent),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            receive_id_type: 'chat_id',
          },
        }
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to send card message: ${response.data.msg}`);
      }

      return response.data;
    } catch (error) {
      console.error('Error sending card message:', error);
      throw error;
    }
  }

  /**
   * 发送告警消息（使用 Webhook）
   */
  async sendAlert(message) {
    if (!this.webhookUrl) {
      console.warn('Webhook URL not configured, skipping alert');
      return;
    }

    try {
      const response = await axios.post(this.webhookUrl, {
        msg_type: 'text',
        content: {
          text: `🚨 网站告警\n\n${message}\n\n⏰ ${new Date().toLocaleString()}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error sending alert:', error);
      throw error;
    }
  }

  /**
   * 发送日报/周报
   */
  async sendReport(chatId, report, type = 'daily') {
    const title = type === 'daily' ? '📊 每日网站报告' : '📊 每周网站报告';
    const period = type === 'daily' ? '今日' : '本周';

    const cardContent = {
      config: {
        wide_screen_mode: true,
      },
      header: {
        title: {
          tag: 'plain_text',
          content: title,
        },
        subtitle: {
          tag: 'plain_text',
          content: `${period}数据概览`,
        },
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**访问数据**\n• 总访问：${report.visits || 'N/A'}\n• 独立访客：${report.uniqueVisitors || 'N/A'}\n• 平均停留：${report.avgDuration || 'N/A'}`,
          },
        },
        {
          tag: 'hr',
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**内容统计**\n• 文章总数：${report.totalPosts || 'N/A'}\n• ${period}新增：${report.newPosts || 'N/A'}`,
          },
        },
      ],
    };

    await this.sendCardMessage(chatId, cardContent);
  }
}

module.exports = { LarkBot };
