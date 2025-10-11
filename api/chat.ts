// Vercel Serverless Function - OpenAI Proxy
// This keeps the API key secure on the server side
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API key from environment (server-side only, not exposed to browser)
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
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
}
