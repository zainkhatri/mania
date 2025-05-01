import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API
// API key should be stored in .env file as REACT_APP_GEMINI_API_KEY
const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

// Create a client with the API key
let genAI: GoogleGenerativeAI | null = null;

// Keep track of recent questions to avoid repeating
const recentQuestions: string[] = [];
const MAX_RECENT_QUESTIONS = 5;

// Only initialize if API key exists and is not the placeholder
if (apiKey && apiKey !== 'your_gemini_api_key_here') {
  genAI = new GoogleGenerativeAI(apiKey);
} else {
  console.warn('Gemini API key not found or using placeholder value. The AI journal enhancement feature will use fallback suggestions.');
}

// Function to generate journal enhancement prompts
export const generateJournalPrompts = async (
  journalText: string,
  location?: string,
  minWordCount: number = 50,
  seed: number = Math.floor(Math.random() * 1000)
): Promise<string[]> => {
  if (!genAI) {
    console.log('Using fallback prompts (no API key)');
    return [getUniqueDefaultPrompt(journalText, location)];
  }
  
  try {
    // Get the text generation model (Gemini Pro)
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Extract key elements from the journal text
    const names = extractNames(journalText);
    const places = extractPlaces(journalText);
    const activities = extractActivities(journalText);
    const foods = extractFoods(journalText);
    const emotions = extractEmotions(journalText);
    const healthIssues = extractHealthIssues(journalText);
    
    console.log("Extracted names:", names);
    console.log("Extracted places:", places);
    console.log("Extracted activities:", activities);
    console.log("Extracted foods:", foods);
    console.log("Extracted emotions:", emotions);
    console.log("Extracted health issues:", healthIssues);
    
    // Create a list of the most specific details to ensure they're used in the question
    const specificDetails = [];
    if (healthIssues.length > 0) specificDetails.push(...healthIssues);
    if (foods.length > 0) specificDetails.push(...foods);
    if (places.length > 0) specificDetails.push(...places);
    
    const timeHash = Date.now() % 10000; // Add current time for additional randomness
    
    // Create a prompt that instructs the model what we want
    const prompt = `
      I need you to analyze this journal entry and create ONE deep, insightful question that directly references the emotional and psychological aspects of what was written.
      Focus on the subtext, underlying emotions, and deeper motivations that may not be explicitly stated.
      
      Journal entry: "${journalText}"
      ${location ? `Location: ${location}` : ''}
      
      I've identified these specific elements in the entry:
      - Names of people: ${names.join(', ') || 'none'}
      - Places/businesses: ${places.join(', ') || 'none'}
      - Activities: ${activities.join(', ') || 'none'}
      - Foods mentioned: ${foods.join(', ') || 'none'}
      - Health issues: ${healthIssues.join(', ') || 'none'}
      - Emotions expressed: ${emotions.join(', ') || 'none'}
      
      KEY REQUIREMENTS:
      1. Create a PROFOUND, PSYCHOLOGICALLY DEEP question that explores motivations, emotions, or inner conflicts
      2. Your question MUST reference specific details from the entry (like "${specificDetails.slice(0,2).join('" and "')}")
      3. Avoid surface-level questions - dig into the "why" behind actions, choices, and feelings
      4. If the entry involves relationships or emotional content, explore the deeper psychological aspects
      5. Don't repeat any of these previous questions: ${recentQuestions.join(", ")}
      6. WRONG EXAMPLE: "What's something about Bowser that most people don't know?" (too surface-level)
      7. GOOD EXAMPLE: "How does your idealization of this 'princess' reflect unresolved desires for rescue in your own life?"
      
      Examples of DEEP questions for different themes:
      
      For unrequited love:
      - "What does your attraction to someone who is unavailable reveal about your own fears of genuine intimacy?"
      - "How might this princess represent something beyond romance that you're seeking in your life?"
      
      For food/health experiences:
      - "How did the vulnerability of being physically ill change your perspective on what you most value?"
      - "What deeper fears about mortality were triggered when you thought you might be seriously ill?"
      
      For daily activities:
      - "How does this experience reflect patterns of behavior that have shaped your identity over time?"
      - "What unresolved internal conflict is being played out through your actions in this situation?"
      
      Return ONLY the question, with no quotes or additional text.
      Seed: ${seed}-${timeHash}
    `;
    
    // Generate content with settings for more deterministic output
    const generationConfig = {
      temperature: 0.75, // Balance between creativity and specificity
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 100,
    };
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }]}],
      generationConfig,
    });
    
    const response = await result.response;
    const text = response.text();
    
    // Clean up the response
    const cleanedQuestion = cleanResponse(text);
    
    // Validate that the question is actually personalized and contains specific details
    if (isGenericQuestion(cleanedQuestion, journalText) || !containsSpecificDetails(cleanedQuestion, specificDetails)) {
      console.log("Rejected insufficient question:", cleanedQuestion);
      // Return a manually crafted personalized question as a fallback
      return [createUniquePersonalizedQuestion(journalText, names, places, activities, foods, healthIssues)];
    }
    
    // Store the question in the recent questions list
    addToRecentQuestions(cleanedQuestion);
    
    return [cleanedQuestion];
  } catch (error) {
    console.error('Error generating prompts with Gemini:', error);
    return [getUniqueDefaultPrompt(journalText, location)];
  }
};

