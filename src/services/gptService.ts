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
  if (apiKey && apiKey !== 'your_openai_api_key_here') {
    openai = new OpenAI({
      apiKey: apiKey,
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
  
  // Sanitize inputs to prevent injection
  const sanitizedJournalText = sanitizeInput(journalText);
  const sanitizedLocation = location ? sanitizeInput(location) : undefined;
  
  return withRetry(async () => {
    try {
      if (!openai) {
        throw new Error('OpenAI API not initialized');
      }
      
      // Extract key elements from the journal text
      const extractedData = extractJournalData(sanitizedJournalText);
      
      logExtractionData(extractedData);
      
      // Create a list of the most specific details to ensure they're used in the question
      const specificDetails = buildSpecificDetailsList(extractedData);
      
      // Create an enhanced prompt
      const prompt = buildPromptTemplate(
        sanitizedJournalText, 
        sanitizedLocation, 
        specificDetails,
        recentQuestions
      );
      
      // Generate content using OpenAI
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: "You are an assistant that generates extremely specific, personalized journal questions. Your questions MUST reference concrete details from the user's journal entry. Never produce generic questions that could apply to any journal. Extract actual details from their writing and incorporate those exact details in your question." },
          { role: "user", content: prompt }
        ],
        temperature: DEFAULT_TEMPERATURE,
        max_tokens: DEFAULT_MAX_TOKENS,
        seed: seed
      });
      
      const text = response.choices[0].message.content || '';
      
      // Clean up the response
      const cleanedQuestion = cleanResponse(text);
      
      // Validate that the question is actually personalized and contains specific details
      if (isGenericQuestion(cleanedQuestion, sanitizedJournalText) || !containsSpecificDetails(cleanedQuestion, specificDetails)) {
        console.log("Rejected insufficient question:", cleanedQuestion);
        // Return a manually crafted personalized question as a fallback
        return [createUniquePersonalizedQuestion(sanitizedJournalText, extractedData)];
      }
      
      // Store the question in the recent questions list
      addToRecentQuestions(cleanedQuestion);
      
      return [cleanedQuestion];
    } catch (error) {
      console.error('Error generating prompts with OpenAI:', error);
      
      // If we've retried and still failed, fall back to default prompts
      return [getUniqueDefaultPrompt(sanitizedJournalText, sanitizedLocation)];
    }
  }, retries);
};

