const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 120 * 1000, // 120 seconds — pipeline has 6 calls, optimizer alone can take 30-60s
});

module.exports = { client };