// Check if a question contains specific details
function containsSpecificDetails(question: string, specificDetails: string[]): boolean {
  if (specificDetails.length === 0) return true; // No details to check against
  
  const questionLower = question.toLowerCase();
  // Check if at least one specific detail is mentioned in the question
  return specificDetails.some(detail => 
    questionLower.includes(detail.toLowerCase())
  );
}

// Extract foods mentioned in the text
function extractFoods(text: string): string[] {
  const textLower = text.toLowerCase();
  const commonFoods = [
    'taco', 'tacos', 'burrito', 'burger', 'pizza', 'sushi', 'sandwich', 'pasta', 'salad',
    'chicken', 'beef', 'pork', 'fish', 'shrimp', 'vegetable', 'rice', 'noodle',
    'soup', 'stew', 'breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'ice cream'
  ];
  
  // Find common foods in text
  const foundFoods: string[] = [];
  
  // Check for common foods
  commonFoods.forEach(food => {
    if (textLower.includes(food)) {
      // Try to find more specific food mentions (e.g. "shrimp tacos")
      const regex = new RegExp(`\\b([a-z]+\\s+)?${food}\\b`, 'i');
      const match = text.match(regex);
      if (match && match[0]) {
        foundFoods.push(match[0].trim());
      } else {
        foundFoods.push(food);
      }
    }
  });
  
  // Look for patterns like "ate X" or "had some X"
  const foodPatterns = [
    /ate\s+([a-z]+\s+)*([a-z]+)/i,
    /had\s+(some\s+)?([a-z]+\s+)*([a-z]+)/i,
    /ordered\s+([a-z]+\s+)*([a-z]+)/i,
    /got\s+(some\s+)?([a-z]+\s+)*([a-z]+)/i
  ];
  
  foodPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches && matches.length > 2) {
      const potentialFood = matches[matches.length - 1];
      if (potentialFood && !commonFoods.includes(potentialFood)) {
        foundFoods.push(potentialFood);
      }
    }
  });
  
  return Array.from(new Set(foundFoods));
}