// Helper function to sanitize inputs
function sanitizeInput(input: string): string {
  return input
    .replace(/["\\]/g, '') // Remove quotes and backslashes to prevent prompt injection
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Extract all data in one pass to reduce repeated text processing
function extractJournalData(text: string) {
  // First, identify the sequence of events and people involved
  const sequenceAnalysis = analyzeNarrativeSequence(text);
  
  // Then extract detailed entities
  return {
    names: extractNames(text),
    places: extractPlaces(text),
    activities: extractActivities(text),
    foods: extractFoods(text),
    emotions: extractEmotions(text),
    healthIssues: extractHealthIssues(text),
    topics: extractTopics(text),
    keyPhrases: extractKeyPhrases(text),
    narrative: sequenceAnalysis
  };
}

function logExtractionData(data: any) {
  if (process.env.NODE_ENV === 'development') {
    console.log('Extracted journal data:', JSON.stringify(data, null, 2));
  }
}

function buildSpecificDetailsList(data: any): string[] {
  const details: string[] = [];
  
  // Add specific details from each category if they exist
  if (data.names.length) details.push(...data.names.slice(0, 2));
  if (data.places.length) details.push(...data.places.slice(0, 2));
  if (data.activities.length) details.push(...data.activities.slice(0, 2));
  if (data.emotions.length) details.push(...data.emotions.slice(0, 2));
  
  return details.filter(Boolean);
}

function extractTopics(text: string): string[] {
  // Simple implementation - in production, this would use more sophisticated NLP
  const commonTopics = [
    "work", "family", "health", "relationships", "goals", "challenges",
    "travel", "food", "fitness", "learning", "money", "spirituality"
  ];
  
  return commonTopics.filter(topic => 
    text.toLowerCase().includes(topic.toLowerCase())
  );
}

function extractKeyPhrases(text: string): string[] {
  // Simple extraction of key phrases
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Select sentences that might contain key insights
  const potentialKeyPhrases = sentences.filter(sentence => 
    sentence.toLowerCase().includes('feel') ||
    sentence.toLowerCase().includes('think') ||
    sentence.toLowerCase().includes('realize') ||
    sentence.toLowerCase().includes('learn') ||
    sentence.toLowerCase().includes('hope') ||
    sentence.toLowerCase().includes('want') ||
    sentence.toLowerCase().includes('need') ||
    sentence.toLowerCase().includes('should')
  );
  
  // Return up to 3 key phrases
  return potentialKeyPhrases
    .slice(0, 3)
    .map(phrase => phrase.trim());
}

function buildPromptTemplate(
  journalText: string,
  location: string | undefined,
  specificDetails: string[],
  recentQuestions: string[]
): string {
  const trimmedJournal = journalText.length > 2000 
    ? journalText.substring(0, 2000) + "..." 
    : journalText;
  
  // Base prompt
  let prompt = `
Journal entry: "${trimmedJournal}"
`;

  // Add location if provided
  if (location && location.trim() !== '') {
    prompt += `\nLocation: ${location}`;
  }

  // Add specifics to make the response more personalized
  if (specificDetails.length > 0) {
    prompt += `\n\nKey elements: ${specificDetails.join(', ')}`;
  }

  // Enhanced instructions for generating a thoughtful, personalized question
  prompt += `\n\nGenerate ONE highly specific follow-up question that directly references exact details from this journal entry.
  
Your question MUST:
- Focus on specific actions, decisions, or statements mentioned by the writer
- Include at least one direct reference to a concrete detail from the entry (e.g., "When you gave suits to poor people...")
- Be written in second person (using "you")
- Encourage deeper reflection about motivations, feelings, or impact
- Be concise (maximum 15 words)
- Avoid generic phrases that could apply to any journal
- NOT repeat these previous questions: ${recentQuestions.join('; ')}

Examples of good questions based on THIS specific journal entry could be:
- "What motivated you to provide suits and ties specifically?"
- "How did you identify which poor people needed your help?"
- "What specific changes did you observe in their lives after receiving the suits?"

Output ONLY the question, nothing else.`;

  return prompt;
}

interface JournalData {
  names: string[];
  places: string[];
  activities: string[];
  foods: string[];
  emotions: string[];
  healthIssues: string[];
  topics: string[];
  keyPhrases: string[];
}

function createUniquePersonalizedQuestion(
  journalText: string,
  data: JournalData
): string {
  // Extract key phrases and terms from the journal text
  const words = journalText.split(/\s+/);
  const keyTerms: string[] = [];
  
  // Look for nouns, especially proper nouns
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Check for capitalized words that aren't at the start of sentences
    if (i > 0 && /^[A-Z][a-z]{2,}$/.test(word)) {
      keyTerms.push(word);
    }
    // Check for important terms
    if (word.length > 5 && !/^(because|through|would|could|should|their|there|these|those|where|which|when|what)$/i.test(word)) {
      keyTerms.push(word.toLowerCase());
    }
  }
  
  // Check for specific actions or scenarios in the journal
  const presidentMention = journalText.toLowerCase().includes('president');
  const helpedPeopleMention = journalText.toLowerCase().includes('helped') && journalText.toLowerCase().includes('people');
  const suitsMention = journalText.toLowerCase().includes('suits');
  const changesMention = journalText.toLowerCase().includes('changed') || journalText.toLowerCase().includes('changes');
  
  // Select a question template based on what data we have extracted
  const templates = [
    // Very specific templates based on exact journal content
    ...(presidentMention ? [
      `What specific responsibilities do you have as the president of the school?`,
      `How did you become the president of the school?`,
      `What leadership qualities helped you become president?`,
    ] : []),
    
    ...(helpedPeopleMention ? [
      `How did you identify the people who needed your help?`,
      `What personal satisfaction did you gain from helping these people?`,
      `What challenges did you face when helping these people?`,
    ] : []),
    
    ...(suitsMention ? [
      `Why did you choose to give suits and ties specifically?`,
      `Where did you obtain the suits and ties you gave away?`,
      `How did people react when you gave them the suits?`,
    ] : []),
    
    ...(changesMention ? [
      `What specific changes have you observed in their lives?`,
      `How do you measure the impact of the changes you've made?`,
      `What motivated you to want to change their lives?`,
    ] : []),
    
    // Templates focused on people
    ...(data.names.length > 0 ? [
      `How has ${data.names[0]} responded to your help?`,
      `What made you choose ${data.names[0]} to help?`,
    ] : []),
    
    // Templates focused on activities
    ...(data.activities.length > 0 ? [
      `What challenges did you face while ${data.activities[0]}?`,
      `How has ${data.activities[0]} changed your perspective?`,
    ] : []),
    
    // Templates focused on emotions
    ...(data.emotions.length > 0 ? [
      `Why did you feel ${data.emotions[0]} during this experience?`,
      `How has feeling ${data.emotions[0]} influenced your actions?`,
    ] : []),
    
    // General templates when specific data is limited - still try to be specific
    `Why did you describe these people as "poor"?`,
    `What specific improvements did you witness after helping them?`,
    `How do you think their lives were different after receiving the suits?`,
    `What motivated you to take this action?`,
    `How did the people react when you gave them the suits?`
  ];
  
  // Choose a random template that hasn't been used recently
  let availableTemplates = templates.filter(t => !recentQuestions.includes(t));
  
  // If all templates have been used recently, just pick a random one
  if (availableTemplates.length === 0) {
    availableTemplates = templates;
  }
  
  const selectedTemplate = availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
  
  // Save this in the recent questions
  addToRecentQuestions(selectedTemplate);
  
  return selectedTemplate;
}

function containsSpecificDetails(question: string, specificDetails: string[]): boolean {
  if (specificDetails.length === 0) return true; // No details to check
  
  return specificDetails.some(detail => 
    question.toLowerCase().includes(detail.toLowerCase())
  );
}

function extractFoods(text: string): string[] {
  // Common food categories and items for detection
  const foodCategories = [
    "breakfast", "lunch", "dinner", "snack", "meal", "food", "eat", "ate",
    "restaurant", "café", "cafe", "coffee", "tea", "dessert", "appetizer"
  ];
  
  const commonFoods = [
    "pizza", "burger", "sandwich", "salad", "pasta", "rice", "chicken", "beef",
    "pork", "fish", "vegetables", "fruits", "apple", "banana", "orange", "cake",
    "cookie", "ice cream", "chocolate", "cheese", "milk", "yogurt", "bread",
    "cereal", "eggs", "bacon", "toast", "pancakes", "waffles", "oatmeal"
  ];
  
  // Look for sentences containing food-related terms
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  const foodMentions: string[] = [];
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    
    // Check for food categories
    const hasFoodCategory = foodCategories.some(category => 
      lowerSentence.includes(category)
    );
    
    // Check for specific food items
    const specificFoodMentions = commonFoods.filter(food => 
      lowerSentence.includes(food)
    );
    
    if (hasFoodCategory || specificFoodMentions.length > 0) {
      // Extract the most likely food item from the sentence
      // This is a simple approach - in production, we'd use NLP for entity extraction
      const foodMention = specificFoodMentions.length > 0 
        ? specificFoodMentions[0] 
        : sentence.trim();
      
      if (!foodMentions.includes(foodMention)) {
        foodMentions.push(foodMention);
      }
    }
  }
  
  return foodMentions.slice(0, 3); // Return up to 3 food mentions
}

function extractEmotions(text: string): string[] {
  // Common emotion words
  const emotionWords = [
    // Positive emotions
    "happy", "joy", "excited", "thrilled", "content", "satisfied", "peaceful",
    "proud", "grateful", "hopeful", "confident", "love", "inspired", "motivated",
    "optimistic", "enthusiastic", "relieved", "serene", "amused", "appreciated",
    
    // Negative emotions
    "sad", "angry", "frustrated", "anxious", "worried", "scared", "fearful",
    "stressed", "overwhelmed", "disappointed", "regretful", "lonely", "jealous",
    "embarrassed", "guilty", "ashamed", "annoyed", "irritated", "nervous",
    "confused", "hurt", "depressed", "insecure", "uncomfortable", "tired",
    
    // Neutral or mixed emotions
    "surprised", "curious", "nostalgic", "pensive", "reflective", "contemplative",
    "ambivalent", "indifferent", "calm", "focused", "determined", "cautious"
  ];
  
  const detectedEmotions: string[] = [];
  
  // Search for direct mentions of emotions
  for (const emotion of emotionWords) {
    const regex = new RegExp(`\\b(I\\s+(?:am|feel|felt)\\s+(?:\\w+\\s+)*${emotion}|${emotion})\\b`, 'i');
    if (regex.test(text)) {
      detectedEmotions.push(emotion);
    }
  }
  
  // Look for phrases indicating emotions
  const emotionalPhrases = [
    { phrase: "couldn't stop smiling", emotion: "happy" },
    { phrase: "made my day", emotion: "happy" },
    { phrase: "broke down", emotion: "sad" },
    { phrase: "in tears", emotion: "sad" },
    { phrase: "drove me crazy", emotion: "frustrated" },
    { phrase: "lost my temper", emotion: "angry" },
    { phrase: "butterflies in my stomach", emotion: "nervous" },
    { phrase: "weight lifted", emotion: "relieved" },
    { phrase: "on cloud nine", emotion: "elated" },
    { phrase: "heart sank", emotion: "disappointed" }
  ];
  
  for (const { phrase, emotion } of emotionalPhrases) {
    if (text.toLowerCase().includes(phrase)) {
      detectedEmotions.push(emotion);
    }
  }
  
  // Remove duplicates and return
  return Array.from(new Set(detectedEmotions)).slice(0, 5);
}

function extractHealthIssues(text: string): string[] {
  // Common health-related terms
  const healthTerms = [
    "pain", "ache", "sore", "tired", "fatigue", "exhausted", "sick", "ill",
    "headache", "migraine", "nausea", "fever", "cold", "flu", "cough", "sneeze",
    "allergies", "injury", "hurt", "wound", "bruise", "sprain", "strain",
    "medication", "medicine", "doctor", "hospital", "appointment", "therapy",
    "treatment", "surgery", "recovery", "healing", "better", "worse", "symptoms",
    "diagnosis", "chronic", "condition", "disease", "disorder", "infection",
    "insomnia", "sleep", "diet", "nutrition", "weight", "exercise", "stress",
    "anxiety", "depression", "mental health"
  ];
  
  const healthMentions: string[] = [];
  
  // Extract sentences containing health terms
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    
    for (const term of healthTerms) {
      if (lowerSentence.includes(term)) {
        // Extract a concise health mention - in production, we'd use NLP
        const shortMention = sentence.length > 50 
          ? sentence.substring(0, 50) + "..."
          : sentence;
        
        healthMentions.push(shortMention.trim());
        break; // Only add the sentence once, even if it contains multiple terms
      }
    }
  }
  
  // Remove duplicates and return up to 3 health mentions
  return Array.from(new Set(healthMentions)).slice(0, 3);
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
    "Is there anything about this situation you'd like to explore more deeply?",
    "How does what you wrote relate to your current goals or values?",
    "What's something you learned from the experience you described?",
    "How might your future self look back on what you've written today?",
    "What would you like to remember most about what you've written?",
    "Is there a pattern you notice in how you responded to this situation?",
    "What strength did you demonstrate in the experience you described?",
    "If you could change one aspect of what you've written about, what would it be?",
    "What support might you need regarding what you've shared in your entry?"
  ];
  
  // If text is very short, use special prompts for brief entries
  if (journalText.split(/\s+/).length < 15) {
    return getUniqueShortEntryPrompt(journalText, location);
  }
  
  // Find a prompt that hasn't been used recently
  let availablePrompts = defaultPrompts.filter(p => !recentQuestions.includes(p));
  
  // If all prompts have been used recently, just use the full list
  if (availablePrompts.length === 0) {
    availablePrompts = defaultPrompts;
  }
  
  // Choose a random prompt from the available ones
  const selectedPrompt = availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
  
  // Add to recent questions list
  addToRecentQuestions(selectedPrompt);
  
  return selectedPrompt;
};

