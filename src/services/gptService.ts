import OpenAI from 'openai';

// Initialize the OpenAI API
// API key should be stored in .env file as CHATGPTAPI
const apiKey = process.env.REACT_APP_CHATGPTAPI;

// Create a client with the API key
let openai: OpenAI | null = null;

// Configuration constants
const MAX_RECENT_QUESTIONS = 10;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// Default GPT model to use
// gpt-4o-mini is a good balance of cost and quality for the $10 budget
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_TOKENS = 100;
const DEFAULT_TEMPERATURE = 0.2;

// Keep track of recent questions to avoid repeating
const recentQuestions: string[] = [];

// Initialize OpenAI with logging and error handling
try {
  // Only initialize if we have a valid API key
  if (apiKey && apiKey !== 'your_openai_api_key_here' && apiKey.length > 20) {
    openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // Allow running in browser environment
    });
    console.log('OpenAI API initialized successfully');
  } else {
    console.warn('OpenAI API key not found or using placeholder value. The AI journal enhancement feature will use fallback suggestions.');
  }
} catch (error) {
  console.error('Failed to initialize OpenAI API:', error);
}

// Helper utility for async retries
const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRY_ATTEMPTS,
  delayMs: number = RETRY_DELAY_MS
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt + 1}/${maxRetries} failed:`, error);
      
      // Don't delay on the final attempt
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError || new Error('Failed after multiple retries');
};

// Function to generate journal enhancement prompts
export const generateJournalPrompts = async (
  journalText: string,
  location?: string,
  minWordCount: number = 50,
  seed: number = Math.floor(Math.random() * 1000),
  retries: number = MAX_RETRY_ATTEMPTS
): Promise<string[]> => {
  // Early validation
  if (!journalText || journalText.trim() === '') {
    console.warn('Empty journal text provided');
    return ['What motivated you to start journaling today?'];
  }
  
  if (!openai) {
    console.log('Using fallback prompts (no API key)');
    return [getUniqueDefaultPrompt(journalText, location)];
  }
  
  // Clean text inputs
  const cleanJournalText = journalText.replace(/["\\]/g, '').trim();
  const cleanLocation = location ? location.replace(/["\\]/g, '').trim() : undefined;
  
  return withRetry(async () => {
    try {
      if (!openai) {
        throw new Error('OpenAI API not initialized');
      }
      
      // Use a more sophisticated prompt that can handle lyrics, poetry, and personal journal entries
      const prompt = `
I'm keeping a journal and have written the following entry:
"${cleanJournalText}"
${cleanLocation ? `\nLocation: ${cleanLocation}` : ''}

This entry appears to be ${detectContentType(cleanJournalText)}.

I need thoughtful, creative follow-up questions that will help me expand on this journal entry and make it deeper and more reflective.

Generate ONE insightful question that:
1. Shows deep understanding of the content's style and substance
2. Makes a specific reference to details or themes in my entry
3. Encourages me to explore emotions, motivations, or meanings beyond what I've written
4. Is phrased in a natural, conversational way
5. Feels personalized and tailored to exactly what I've shared

Avoid:
- Generic questions that could apply to any entry
- Questions that misinterpret lyrics or poetic content as literal experiences
- Questions about "rather" as if it's a person or thing
- Using phrases like "tell me more about" without specific context

Examples of good questions for lyrics or poetic content:
- "What emotions were you channeling when you connected with these lyrics?"
- "What part of your life story resonates with the line 'Truth is, they can't handle me at the top'?"
- "If you were to add another verse to express how you feel now, what would it say?"

Examples of good questions for personal narratives:
- "How did feeling [specific emotion from text] change your perspective on [specific situation from text]?"
- "What did you learn about yourself when [specific action/event from text]?"

