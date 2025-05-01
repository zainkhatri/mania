import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateJournalPrompts } from '../services/geminiService';
import { getPersonalizedQuestion } from '../utils/journalQuestionUtils';

// Add a debounce utility function
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set a timer to update the debounced value after the specified delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clear the timer if value changes before the delay has passed
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface JournalEnhancerProps {
  journalText: string;
  location?: string;
  minWordCount: number;
  onSuggestionClick?: (suggestion: string) => void;
}

const JournalEnhancer: React.FC<JournalEnhancerProps> = ({
  journalText,
  location,
  minWordCount = 50,
  onSuggestionClick
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [suggestion, setSuggestion] = useState<string>('');
  const [expanded, setExpanded] = useState<boolean>(false);
  const [isVeryShortEntry, setIsVeryShortEntry] = useState<boolean>(false);
  const [isShuffling, setIsShuffling] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const previousQuestionRef = useRef<string>('');
  const questionCountRef = useRef<number>(0);
  const [shouldGenerateNew, setShouldGenerateNew] = useState<boolean>(false);
  
  // Debounce journal text to prevent too frequent updates
  const debouncedJournalText = useDebounce(journalText, 1000); // 1 second delay
  
  // Generate a pool of questions for the slot machine effect
  const slotQuestionPool = [
    "What's the real story here?",
    "Why didn't you mention that part?",
    "What were you thinking at the time?",
    "How did that make you feel?",
    "Who else was involved?",
    "What happened next?",
    "Why was this important to you?",
    "Is there something you're holding back?",
    "Did this change your perspective?",
    "Is there more to this story?",
    "What would others say about this?",
    "Are you being completely honest?",
    "Is there another side to this?",
    "What were you afraid of in this moment?",
    "Who were you trying to impress?",
    "What's the part you're leaving out?",
    "What would happen if you just let go?",
    "Did you consider the alternatives?",
    "Why does this matter to you?",
    "What are you avoiding saying?"
  ];

  // Detect when text changes significantly enough to warrant a new question
  useEffect(() => {
    // Count words
    const words = journalText.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length || 0;
    setIsVeryShortEntry(wordCount > 0 && wordCount < 25);

    // Show suggestions if word count is at least 15 and less than minWordCount
    if (wordCount >= 15 && wordCount < minWordCount) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
      // Clear suggestion when we hide the component to prevent processing in the background
      if (suggestion) {
        setSuggestion('');
      }
    }
  }, [journalText, minWordCount, suggestion]);
  
  // Response to debounced journal text changes
  useEffect(() => {
    // Only process if component is visible and we have text
    if (!isVisible || debouncedJournalText.trim().length === 0) {
      return;
    }
    
    // Only set shouldGenerateNew to true if the debounced text changed significantly
    // and there's enough content to generate a meaningful question
    const currentWords = debouncedJournalText.trim().split(/\s+/).length || 0;
    
    if (currentWords >= 5 && expanded && !isShuffling) {
      // Clear existing suggestion to force regeneration
      setSuggestion('');
      setIsError(false);
      setShouldGenerateNew(true);
    }
  }, [debouncedJournalText, expanded, isShuffling, isVisible]);

  // Check if a question is specific to the journal content
  const isQuestionSpecificToContent = (question: string, content: string): boolean => {
    const contentWords = content.toLowerCase().split(/\s+/);
    const questionWords = question.toLowerCase().split(/\s+/);
    
    // Filter out common words
    const commonWords = ['a', 'an', 'the', 'this', 'that', 'these', 'those', 'and', 'or', 'but', 
                         'in', 'on', 'at', 'to', 'for', 'with', 'about', 'from', 'by', 'is', 
                         'was', 'were', 'are', 'of', 'you', 'your', 'what', 'who', 'when', 
                         'where', 'why', 'how', 'did', 'do', 'does', 'have', 'has', 'had'];
    
    // Extract key content details from the journal
    const keyDetails = extractKeyDetails(content);
    
    // Check if question contains specific key details from the content
    for (const detail of keyDetails) {
      if (question.toLowerCase().includes(detail.toLowerCase())) {
        return true;
      }
    }
    
    // Count significant content words that appear in the question
    const significantContentWords = contentWords.filter(word => 
      word.length > 3 && !commonWords.includes(word)
    );
    
    // Count how many significant words from the content appear in the question
    let matchCount = 0;
    significantContentWords.forEach(word => {
      if (questionWords.includes(word)) {
        matchCount++;
      }
    });
    
    // If the question contains multiple specific words from the content, it's likely specific
    return matchCount >= 3; // Increased threshold from 2 to 3 for stronger relevance
  };

  // Extract key details from journal text for better personalization
  const extractKeyDetails = (text: string): string[] => {
    const details: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Extract locations
    const locationPattern = /\b(at|to|in|near)\s+([A-Z][a-z]+([\s][A-Z][a-z]+)*)\b/g;
    let locationMatch;
    while ((locationMatch = locationPattern.exec(text)) !== null) {
      if (locationMatch[2] && !details.includes(locationMatch[2])) {
        details.push(locationMatch[2]);
      }
    }
    
    // Extract times
    const timePattern = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)\b/g;
    const timeMatches = text.match(timePattern);
    if (timeMatches) {
      details.push(...timeMatches);
    }
    
    // Extract events or activities
    if (lowerText.includes('event')) {
      const eventPattern = /\b([A-Za-z]+\s+[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+event\b/g;
      let eventMatch;
      while ((eventMatch = eventPattern.exec(text)) !== null) {
        if (eventMatch[1] && !details.includes(eventMatch[1])) {
          details.push(`${eventMatch[1]} event`);
        }
      }
    }
    
    // Extract specific activities
    const activities = ['coffee', 'breakfast', 'lunch', 'dinner', 'meeting', 'class', 'lecture', 'study'];
    activities.forEach(activity => {
      if (lowerText.includes(activity)) details.push(activity);
    });
    
    // Extract emotional states or judgments
    const emotions = ['weird', 'strange', 'odd', 'exciting', 'boring', 'fun', 'sad', 'happy', 'anxious'];
    emotions.forEach(emotion => {
      if (lowerText.includes(emotion)) details.push(emotion);
    });
    
    return details;
  };

  // GENERIC pattern matching for personalized questions (without hardcoded names)
  const getGenericPersonalizedQuestion = () => {
    const text = journalText.toLowerCase();
    const questionsBank = [];
    
    // Extract specific details from the journal content
    const names = extractNames(journalText);
    const keyDetails = extractKeyDetails(journalText);
    const events = keyDetails.filter(d => d.includes('event'));
    const locations = extractLocations(journalText);
    const times = keyDetails.filter(d => /\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)/.test(d));
    const emotions = keyDetails.filter(d => ['weird', 'strange', 'odd', 'exciting', 'boring', 'fun', 'sad', 'happy', 'anxious'].includes(d));
    
    console.log("Found details:", {names, keyDetails, events, locations, times, emotions});
    
    // Generate highly specific questions based on extracted details
    
    // Check for beach references (Manhattan Beach, etc.)
    if (text.includes('beach')) {
      const beachName = text.includes('manhattan beach') ? 'Manhattan Beach' : 
                       text.includes('venice beach') ? 'Venice Beach' :
                       text.includes('santa monica') ? 'Santa Monica Beach' : 'the beach';
      
      questionsBank.push(
        `What specifically draws you to ${beachName} compared to other beaches in the area?`,
        `How does your experience at ${beachName} today compare to previous visits?`,
        `What sensory details stood out to you most at ${beachName} today - the sounds, smells, or sights?`,
        `Was there a specific moment at ${beachName} that made you feel particularly connected to the place?`,
        `How does being at ${beachName} affect your mood or state of mind?`
      );
    }
    
    // Los Angeles specific questions
    if (text.includes('los angeles') || text.includes('la ')) {
      questionsBank.push(
        "What aspects of Los Angeles do you appreciate most that might not be obvious to visitors?",
        "How has your relationship with Los Angeles evolved over time?",
        "What neighborhood in Los Angeles feels most like 'home' to you and why?",
        "What contradictions or juxtapositions in Los Angeles do you find most interesting?",
        "How does Los Angeles inspire or influence your perspective in ways other cities don't?"
      );
    }
    
    // Questions about specific events
    if (events.length > 0) {
      const event = events[0];
      questionsBank.push(
        `What specifically made the ${event} feel ${emotions.length > 0 ? emotions[0] : 'memorable'}?`,
        `What expectations did you have about the ${event} before you went?`,
        `Were there any unexpected encounters at the ${event}?`,
        `What was the most surprising thing about the ${event}?`,
        `How did the ${event} compare to similar events you've attended before?`
      );
    }
    
    // Questions about specific beach activities
    if (text.includes('beach') && (text.includes('swim') || text.includes('surf') || text.includes('sand') || text.includes('waves'))) {
      let activity = "";
      if (text.includes('swim')) activity = "swimming";
      else if (text.includes('surf')) activity = "surfing";
      else if (text.includes('sand')) activity = "walking on the sand";
      else if (text.includes('waves')) activity = "watching the waves";
      
      if (activity) {
        questionsBank.push(
          `What emotions surfaced while you were ${activity} today?`,
          `How would you describe the quality of the ${activity === "surfing" ? "waves" : "water"} today compared to other times?`,
          `What thoughts were going through your mind while ${activity}?`,
          `How does ${activity} at this beach compare to other places you've been?`
        );
      }
    }
    
    // Questions about times mentioned
    if (times.length > 0) {
      const time = times[0];
      questionsBank.push(
        `Is going to ${locations.length > 0 ? locations[0] : 'places'} at ${time} typical for you, or was today different?`,
        `How did being there at ${time} affect the experience?`,
        `Was there a specific reason you chose to go at ${time} today?`
      );
    }
    
    // Questions about locations
    if (locations.length > 0) {
      const location = locations[0];
      questionsBank.push(
        `What specifically attracts you to ${location}?`,
        `What details about ${location} would someone need to know to understand your experience there?`,
        `How does ${location} make you feel differently than other similar places?`,
        `What hidden aspects of ${location} do you appreciate that others might miss?`,
        `How has ${location} changed since you first experienced it?`
      );
    }

    // Questions about emotional reactions
    if (emotions.length > 0) {
      const emotion = emotions[0];
      questionsBank.push(
        `What specifically triggered that ${emotion} feeling?`,
        `When else have you experienced something ${emotion} like this?`,
        `What contributed most to the ${emotion} feeling?`,
        `Did others seem to find it ${emotion} too, or just you?`
      );
    }
    
    // Personalized questions based on "love" statements
    if (text.includes('love') || text.includes('enjoy')) {
      // Extract what they love
      const lovePattern = /(?:love|enjoy)\s+([^\.]+)/i;
      const match = text.match(lovePattern);
      
      if (match && match[1]) {
        const lovedThing = match[1].trim();
        questionsBank.push(
          `When did you first realize you loved ${lovedThing}?`,
          `What specific qualities of ${lovedThing} resonate with you most deeply?`,
          `How has your appreciation for ${lovedThing} evolved over time?`,
          `Is there a particular memory of ${lovedThing} that stands out as especially meaningful?`,
          `How does your love for ${lovedThing} influence other aspects of your life?`
        );
      }
    }
    
    // Weather-specific questions
    const weatherTerms = ['sunny', 'cloudy', 'rainy', 'foggy', 'hot', 'cold', 'warm', 'windy', 'humid'];
    const foundWeatherTerms = weatherTerms.filter(term => text.includes(term));
    
    if (foundWeatherTerms.length > 0) {
      const weather = foundWeatherTerms[0];
      questionsBank.push(
        `How does the ${weather} weather affect your mood when you're at ${locations.length > 0 ? locations[0] : 'this place'}?`,
        `What specifically about ${weather} days draws you outdoors?`,
        `How does today's ${weather} weather compare to what you were expecting?`,
        `Do you have particular memories associated with ${weather} days like this?`
      );
    }
    
    // If we have very little in the question bank, use more context clues
    if (questionsBank.length < 3) {
      // Extract key phrases or subjects from the text
      const sentences = journalText.split(/[\.!\?]+/).filter(s => s.trim().length > 0);
      
      if (sentences.length > 0) {
        // Find the longest sentence as it might contain the most information
        const mainSentence = sentences.reduce((longest, current) => 
          current.length > longest.length ? current : longest, sentences[0]);
        
        // Extract potential subjects (nouns) - simple approach
        const words = mainSentence.split(/\s+/);
        const potentialSubjects = words.filter(word => 
          word.length > 3 && 
          !['this', 'that', 'they', 'them', 'their', 'went', 'have', 'were', 'with'].includes(word.toLowerCase())
        );
        
        if (potentialSubjects.length > 0) {
          // Use 1-2 subjects to create a more specific question
          const subject1 = potentialSubjects[Math.floor(Math.random() * potentialSubjects.length)];
          let subject2 = "";
          
          if (potentialSubjects.length > 1) {
            do {
              subject2 = potentialSubjects[Math.floor(Math.random() * potentialSubjects.length)];
            } while (subject2 === subject1);
          }
          
          const combinedSubject = subject2 ? `${subject1} and ${subject2}` : subject1;
          
          questionsBank.push(
            `What aspects of ${combinedSubject} left the strongest impression on you?`,
            `How did your experience with ${combinedSubject} differ from what you anticipated?`,
            `What emotions were stirred when you encountered ${combinedSubject}?`,
            `What specific details about ${combinedSubject} would help someone else understand your experience?`
          );
        }
      }
    }
    
    // Fallback questions that still reference the content - much more specific
    if (questionsBank.length === 0) {
      if (text.includes('friend') || text.includes('people')) {
        questionsBank.push(
          "What specific qualities in these people make you value their company?",
          "How do these particular relationships fulfill needs that others in your life don't?",
          "What unspoken dynamics exist in this group that an outsider wouldn't notice?",
          "How did the social energy of this gathering affect your own emotional state?"
        );
      } else if (text.includes('went to') || text.includes('visited')) {
        questionsBank.push(
          "What specific sensory details made this place memorable to you?",
          "How did this location differ from what you expected before arriving?",
          "What aspect of this place resonated with you on a personal level?",
          "How does this location connect to other meaningful places in your life?"
        );
      } else {
        // Most generic fallback, but still somewhat personalized and juicy
        const firstWords = journalText.split(/\s+/).slice(0, 5).join(" ").replace(/\.$/, "");
        questionsBank.push(
          `When you wrote "${firstWords}...", what deeper feelings were you experiencing?`,
          "What details of this experience would you want to remember five years from now?",
          "If you were to describe the most significant aspect of this experience, what would it be?",
          "What emotional truths are just beneath the surface of what you've written?",
          "How did this experience change your perspective, even in a subtle way?"
        );
      }
    }

    // Pick a question, making sure to not repeat the previous one if possible
    if (questionsBank.length > 1 && previousQuestionRef.current) {
      const filteredQuestions = questionsBank.filter(q => q !== previousQuestionRef.current);
      return filteredQuestions[questionCountRef.current % filteredQuestions.length];
    }
    
    return questionsBank[questionCountRef.current % questionsBank.length];
  };
  
  // Extract names from text
  const extractNames = (text: string): string[] => {
    // Look for capitalized words that likely represent names
    const namePattern = /\b[A-Z][a-z]+\b/g;
    const potentialNames = text.match(namePattern) || [];
    
    // Filter common non-name capitalized words
    const nonNames = [
      'I', 'My', 'Me', 'Mine', 'Myself',
      'The', 'A', 'An', 'This', 'That', 'These', 'Those',
      'Today', 'Yesterday', 'Tomorrow', 
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 
      'August', 'September', 'October', 'November', 'December',
      'UCSD', 'AM', 'PM', 'It', 'Its', 'We', 'Our', 'They', 'Their', 'He', 'She', 'His', 'Her'
    ];
    
    // Filter out non-names and return unique names
    const filteredNames = potentialNames.filter(name => !nonNames.includes(name));
    return Array.from(new Set(filteredNames));
  };

  // Helper to extract locations from text
  const extractLocations = (text: string): string[] => {
    const locations: string[] = [];
    
    // Look for location patterns: "at/to/in X", where X is likely a place
    const locationPatterns = [
      /\bat\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
      /\bto\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
      /\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
      /\bnear\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g
    ];
    
    // Apply each pattern
    locationPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && !locations.includes(match[1]) && 
            !['I', 'My', 'Me', 'Mine', 'Myself', 'AM', 'PM'].includes(match[1])) {
          locations.push(match[1]);
        }
      }
    });
    
    // Look for known location keywords
    const knownLocations = ['UCSD', 'Costco', 'home', 'school', 'work', 'university', 'college'];
    knownLocations.forEach(loc => {
      if (text.includes(loc) && !locations.includes(loc)) {
        locations.push(loc);
      }
    });
    
    return locations;
  };

  // Generate a question - try API first, then fall back to guaranteed method
  const generateNewQuestion = useCallback(async () => {
    // Exit early if component is not visible or no text to analyze
    if (!isVisible || debouncedJournalText.trim().length === 0) return;
    
    // Set a timeout to prevent getting stuck in case of API failures
    const apiTimeout = setTimeout(() => {
      console.log('API request taking too long, falling back to local generation');
      try {
        const fallbackQuestion = getGenericPersonalizedQuestion();
        setSuggestion(fallbackQuestion);
        previousQuestionRef.current = fallbackQuestion;
      } catch (error) {
        console.error('Error generating fallback question:', error);
        setSuggestion("What else would you like to add to your journal?");
      } finally {
        setIsShuffling(false);
      }
    }, 5000); // 5 seconds timeout for API call
    
    // Try using the API first
    try {
      questionCountRef.current += 1;
      console.log('Generating question, attempt #', questionCountRef.current);
      
      // Try to get an AI-generated question first
      const seed = Math.floor(Math.random() * 10000);
      try {
        // Priority #1: Use AI-generated question from Gemini
        const aiQuestions = await generateJournalPrompts(debouncedJournalText, location, 50, seed);
        console.log('Got AI question:', aiQuestions && aiQuestions[0]);
        
        // Clear the timeout since API responded
        clearTimeout(apiTimeout);
        
        if (aiQuestions && aiQuestions.length > 0) {
          // Check if the generated question is sufficiently specific to the journal content
          const isSpecificToContent = isQuestionSpecificToContent(aiQuestions[0], debouncedJournalText);
          
          if (isSpecificToContent) {
            setSuggestion(aiQuestions[0]);
            previousQuestionRef.current = aiQuestions[0];
            return;
          } else {
            console.log('Question not specific enough to journal content, trying a different approach');
            // Continue to next approach
          }
        }
      } catch (e) {
        console.log('AI request failed, using fallback questions');
        // Continue to fallback
      }
      
      // Clear the timeout since we're proceeding to the fallback
      clearTimeout(apiTimeout);
      
      // Priority #2: Use the pattern-matching approach
      try {
        const genericQuestion = getGenericPersonalizedQuestion();
        console.log('Generated generic personalized question:', genericQuestion);
        setSuggestion(genericQuestion);
        previousQuestionRef.current = genericQuestion;
      } catch (error) {
        console.error('Error with pattern matching approach:', error);
        // Fall back to a very simple question
        setSuggestion("What else would you like to add to your journal?");
      }
    } catch (error) {
      console.error('Error generating question:', error);
      clearTimeout(apiTimeout);
      setIsError(true);
      
      // If everything fails, use a simple fallback question
      setSuggestion("What details could you add to make this more memorable?");
      previousQuestionRef.current = "What details could you add to make this more memorable?";
    } finally {
      // Always ensure we're not showing the shuffling animation when done
      setIsShuffling(false);
      // Reset the flag
      setShouldGenerateNew(false);
    }
  }, [debouncedJournalText, location, isVisible]);

  // Get personalized question when panel is expanded or when shouldGenerateNew is true
  useEffect(() => {
    if ((expanded && !suggestion && !isShuffling) || (expanded && shouldGenerateNew && !isShuffling)) {
      generateNewQuestion();
    }
  }, [expanded, suggestion, isShuffling, shouldGenerateNew, generateNewQuestion]);

  // Function to shuffle and get a new personalized question
  const handleShuffleQuestion = () => {
    setIsShuffling(true);
    setSuggestion(''); // Clear current suggestion
    
    // Force a different question by clearing previous and incrementing counter
    previousQuestionRef.current = suggestion; // Track the current question to avoid repeating
    questionCountRef.current += 1; // Increment the counter to get a different question
    
    console.log('Shuffle button clicked, starting animation');
    
    // Set a timeout to prevent the shuffling state from getting stuck
    const shuffleTimeout = setTimeout(() => {
      if (isShuffling) {
        console.log('Shuffle taking too long, force recovery');
        setIsShuffling(false);
        // Provide a fallback question if we got stuck
        setSuggestion("What deeper meaning might be hidden in what you've written so far?");
      }
    }, 8000); // 8 seconds max for shuffling before force recovery
    
    // Simulate the slot machine effect with a delay
    setTimeout(() => {
      console.log('Animation complete, generating new question');
      generateNewQuestion();
      clearTimeout(shuffleTimeout); // Clear the recovery timeout if normal flow works
      // Don't set isShuffling to false here, let generateNewQuestion handle it
    }, 2000); // Animation for 2 seconds
  };

  // If the panel is not visible, don't render anything
  if (!isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="mt-2 mb-4 bg-white rounded-lg border border-[#d1cdc0] shadow-sm overflow-hidden"
      >
        <div 
          className={`bg-[#f9f7f1] px-4 py-3 flex justify-between items-center cursor-pointer ${expanded ? 'border-b border-[#e8e4d5]' : ''}`}
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="text-[#b5a890]">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
            <span className="font-medium text-sm text-[#1a1a1a]">
              {isVeryShortEntry ? 'Feeling stuck? Ask our AI for a question' : 'Feeling stuck? Ask our AI for a question'}
            </span>
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">AI</span>
          </div>
          <div className="flex items-center gap-2">
            <svg 
              width="14" 
              height="14" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              className={`text-[#a39580] transition-transform ${expanded ? 'rotate-180' : ''}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>
        
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-3"
            >
              {isShuffling ? (
                <div className="space-y-2">
                  <div className="w-full text-left p-3 rounded-lg bg-white border border-[#e8e4d5] font-medium text-base overflow-hidden relative h-[100px]">
                    {/* Casino Slot Machine Effect */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="slot-machine-container relative h-[60px] overflow-hidden">
                        {/* Visual slot track with multiple questions */}
                        <motion.div
                          className="slot-track"
                          initial={{ y: 0 }}
                          animate={{ 
                            y: [0, -2000, -4000],
                            transition: { 
                              duration: 2,
                              ease: "easeInOut",
                              times: [0, 0.4, 1]
                            }
                          }}
                        >
                          {/* Generate many repeated questions for the scrolling effect */}
                          {[...Array(60)].map((_, i) => (
                            <div 
                              key={i} 
                              className="py-2 text-center border-b border-dashed border-[#e8e4d5] last:border-b-0"
                            >
                              {slotQuestionPool[i % slotQuestionPool.length]}
                            </div>
                          ))}
                        </motion.div>
                        
                        {/* Highlight for the "selected" slot item */}
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="h-full flex flex-col justify-center">
                            <div className="border-t-2 border-b-2 border-[#b5a890]/50 h-[60px] bg-[#f9f7f1]/30 backdrop-blur-[1px]"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center items-center gap-1 mt-1">
                    <div className="w-2 h-2 rounded-full bg-[#b5a890] animate-ping"></div>
                    <div className="w-2 h-2 rounded-full bg-[#b5a890] animate-ping" style={{ animationDelay: "0.3s" }}></div>
                    <div className="w-2 h-2 rounded-full bg-[#b5a890] animate-ping" style={{ animationDelay: "0.6s" }}></div>
                  </div>
                </div>
              ) : suggestion ? (
                <div className="space-y-2">
                  <div className="w-full text-left p-3 rounded-lg bg-white border border-[#e8e4d5] font-medium text-base">
                    {suggestion}
                  </div>
                  <div className="flex justify-end items-center gap-2 mt-2">
                    <button
                      onClick={handleShuffleQuestion}
                      className="text-xs flex items-center gap-1 text-[#b5a890] hover:text-[#a39580] py-1 px-2 rounded border border-[#e8e4d5] hover:border-[#d1cdc0] transition-colors"
                    >
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                      </svg>
                      Get another question
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-[#4a4a4a]">AI will analyze your journal to suggest thought-provoking questions</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default JournalEnhancer; 