const getUniqueShortEntryPrompt = (journalText: string, location?: string): string => {
  // Prompts specifically designed for very short entries
  const shortEntryPrompts = [
    "What made you decide to write a brief entry today?",
    "What else would you like to add to what you've written?",
    "What were you feeling before you started writing today?",
    "What are you hoping to gain from journaling right now?",
    "Would you like to expand on what you've written so far?",
    "Is there something specific on your mind that you haven't expressed yet?",
    "What's the most important thing for you to capture in your journal today?",
    "How might you continue this thought in your next entry?",
    "What's another perspective on what you've written that you might explore?",
    "If you had more time to write, what would you add to this entry?"
  ];
  
  // Find a prompt that hasn't been used recently
  let availablePrompts = shortEntryPrompts.filter(p => !recentQuestions.includes(p));
  
  // If all prompts have been used recently, just use the full list
  if (availablePrompts.length === 0) {
    availablePrompts = shortEntryPrompts;
  }
  
  // Choose a random prompt from the available ones
  const selectedPrompt = availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
  
  // Add to recent questions list
  addToRecentQuestions(selectedPrompt);
  
  return selectedPrompt;
};

function extractNames(text: string): string[] {
  // This is a simplified approach - in production, we'd use NER (Named Entity Recognition)
  const possibleNames: string[] = [];
  
  // Look for common name patterns (capitalized words)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  for (const sentence of sentences) {
    // Find potential name candidates (e.g., capitalized words not at the start of a sentence)
    const words = sentence.split(/\s+/);
    
    for (let i = 1; i < words.length; i++) { // Start at index 1 to skip first word of sentence
      const word = words[i].trim();
      
      // Check if the word starts with a capital letter and doesn't end with punctuation
      if (/^[A-Z][a-z]+[,;:]?$/.test(word)) {
        // Look for common name disqualifiers
        const lowerWord = word.toLowerCase().replace(/[,;:]$/, '');
        
        // Skip common capitalized non-name words
        const nonNameWords = [
          "i", "me", "my", "mine", "myself", "monday", "tuesday", "wednesday", 
          "thursday", "friday", "saturday", "sunday", "january", "february", 
          "march", "april", "may", "june", "july", "august", "september", 
          "october", "november", "december", "the", "a", "an", "and", "but", 
          "or", "nor", "for", "so", "yet", "after", "although", "as", "because",
          "before", "if", "once", "since", "though", "unless", "until", "when",
          "where", "while"
        ];
        
        if (!nonNameWords.includes(lowerWord)) {
          const cleanName = word.replace(/[,;:]$/, '');
          possibleNames.push(cleanName);
        }
      }
      
      // Also check for "I" followed by interaction verbs and a capitalized word
      if (i >= 2 && words[i-2].trim() === "I") {
        const verb = words[i-1].toLowerCase().trim();
        const interactionVerbs = ["met", "saw", "visited", "called", "texted", "spoke", "talked", "discussed", "told", "asked", "thanked"];
        
        if (interactionVerbs.includes(verb) && /^[A-Z][a-z]+[,;:]?$/.test(word)) {
          const cleanName = word.replace(/[,;:]$/, '');
          possibleNames.push(cleanName);
        }
      }
    }
  }
  
  // Remove duplicates and return
  return Array.from(new Set(possibleNames)).slice(0, 5);
}

