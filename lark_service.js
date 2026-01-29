/**
 * Lark Service - Handles all Lark API interactions
 * Includes messaging, Bitable operations, and document creation
 */

const axios = require('axios');
const config = require('./config');
const { retry } = require('./utils');

class LarkService {
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
    // Return cached token if still valid
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
        // Token expires in 2 hours, refresh 5 minutes early
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
   * Create a Lark document
   * @param {string} title - Document title
   * @param {string} content - Document content (markdown or rich text)
   * @param {string} folderId - Folder ID (optional)
   * @returns {Promise<object>} - Document data with URL
   */
  async createDocument(title, content = '') {
    try {
      // Create a new document
      const docResponse = await this.apiRequest('POST', '/docx/v1/documents', {
        title,
      });

      const documentId = docResponse.document.document_id;

      // Set document permissions to private (only specific users can access)
      await this.setDocumentPermissions(documentId);

      // Add content to the document using blocks API if content provided
      if (content && content.trim()) {
        await this.addContentToDocument(documentId, content);
      }

      // Get document URL
      const url = `https://larksuite.com/docx/${documentId}`;

      return {
        document_id: documentId,
        url,
      };
    } catch (error) {
      console.error('Document creation error:', error);
      throw error;
    }
  }

  /**
   * Set document permissions - organization-wide edit access
   * @param {string} documentId - Document ID
   * @returns {Promise<void>}
   */
  async setDocumentPermissions(documentId) {
    try {
      // Set link share settings: anyone in tenant with link can edit
      await this.apiRequest('PATCH', `/drive/v1/permissions/${documentId}/public`, {
        link_share_entity: 'tenant_editable', // Anyone in org with link can edit
        external_access_entity: 'tenant' // Only organization members
      });

      console.log(`✅ Set document ${documentId} to organization-wide edit access`);
    } catch (error) {
      console.warn('⚠️  Could not set permissions:', error.response?.data?.msg || error.message);
      
      // Try alternative method - create member permission
      try {
        await this.apiRequest('POST', `/drive/v1/permissions/${documentId}/members`, {
          member_type: 'openid',
          member_id: 'anyone',
          perm: 'edit'
        });
        console.log(`✅ Set document ${documentId} to anyone can edit (fallback method)`);
      } catch (fallbackError) {
        console.warn('⚠️  Fallback permission method also failed:', fallbackError.response?.data?.msg || fallbackError.message);
      }
    }
  }

  /**
   * Share document with specific users - set org-wide access
   * @param {string} documentId - Document ID
   * @param {string[]} userIds - Array of user IDs (not used, kept for API compatibility)
   * @param {string} permission - Permission level (not used, kept for API compatibility)
   * @returns {Promise<void>}
   */
  async shareDocumentWithUsers(documentId, userIds, permission = 'edit') {
    // Set organization-wide access so anyone in the org can view/edit via link
    await this.setDocumentPermissions(documentId);
  }

