/**
 * Command Handler - Handles all /command processing
 */

const larkService = require('../lark_service');
const aiService = require('../ai_service');
const config = require('../config');
const { stripMarkdown, extractAuthor } = require('../utils/markdownStripper');
const utils = require('../utils');
const scheduler = require('../services/scheduler');

/**
 * Handle /meetings command
 */
async function handleListMeetings(chatId, messageId) {
  await larkService.replyMessage(
    messageId,
    '📋 Meeting listing is not available in this version.\n\n💡 Use /record <transcript> to summarize meetings.'
  );
}

/**
 * Handle /template command
 */
async function handleSetTemplate(templateName, chatId, messageId, showExample = false) {
  const template = config.templates[templateName.toLowerCase()];

  if (template) {
    if (showExample && template.exampleTranscript) {
      const exampleMessage = `📋 ${template.name} - Example

📝 Example Input:
${utils.truncate(template.exampleTranscript, 500)}

✅ Example Output:
${utils.truncate(template.exampleOutput, 500)}

Usage: Send /template ${templateName} then send your transcript.`;

      await larkService.replyMessage(messageId, exampleMessage);
    } else {
      await larkService.replyMessage(
        messageId,
        `✅ Template set to: ${template.name}

📝 Next transcript will use this template.

💡 Tip: Send /template ${templateName} example to see an example.`
      );
    }
  } else {
    await larkService.replyMessage(
      messageId,
      `❌ Template "${templateName}" not found.

Use /template to see available templates.`
    );
  }
}

/**
 * Handle /template without args - List templates
 */
async function handleListTemplates(chatId, messageId) {
  const templateList = Object.entries(config.templates)
    .map(([key, template]) => {
      let info = `📋 ${key} - ${template.name}`;
      if (template.exampleTranscript) {
        info += ` (has example)`;
      }
      return info;
    })
    .join('\n');

  const message = `📚 Available Templates:

${templateList}

Usage: /template <name>
Example: /template daily-standup

💡 Send /template <name> example to see an example`;
  await larkService.replyMessage(messageId, message);
}

/**
 * Handle /record command - Summarize transcript and save to storage
 */
async function handleMeetingSummary(transcript, chatId, messageId) {
  try {
    const notes = await aiService.generateNotes(transcript, 'general');
    const cleanNotes = stripMarkdown(notes);

    // Try to save to meeting storage table
    try {
      await larkService.addMeetingRecord(
        transcript,
        cleanNotes,
        `Meeting - ${new Date().toLocaleDateString()}`,
        '' // Attendees field - can be extracted later if needed
      );
      console.log('✅ Meeting record saved to storage');
    } catch (storageError) {
      console.warn('⚠️ Failed to save meeting to storage:', storageError.message);
      // Continue even if storage fails
    }

    await larkService.replyMessage(
      messageId,
      `📋 Meeting Summary:

${cleanNotes}

---

✅ Meeting saved to storage`
    );
  } catch (error) {
    console.error('Meeting summary error:', error);
    await larkService.replyMessage(
      messageId,
      `❌ Failed to generate summary: ${error.message}`
    );
  }
}

/**
 * Handle /thoughts command
 */
async function handleGetThoughts(chatId, messageId) {
  try {
    const thoughts = await larkService.getRecentThoughts(config.thoughts.displayLimit);

    if (thoughts.length === 0) {
      await larkService.replyMessage(
        messageId,
        `💭 No thoughts recorded yet.

💡 Reply to bot messages to add thoughts!`
      );
      return;
    }

    const thoughtsList = thoughts.map((record, index) => {
      const fields = record.fields;
      const thought = fields.Thought || '';
      const author = extractAuthor(fields['Author']);
      const context = fields['Meeting Context'] || '';

      const createdTime = fields['Created Time'] || fields['Date'] || fields['创建时间'] || fields.created_time || null;
      let timeStr = '';

      if (createdTime && typeof createdTime === 'number') {
        const date = new Date(createdTime);
        timeStr = ` - ${date.toLocaleString()}`;
      } else if (createdTime && typeof createdTime === 'string') {
        timeStr = ` - ${createdTime}`;
      } else {
        timeStr = ' - {No timestamp}';
      }

      return `${index + 1}. ${author}${context ? ` (${context})` : ''}${timeStr}\n   ${thought}`;
    }).join('\n\n');

    await larkService.replyMessage(
      messageId,
      `💭 Latest ${config.thoughts.displayLimit} Thoughts:

${thoughtsList}

---

💡 Use /summarize to get AI summary of ALL thoughts`
    );
  } catch (error) {
    console.error('Get thoughts error:', error);
    await larkService.replyMessage(messageId, '❌ Failed to retrieve thoughts. Make sure Bitable is configured.');
  }
}