// Extract emotions expressed in the text
function extractEmotions(text: string): string[] {
  const textLower = text.toLowerCase();
  const emotionWords = [
    'happy', 'sad', 'angry', 'excited', 'nervous', 'anxious', 'disappointed', 
    'frustrated', 'annoyed', 'scared', 'terrified', 'worried', 'concerned',
    'upset', 'hurt', 'confused', 'surprised', 'shocked', 'disgusted', 'sick',
    'afraid', 'fearful', 'joyful', 'content', 'satisfied', 'proud', 'guilty',
    'ashamed', 'embarrassed', 'lonely', 'hopeful', 'hopeless', 'desperate'
  ];
  
  // Find emotion words in text
  const foundEmotions = emotionWords.filter(emotion => textLower.includes(emotion));
  
  // Look for phrases that indicate emotions
  const emotionPhrases = [];
  if (textLower.includes('felt like')) emotionPhrases.push('felt like');
  if (textLower.includes('was feeling')) emotionPhrases.push('was feeling');
  if (textLower.includes('made me feel')) emotionPhrases.push('made me feel');
  if (textLower.includes('thought i was dead')) emotionPhrases.push('feared death');
  if (textLower.includes('was scared')) emotionPhrases.push('was scared');
  if (textLower.includes('was worried')) emotionPhrases.push('was worried');
  
  return Array.from(new Set([...foundEmotions, ...emotionPhrases]));
}

// Extract health issues mentioned in the text
function extractHealthIssues(text: string): string[] {
  const textLower = text.toLowerCase();
  const healthIssues = [
    'sick', 'ill', 'pain', 'hurt', 'headache', 'nausea', 'vomit', 'vomiting',
    'fever', 'cough', 'cold', 'flu', 'covid', 'infection', 'poisoning', 'food poisoning',
    'stomach', 'diarrhea', 'allergic', 'allergy', 'reaction', 'disease', 'condition'
  ];
  
  // Find health issues in text
  const foundIssues = healthIssues.filter(issue => textLower.includes(issue));
  
  // Look for specific health issue patterns
  const healthPatterns = [];
  if (textLower.includes('food poisoning')) healthPatterns.push('food poisoning');
  if (textLower.includes('got sick')) healthPatterns.push('got sick');
  if (textLower.includes('felt sick')) healthPatterns.push('felt sick');
  if (textLower.includes('was ill')) healthPatterns.push('was ill');
  if (textLower.includes('thought i was dead')) healthPatterns.push('severe illness');
  
  return Array.from(new Set([...foundIssues, ...healthPatterns]));
}

// Helper function to store recent questions
function addToRecentQuestions(question: string): void {
  // Add the new question to the beginning of the array
  recentQuestions.unshift(question);
  
  // Keep only the most recent questions
  if (recentQuestions.length > MAX_RECENT_QUESTIONS) {
    recentQuestions.pop();
  }
}

