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
    this.autoSummaryEnabled = false;
    this.targetChatId = null;
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
        this.autoSummaryEnabled = data.autoSummaryEnabled || false;
        this.targetChatId = data.targetChatId || null;
        
        if (this.autoSummaryEnabled && this.targetChatId) {
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
      const data = {
        autoSummaryEnabled: this.autoSummaryEnabled,
        targetChatId: this.targetChatId,
      };
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
      console.log('✅ Scheduler settings saved');
    } catch (error) {
      console.error('Failed to save scheduler settings:', error);
    }
  }

  /**
   * Enable auto-summary
   * @param {string} chatId - Target chat ID to send summaries
   */
  enableAutoSummary(chatId) {
    this.autoSummaryEnabled = true;
    this.targetChatId = chatId;
    this.saveSettings();
    this.startAutoSummary();
  }

  /**
   * Disable auto-summary
   */
  disableAutoSummary() {
    this.autoSummaryEnabled = false;
    this.targetChatId = null;
    this.saveSettings();
    this.stopAutoSummary();
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
      if (!this.autoSummaryEnabled || !this.targetChatId) {
        console.log('⚠️ Auto-summary not enabled or no target chat');
        return;
      }

      const thoughts = await this.getThoughtsSinceYesterday();

      if (thoughts.length === 0) {
        console.log('💭 No thoughts to summarize since yesterday');
        await larkMessaging.sendMessage(
          this.targetChatId,
          '💭 Daily Summary (8:00 AM HKT)\n\nNo thoughts recorded since yesterday.'
        );
        return;
      }

      // Generate summary
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

      // Send to target chat
      await larkMessaging.sendMessage(
        this.targetChatId,
        `🌅 Daily Summary - ${hkDate}

📊 Analyzed ${thoughts.length} thought(s) since yesterday

${summary}

---

💡 Auto-generated at 8:00 AM HKT (Hong Kong Time)
🔧 Use /autosummary off to disable`
      );

      console.log(`✅ Auto-summary sent to chat ${this.targetChatId}`);
    } catch (error) {
      console.error('❌ Auto-summary task failed:', error);
      
      // Try to notify about the error
      if (this.targetChatId) {
        try {
          await larkMessaging.sendMessage(
            this.targetChatId,
            `❌ Daily auto-summary failed: ${error.message}`
          );
        } catch (notifyError) {
          console.error('Failed to send error notification:', notifyError);
        }
      }
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      enabled: this.autoSummaryEnabled,
      chatId: this.targetChatId,
    };
  }
}

module.exports = new SchedulerService();