/**
 * Handle /summarize command
 * Summarizes thoughts from previous day to current date
 */
async function handleSummarizeThoughts(chatId, messageId) {
  try {
    await larkService.replyMessage(
      messageId,
      '🤔 Analyzing thoughts from yesterday to today...'
    );

    // Get thoughts since yesterday (same logic as auto-summary)
    const thoughts = await scheduler.getThoughtsSinceYesterday();

    if (thoughts.length === 0) {
      await larkService.replyMessage(
        messageId,
        `💭 No thoughts recorded since yesterday.

💡 Reply to bot messages to add thoughts!`
      );
      return;
    }

    const thoughtTexts = thoughts.map(record => {
      const fields = record.fields;
      const author = extractAuthor(fields['Author']);
      const thought = fields.Thought || '';
      const context = fields['Meeting Context'] || '';

      return `${author}${context ? ` (${context})` : ''}: ${thought}`;
    });

    const rawSummary = await aiService.summarizeThoughts(thoughtTexts);
    const summary = stripMarkdown(rawSummary);

    await larkService.replyMessage(
      messageId,
      `🧠 AI Summary (Yesterday to Today):

📊 Analyzed ${thoughts.length} thought(s)

${summary}

---

💡 Use /thoughts to see latest ${config.thoughts.displayLimit} thoughts`
    );
  } catch (error) {
    console.error('Summarize thoughts error:', error);
    await larkService.replyMessage(
      messageId,
      '❌ Failed to generate summary. Make sure Bitable is configured.'
    );
  }
}

/**
 * Handle /general command
 */
async function handleGeneral(question, chatId, messageId) {
  try {
    await larkService.replyMessage(messageId, '🤔 Thinking...');

    const response = await aiService.generateWithOpenAI(
      'You are a helpful AI assistant. Provide clear, concise answers.',
      question
    );

    const cleanResponse = stripMarkdown(response);

    await larkService.replyMessage(
      messageId,
      `💡 Answer:

${cleanResponse}`
    );
  } catch (error) {
    console.error('General AI error:', error);
    await larkService.replyMessage(
      messageId,
      `❌ Failed to get answer: ${error.message}`
    );
  }
}

/**
 * Handle /autosummary command
 */
async function handleAutoSummary(args, chatId, messageId) {
  try {
    if (args.length === 0) {
      const status = scheduler.getStatus();
      const statusText = status.enabled 
        ? `✅ Auto-summary is ENABLED\n📍 Target chat: ${status.chatId}\n⏰ Runs daily at 8:00 AM HKT (Hong Kong Time)`
        : `❌ Auto-summary is DISABLED`;

      await larkService.replyMessage(
        messageId,
        `🤖 Auto-Summary Status:

${statusText}

💡 Usage:
• /autosummary on - Enable auto-summary in this chat
• /autosummary off - Disable auto-summary
• /autosummary status - Check current status`
      );
      return;
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'on':
      case 'enable':
        scheduler.enableAutoSummary(chatId);
        await larkService.replyMessage(
          messageId,
          `✅ Auto-summary ENABLED

📍 This chat will receive daily summaries at 8:00 AM HKT
📊 Summarizes thoughts from previous day to current date
🔧 Use /autosummary off to disable`
        );
        break;

      case 'off':
      case 'disable':
        scheduler.disableAutoSummary();
        await larkService.replyMessage(
          messageId,
          `❌ Auto-summary DISABLED

💡 Use /autosummary on to re-enable`
        );
        break;

      case 'status':
        const status = scheduler.getStatus();
        const statusText = status.enabled 
          ? `✅ ENABLED\n📍 Chat: ${status.chatId}\n⏰ Daily at 8:00 AM HKT (Hong Kong Time)`
          : `❌ DISABLED`;

        await larkService.replyMessage(
          messageId,
          `🤖 Auto-Summary Status:

${statusText}`
        );
        break;

      default:
        await larkService.replyMessage(
          messageId,
          `❌ Unknown subcommand: ${subcommand}

💡 Usage:
• /autosummary on - Enable
• /autosummary off - Disable  
• /autosummary status - Check status`
        );
    }
  } catch (error) {
    console.error('Auto-summary command error:', error);
    await larkService.replyMessage(
      messageId,
      `❌ Failed to update auto-summary: ${error.message}`
    );
  }
}