Respond ONLY with the question - no explanation, no introduction, no extra text.`;
      
      // Generate content using OpenAI
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { 
            role: "system", 
            content: "You are an expert writing coach and journaling companion who helps people reflect deeply on their experiences, emotions, and creative expressions. You're skilled at recognizing different writing styles including poetry, lyrics, personal narratives, and creative fiction."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 150,
        seed: seed
      });
      
      const text = response.choices[0].message.content || '';
      
      // Clean up the response
      const cleanedQuestion = text
        .replace(/^["']|["']$/g, '') // Remove surrounding quotes if present
        .replace(/^(here's a question:|question:|follow-up:|follow up:)/i, '') // Remove introductory phrases
        .trim();
      
      // Make sure it ends with a question mark
      const finalQuestion = cleanedQuestion.endsWith('?') 
        ? cleanedQuestion 
        : cleanedQuestion + '?';
      
      // Store the question in the recent questions list
      addToRecentQuestions(finalQuestion);
      
      return [finalQuestion];
    } catch (error) {
      console.error('Error generating prompts with OpenAI:', error);
      
      // If we've retried and still failed, fall back to default prompts
      return [getUniqueDefaultPrompt(cleanJournalText, cleanLocation)];
    }
  }, retries);
};

// Helper function to detect what type of content is in the journal
function detectContentType(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Check for repetitive patterns that suggest lyrics/poetry
  const lines = text.split(/\n/).map(line => line.trim()).filter(line => line.length > 0);
  const repeatedPhrases = lowerText.match(/i'd rather|truth is|oh,? i'd/gi) || [];
  
  if (repeatedPhrases.length >= 2 || 
      (lines.length >= 3 && lines.some(line => line.includes("I'd rather")))) {
    return "lyrics or poetic content";
  }
  
  // Check for narrative structure
  if (lowerText.includes("today") || 
      lowerText.includes("yesterday") || 
      lowerText.includes("went to") ||
      lowerText.includes("felt") ||
      lowerText.match(/i (was|am|had|have|did)/i)) {
    return "a personal narrative";
  }
  
  // Default
  return "a reflective journal entry";
}

function addToRecentQuestions(question: string): void {
  // Add to recent questions and keep only the most recent ones
  recentQuestions.unshift(question);
  
  if (recentQuestions.length > MAX_RECENT_QUESTIONS) {
    recentQuestions.pop();
  }
}

const getUniqueDefaultPrompt = (journalText = '', location?: string): string => {
  // Default prompts for when no AI-generated prompt is available
  const defaultPrompts = [
    "What emotions were you feeling as you wrote this entry?",
    "How does what you wrote relate to your current goals or values?",
    "What's something you learned from the experience you described?",
    "How might your future self look back on what you've written today?",
    "What would you like to remember most about what you've written?",
    "What strength did you demonstrate in the experience you described?",
    "If you could change one aspect of what you've written about, what would it be?",
    "What support might you need regarding what you've shared in your entry?"
  ];
  
  // Special prompts for lyrics or poetic content
  const lyricalPrompts = [
    "What emotions do these lyrics evoke for you?",
    "Which line in this passage speaks to you most strongly?",
    "What memories or associations do these words bring up for you?",
    "What draws you to these particular lyrics?",
    "How do these words reflect your current state of mind?",
    "If you could add another verse, what would it say?",
    "What truth are these lyrics helping you express?",
    "How do these lyrics connect to your personal experiences?"
  ];
  
  // If text appears to be lyrics, use lyrical prompts
  const isLyrical = detectContentType(journalText).includes("lyric") || 
                    journalText.toLowerCase().includes("i'd rather");
  
  const appropriatePrompts = isLyrical ? lyricalPrompts : defaultPrompts;
  
  // Find a prompt that hasn't been used recently
  let availablePrompts = appropriatePrompts.filter(p => !recentQuestions.includes(p));
  
  // If all prompts have been used recently, just use the full list
  if (availablePrompts.length === 0) {
    availablePrompts = appropriatePrompts;
  }
  
  // Choose a random prompt from the available ones
  const selectedPrompt = availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
  
  // Add to recent questions list
  addToRecentQuestions(selectedPrompt);
  
  return selectedPrompt;
};

// Create a service object with all the exported functions
const gptService = {
  generateJournalPrompts
}; 

export default gptService; 