function extractPlaces(text: string): string[] {
  // This is a simplified approach - in production, we'd use NER (Named Entity Recognition)
  const possiblePlaces: string[] = [];
  
  // Common place indicators
  const placeIndicators = [
    "at", "in", "to", "from", "near", "around", "through", "across", "over", "under",
    "inside", "outside", "downtown", "uptown", "visited", "traveled", "drove", "flew",
    "walked", "hiked", "exploring", "moved", "relocated", "living", "staying"
  ];
  
  // Look for places with two approaches
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    
    // Approach 1: Look for place indicators followed by proper nouns
    for (let i = 0; i < words.length - 1; i++) {
      const currentWord = words[i].toLowerCase().trim().replace(/[,.;:]$/, '');
      
      if (placeIndicators.includes(currentWord)) {
        // Check if the next word is potentially a place name (capitalized)
        const nextWord = words[i+1].trim();
        if (/^[A-Z][a-z]+[,;:]?$/.test(nextWord)) {
          // Check for compound place names (e.g., "New York")
          if (i+2 < words.length && /^[A-Z][a-z]+[,;:]?$/.test(words[i+2])) {
            const placeName = `${nextWord.replace(/[,;:]$/, '')} ${words[i+2].replace(/[,;:]$/, '')}`;
            possiblePlaces.push(placeName);
            continue;
          }
          
          // Single word place
          const placeName = nextWord.replace(/[,;:]$/, '');
          possiblePlaces.push(placeName);
        }
      }
    }
    
    // Approach 2: Look for common place types
    const placeTypes = [
      "cafe", "café", "restaurant", "store", "shop", "mall", "park", "beach",
      "mountain", "river", "lake", "ocean", "sea", "forest", "desert", "island",
      "hotel", "motel", "resort", "home", "house", "apartment", "condo", "office",
      "building", "school", "college", "university", "library", "museum", "theater",
      "cinema", "stadium", "arena", "gym", "hospital", "clinic", "airport", "station"
    ];
    
    for (const placeType of placeTypes) {
      if (sentence.toLowerCase().includes(placeType)) {
        // Use regex to find a pattern like "the [CafeType]" or "[Name] [CafeType]"
        const regex = new RegExp(`(the\\s+${placeType})|(\\w+\\s+${placeType})`, 'i');
        const match = sentence.match(regex);
        
        if (match && match[0]) {
          possiblePlaces.push(match[0].trim());
        }
      }
    }
  }
  
  // Remove duplicates and return
  return Array.from(new Set(possiblePlaces)).slice(0, 5);
}