// Helper function to get a unique personalized question
function createUniquePersonalizedQuestion(
  journalText: string, 
  names: string[], 
  places: string[], 
  activities: string[],
  foods: string[] = [],
  healthIssues: string[] = []
): string {
  // Get a list of potential questions
  const potentialQuestions: string[] = [];
  const textLower = journalText.toLowerCase();
  
  // Food poisoning specific questions
  if (textLower.includes('food poisoning') || 
      (textLower.includes('poisoning') && foods.length > 0)) {
    const food = foods.length > 0 ? foods[0] : 'food';
    const place = places.length > 0 ? places[0] : 'restaurant';
    
    potentialQuestions.push(
      `How long after eating the ${food} at ${place} did you start feeling sick?`,
      `Did anyone else who ate at ${place} experience food poisoning, or was it just you?`,
      `Have you ever had food poisoning before, or was this your first experience with ${food} making you sick?`,
      `What was the first symptom you noticed after eating the ${food} that made you suspect food poisoning?`,
      `Will you ever go back to ${place} after getting food poisoning from their ${food}?`,
      `When you realized it was food poisoning from the ${food}, who was the first person you wanted to tell?`
    );
  }
  
  // Restaurant specific questions
  if (places.length > 0 && foods.length > 0) {
    const place = places[0];
    const food = foods[0];
    
    potentialQuestions.push(
      `What made you choose ${place} for ${food} instead of somewhere else?`,
      `Had you been to ${place} before ordering the ${food}, or was this your first time?`,
      `Did someone recommend the ${food} at ${place}, or did you choose it yourself?`,
      `Was there anything unusual about the ${food} at ${place} that you noticed before eating it?`,
      `Will this experience change your future ordering habits when it comes to ${food}?`
    );
  }
  
  // Health scare specific questions
  if (textLower.includes('thought i was dead') || textLower.includes('dead') || healthIssues.length > 0) {
    potentialQuestions.push(
      `When you thought you might be seriously ill, what was going through your mind?`,
      `Did the health scare from the food poisoning make you reflect on anything important in your life?`,
      `Were you alone when the food poisoning symptoms hit, or was someone there to help you?`,
      `What was the worst moment during your food poisoning experience?`,
      `Did you seek medical attention, or did you try to handle the food poisoning on your own?`
    );
  }
  
  // Ensure we have at least some questions
  if (potentialQuestions.length === 0) {
    potentialQuestions.push(
      "What specifically made you feel like you might be 'dead' from this experience?",
      "Which symptom of the food poisoning was the most unbearable?",
      "Did you warn others about your experience at this restaurant?",
      "How did this bad food experience compare to other times you've gotten sick?",
      "What did you do to try to feel better after realizing you had food poisoning?"
    );
  }
  
  // Filter out any questions that are in the recent questions list
  const uniqueQuestions = potentialQuestions.filter(q => !recentQuestions.includes(q));
  
  // If we have unique questions available, use those
  if (uniqueQuestions.length > 0) {
    const selectedQuestion = uniqueQuestions[Math.floor(Math.random() * uniqueQuestions.length)];
    addToRecentQuestions(selectedQuestion);
    return selectedQuestion;
  }
  
  // If all our questions have been recently used, pick a random one
  const selectedQuestion = potentialQuestions[Math.floor(Math.random() * potentialQuestions.length)];
  addToRecentQuestions(selectedQuestion);
  return selectedQuestion;
}

// Generate a unique default prompt
const getUniqueDefaultPrompt = (journalText = '', location?: string): string => {
  // For very short entries, focus on specific details mentioned
  if (journalText.split(/\s+/).length < 25) {
    return getUniqueShortEntryPrompt(journalText, location);
  }
  
  // Default juicy questions for longer entries
  const juicyQuestions = [
    "What's the part of this story you'd only tell your closest friend?",
    "Who in this situation might have a completely different version of events?",
    "What were you actually thinking when all this was happening?",
    "Is there an unresolved tension here you're still figuring out?",
    "What's the most uncomfortable moment that happened during all this?",
    "If you're being totally honest, what's your real motivation here?",
    "Who are you trying to impress in this situation?",
    "What emotions were you trying to suppress during this experience?",
    "What would your younger self think about how you handled this situation?",
    "If this story was being told about you instead of by you, what details would be different?",
    "What part of your personality were you most conscious of during this experience?",
    "How might this story connect to patterns in your life you're trying to change?"
  ];
  
  // Filter out any questions that are in the recent questions list
  const uniqueQuestions = juicyQuestions.filter(q => !recentQuestions.includes(q));
  
  // If we have unique questions available, use those
  if (uniqueQuestions.length > 0) {
    const selectedQuestion = uniqueQuestions[Math.floor(Math.random() * uniqueQuestions.length)];
    addToRecentQuestions(selectedQuestion);
    return selectedQuestion;
  }
  
  // If all our questions have been recently used, pick a random one
  const selectedQuestion = juicyQuestions[Math.floor(Math.random() * juicyQuestions.length)];
  addToRecentQuestions(selectedQuestion);
  return selectedQuestion;
};

