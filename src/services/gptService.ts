import OpenAI from 'openai';

// Initialize the OpenAI API
// API key should be stored in .env file as REACT_APP_OPENAI_API_KEY
const apiKey = process.env.REACT_APP_OPENAI_API_KEY || process.env.REACT_APP_CHATGPTAPI || process.env.OPEN_AI_API_KEY;

// Debug environment variables
console.log('🔍 Environment check:');
console.log('REACT_APP_OPENAI_API_KEY exists:', !!process.env.REACT_APP_OPENAI_API_KEY);
console.log('REACT_APP_OPENAI_API_KEY value:', process.env.REACT_APP_OPENAI_API_KEY ? process.env.REACT_APP_OPENAI_API_KEY.substring(0, 20) + '...' : 'undefined');
console.log('All REACT_APP_ env vars:', Object.keys(process.env).filter(key => key.startsWith('REACT_APP_')));
console.log('All env vars containing "OPENAI":', Object.keys(process.env).filter(key => key.includes('OPENAI')));
console.log('All env vars containing "API":', Object.keys(process.env).filter(key => key.includes('API')));

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
  console.log('🔑 Checking API key:', apiKey ? 'Present' : 'Missing');
  // Only initialize if we have a valid API key
  if (apiKey && apiKey !== 'your_openai_api_key_here' && apiKey.length > 20) {
    openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // Allow running in browser environment
    });
    console.log('✅ OpenAI API initialized successfully with key:', apiKey.substring(0, 10) + '...');
  } else {
    console.warn('⚠️ OpenAI API key not found or using placeholder value. Current key:', apiKey ? apiKey.substring(0, 10) + '...' : 'undefined');
    console.warn('The AI journal enhancement feature will use fallback suggestions.');
  }
} catch (error) {
  console.error('❌ Failed to initialize OpenAI API:', error);
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
  console.log('🚀 generateJournalPrompts called with:', { journalText: journalText.substring(0, 50) + '...', location });
  
  // Early validation
  if (!journalText || journalText.trim() === '') {
    console.warn('Empty journal text provided');
    return ['What motivated you to start journaling today?'];
  }
  
  if (!openai) {
    console.log('❌ No OpenAI API key found - using fallback prompts');
    console.log('🔑 API Key status:', apiKey ? 'Present but invalid' : 'Missing');
    return [getUniqueDefaultPrompt(journalText, location)];
  }
  
  // Clean text inputs
  const cleanJournalText = journalText.replace(/["\\]/g, '').trim();
  const cleanLocation = location ? location.replace(/["\\]/g, '').trim() : undefined;
  
  return withRetry(async () => {
    try {
      console.log('🚀 Attempting to call OpenAI API...');
      if (!openai) {
        throw new Error('OpenAI API not initialized');
      }
      
      // Natural conversational prompt that makes the AI genuinely curious
      const prompt = `
I just told you this:
"${cleanJournalText}"
${cleanLocation ? `\nI'm in: ${cleanLocation}` : ''}

You're my friend and you just heard me vent. Ask me ONE natural question that shows you were listening and makes me think deeper about what I just told you.

Use my exact words and be genuinely curious about my situation.

Respond ONLY with the question - no explanation.`;
      
      // Generate content using OpenAI with enhanced parameters for variety
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { 
            role: "system", 
            content: "You are a caring friend who just heard someone share something personal. Ask them ONE natural question that shows you were listening and makes them think deeper. Use their exact words and be genuinely curious about their situation."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.8, // Increased for more variety
        max_tokens: 50,
        seed: seed,
        presence_penalty: 0.6, // Encourage novel content
        frequency_penalty: 0.3  // Reduce repetition
      });
      
      const text = response.choices[0].message.content || '';
      console.log('📝 Raw GPT response:', text);
      
      // Clean up the response
      const cleanedQuestion = text
        .replace(/^["']|["']$/g, '') // Remove surrounding quotes if present
        .replace(/^(here's a question:|question:|follow-up:|follow up:)/i, '') // Remove introductory phrases
        .trim();
      
      // Make sure it ends with a question mark
      const finalQuestion = cleanedQuestion.endsWith('?') 
        ? cleanedQuestion 
        : cleanedQuestion + '?';
      
      // Validate the question quality
      if (finalQuestion.length < 10 || finalQuestion.toLowerCase().includes('experience with rather')) {
        throw new Error('Generated question quality is poor');
      }
      
      // Store the question in the recent questions list
      addToRecentQuestions(finalQuestion);
      
      console.log('✅ Successfully generated GPT question:', finalQuestion);
      return [finalQuestion];
    } catch (error) {
      console.error('❌ Error generating prompts with OpenAI:', error);
      
      // If we've retried and still failed, fall back to default prompts
      console.log('🔄 Falling back to default prompts after GPT failure');
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
  // Analyze the journal text to create more targeted prompts
  const lowerText = journalText.toLowerCase();
  const words = journalText.split(/\s+/).filter(word => word.length > 0);
  
  // Extract key themes and words from the journal entry
  const keyWords = words.filter(word => 
    word.length > 3 && 
    !['the', 'and', 'but', 'for', 'are', 'with', 'his', 'they', 'have', 'this', 'that', 'will', 'your', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'just', 'into', 'than', 'more', 'other', 'about', 'many', 'then', 'them', 'these', 'so', 'people', 'can', 'said', 'each', 'which', 'she', 'do', 'how', 'their', 'if', 'up', 'out', 'many', 'then', 'them', 'these', 'so', 'people', 'can', 'said', 'each', 'which', 'she', 'do', 'how', 'their', 'if', 'up', 'out'].includes(word.toLowerCase())
  ).slice(0, 5);
  
  // Detect emotions and themes
  const emotions = [];
  if (lowerText.includes('happy') || lowerText.includes('joy') || lowerText.includes('excited')) emotions.push('happiness');
  if (lowerText.includes('sad') || lowerText.includes('depressed') || lowerText.includes('down')) emotions.push('sadness');
  if (lowerText.includes('angry') || lowerText.includes('frustrated') || lowerText.includes('mad')) emotions.push('anger');
  if (lowerText.includes('anxious') || lowerText.includes('worried') || lowerText.includes('nervous')) emotions.push('anxiety');
  if (lowerText.includes('tired') || lowerText.includes('exhausted') || lowerText.includes('drained')) emotions.push('exhaustion');
  if (lowerText.includes('grateful') || lowerText.includes('thankful') || lowerText.includes('blessed')) emotions.push('gratitude');
  
  // Detect themes
  const themes = [];
  if (lowerText.includes('work') || lowerText.includes('job') || lowerText.includes('career')) themes.push('work');
  if (lowerText.includes('friend') || lowerText.includes('family') || lowerText.includes('relationship')) themes.push('relationships');
  if (lowerText.includes('goal') || lowerText.includes('dream') || lowerText.includes('future')) themes.push('goals');
  if (lowerText.includes('health') || lowerText.includes('exercise') || lowerText.includes('body')) themes.push('health');
  if (lowerText.includes('learn') || lowerText.includes('study') || lowerText.includes('school')) themes.push('learning');
  
  // Create targeted prompts based on detected content
  let targetedPrompts = [];
  
  if (emotions.length > 0) {
    const emotion = emotions[0];
    targetedPrompts.push(`What's going on with this ${emotion}?`);
    targetedPrompts.push(`What's behind this ${emotion}?`);
  }
  
  if (themes.length > 0) {
    const theme = themes[0];
    if (theme === 'work') {
      targetedPrompts.push("What's going on at work?");
      targetedPrompts.push("What's the deal with your job?");
    } else if (theme === 'relationships') {
      targetedPrompts.push("What's happening with your relationships?");
      targetedPrompts.push("What's going on with the people in your life?");
    } else if (theme === 'goals') {
      targetedPrompts.push("What's stopping you?");
      targetedPrompts.push("What do you want?");
    }
  }
  
  if (keyWords.length > 0) {
    const keyWord = keyWords[0];
    targetedPrompts.push(`What's up with "${keyWord}"?`);
    targetedPrompts.push(`What's the deal with "${keyWord}"?`);
  }
  
  // Natural fallback prompts
  const defaultPrompts = [
    "What's really going on here?",
    "What's the real story?",
    "What happened?",
    "What's bothering you?",
    "What's on your mind?",
    "What's going through your head?",
    "What's the deal?",
    "What's up?"
  ];
  
  // Natural prompts for lyrics
  const lyricalPrompts = [
    "What's going on with these lyrics?",
    "What's up with this song?",
    "What's the deal with these words?",
    "What's happening here?",
    "What's on your mind with this?",
    "What's going through your head?",
    "What's the story behind this?",
    "What's really going on?"
  ];
  
  // If text appears to be lyrics, use lyrical prompts
  const isLyrical = detectContentType(journalText).includes("lyric") || 
                    journalText.toLowerCase().includes("i'd rather");
  
  // Prioritize targeted prompts, then lyrical if applicable, then defaults
  let allPrompts = [...targetedPrompts];
  
  if (isLyrical) {
    allPrompts = [...targetedPrompts, ...lyricalPrompts];
  } else {
    allPrompts = [...targetedPrompts, ...defaultPrompts];
  }
  
  // Find a prompt that hasn't been used recently
  let availablePrompts = allPrompts.filter(p => !recentQuestions.includes(p));
  
  // If all prompts have been used recently, just use the full list
  if (availablePrompts.length === 0) {
    availablePrompts = allPrompts;
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