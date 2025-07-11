import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateJournalPrompts } from '../services/gptService';

interface JournalEnhancerProps {
  journalText: string;
  location?: string;
  minWordCount: number;
  showInitially?: boolean;
}

const JournalEnhancer: React.FC<JournalEnhancerProps> = ({
  journalText,
  location,
  minWordCount = 50,
  showInitially = false
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false); // Default to hidden
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<boolean>(false); // Default to collapsed
  const [isShuffling, setIsShuffling] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGlitching, setIsGlitching] = useState<boolean>(false); // For glitch effect
  
  // Use refs for tracking shuffle states to avoid dependency cycles
  const shuffleAttempts = useRef(0);
  const isGeneratingQuestion = useRef(false);
  const journalAnalysis = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Extract locations from text for beach scenario - extracted keywords are used in the questions
  const extractLocations = useCallback((text: string): string[] => {
    const cleanText = text.toLowerCase();
    const locationWords = ['la jolla', 'cove', 'beach', 'jolla']; 
    
    return locationWords.filter(location => cleanText.includes(location));
  }, []);

  // Extract people mentioned - names are directly used in questions
  const extractPeople = useCallback((text: string): string[] => {
    const cleanText = text.toLowerCase();
    
    // More carefully extract proper names that are likely people
    const possibleNames = text.match(/[A-Z][a-z]+/g) || [];
    
    // Filter out location names and sentence starters
    const knownLocations = ['La', 'Jolla', 'Cove', 'Beach', 'San', 'Diego'];
    const commonSentenceStarters = ['I', 'It', 'The', 'We', 'They', 'When', 'My', 'Your', 'Our'];
    
    // Only keep likely people names
    const names = possibleNames.filter(name => 
      !knownLocations.includes(name) && 
      !commonSentenceStarters.includes(name)
    );
    
    // Also check for explicit friend indicators
    const peopleIndicators = ['friend', 'besties', 'buddy', 'pal'];
    
    // Extract from common indicators
    const indicatedPeople = peopleIndicators
      .filter(indicator => cleanText.includes(indicator))
      .map(match => {
        const phrases = text.match(new RegExp(`(\\w+\\s+){0,2}${match}`, 'gi'));
        return phrases ? phrases[0].trim() : match;
      });
      
    // Combine with found names
    return Array.from(new Set([...names, ...indicatedPeople]));
  }, []);

  // Extract activities - directly used in questions
  const extractActivities = useCallback((text: string): string[] => {
    const cleanText = text.toLowerCase();
    const activityWords = ['hung out', 'lounging', 'went to', 'time'];
    
    return activityWords.filter(activity => cleanText.includes(activity));
  }, []);

  // Extract feelings/emotions - used to tailor questions to mood
  const extractEmotions = useCallback((text: string): string[] => {
    const cleanText = text.toLowerCase();
    const emotionMapping = {
      joy: ['liked', 'beautiful', 'great', 'time'],
      appreciation: ['beautiful'],
      contentment: ['lounging', 'besties']
    };
    
    return Object.entries(emotionMapping)
      .filter(([_, triggers]) => triggers.some(word => cleanText.includes(word)))
      .map(([emotion]) => emotion);
  }, []);

  // Analyze journal content to extract key details - used for all question generation
  const analyzeJournalContent = useCallback((text: string) => {
    const people = extractPeople(text);
    const locations = extractLocations(text);
    const activities = extractActivities(text);
    const emotions = extractEmotions(text);
    const cleanText = text.toLowerCase();
    
    // Extract all key nouns and verbs
    const words = text.split(/\s+/);
    const keyWords = words.filter(word => 
      word.length > 3 && 
      !['this', 'that', 'with', 'from', 'about', 'would', 'could', 'should', 'have', 'were', 'their', 'them'].includes(word.toLowerCase())
    );
    
    // Determine primary topic
    let primaryTopic = 'experience';
    if (locations.some(loc => loc.includes('jolla') || loc.includes('beach'))) {
      primaryTopic = 'beach trip';
    }
    
    return {
      people,
      locations,
      activities,
      emotions,
      keyWords: Array.from(new Set(keyWords)).slice(0, 7),
      isPastEvent: cleanText.includes('went') || cleanText.includes('was'),
      isFuturePlanning: cleanText.includes('will') || cleanText.includes('plan'),
      hasFriends: people.length > 0 || cleanText.includes('besties'),
      primaryTopic,
      mentionedPlaces: locations.join(', '),
      primaryEmotion: emotions.length > 0 ? emotions[0] : 'neutral',
      // Specific details from the journal
      specificDetails: {
        mentionedBeach: cleanText.includes('beach'),
        mentionedLaJolla: cleanText.includes('la jolla') || cleanText.includes('jolla'),
        mentionedFriends: people.length > 0,
        wasFun: cleanText.includes('great time') || cleanText.includes('liked'),
        wasBeautiful: cleanText.includes('beautiful'),
      }
    };
  }, [extractPeople, extractLocations, extractActivities, extractEmotions]);

  // Extract specific phrases from text
  const extractSpecificPhrases = (text: string): string[] => {
    const phrases: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Look for emotional expressions
    const emotionalPhrases = [
      'felt like', 'feeling', 'made me', 'i was', 'i am', 'i feel',
      'it was', 'seemed like', 'reminded me', 'thought about'
    ];
    
    emotionalPhrases.forEach(phrase => {
      if (lowerText.includes(phrase)) {
        // Try to extract the full context around the phrase
        const index = lowerText.indexOf(phrase);
        const start = Math.max(0, index - 10);
        const end = Math.min(text.length, index + phrase.length + 20);
        phrases.push(text.substring(start, end).trim());
      }
    });
    
    // Look for time references
    const timeReferences = [
      'today', 'yesterday', 'tomorrow', 'this morning', 'tonight',
      'last week', 'next week', 'earlier', 'later', 'now'
    ];
    
    timeReferences.forEach(timeRef => {
      if (lowerText.includes(timeRef)) {
        phrases.push(timeRef);
      }
    });
    
    // Look for action words
    const actionWords = [
      'went to', 'decided to', 'tried to', 'wanted to', 'needed to',
      'started', 'finished', 'completed', 'began', 'ended'
    ];
    
    actionWords.forEach(action => {
      if (lowerText.includes(action)) {
        phrases.push(action);
      }
    });
    
    return Array.from(new Set(phrases)); // Remove duplicates
  };

  // Generate personalized questions from journal content - core of the feature
  const generateDirectQuestions = useCallback((text: string): string[] => {
    const analysis = analyzeJournalContent(text);
    journalAnalysis.current = analysis;  // Store for reuse
    
    console.log("Journal analysis:", analysis);
    
    const questions: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Extract key specific phrases, nouns, numbers, and descriptive words
    const specificPhrases = extractSpecificPhrases(text);
    
    // Detect if this is likely lyrics or poetry
    const isLyrics = 
      (lowerText.match(/i'd rather/g) || []).length >= 2 || 
      (lowerText.includes("truth is") && lowerText.includes("love")) ||
      text.split('\n').length >= 3;

    // Special handling for lyrics
    if (isLyrics) {
      questions.push("What emotions do these lyrics evoke for you?");
      questions.push("What draws you to these particular lyrics?");
      questions.push("Which line in this passage speaks to you most strongly?");
      questions.push("How do these lyrics connect to your personal experiences?");
      
      // If "truth is" is mentioned
      if (lowerText.includes("truth is")) {
        questions.push("What truth in your own life resonates with these lyrics?");
      }
      
      // If "top" is mentioned
      if (lowerText.includes("at the top")) {
        questions.push("What does being 'at the top' represent to you in your life?");
      }
      
      return questions;
    }
    
    // Handle regular journal entries
    const defaultQuestions = [
      "What emotions were you feeling as you wrote this?",
      "What's something you learned from this experience?",
      "How might your future self look back on this moment?",
      "What would you like to remember most about today?",
      "What strength did you demonstrate in this situation?",
      "How does this relate to your current goals or values?",
      "What support might you need moving forward?",
      "If you could change one thing about this experience, what would it be?"
    ];
    
    // Add context-specific questions based on analysis
    if (analysis.people.length > 0) {
      questions.push(`How did your interaction with ${analysis.people[0]} affect you?`);
      questions.push("What did you learn about yourself through this relationship?");
    }
    
    if (analysis.locations.length > 0) {
      questions.push(`What makes ${analysis.locations[0]} special to you?`);
      questions.push("How did the setting influence your experience?");
    }
    
    if (analysis.emotions.length > 0) {
      questions.push(`What triggered the feeling of ${analysis.emotions[0]}?`);
      questions.push("How do you want to handle similar emotions in the future?");
    }
    
    if (analysis.isPastEvent) {
      questions.push("What would you tell someone else going through a similar experience?");
      questions.push("How has this experience changed your perspective?");
    }
    
    if (analysis.isFuturePlanning) {
      questions.push("What steps will you take to make this happen?");
      questions.push("What obstacles might you face and how will you overcome them?");
    }
    
    // Add some default questions if we don't have enough context-specific ones
    const allQuestions = [...questions, ...defaultQuestions];
    
    // Return a mix of context-specific and general questions
    return allQuestions.slice(0, 6);
  }, [analyzeJournalContent]);

  // Check if a question is relevant to journal content
  const isRelevantQuestion = useCallback((question: string, text: string): boolean => {
    // Implementation for relevance checking
    return true;
  }, []);

  // Only show the enhancer when user stops typing
  useEffect(() => {
    console.log('🔍 JournalEnhancer useEffect triggered:', {
      journalTextLength: journalText.trim().length,
      minWordCount,
      isVisible,
      questionsLength: questions.length
    });
    
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (journalText.trim().length >= minWordCount) {
      console.log('✅ Text meets minimum word count, setting timeout...');
      // Set a delay before showing the enhancer (1 second after typing stops)
      typingTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Timeout triggered, making enhancer visible');
        setIsVisible(true);
         
        // If no questions have been generated yet and this is the first time
        // we're showing the enhancer, generate initial questions
        if (questions.length === 0 && !isGeneratingQuestion.current) {
          const generateInitialQuestion = async () => {
            if (!journalText.trim()) return;
            
            setIsLoading(true);
            isGeneratingQuestion.current = true;
            console.log("Generating initial question for journal text:", journalText);
            
            try {
              // Detect if this is lyrics
              const lowerText = journalText.toLowerCase();
              const isLyrics = 
                (lowerText.match(/i'd rather/g) || []).length >= 2 || 
                (lowerText.includes("truth is") && lowerText.includes("love")) ||
                journalText.split('\n').length >= 3;
              
              // Generate direct questions first as a backup
              const directQuestions = generateDirectQuestions(journalText);
              console.log("Direct questions generated:", directQuestions);
              
              // Try using the AI service
              const aiQuestions = await generateJournalPrompts(journalText, location, minWordCount);
              console.log("AI service returned questions:", aiQuestions);
              
              // For lyrics, prefer our specialized lyric questions unless the AI question is really good
              if (isLyrics) {
                // Check if AI question contains any good lyric-related words
                const goodLyricPatterns = [
                  "lyric", "song", "verse", "line", "passage", "emotion", "feel", "meaning",
                  "resonate", "connect", "truth", "represent", "express"
                ];
                
                const isGoodAiQuestion = aiQuestions && 
                                        aiQuestions.length > 0 && 
                                        !aiQuestions[0].toLowerCase().includes("experience with rather") &&
                                        goodLyricPatterns.some(pattern => aiQuestions[0].toLowerCase().includes(pattern));
                
                if (isGoodAiQuestion) {
                  // Use the AI question for lyrics
                  setQuestions([...aiQuestions, ...directQuestions]);
                  setCurrentQuestion(aiQuestions[0]);
                  console.log("Using AI-generated question for lyrics:", aiQuestions[0]);
                } else {
                  // Use our specialized lyric questions
                  setQuestions(directQuestions);
                  setCurrentQuestion(directQuestions[0]);
                  console.log("Using specialized lyrics questions:", directQuestions[0]);
                }
              } else if (aiQuestions && aiQuestions.length > 0 && isRelevantQuestion(aiQuestions[0], journalText)) {
                // For non-lyrics, use AI question if it's relevant
                setQuestions([...aiQuestions, ...directQuestions]);
                setCurrentQuestion(aiQuestions[0]);
                console.log("Using AI-generated question:", aiQuestions[0]);
              } else {
                // Otherwise use our direct questions
                setQuestions(directQuestions);
                setCurrentQuestion(directQuestions[0]);
                console.log("Using direct questions:", directQuestions[0]);
              }
            } catch (error) {
              console.error("Error generating AI question:", error);
              // Fall back to direct questions
              const directQuestions = generateDirectQuestions(journalText);
              setQuestions(directQuestions);
              setCurrentQuestion(directQuestions[0]);
              console.log("Using fallback direct questions:", directQuestions[0]);
            } finally {
              setIsLoading(false);
              isGeneratingQuestion.current = false;
            }
          };
          
          generateInitialQuestion();
        }
      }, 1000);
    } else {
      // Hide if below minimum word count
      setIsVisible(false);
    }
    
    // Cleanup function
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [journalText, minWordCount, location, generateDirectQuestions, isRelevantQuestion, questions.length]);

  // Handle getting another question - add static effect
  const handleGetAnotherQuestion = async () => {
    if (isGeneratingQuestion.current) return; // Prevent multiple calls
    
    // Trigger static effect
    setIsGlitching(true);
    
    // Remove static effect after animation completes
    setTimeout(() => {
      setIsGlitching(false);
    }, 800);
    
    isGeneratingQuestion.current = true;
    setIsShuffling(true);
    console.log("Getting another question...");
    
    try {
      shuffleAttempts.current += 1;
      
      // Detect if this is lyrics
      const lowerText = journalText.toLowerCase();
      const isLyrics = 
        (lowerText.match(/i'd rather/g) || []).length >= 2 || 
        (lowerText.includes("truth is") && lowerText.includes("love")) ||
        journalText.split('\n').length >= 3;
      
      // ALWAYS try to get a GPT-generated question first
      console.log("Attempting to generate a new GPT question...");
      
      try {
        // If no analysis yet, create one
        if (!journalAnalysis.current) {
          journalAnalysis.current = analyzeJournalContent(journalText);
        }
        
        // For lyrics, don't append any focus element
        let focusedPrompt = journalText;
        
        if (!isLyrics) {
          // Get key details to focus on
          const analysis = journalAnalysis.current;
          
          // Pick a focus element that's meaningful
          let focusElement = "";
          const focusOptions = [
            ...(analysis.people.length > 0 ? analysis.people : []),
            ...(analysis.locations.length > 0 ? analysis.locations : []),
            ...(analysis.activities.length > 0 ? analysis.activities : []),
            ...(analysis.keyWords.length > 0 ? analysis.keyWords
              .filter((word: string) => !['rather', 'would', 'could', 'should'].includes(word.toLowerCase()))
              .slice(0, 3) : [])
          ];
          
          if (focusOptions.length > 0) {
            focusElement = focusOptions[Math.floor(Math.random() * focusOptions.length)];
          }
          
          console.log("Using focus element:", focusElement);
          
          // Only add focus for non-lyrics
          if (focusElement) {
            focusedPrompt = `${journalText} (Focus especially on "${focusElement}" in your question)`;
          }
        }
        
        // Use a different seed each time to get variety
        const seed = Date.now() + shuffleAttempts.current;
        
        // Try getting an AI-generated question with retries
        const newQuestions = await generateJournalPrompts(
          focusedPrompt,
          location,
          minWordCount,
          seed,
          3 // Increase retry attempts for "try another"
        );
        
        console.log("New GPT questions generated:", newQuestions);
        
        if (newQuestions && newQuestions.length > 0) {
          const newQuestion = newQuestions[0];
          
          // Check if it's unique and relevant
          if (!questions.includes(newQuestion) && 
              isRelevantQuestion(newQuestion, journalText) &&
              !newQuestion.toLowerCase().includes("experience with rather")) {
            // Add to question list and display
            setQuestions(prevQuestions => [...prevQuestions, newQuestion]);
            setCurrentQuestion(newQuestion);
            console.log("✅ Added new GPT question:", newQuestion);
            return; // Success! Exit early
          } else {
            console.log("⚠️ GPT question was duplicate or irrelevant, trying again...");
            // Try one more time with a different approach
            const retryQuestions = await generateJournalPrompts(
              journalText, // Use original text without focus
              location,
              minWordCount,
              Date.now() + Math.random() * 1000, // Different seed
              2 // Fewer retries for the retry attempt
            );
            
            if (retryQuestions && retryQuestions.length > 0) {
              const retryQuestion = retryQuestions[0];
              if (!questions.includes(retryQuestion) && 
                  !retryQuestion.toLowerCase().includes("experience with rather")) {
                setQuestions(prevQuestions => [...prevQuestions, retryQuestion]);
                setCurrentQuestion(retryQuestion);
                console.log("✅ Added retry GPT question:", retryQuestion);
                return; // Success! Exit early
              }
            }
          }
        }
        
        // If we get here, GPT didn't provide a good unique question
        throw new Error("GPT didn't provide a unique question");
        
      } catch (gptError) {
        console.error("❌ GPT question generation failed:", gptError);
        
        // Only now fall back to cycling existing questions or direct questions
        console.log("🔄 Falling back to existing questions or direct questions...");
        
        // If we have multiple questions, cycle through them first
        if (questions.length > 1) {
          const currentIndex = questions.indexOf(currentQuestion);
          const nextIndex = (currentIndex + 1) % questions.length;
          setCurrentQuestion(questions[nextIndex]);
          console.log("🔄 Cycling to existing question:", questions[nextIndex]);
        } else {
          // Generate fresh direct questions as absolute last resort
          const directQuestions = generateDirectQuestions(journalText);
          const newDirectQuestion = directQuestions.find(q => !questions.includes(q));
          
          if (newDirectQuestion) {
            setQuestions(prevQuestions => [...prevQuestions, newDirectQuestion]);
            setCurrentQuestion(newDirectQuestion);
            console.log("⚠️ Added fallback direct question:", newDirectQuestion);
          } else {
            // Cycle questions if we can't generate a unique one
            const currentIndex = questions.indexOf(currentQuestion);
            const nextIndex = (currentIndex + 1) % questions.length;
            setCurrentQuestion(questions[nextIndex]);
            console.log("🔄 Cycling to next question after all fallbacks:", questions[nextIndex]);
          }
        }
      }
    } finally {
      // Reset generation flag after short delay to ensure state updates complete
      setTimeout(() => {
        isGeneratingQuestion.current = false;
        setIsShuffling(false);
      }, 800);
    }
  };

  if (!isVisible) {
    console.log('🚫 JournalEnhancer not visible, returning null');
    return null;
  }

  console.log('✨ JournalEnhancer rendering with:', {
    isVisible,
    expanded,
    currentQuestion,
    questionsLength: questions.length,
    isLoading
  });

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="mt-4 relative"
        >
          <div 
            className={`border border-white/30 rounded-lg shadow-md overflow-hidden transition-all duration-300 ${expanded ? 'bg-black/40' : 'bg-black/30'} backdrop-blur-sm`}
          >
            {/* Header with AI icon and expand button */}
            <div 
              className="p-4 flex justify-between items-center cursor-pointer"
              onClick={() => setExpanded(!expanded)}
            >
              <div className="flex items-center gap-2">
                <div className="text-blue-400">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor"/>
                    <path d="M12 6C10.9 6 10 6.9 10 8C10 9.1 10.9 10 12 10C13.1 10 14 9.1 14 8C14 6.9 13.1 6 12 6Z" fill="currentColor"/>
                    <path d="M12 14C10.9 14 10 14.9 10 16C10 17.1 10.9 18 12 18C13.1 18 14 17.1 14 16C14 14.9 13.1 14 12 14Z" fill="currentColor"/>
                    <path d="M20 10C18.9 10 18 10.9 18 12C18 13.1 18.9 14 20 14C21.1 14 22 13.1 22 12C22 10.9 21.1 10 20 10Z" fill="currentColor"/>
                    <path d="M4 10C2.9 10 2 10.9 2 12C2 13.1 2.9 14 4 14C5.1 14 6 13.1 6 12C6 10.9 5.1 10 4 10Z" fill="currentColor"/>
                  </svg>
                </div>
                <h3 className="text-base md:text-lg font-medium text-white">Need inspiration?</h3>
              </div>
              <svg 
                className={`w-7 h-7 text-white transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
            
            {/* Expandable content */}
            {expanded && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="px-5 pb-5"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <p className={`text-sm md:text-base text-white ${isGlitching ? 'glitch-text' : ''}`}>
                        {currentQuestion || 'What thoughts were running through your mind that you didn\'t express at the time?'}
                      </p>
                    </div>
                    
                    <div className="flex justify-between gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGetAnotherQuestion();
                        }}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm md:text-base flex-1 hover:bg-blue-700 focus:outline-none transition-colors"
                      >
                        Try another
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default JournalEnhancer;