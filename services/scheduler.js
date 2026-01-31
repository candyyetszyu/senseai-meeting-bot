/**
 * Scheduler Service - Handles scheduled tasks like auto-summary
 */

const cron = require('node-cron');
const larkMessaging = require('./larkMessaging');
const larkBitable = require('./larkBitable');
const aiService = require('../ai_service');
const { stripMarkdown, extractAuthor } = require('../utils/markdownStripper');
const config = require('../config');
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../.scheduler-settings.json');

class SchedulerService {
  constructor() {
    // Map of chatId -> auto-summary settings
    this.chatSettings = new Map(); // { chatId: { enabled: boolean, enabledAt: timestamp } }
    this.task = null;
    this.loadSettings();
  }

  /**
   * Load scheduler settings from file
   */
  loadSettings() {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        
        // Convert old format to new format if needed
        if (data.autoSummaryEnabled !== undefined && data.targetChatId) {
          this.chatSettings.set(data.targetChatId, {
            enabled: data.autoSummaryEnabled,
            enabledAt: data.enabledAt || Date.now()
          });
        } else if (data.chatSettings) {
          // Load new format
          Object.entries(data.chatSettings).forEach(([chatId, settings]) => {
            this.chatSettings.set(chatId, settings);
          });
        }
        
        // Start scheduler if any chat has auto-summary enabled
        if (this.hasEnabledChats()) {
          this.startAutoSummary();
          console.log('✅ Auto-summary scheduler loaded and started');
        }
      }
    } catch (error) {
      console.error('Failed to load scheduler settings:', error);
    }
  }

  /**
   * Save scheduler settings to file
   */
  saveSettings() {
    try {
      const chatSettingsObj = {};
      this.chatSettings.forEach((settings, chatId) => {
        chatSettingsObj[chatId] = settings;
      });
      
      const data = { chatSettings: chatSettingsObj };
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
      console.log('✅ Scheduler settings saved');
    } catch (error) {
      console.error('Failed to save scheduler settings:', error);
    }
  }

  /**
   * Check if any chat has auto-summary enabled
   */
  hasEnabledChats() {
    for (const settings of this.chatSettings.values()) {
      if (settings.enabled) return true;
    }
    return false;
  }

  /**
   * Get all enabled chat IDs
   */
  getEnabledChatIds() {
    const enabledChats = [];
    this.chatSettings.forEach((settings, chatId) => {
      if (settings.enabled) {
        enabledChats.push(chatId);
      }
    });
    return enabledChats;
  }

  /**
   * Enable auto-summary for a specific chat
   * @param {string} chatId - Target chat ID to send summaries
   */
  enableAutoSummary(chatId) {
    this.chatSettings.set(chatId, {
      enabled: true,
      enabledAt: Date.now()
    });
    this.saveSettings();
    this.startAutoSummary();
  }

  /**
   * Disable auto-summary for a specific chat
   * @param {string} chatId - Chat ID to disable
   */
  disableAutoSummary(chatId) {
    if (this.chatSettings.has(chatId)) {
      this.chatSettings.set(chatId, {
        enabled: false,
        enabledAt: this.chatSettings.get(chatId).enabledAt
      });
      this.saveSettings();
    }
    
    // Stop scheduler if no chats are enabled
    if (!this.hasEnabledChats()) {
      this.stopAutoSummary();
    }
  }

  /**
   * Check if auto-summary is enabled for a specific chat
   * @param {string} chatId - Chat ID to check
   */
  isAutoSummaryEnabled(chatId) {
    const settings = this.chatSettings.get(chatId);
    return settings ? settings.enabled : false;
  }

  /**
   * Start auto-summary cron job (runs at 8:00 AM daily in Hong Kong timezone)
   */
  startAutoSummary() {
    if (this.task) {
      this.task.stop();
    }

    // Schedule at 8:00 AM daily Hong Kong time (0 8 * * *)
    this.task = cron.schedule('0 8 * * *', async () => {
      console.log('🤖 Running scheduled auto-summary at 8:00 AM HKT');
      await this.runAutoSummary();
    }, {
      timezone: 'Asia/Hong_Kong'
    });

    console.log('✅ Auto-summary scheduler started (8:00 AM daily Hong Kong Time)');
  }

  /**
   * Stop auto-summary cron job
   */
  stopAutoSummary() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('⏹️ Auto-summary scheduler stopped');
    }
  }

  /**
   * Get thoughts from previous day to current date
   * @returns {Promise<object[]>} - Filtered thoughts
   */
  async getThoughtsSinceYesterday() {
    try {
      const allThoughts = await larkBitable.getAllThoughts(500);
      
      // Get yesterday's start of day (00:00:00)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const yesterdayTimestamp = yesterday.getTime();

      // Filter thoughts from yesterday onwards
      const filteredThoughts = allThoughts.filter(record => {
        const createdTime = record.fields['Created Time'] || 
                          record.fields['Date'] || 
                          record.fields['创建时间'] || 
                          record.created_time;
        
        return createdTime && createdTime >= yesterdayTimestamp;
      });

      console.log(`📊 Filtered ${filteredThoughts.length} thoughts since yesterday from ${allThoughts.length} total`);
      return filteredThoughts;
    } catch (error) {
      console.error('Error getting thoughts since yesterday:', error);
      return [];
    }
  }

  /**
   * Run auto-summary task
   */
  async runAutoSummary() {
    try {
      const enabledChatIds = this.getEnabledChatIds();
      
      if (enabledChatIds.length === 0) {
        console.log('⚠️ Auto-summary not enabled for any chat');
        return;
      }

      const thoughts = await this.getThoughtsSinceYesterday();

      // Generate summary once (shared across all enabled chats)
      let summaryText = '';
      let hasThoughts = thoughts.length > 0;

      if (hasThoughts) {
        const thoughtTexts = thoughts.map(record => {
          const fields = record.fields;
          const author = extractAuthor(fields['Author']);
          const thought = fields.Thought || '';
          const context = fields['Meeting Context'] || '';

          return `${author}${context ? ` (${context})` : ''}: ${thought}`;
        });

        const rawSummary = await aiService.summarizeThoughts(thoughtTexts);
        const summary = stripMarkdown(rawSummary);

        // Format date in Hong Kong timezone
        const hkDate = new Date().toLocaleDateString('en-US', { 
          timeZone: 'Asia/Hong_Kong',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        summaryText = `🌅 Daily Summary - ${hkDate}

📊 Analyzed ${thoughts.length} thought(s) since yesterday

${summary}

---

💡 Auto-generated at 8:00 AM HKT (Hong Kong Time)
🔧 Use /autosummary off to disable`;
      } else {
        summaryText = '💭 Daily Summary (8:00 AM HKT)\n\nNo thoughts recorded since yesterday.';
      }

      // Send summary to all enabled chats
      for (const chatId of enabledChatIds) {
        try {
          await larkMessaging.sendMessage(chatId, summaryText);
          console.log(`✅ Auto-summary sent to chat ${chatId}`);
        } catch (error) {
          console.error(`❌ Failed to send auto-summary to chat ${chatId}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Auto-summary task failed:', error);
      
      // Try to notify all enabled chats about the error
      const enabledChatIds = this.getEnabledChatIds();
      for (const chatId of enabledChatIds) {
        try {
          await larkMessaging.sendMessage(
            chatId,
            `❌ Daily auto-summary failed: ${error.message}`
          );
        } catch (notifyError) {
          console.error('Failed to send error notification:', notifyError);
        }
      }
    }
  }

  /**
   * Get current status for a specific chat
   * @param {string} chatId - Chat ID to get status for
   */
  getStatus(chatId) {
    const settings = this.chatSettings.get(chatId);
    return {
      enabled: settings ? settings.enabled : false,
      chatId: chatId,
      enabledAt: settings ? settings.enabledAt : null,
    };
  }
}

module.exports = new SchedulerService();
