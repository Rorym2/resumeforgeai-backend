const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30 * 1000, // 30 seconds
});

module.exports = { client };
