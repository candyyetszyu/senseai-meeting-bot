/**
 * Lark Bitable Service - Handles Bitable operations for thoughts storage
 */

const config = require('../config');

class LarkBitableService {
  constructor() {
    this.messaging = null;
  }

  setMessaging(messagingService) {
    this.messaging = messagingService;
  }

  /**
   * Add thought to Bitable
   * @param {string} thought - The thought content
   * @param {string} author - Author name
   * @param {string} meetingContext - Meeting context/title
   * @returns {Promise<object>} - Created record
   */
  async addThought(thought, author, meetingContext = '', userId = null, userIdType = 'open_id') {
    try {
      if (!config.lark.bitableAppToken || !config.lark.thoughtsTableId) {
        console.warn('Bitable not configured - thoughts feature disabled');
        return null;
      }

      const fields = {
        'Thought': thought,
        'Meeting Context': meetingContext,
      };

      if (userId) {
        fields['Author'] = [{
          id: userId,
        }];
      }

      const result = await this.messaging.apiRequest(
        'POST',
        `/bitable/v1/apps/${config.lark.bitableAppToken}/tables/${config.lark.thoughtsTableId}/records`,
        { fields }
      );

      console.log('✅ Thought added to Bitable with Author:', { userId, context: meetingContext });
      return result;
    } catch (error) {
      console.error('❌ Add thought error:', error);
      throw error;
    }
  }

  /**
   * Get recent thoughts from Bitable
   * @param {number} limit - Number of thoughts to fetch
   * @returns {Promise<object[]>} - Array of thoughts
   */
  async getRecentThoughts(limit = 5) {
    try {
      if (!config.lark.bitableAppToken || !config.lark.thoughtsTableId) {
        console.warn('Bitable not configured - thoughts feature disabled');
        return [];
      }

      const response = await this.messaging.apiRequest(
        'GET',
        `/bitable/v1/apps/${config.lark.bitableAppToken}/tables/${config.lark.thoughtsTableId}/records?page_size=100`
      );

      const items = response.items || [];

      console.log(`📊 Retrieved ${items.length} thoughts from Bitable`);
      if (items.length > 0) {
        console.log('📋 Sample record fields:', Object.keys(items[0].fields));
        console.log('📋 Sample record values:', JSON.stringify(items[0].fields, null, 2));
      }

      const sorted = items.sort((a, b) => {
        const timeA = a.fields['Created Time'] || a.fields['Date'] || a.fields['创建时间'] || a.created_time || 0;
        const timeB = b.fields['Created Time'] || b.fields['Date'] || b.fields['创建时间'] || b.created_time || 0;
        return timeB - timeA;
      });

      return sorted.slice(0, limit);
    } catch (error) {
      console.error('Get recent thoughts error:', error);
      return [];
    }
  }

  /**
   * Get all thoughts from Bitable
   * @param {number} limit - Maximum number of thoughts to fetch
   * @returns {Promise<object[]>} - Array of all thoughts
   */
  async getAllThoughts(limit = 100) {
    try {
      if (!config.lark.bitableAppToken || !config.lark.thoughtsTableId) {
        console.warn('Bitable not configured - thoughts feature disabled');
        return [];
      }

      const response = await this.messaging.apiRequest(
        'GET',
        `/bitable/v1/apps/${config.lark.bitableAppToken}/tables/${config.lark.thoughtsTableId}/records?page_size=${limit}&sort=["Created Time DESC"]`
      );

      return response.items || [];
    } catch (error) {
      console.error('Get all thoughts error:', error);
      return [];
    }
  }
}

module.exports = new LarkBitableService();