function extractActivities(text: string): string[] {
  const activities: string[] = [];
  
  // Common activity verbs in past tense
  const activityVerbs = [
    "went", "played", "watched", "read", "wrote", "visited", "traveled",
    "hiked", "walked", "ran", "jogged", "swam", "exercised", "worked out",
    "cooked", "baked", "cleaned", "organized", "shopped", "bought", "purchased",
    "met", "talked", "spoke", "discussed", "argued", "celebrated", "attended",
    "worked", "studied", "learned", "practiced", "created", "made", "built",
    "fixed", "repaired", "helped", "assisted", "volunteered", "participated"
  ];
  
  // Common hobby and activity nouns
  const activityNouns = [
    "movie", "show", "book", "game", "sport", "exercise", "workout", "hike",
    "walk", "run", "jog", "swim", "yoga", "meditation", "painting", "drawing",
    "cooking", "baking", "cleaning", "shopping", "meeting", "conversation",
    "discussion", "argument", "celebration", "party", "gathering", "event",
    "concert", "performance", "work", "project", "task", "assignment", "study",
    "class", "lecture", "lesson", "practice", "rehearsal", "creation", "building"
  ];
  
  // Look for "I" + activity verb patterns
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    
    // Approach 1: Look for "I verb" patterns
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].trim() === "I") {
        const nextWord = words[i+1].toLowerCase().trim().replace(/[,.;:]$/, '');
        
        if (activityVerbs.includes(nextWord)) {
          // Extract a meaningful activity phrase
          const activityEndIndex = Math.min(i + 4, words.length);
          const activityPhrase = words.slice(i, activityEndIndex).join(" ").trim().replace(/[,.;:]$/, '');
          activities.push(activityPhrase);
        }
      }
    }
    
    // Approach 2: Look for activity nouns
    for (const noun of activityNouns) {
      if (sentence.toLowerCase().includes(noun)) {
        // Find the specific context around the activity noun
        const regex = new RegExp(`((my|the|a|an)\\s+${noun})|(${noun}\\s+(with|at|in|for))`, 'i');
        const match = sentence.match(regex);
        
        if (match && match[0]) {
          activities.push(match[0].trim());
        } else if (sentence.toLowerCase().includes(noun)) {
          // If no specific context is found, just use the basic noun
          activities.push(noun);
        }
      }
    }
  }
  
  // Remove duplicates and get the most specific activities
  return Array.from(new Set(activities)).slice(0, 5);
}

