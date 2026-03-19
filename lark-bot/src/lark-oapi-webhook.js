/**
 * 使用 lark-oapi 官方 SDK 处理 webhook
 */

const { Client } = require('@larksuiteoapi/node-sdk');
const crypto = require('crypto');

// 配置
const config = {
  appId: process.env.LARK_APP_ID,
  appSecret: process.env.LARK_APP_SECRET,
};

// 创建 Lark 客户端
const client = new Client(config);

/**
 * 验证请求签名
 * 飞书文档: https://open.feishu.cn/document/ukTMukTMukTM/uYzM5YjL1MzU24CNzcjN/event-subscription-callback#e7e6c40c
 */
function verifyRequest(data, signature, timestamp, nonce) {
  if (!process.env.LARK_ENCRYPT_KEY) {
    return true; // 如果没有配置加密密钥，跳过验证
  }

  const token = process.env.LARK_VERIFICATION_TOKEN || '';
  const stringToSign = `${timestamp}${nonce}${token}${data}`;

  const calculated = crypto
    .createHash('sha256')
    .update(stringToSign)
    .digest('hex');

  return calculated === signature;
}

/**
 * 解密消息（如果启用了加密）
 */
function decryptMessage(encryptKey, encryptData) {
  if (!encryptKey || !encryptData) {
    return null;
  }

  // 飞书加密使用的 AES-256-CBC
  // 这里简化处理，实际生产环境需要完整实现
  // 文档: https://open.feishu.cn/document/ukTMukTMukTM/uYzM5YjL1MzU24CNzcjN/event-subscription-callback#e7e6c40c

  // 返回原始数据（假设未加密或外部处理）
  return encryptData;
}

/**
 * 处理 Challenge 验证
 */
function handleChallenge(body) {
  if (body.type === 'url_verification') {
    return {
      statusCode: 200,
      body: { challenge: body.challenge }
    };
  }
  return null;
}

/**
 * 主处理函数 - Express 中间件
 */
function createLarkWebhookHandler(options = {}) {
  const {
    onMessage,      // 收到消息时的回调
    onEvent,        // 收到事件时的回调
    onError,        // 错误处理回调
    verificationToken = process.env.LARK_VERIFICATION_TOKEN,
    encryptKey = process.env.LARK_ENCRYPT_KEY
  } = options;

  return async (req, res) => {
    try {
      // 1. 获取请求信息
      const body = req.body;
      const signature = req.headers('X-Lark-Signature') || req.headers('x-lark-signature');
      const timestamp = req.headers('X-Lark-Timestamp') || req.headers('x-lark-timestamp');
      const nonce = req.headers('X-Lark-Nonce') || req.headers('x-lark-nonce');

      console.log('[Lark Webhook] Received request:', {
        type: body?.type,
        eventType: body?.header?.event_type,
        timestamp
      });

      // 2. 处理 Challenge 验证 (飞书首次配置 webhook 时会发送)
      const challengeResponse = handleChallenge(body);
      if (challengeResponse) {
        console.log('[Lark Webhook] Challenge verified');
        return res.status(200).json(challengeResponse.body);
      }

      // 3. 验证签名（可选，根据安全需求）
      if (signature && !verifyRequest(body, signature, timestamp, nonce)) {
        console.error('[Lark Webhook] Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // 4. 解密消息（如果启用了加密）
      let eventData = body;
      if (body.encrypt) {
        const decrypted = decryptMessage(encryptKey, body.encrypt);
        if (decrypted) {
          eventData = JSON.parse(decrypted);
        }
      }

      // 5. 处理事件
      const eventType = eventData?.header?.event_type;

      // 消息事件
      if (eventType === 'im.message.receive_v1' && onMessage) {
        const message = eventData.event.message;
        const chatId = message.chat_id;
        const content = JSON.parse(message.content);

        await onMessage({
          chatId,
          message,
          content,
          event: eventData.event
        });
      }

      // 其他事件
      else if (onEvent) {
        await onEvent({
          eventType,
          event: eventData.event,
          raw: eventData
        });
      }

      // 6. 返回成功响应
      return res.status(200).json({ code: 0 });

    } catch (error) {
      console.error('[Lark Webhook] Error:', error);

      if (onError) {
        await onError(error, req, res);
      }

      // 始终返回 JSON，防止飞书报"非合法JSON格式"
      return res.status(500).json({
        code: -1,
        error: error.message
      });
    }
  };
}

// 导出
module.exports = {
  createLarkWebhookHandler,
  verifyRequest,
  decryptMessage,
  client
};