// Unique prompt generator for very short entries
const getUniqueShortEntryPrompt = (journalText: string, location?: string): string => {
  // Generic but juicy questions for very short entries
  const juicyQuestions = [
    "What's the part of this story you're deliberately leaving out?",
    "Who were you really thinking about during all this?",
    "What's the thing about today you wouldn't tell just anyone?",
    "Did something happen that made you uncomfortable?",
    "What's the real story behind what you just wrote?",
    "Is there someone involved you're purposely not mentioning?",
    "What would your friends say if they knew the whole truth about this?",
    "How did this experience make you feel about yourself afterward?",
    "Was there a moment during this that you almost acted differently?",
    "What were you hoping would happen that didn't?",
    "What's a thought you had during this that you'd be embarrassed to share?",
    "How does this connect to something else happening in your life right now?"
  ];
  
  // Filter out any questions that are in the recent questions list
  const uniqueQuestions = juicyQuestions.filter(q => !recentQuestions.includes(q));
  
  // If we have unique questions available, use those
  if (uniqueQuestions.length > 0) {
    const selectedQuestion = uniqueQuestions[Math.floor(Math.random() * uniqueQuestions.length)];
    addToRecentQuestions(selectedQuestion);
    return selectedQuestion;
  }
  
  // If all our questions have been recently used, pick a random one
  const selectedQuestion = juicyQuestions[Math.floor(Math.random() * juicyQuestions.length)];
  addToRecentQuestions(selectedQuestion);
  return selectedQuestion;
};

// Helper function to extract names from text
function extractNames(text: string): string[] {
  // Look for capitalized words that likely represent names
  const namePattern = /\b[A-Z][a-z]+\b/g;
  const potentialNames = text.match(namePattern) || [];
  
  // Filter common non-name capitalized words
  const nonNames = ['I', 'My', 'The', 'A', 'An', 'This', 'That', 'Today', 'Yesterday', 'Tomorrow'];
  
  // Check for contexts that indicate a business name rather than a person
  const textLower = text.toLowerCase();
  const businessContexts = ['restaurant', 'cafe', 'store', 'shop', 'bar', 'taco', 'tacos', 'food'];
  
  // Filter out names that appear to be businesses based on context
  return potentialNames.filter(name => {
    // Skip common non-name words
    if (nonNames.includes(name)) return false;
    
    // Check if this name appears in a business context
    const nameInBusinessContext = businessContexts.some(context => {
      const regex = new RegExp(`${name}.*?${context}|${context}.*?${name}`, 'i');
      return regex.test(text);
    });
    
    // If in business context, don't treat as a person's name
    if (nameInBusinessContext) return false;
    
    // Include as a name
    return true;
  });
}