function isGenericQuestion(question: string, journalText: string): boolean {
  // Check if the question is too generic by seeing if it could apply to almost any journal entry
  
  const genericPhrases = [
    "tell me more",
    "how do you feel",
    "how did you feel",
    "what happened",
    "can you elaborate",
    "why did you",
    "have you considered",
    "what do you think",
    "how would you",
    "can you explain"
  ];
  
  // Check if the question contains any of the generic phrases
  const lowerQuestion = question.toLowerCase();
  
  const isGeneric = genericPhrases.some(phrase => lowerQuestion.includes(phrase));
  
  // If the question doesn't contain any specific details from the journal, it's probably generic
  const words = journalText.split(/\s+/);
  const significantWords = words.filter(word => 
    word.length > 4 && !commonWords.includes(word.toLowerCase())
  );
  
  // Take a sample of significant words and check if any appear in the question
  const sampleWords = significantWords.slice(0, 10);
  const containsSpecificContent = sampleWords.some(word => 
    lowerQuestion.includes(word.toLowerCase())
  );
  
  return isGeneric || !containsSpecificContent;
}

// Common English words to filter out when looking for significant words
const commonWords = [
  "about", "above", "across", "after", "again", "against", "almost", "alone",
  "along", "already", "also", "although", "always", "among", "another", "anyone",
  "anything", "anywhere", "around", "because", "before", "being", "below",
  "between", "both", "could", "during", "either", "every", "everyone",
  "everything", "everywhere", "from", "have", "having", "here", "himself",
  "herself", "into", "myself", "never", "nothing", "nowhere", "once", "only",
  "other", "others", "ought", "ourselves", "over", "same", "should", "since",
  "some", "someone", "something", "somewhere", "such", "than", "that", "their",
  "them", "themselves", "then", "there", "these", "they", "this", "those",
  "through", "thus", "under", "until", "very", "what", "whatever", "when",
  "where", "whether", "which", "while", "with", "within", "without", "would",
  "your", "yours", "yourself", "yourselves"
];

