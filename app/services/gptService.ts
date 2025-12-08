import Constants from 'expo-constants';

const API_KEY = Constants.expoConfig?.extra?.openaiApiKey;
const MAX_RECENT_QUESTIONS = 10;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_TOKENS = 100;
const DEFAULT_TEMPERATURE = 0.2;

const recentQuestions: string[] = [];

const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = MAX_RETRY_ATTEMPTS
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
};

export const generateJournalPrompts = async (
  journalText: string,
  location?: string,
  model: string = DEFAULT_MODEL,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  temperature: number = DEFAULT_TEMPERATURE
): Promise<string> => {
  if (!journalText || journalText.trim().length === 0) {
    return getUniqueDefaultPrompt();
  }

  const cleanJournalText = journalText.replace(/["\\]/g, '').trim();
  const cleanLocation = location ? location.replace(/["\\]/g, '').trim() : undefined;

  try {
    return await withRetry(async () => {
      const prompt = `
Based on this journal entry${cleanLocation ? ` from ${cleanLocation}` : ''}, generate ONE thoughtful, contextual question that encourages deeper reflection. The question should relate directly to the content, emotions, or themes in the entry.

Journal entry: "${cleanJournalText}"

Return ONLY the question, nothing else. Make it conversational and insightful.
      `.trim();

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', errorData);
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';

      const cleanedQuestion = text
        .replace(/^["'\s]+|["'\s]+$/g, '')
        .replace(/\n+/g, ' ')
        .trim();

      const finalQuestion = cleanedQuestion.endsWith('?')
        ? cleanedQuestion
        : `${cleanedQuestion}?`;

      if (recentQuestions.includes(finalQuestion)) {
        return getUniqueDefaultPrompt(journalText, location);
      }

      recentQuestions.push(finalQuestion);
      if (recentQuestions.length > MAX_RECENT_QUESTIONS) {
        recentQuestions.shift();
      }

      return finalQuestion;
    });
  } catch (error) {
    console.error('Error generating prompt:', error);
    return getUniqueDefaultPrompt(journalText, location);
  }
};

const getUniqueDefaultPrompt = (journalText = '', location?: string): string => {
  const defaultPrompts = [
    "What's one thing from today you want to remember?",
    "How did you show up for yourself today?",
    "What surprised you about today?",
    "What are you grateful for right now?",
    "What would tomorrow-you want to know about today?",
  ];

  return defaultPrompts[Math.floor(Math.random() * defaultPrompts.length)];
};

export default {
  generateJournalPrompts,
};