// Helper function to extract places from text
function extractPlaces(text: string): string[] {
  const textLower = text.toLowerCase();
  
  // Generic place keywords that could appear in journals
  const genericPlaces = [
    'library', 'coffee shop', 'cafe', 'restaurant', 'bar', 'park', 
    'campus', 'office', 'school', 'university', 'college', 'gym', 
    'home', 'house', 'apartment', 'dorm', 'room', 'class', 'building',
    'mall', 'store', 'shop', 'theater', 'cinema', 'beach', 'club',
    'studio', 'lab', 'lecture hall', 'meeting'
  ];
  
  // Find any generic places mentioned
  const foundGenericPlaces = genericPlaces.filter(place => 
    textLower.includes(place)
  );
  
  // Look for specific building/location names (capitalized phrases)
  const specificPlacePattern = /\b[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+(Library|Building|Hall|Center|Room|Park|Plaza|Cafe|Restaurant|Theater|Cinema|Stadium|Arena|Mall)\b/g;
  const specificPlaces = (text.match(specificPlacePattern) || []);
  
  // Look for potential restaurant/business names
  const restaurantPattern = /\b[A-Z][a-z]+('s)?\b/g;
  const potentialBusinesses = (text.match(restaurantPattern) || []);
  
  // Filter potential businesses to only include those in business context
  const businessContexts = ['restaurant', 'cafe', 'store', 'shop', 'food', 'taco', 'tacos', 'eat', 'ate', 'lunch', 'dinner'];
  const businessPlaces = potentialBusinesses.filter(name => {
    return businessContexts.some(context => {
      const regex = new RegExp(`${name}.*?${context}|${context}.*?${name}`, 'i');
      return regex.test(text);
    });
  });
  
  // Combine and remove duplicates
  return Array.from(new Set([...foundGenericPlaces, ...specificPlaces, ...businessPlaces]));
}

// Helper function to extract activities from text
function extractActivities(text: string): string[] {
  const textLower = text.toLowerCase();
  
  // Common verbs that indicate activities
  const commonVerbs = [
    'went', 'walked', 'drove', 'visited', 'attended', 'watched', 'saw', 
    'played', 'studied', 'worked', 'talked', 'spoke', 'discussed', 'met',
    'ate', 'drank', 'cooked', 'baked', 'exercised', 'ran', 'swam', 'hiked',
    'read', 'wrote', 'listened', 'sang', 'danced', 'celebrated', 'presented',
    'argued', 'cried', 'laughed', 'shopped', 'bought', 'spent', 'slept'
  ];
  
  // Common activity phrases
  const activityPhrases = [
    'hanging out', 'going out', 'staying in', 'working on', 'meeting up', 
    'catching up', 'studying for', 'preparing for', 'getting ready',
    'waking up', 'going to bed', 'having lunch', 'having dinner', 'having breakfast'
  ];
  
  // Find verbs and phrases in the text
  const activities: string[] = [];
  
  // Check for common verbs
  commonVerbs.forEach(verb => {
    // Match the verb at word boundary and followed by space
    const regex = new RegExp(`\\b${verb}\\b`, 'i');
    if (regex.test(textLower)) {
      
      // For verbs like "went", try to capture what follows
      if (verb === 'went') {
        const wentToMatch = textLower.match(/went\s+to\s+([a-z]+)/i);
        if (wentToMatch && wentToMatch[1]) {
          activities.push(`went to ${wentToMatch[1]}`);
        } else {
          activities.push(verb);
        }
      } else {
        activities.push(verb);
      }
    }
  });
  
  // Check for activity phrases
  activityPhrases.forEach(phrase => {
    if (textLower.includes(phrase)) {
      activities.push(phrase);
    }
  });
  
  // Look for gerunds (verbs ending in 'ing') which often indicate activities
  const gerundPattern = /\b([a-z]+ing)\b/g;
  const gerunds = textLower.match(gerundPattern) || [];
  
  // Combine and remove duplicates
  return Array.from(new Set([...activities, ...gerunds]));
}

// Check if a question is generic and not personalized to the journal
function isGenericQuestion(question: string, journalText: string): boolean {
  // Convert to lowercase for comparison
  const questionLower = question.toLowerCase();
  const journalLower = journalText.toLowerCase();
  
  // List of generic question patterns
  const genericPatterns = [
    'what were you really feeling',
    'what are you not saying',
    'what are you leaving out',
    'how did you feel about',
    'what\'s the real story',
    'what happened next',
    'is there more to this',
    'why did you decide',
    'how did that make you feel'
  ];
  
  // Check if the question appears to be generic
  const appearsGeneric = genericPatterns.some(pattern => questionLower.includes(pattern));
  
  // Extract names and places from the journal
  const names = extractNames(journalText);
  const places = extractPlaces(journalText);
  
  // If the question doesn't contain any names or places from the journal, it's likely generic
  const containsSpecifics = names.some(name => questionLower.includes(name.toLowerCase())) || 
                           places.some(place => questionLower.includes(place.toLowerCase()));
  
  return (appearsGeneric && !containsSpecifics);
}

// Clean up the response text
const cleanResponse = (text: string): string => {
  // Remove quotes if present
  let cleaned = text.trim().replace(/^["']|["']$/g, '');
  
  // Remove any numbered markers or formatting characters
  cleaned = cleaned.replace(/^(\d+[.)][-*•?]?|\*|-|•|\?)\s+/g, '');
  
  // Make sure it ends with a question mark
  if (!cleaned.endsWith('?')) {
    cleaned += '?';
  }
  
  return cleaned;
};

// Original function definitions still needed:
const getDefaultPrompt = getUniqueDefaultPrompt;
const getShortEntryPrompt = getUniqueShortEntryPrompt;
const createForcedPersonalizedQuestion = createUniquePersonalizedQuestion;