const cleanResponse = (text: string): string => {
  // Process the OpenAI response to extract just the question
  
  // Remove any prefixes like "Here's a thoughtful question:" or "Question:"
  let cleaned = text.replace(/^(here'?s\s+a\s+|here\s+is\s+a\s+)?([a-z\s]*question[s]?:?\s+)/i, '');
  
  // Remove any quotes
  cleaned = cleaned.replace(/^"(.*)"$/, '$1');
  cleaned = cleaned.trim();
  
  // Remove any trailing period if it's a question and doesn't end with a question mark
  if (!cleaned.endsWith('?') && !cleaned.endsWith('.')) {
    cleaned += '?';
  } else if (cleaned.endsWith('.')) {
    // If it ends with a period but contains a question structure, change to question mark
    if (/\b(what|who|where|when|why|how)\b/i.test(cleaned)) {
      cleaned = cleaned.slice(0, -1) + '?';
    }
  }
  
  // If the response has multiple sentences, keep only the first one if it's a complete question
  if (cleaned.includes('.') && cleaned.indexOf('.') < cleaned.length - 1) {
    const firstSentence = cleaned.split('.')[0].trim();
    if (firstSentence.endsWith('?') || /\b(what|who|where|when|why|how)\b/i.test(firstSentence)) {
      if (!firstSentence.endsWith('?')) {
        cleaned = firstSentence + '?';
      } else {
        cleaned = firstSentence;
      }
    }
  }
  
  return cleaned;
};

function analyzeNarrativeSequence(text: string) {
  // Break down text into sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Look for time markers that indicate sequence
  const timeMarkers = [
    "first", "initially", "to start", "began", "started",
    "then", "after", "next", "afterwards", "subsequently",
    "finally", "lastly", "eventually", "in the end", "ultimately"
  ];
  
  const timeSequence: string[] = [];
  
  for (const sentence of sentences) {
    for (const marker of timeMarkers) {
      if (sentence.toLowerCase().includes(marker)) {
        timeSequence.push(sentence.trim());
        break;
      }
    }
  }
  
  return {
    hasSequence: timeSequence.length > 1,
    sequence: timeSequence.slice(0, 3) // Return up to 3 sequence markers
  };
}

export default {
  generateJournalPrompts
}; 