/**
 * Handle /help command
 */
async function handleHelp(chatId, messageId) {
  const helpText = `🤖 Lark Meeting Bot - Commands

📝 Meeting Notes:
• Reply to bot messages OR @mention the bot to add your thoughts
• Mention "daily report" in your thought → auto-tagged as (Daily Report)

📋 Commands:
• /record <transcript> - Summarize meeting and save to storage
• /meetings - List recent meetings
• /template - List available templates
• /template <name> - Set note template
• /template <name> example - See template example
• /thoughts - View latest ${config.thoughts.displayLimit} thoughts
• /summarize - AI summary from yesterday to today
• /autosummary on - Enable daily 8AM (HKT) auto-summary
• /autosummary off - Disable auto-summary
• /autosummary status - Check auto-summary status
• /general <question> - Ask AI any question
• /help - Show this help message

🎯 Available Templates:
• daily-standup - Team standup format
• brainstorming - Ideation & features
• kickoff - Project kickoff format
• retrospective - Sprint retro format
• general - Standard meeting notes

📖 Example Usage:
1. /record <transcript> → Generates summary and saves to storage
2. Reply to bot message → Add your thoughts
3. /thoughts → See latest ${config.thoughts.displayLimit} thoughts
4. /summarize → AI summary from yesterday to today
5. /autosummary on → Enable daily summaries at 8AM HKT
6. /general <question> → Ask AI anything

💡 Tips:
• /autosummary on - Get daily summaries at 8AM Hong Kong Time
• Thoughts with "daily report" → auto-tagged as (Daily Report)
• /record saves both transcript and notes to Bitable`;

  await larkService.replyMessage(messageId, helpText);
}

/**
 * Main command dispatcher
 */
async function handleCommand(command, args, chatId, messageId) {
  try {
    switch (command) {
      case '/meetings':
        await handleListMeetings(chatId, messageId);
        break;

      case '/record':
        const transcript = args.join(' ');
        if (transcript.trim().length > 0) {
          await handleMeetingSummary(transcript, chatId, messageId);
        } else {
          await larkService.replyMessage(
            messageId,
            'Please provide a meeting transcript. Usage: /record <transcript>'
          );
        }
        break;

      case '/template':
        if (args.length > 0) {
          const showExample = args.length > 1 && args[1].toLowerCase() === 'example';
          await handleSetTemplate(args[0], chatId, messageId, showExample);
        } else {
          await handleListTemplates(chatId, messageId);
        }
        break;

      case '/thoughts':
        await handleGetThoughts(chatId, messageId);
        break;

      case '/summarize':
      case '/summary':
        await handleSummarizeThoughts(chatId, messageId);
        break;

      case '/autosummary':
        await handleAutoSummary(args, chatId, messageId);
        break;

      case '/help':
        await handleHelp(chatId, messageId);
        break;

      case '/general':
        const question = args.join(' ');
        if (question.trim().length > 0) {
          await handleGeneral(question, chatId, messageId);
        } else {
          await larkService.replyMessage(
            messageId,
            'Please provide a question. Usage: /general <question>'
          );
        }
        break;

      default:
        await larkService.replyMessage(
          messageId,
          `Unknown command: ${command}. Type /help for available commands.`
        );
    }
  } catch (error) {
    console.error('Command handler error:', error);
    await larkService.replyMessage(
      messageId,
      `Error processing command: ${error.message}`
    );
  }
}

module.exports = {
  handleCommand,
  handleListMeetings,
  handleSetTemplate,
  handleListTemplates,
  handleMeetingSummary,
  handleGetThoughts,
  handleSummarizeThoughts,
  handleAutoSummary,
  handleGeneral,
  handleHelp,
};
