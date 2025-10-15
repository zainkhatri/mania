// Local development server for API routes
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Handle /api/chat endpoint
app.post('/api/chat', async (req, res) => {
  // Mock Vercel request/response objects
  const mockReq = {
    method: 'POST',
    body: req.body,
  };

  const mockRes = {
    status: (code) => ({
      json: (data) => res.status(code).json(data),
    }),
  };

  try {
    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const { messages, model = 'gpt-4o-mini', temperature = 0.8, max_tokens = 50, seed, presence_penalty = 0.6, frequency_penalty = 0.3 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request: messages array required' });
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens,
        seed,
        presence_penalty,
        frequency_penalty,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ error: errorData });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('OpenAI API Error:', error);
    return res.status(500).json({ error: 'Failed to generate response' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`✅ OpenAI API key configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
});
