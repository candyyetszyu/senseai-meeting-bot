/**
 * AI Configuration
 */
module.exports = {
  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY,
    huggingfaceToken: process.env.HF_TOKEN || process.env.HUGGINGFACE_API_TOKEN,
  },
};
