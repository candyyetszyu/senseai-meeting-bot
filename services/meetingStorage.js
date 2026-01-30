/**
 * Meeting Storage Service - Handles meeting transcripts and notes storage in Bitable
 */

const config = require('../config');

class MeetingStorageService {
  constructor() {
    this.messaging = null;
  }

  setMessaging(messagingService) {
    this.messaging = messagingService;
  }

  /**
   * Add meeting transcript and notes to Bitable
   * @param {string} transcript - The meeting transcript
   * @param {string} notes - AI-generated meeting notes
   * @param {string} meetingTitle - Meeting title/context
   * @param {string} attendees - List of attendees (optional)
   * @returns {Promise<object>} - Created record
   */
  async addMeetingRecord(transcript, notes, meetingTitle = '', attendees = '') {
    try {
      if (!config.lark.meetingTableAppToken || !config.lark.meetingTableId) {
        console.warn('Meeting table not configured - meeting storage disabled');
        return null;
      }

      const fields = {
        'Transcript': transcript,
        'Meeting Notes': notes,
        'Meeting Title': meetingTitle,
        'Attendees': attendees,
      };

      const result = await this.messaging.apiRequest(
        'POST',
        `/bitable/v1/apps/${config.lark.meetingTableAppToken}/tables/${config.lark.meetingTableId}/records`,
        { fields }
      );

      console.log('✅ Meeting record added to Bitable:', { title: meetingTitle });
      return result;
    } catch (error) {
      console.error('❌ Add meeting record error:', error);
      throw error;
    }
  }

  /**
   * Get recent meeting records from Bitable
   * @param {number} limit - Number of records to fetch
   * @returns {Promise<object[]>} - Array of meeting records
   */
  async getRecentMeetings(limit = 10) {
    try {
      if (!config.lark.meetingTableAppToken || !config.lark.meetingTableId) {
        console.warn('Meeting table not configured - meeting storage disabled');
        return [];
      }

      const response = await this.messaging.apiRequest(
        'GET',
        `/bitable/v1/apps/${config.lark.meetingTableAppToken}/tables/${config.lark.meetingTableId}/records?page_size=${limit}&sort=["Created Time DESC"]`
      );

      const items = response.items || [];
      console.log(`📊 Retrieved ${items.length} meeting records from Bitable`);
      
      return items;
    } catch (error) {
      console.error('Get recent meetings error:', error);
      return [];
    }
  }

  /**
   * Search meetings by title
   * @param {string} searchTerm - Search term for meeting title
   * @returns {Promise<object[]>} - Array of matching meeting records
   */
  async searchMeetings(searchTerm) {
    try {
      if (!config.lark.meetingTableAppToken || !config.lark.meetingTableId) {
        console.warn('Meeting table not configured - meeting storage disabled');
        return [];
      }

      const response = await this.messaging.apiRequest(
        'GET',
        `/bitable/v1/apps/${config.lark.meetingTableAppToken}/tables/${config.lark.meetingTableId}/records?page_size=100`
      );

      const items = response.items || [];
      
      // Filter by title containing search term (case-insensitive)
      const filtered = items.filter(record => {
        const title = record.fields['Meeting Title'] || '';
        return title.toLowerCase().includes(searchTerm.toLowerCase());
      });

      console.log(`🔍 Found ${filtered.length} meetings matching "${searchTerm}"`);
      return filtered;
    } catch (error) {
      console.error('Search meetings error:', error);
      return [];
    }
  }
}

module.exports = new MeetingStorageService();
