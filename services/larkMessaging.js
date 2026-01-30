/**
 * Lark Messaging Service - Handles Lark API interactions for messaging
 */

const axios = require('axios');
const config = require('../config');
const { retry } = require('../utils');

class LarkMessagingService {
  constructor() {
    this.baseURL = 'https://open.larksuite.com/open-apis';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get tenant access token
   * @returns {Promise<string>} - Access token
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/auth/v3/tenant_access_token/internal`,
        {
          app_id: config.lark.appId,
          app_secret: config.lark.appSecret,
        }
      );

      if (response.data.code === 0) {
        this.accessToken = response.data.tenant_access_token;
        this.tokenExpiry = Date.now() + (response.data.expire - 300) * 1000;
        return this.accessToken;
      } else {
        throw new Error(`Failed to get access token: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('Access token error:', error);
      throw error;
    }
  }

  /**
   * Make authenticated API request
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {object} data - Request data
   * @returns {Promise<object>} - Response data
   */
  async apiRequest(method, endpoint, data = null) {
    const token = await this.getAccessToken();
    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await axios({
        method,
        url,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data,
      });

      if (response.data.code !== 0) {
        throw new Error(`API error: ${response.data.msg}`);
      }

      return response.data.data;
    } catch (error) {
      console.error(`API request failed: ${method} ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Send message to chat
   * @param {string} receiveId - Chat ID or user ID
   * @param {string} content - Message content
   * @param {string} msgType - Message type (text, interactive, etc.)
   * @param {string} receiveIdType - Receive ID type (chat_id, user_id, etc.)
   * @returns {Promise<object>} - Message data
   */
  async sendMessage(receiveId, content, msgType = 'text', receiveIdType = 'chat_id') {
    let formattedContent = content;

    if (msgType === 'text') {
      formattedContent = JSON.stringify({ text: content });
    } else if (typeof content === 'object') {
      formattedContent = JSON.stringify(content);
    }

    return await retry(async () => {
      return await this.apiRequest('POST', `/im/v1/messages?receive_id_type=${receiveIdType}`, {
        receive_id: receiveId,
        msg_type: msgType,
        content: formattedContent,
      });
    });
  }

  /**
   * Reply to a message
   * @param {string} messageId - Message ID to reply to
   * @param {string} content - Reply content
   * @param {string} msgType - Message type
   * @returns {Promise<object>} - Reply message data
   */
  async replyMessage(messageId, content, msgType = 'text') {
    let formattedContent = content;

    if (msgType === 'text') {
      formattedContent = JSON.stringify({ text: content });
    } else if (typeof content === 'object') {
      formattedContent = JSON.stringify(content);
    }

    return await this.apiRequest('POST', `/im/v1/messages/${messageId}/reply`, {
      msg_type: msgType,
      content: formattedContent,
    });
  }

  /**
   * Get message thread replies
   * @param {string} messageId - Message ID
   * @returns {Promise<object[]>} - Array of reply messages
   */
  async getMessageReplies(messageId) {
    try {
      const response = await this.apiRequest(
        'GET',
        `/im/v1/messages/${messageId}/replies?page_size=50`
      );

      return response.items || [];
    } catch (error) {
      console.error('Failed to get message replies:', error);
      return [];
    }
  }

  /**
   * Create rich text card message
   * @param {string} title - Card title
   * @param {string} content - Card content
   * @param {Array} buttons - Optional buttons
   * @returns {object} - Card message content
   */
  createCardMessage(title, content, buttons = []) {
    const elements = [
      {
        tag: 'markdown',
        content,
      },
    ];

    if (buttons.length > 0) {
      elements.push({
        tag: 'action',
        actions: buttons,
      });
    }

    return {
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: title,
          },
          template: 'blue',
        },
        elements,
      },
    };
  }
}

module.exports = new LarkMessagingService();
