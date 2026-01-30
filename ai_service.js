/**
 * AI Service for generating meeting notes
 * Supports OpenAI and HuggingFace
 */

const OpenAI = require('openai');
const config = require('./config');

class AIService {
  constructor() {
    this.provider = config.ai.provider;
    
    if (this.provider === 'openai' && config.ai.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.ai.openaiApiKey,
      });
    }
    
    if (this.provider === 'huggingface' && config.ai.huggingfaceToken) {
      // Use HuggingFace's OpenAI-compatible API via router
      this.hfOpenAI = new OpenAI({
        baseURL: 'https://router.huggingface.co/v1',
        apiKey: config.ai.huggingfaceToken,
      });
    }
  }

  /**
   * Generate meeting notes from transcript
   * @param {string} transcript - Meeting transcript
   * @param {string} templateName - Template name (default: 'general')
   * @returns {Promise<string>} - Generated notes
   */
  async generateNotes(transcript, templateName = 'general') {
    const template = config.templates[templateName] || config.templates.general;
    
    const systemPrompt = `You are SenseAI Assistant, an expert meeting notes assistant. Your task is to create clear, concise, and well-structured meeting notes from transcripts.`;
    
    const userPrompt = `${template.prompt}\n\nTranscript:\n${transcript}`;

    try {
      if (this.provider === 'openai') {
        return await this.generateWithOpenAI(systemPrompt, userPrompt);
      } else if (this.provider === 'huggingface') {
        return await this.generateWithHuggingFace(systemPrompt, userPrompt);
      } else {
        throw new Error(`Unsupported AI provider: ${this.provider}`);
      }
    } catch (error) {
      console.error('AI generation error:', error);
      throw new Error(`Failed to generate notes: ${error.message}`);
    }
  }

  /**
   * Generate response using configured AI provider
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @returns {Promise<string>} - Generated response
   */
  async generate(systemPrompt, userPrompt) {
    try {
      if (this.provider === 'openai') {
        return await this.generateWithOpenAI(systemPrompt, userPrompt);
      } else if (this.provider === 'huggingface') {
        return await this.generateWithHuggingFace(systemPrompt, userPrompt);
      } else {
        throw new Error(`Unsupported AI provider: ${this.provider}`);
      }
    } catch (error) {
      console.error('AI generation error:', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  /**
   * Generate notes using OpenAI
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @returns {Promise<string>} - Generated notes
   */
  async generateWithOpenAI(systemPrompt, userPrompt) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized. Check your API key.');
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    return response.choices[0]?.message?.content || 'Failed to generate notes.';
  }

  /**
   * Generate notes using HuggingFace via OpenAI-compatible API
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @returns {Promise<string>} - Generated notes
   */
  async generateWithHuggingFace(systemPrompt, userPrompt) {
    if (!this.hfOpenAI) {
      throw new Error('HuggingFace client not initialized. Check your token.');
    }

    const response = await this.hfOpenAI.chat.completions.create({
      model: 'Qwen/Qwen2.5-7B-Instruct:together',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || 'Failed to generate notes.';
  }

  /**
   * Extract action items from notes
   * @param {string} notes - Meeting notes
   * @returns {Promise<string[]>} - List of action items
   */
  async extractActionItems(notes) {
    const prompt = `Extract all action items from these meeting notes. Return only the action items as a numbered list, one per line.\n\nNotes:\n${notes}`;

    try {
      const result = await this.generate(
        'You are SenseAI Assistant, a helpful AI that extracts action items.',
        prompt
      );

      // Parse action items from the response
      const items = result
        .split('\n')
        .filter(line => line.trim())
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim());

      return items;
    } catch (error) {
      console.error('Action item extraction error:', error);
      return [];
    }
  }

  /**
   * Summarize thread replies/thoughts
   * @param {string[]} replies - Array of reply messages
   * @returns {Promise<string>} - Summary of thoughts
   */
  async summarizeThoughts(replies) {
    if (!replies || replies.length === 0) {
      return 'No additional thoughts were shared.';
    }

    const thoughtsText = replies.map((r, i) => `${i + 1}. ${r}`).join('\n');
    const prompt = `Summarize these team thoughts and comments into key points:\n\n${thoughtsText}`;

    try {
      return await this.generate(
        'You are SenseAI Assistant, a helpful AI that summarizes team discussions.',
        prompt
      );
    } catch (error) {
      console.error('Thought summarization error:', error);
      return thoughtsText; // Return raw thoughts if summarization fails
    }
  }
}

module.exports = new AIService();