  /**
   * Create a subdocument under a parent document
   * @param {string} parentDocToken - Parent document token (not used for now, documents created at root)
   * @param {string} title - Subdocument title
   * @param {string} content - Document content
   * @param {string} transcript - Original meeting transcript
   * @returns {Promise<object>} - Subdocument data with URL
   */
  /**
   * Create a document and add it as a wiki page under a parent space
   * @param {string} parentDocToken - Parent wiki space token
   * @param {string} title - Document title
   * @param {string} content - Document content (markdown)
   * @returns {Promise<object>} - Document data with URL
   */
  async createSubDocument(parentDocToken, title, content) {
    // Create document first (empty, title only)
    const docResponse = await this.apiRequest('POST', '/docx/v1/documents', {
      title,
    });

    const documentId = docResponse.document.document_id;
    const url = `https://larksuite.com/docx/${documentId}`;

    // Add as wiki page under parent space
    if (parentDocToken) {
      await this.apiRequest('POST', '/wiki/v2/spaces', {
        parent_token: parentDocToken,
        obj_type: 'docx',
        obj_id: documentId,
        name: title,
      });
    }

    return {
      document_id: documentId,
      url,
      title,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Build formatted meeting document content
   * @param {string} title - Meeting title
   * @param {string} notes - AI-generated notes
   * @param {string} transcript - Original transcript
   * @returns {string} - Formatted content
   */
  buildMeetingDocumentContent(title, notes, transcript) {
    let content = `# ${title}\n\n\n`;
    content += `** Created: ** ${new Date().toLocaleString()}\n\n\n`;
    content += `## 📝 Meeting Notes\n\n\n${notes}\n\n\n`;
    
    if (transcript) {
      content += `---\n\n\n## 📄 Original Transcript\n\n\n${transcript}\n\n\n`;
    }
    
    content += `---\n\n\n## 💭 Team Thoughts\n\n\n_(Reply to the bot message to add your thoughts)_\n\n`;
    
    return content;
  }

  /**
   * List subdocuments in a parent document
   * @param {string} parentDocToken - Parent document token
   * @param {number} limit - Number of documents to fetch
   * @returns {Promise<object[]>} - Array of subdocuments
   */
  async listSubDocuments(parentDocToken, limit = 10) {
    try {
      // In Lark, we need to get the document's children
      // This uses the Wiki API to list pages under a space
      const response = await this.apiRequest(
        'GET',
        `/wiki/v2/spaces/${parentDocToken}/nodes?page_size=${limit}`
      );

      return response.items || [];
    } catch (error) {
      console.error('List subdocuments error:', error);
      // Return empty array if parent doesn't exist yet
      return [];
    }
  }

  /**
   * Get document details
   * @param {string} documentId - Document ID
   * @returns {Promise<object>} - Document metadata
   */
  async getDocumentMetadata(documentId) {
    try {
      const response = await this.apiRequest('GET', `/docx/v1/documents/${documentId}`);
      return response.document;
    } catch (error) {
      console.error('Get document metadata error:', error);
      throw error;
    }
  }

  /**
   * Get user info by user ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} - User info
   */
  async getUserInfo(userId) {
    try {
      const response = await this.apiRequest(
        'GET',
        `/contact/v3/users/${userId}`
      );
      return response.user || null;
    } catch (error) {
      console.error('Get user info error:', error);
      return null;
    }
  }

  /**
   * Add thought to Bitable
   * @param {string} thought - The thought content
   * @param {string} author - Author name
   * @param {string} meetingContext - Meeting context/title
   * @returns {Promise<object>} - Created record
   */
  async addThought(thought, author, meetingContext = '') {
    try {
      if (!config.lark.bitableAppToken || !config.lark.thoughtsTableId) {
        console.warn('Bitable not configured - thoughts feature disabled');
        return null;
      }

      const fields = {
        'Thought': thought,
        'Author': author,
        'Meeting Context': meetingContext,
      };

      // Note: "Created Time" field is auto-filled by Bitable and cannot be set manually

      return await this.apiRequest(
        'POST',
        `/bitable/v1/apps/${config.lark.bitableAppToken}/tables/${config.lark.thoughtsTableId}/records`,
        { fields }
      );
    } catch (error) {
      console.error('Add thought error:', error);
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

      // Fetch more records than needed to allow for manual sorting
      const response = await this.apiRequest(
        'GET',
        `/bitable/v1/apps/${config.lark.bitableAppToken}/tables/${config.lark.thoughtsTableId}/records?page_size=100`
      );

      const items = response.items || [];
      
      // Sort by Created Time descending (most recent first)
      // Created Time is a timestamp in milliseconds
      const sorted = items.sort((a, b) => {
        const timeA = a.fields['Created Time'] || 0;
        const timeB = b.fields['Created Time'] || 0;
        return timeB - timeA; // Descending order (newest first)
      });

      // Return only the requested number of items
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

      const response = await this.apiRequest(
        'GET',
        `/bitable/v1/apps/${config.lark.bitableAppToken}/tables/${config.lark.thoughtsTableId}/records?page_size=${limit}&sort=["Created Time DESC"]`
      );

      return response.items || [];
    } catch (error) {
      console.error('Get all thoughts error:', error);
      return [];
    }
  }

  /**
   * Add content to document using blocks API
   * @param {string} documentId - Document ID
   * @param {string} content - Markdown-style content to add
   * @returns {Promise<void>}
   */
  async addContentToDocument(documentId, content) {
    try {
      // Convert markdown-style content to text blocks
      // Split by paragraphs (double newlines)
      const paragraphs = content.split('\n\n').filter(p => p.trim());
      
      if (paragraphs.length === 0) {
        console.log(`No content to add to document ${documentId}`);
        return;
      }

      const children = paragraphs.map(paragraph => {
        const text = paragraph.trim();

        // Check if it's a heading
        if (text.startsWith('# ')) {
          return {
            block_type: 1, // Heading 1
            text: {
              elements: [{
                text_run: {
                  content: text.substring(2).trim()
                }
              }]
            }
          };
        } else if (text.startsWith('## ')) {
          return {
            block_type: 2, // Heading 2
            text: {
              elements: [{
                text_run: {
                  content: text.substring(3).trim()
                }
              }]
            }
          };
        } else if (text.startsWith('### ')) {
          return {
            block_type: 3, // Heading 3
            text: {
              elements: [{
                text_run: {
                  content: text.substring(4).trim()
                }
              }]
            }
          };
        } else {
          // Regular text block
          return {
            block_type: 2, // Text
            text: {
              elements: [{
                text_run: {
                  content: text
                }
              }]
            }
          };
        }
      });

      // Create blocks in the document
      if (children.length > 0) {
        try {
          // Get the document to find the page block ID
          const docInfo = await this.apiRequest('GET', `/docx/v1/documents/${documentId}`);
          
          // Handle different API response structures
          const doc = docInfo.document || docInfo;
          const blocks = doc?.body?.blocks;
          
          if (!blocks || blocks.length === 0) {
            console.warn(`⚠️  Document ${documentId} has no blocks to append to`);
            return;
          }
          
          const pageBlockId = blocks[0].block_id;

          // Add blocks as children of the page
          await this.apiRequest('POST', `/docx/v1/documents/${documentId}/blocks/${pageBlockId}/children`, {
            children,
            index: 0
          });

          console.log(`✅ Added ${children.length} content blocks to document ${documentId}`);
        } catch (blockError) {
          console.warn(`⚠️  Could not add content blocks to ${documentId}:`, blockError.response?.data?.msg || blockError.message);
        }
      }
    } catch (error) {
      console.error('❌ Failed to add content to document:', error.response?.data || error.message);
      console.warn(`⚠️  Document ${documentId} was created but content could not be added automatically`);
      console.warn('   You may need to add the meeting notes manually');
    }
  }

  /**
   * Create meeting document with notes
   * @param {string} title - Meeting title
   * @param {string} transcript - Meeting transcript
   * @param {string} notes - AI-generated notes
   * @param {string} templateName - Template used
   * @returns {Promise<object>} - Created meeting document
   */
  async createMeetingDocument(title, transcript, notes = '', templateName = 'general') {
    const timestamp = new Date().toLocaleDateString();
    
    const docTitle = `✅ ${title} - ${timestamp}`;
    const content = this.buildMeetingDocumentContent(title, notes, transcript);
    
    // Create document under parent wiki space
    const parentDocToken = config.lark.notesDocToken;
    const doc = await this.createSubDocument(parentDocToken, docTitle, content);

    return {
      document_id: doc.document_id,
      url: doc.url,
      template: templateName,
      title: docTitle,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Update document title
   * @param {string} documentId - Document ID
   * @param {string} title - New title
   * @returns {Promise<void>}
   */
  async updateDocumentTitle(documentId, title) {
    try {
      await this.apiRequest('PATCH', `/docx/v1/documents/${documentId}`, {
        title
      });
    } catch (error) {
      console.error('Update document title error:', error);
      // Non-critical, continue
    }
  }

  /**
   * List recent meeting documents
   * Note: Without a parent folder system, we can't easily list all meeting docs
   * This is a placeholder - in production you'd want to track doc IDs in a database
   * @param {number} limit - Number of documents to fetch
   * @returns {Promise<object[]>} - Array of meeting documents
   */
  async listMeetingDocuments(limit = 10) {
    // Since we create standalone documents, we can't easily list them
    // For now, return empty array
    // In production: track document IDs in a simple database or file
    console.log('ℹ️  Document listing not available without external storage');
    return [];
  }

  /**
   * Create template example document
   * @param {string} templateName - Template name
   * @param {string} exampleTranscript - Example transcript
   * @param {string} exampleNotes - Example output notes
   * @returns {Promise<object>} - Created template document
   */
  async createTemplateDocument(templateName, exampleTranscript, exampleNotes) {
    try {
      const template = config.templates[templateName];
      if (!template) {
        throw new Error(`Template ${templateName} not found`);
      }

      const content = this.buildTemplateDocumentContent(
        template.name,
        template.prompt,
        exampleTranscript,
        exampleNotes
      );

      const doc = await this.createSubDocument(
        config.lark.templatesDocToken,
        `${template.name} Template`,
        content,
        ''
      );

      return {
        document_id: doc.document_id,
        url: doc.url,
        template_name: templateName,
      };
    } catch (error) {
      console.error('Create template document error:', error);
      throw error;
    }
  }

  /**
   * Build template document content
   * @param {string} name - Template name
   * @param {string} prompt - Template prompt
   * @param {string} exampleTranscript - Example input
   * @param {string} exampleNotes - Example output
   * @returns {string} - Formatted content
   */
  buildTemplateDocumentContent(name, prompt, exampleTranscript, exampleNotes) {
    let content = `# ${name} Template\n\n\n`;
    content += `## 📋 Description\n\n\n`;
    content += `This template is designed for ${name.toLowerCase()} meetings.\n\n\n`;
    content += `## 🎯 AI Prompt\n\n\n`;
    content += `${prompt}\n\n\n`;
    content += `---\n\n\n`;
    content += `## 📝 Example Input (Transcript)\n\n\n`;
    content += `\`\`\`\n${exampleTranscript}\n\`\`\`\n\n\n`;
    content += `---\n\n\n`;
    content += `## ✅ Example Output (Generated Notes)\n\n\n`;
    content += `${exampleNotes}\n\n\n`;
    content += `---\n\n\n`;
    content += `## 💡 Usage\n\n\n`;
    content += `To use this template:\n\n`;
    content += `1. Send \`/template ${name.toLowerCase().replace(/\s+/g, '-')}\` to the bot\n\n`;
    content += `2. Send your meeting transcript\n\n`;
    content += `3. The bot will generate notes using this template\n\n`;
    
    return content;
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

  /**
   * Create meeting list card
   * @param {object[]} meetings - Array of meeting documents
   * @returns {object} - Card message
   */
  createMeetingListCard(meetings) {
    if (!meetings || meetings.length === 0) {
      return this.createCardMessage('Recent Meetings', 'No meetings found. Send a transcript to create one!');
    }

    const meetingList = meetings
      .map((m, i) => {
        const title = m.title || 'Untitled Meeting';
        const docUrl = m.url || '';
        const date = m.created_at ? new Date(m.created_at).toLocaleDateString() : '';
        const dateStr = date ? ` (${date})` : '';
        
        return `${i + 1}. 📝 [** ${title} **](${docUrl})${dateStr}`;
      })
      .join('\n\n');

    return this.createCardMessage('📚 Recent Meetings', meetingList);
  }
}

module.exports = new LarkService();
