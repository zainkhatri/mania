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
  const [isVisible, setIsVisible] = useState<boolean>(showInitially);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<boolean>(showInitially);
  const [isShuffling, setIsShuffling] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Use refs for tracking shuffle states to avoid dependency cycles
  const shuffleAttempts = useRef(0);
  const isGeneratingQuestion = useRef(false);
  const journalAnalysis = useRef<any>(null);

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

  // Generate personalized questions from journal content - core of the feature
  const generateDirectQuestions = useCallback((text: string): string[] => {
    const analysis = analyzeJournalContent(text);
    journalAnalysis.current = analysis;  // Store for reuse
    
    console.log("Journal analysis:", analysis);
    
    const questions: string[] = [];
    
    // Beach/La Jolla specific questions
    if (analysis.specificDetails.mentionedLaJolla) {
      // Friend-focused questions if friends mentioned
      if (analysis.hasFriends && analysis.people.length > 0) {
        const friendNames = analysis.people.join(' and ');
        // More natural-sounding questions with specific content
        if (analysis.people.length === 2) {
          questions.push(`What activities did you enjoy most with ${friendNames} during your visit to La Jolla Cove?`);
        } else if (analysis.people.length === 1) {
          questions.push(`What did you and ${friendNames} enjoy most about your time at La Jolla Cove?`);
        } else {
          questions.push(`What were the highlights of your beach day with your friends at La Jolla Cove?`);
        }
        
        questions.push(`How would you describe your friendship with ${friendNames}?`);
      }
      
      // Beach experience questions
      if (analysis.specificDetails.mentionedBeach) {
        questions.push("What was your favorite part of the beach experience at La Jolla Cove?");
        questions.push("What made the scenery at La Jolla Cove particularly beautiful to you?");
      }
      
      // General La Jolla questions
      questions.push("What made your time at La Jolla Cove so enjoyable?");
      questions.push("Would you recommend La Jolla Cove to others? What advice would you give them?");
    }
    
    // "Liked" specific questions if mentioned
    if (text.toLowerCase().includes('liked')) {
      questions.push("What specifically did you like most about this experience?");
    }
    
    // "Lounging" specific questions
    if (text.toLowerCase().includes('lounging')) {
      questions.push("How did lounging at the beach make you feel compared to your usual daily activities?");
    }
    
    // "Besties" specific questions
    if (text.toLowerCase().includes('besties')) {
      if (analysis.people.length > 0) {
        questions.push(`What makes ${analysis.people.join(' and ')} your 'besties'? How long have you known them?`);
      } else {
        questions.push("What makes these friends your 'besties'? Do you have any special memories with them?");
      }
    }
    
    // General fallback questions that still reference journal details
    if (analysis.keyWords.length > 0) {
      const keyword = analysis.keyWords[0];
      questions.push(`Can you share more about your experience with ${keyword}?`);
    }
    
    // If somehow no specific questions were generated
    if (questions.length === 0) {
      questions.push("What made this experience at La Jolla memorable enough for you to write about in your journal?");
    }
    
    // Shuffle and return questions
    return questions.sort(() => Math.random() - 0.5);
  }, [analyzeJournalContent]);

  // Check if a question is relevant to journal content
  const isRelevantQuestion = useCallback((question: string, journalText: string): boolean => {
    if (!journalAnalysis.current) {
      journalAnalysis.current = analyzeJournalContent(journalText);
    }
    
    const analysis = journalAnalysis.current;
    
    // Check if question includes key elements from analysis
    return (
      // People mentioned
      analysis.people.some((name: string) => question.toLowerCase().includes(name.toLowerCase())) ||
      // Locations mentioned
      analysis.locations.some((location: string) => question.toLowerCase().includes(location.toLowerCase())) ||
      // Key words from journal
      analysis.keyWords.some((word: string) => 
        question.toLowerCase().includes(word.toLowerCase()) && word.length > 3
      ) ||
      // Or the question contains very specific details from the journal
      (analysis.specificDetails.mentionedLaJolla && question.toLowerCase().includes('la jolla')) ||
      (analysis.specificDetails.mentionedBeach && question.toLowerCase().includes('beach')) ||
      (analysis.specificDetails.wasFun && 
       (question.toLowerCase().includes('enjoy') || question.toLowerCase().includes('fun')))
    );
  }, [analyzeJournalContent]);

  // Generate initial question
  useEffect(() => {
    const generateInitialQuestion = async () => {
      if (!journalText.trim()) return;
      
      setIsVisible(true);
      setIsLoading(true);
      console.log("Generating initial question for journal text:", journalText);
      
      try {
        // Generate direct questions first as a backup
        const directQuestions = generateDirectQuestions(journalText);
        console.log("Direct questions generated:", directQuestions);
        
        // Try using the AI service
        const aiQuestions = await generateJournalPrompts(journalText, location, minWordCount);
        console.log("AI service returned questions:", aiQuestions);
        
        if (aiQuestions && aiQuestions.length > 0 && isRelevantQuestion(aiQuestions[0], journalText)) {
          // Use AI question if it's relevant
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
      }
    };

    generateInitialQuestion();
  }, [journalText, location, minWordCount, generateDirectQuestions, isRelevantQuestion]);

  // Handle getting another question
  const handleGetAnotherQuestion = async () => {
    if (isGeneratingQuestion.current) return; // Prevent multiple calls
    
    isGeneratingQuestion.current = true;
    setIsShuffling(true);
    console.log("Getting another question...");
    
    try {
      shuffleAttempts.current += 1;
      
      // If we have multiple questions, just cycle through them first
      if (questions.length > 1 && shuffleAttempts.current <= questions.length) {
        const currentIndex = questions.indexOf(currentQuestion);
        const nextIndex = (currentIndex + 1) % questions.length;
        setCurrentQuestion(questions[nextIndex]);
        console.log("Cycling to existing question:", questions[nextIndex]);
      } else {
        // Try to generate a new question
        console.log("Attempting to generate a new question...");
        
        try {
          // Use a different seed each time
          const seed = Date.now();
          
          // If no analysis yet, create one
          if (!journalAnalysis.current) {
            journalAnalysis.current = analyzeJournalContent(journalText);
          }
          
          // Get key details to focus on
          const analysis = journalAnalysis.current;
          
          // Pick a focus element that's meaningful
          let focusElement = "";
          const focusOptions = [
            ...(analysis.people.length > 0 ? analysis.people : []),
            ...(analysis.locations.length > 0 ? analysis.locations : []),
            ...(analysis.activities.length > 0 ? analysis.activities : []),
            ...(analysis.keyWords.length > 0 ? analysis.keyWords.slice(0, 3) : [])
          ];
          
          if (focusOptions.length > 0) {
            focusElement = focusOptions[Math.floor(Math.random() * focusOptions.length)];
          }
          
          console.log("Using focus element:", focusElement);
          
          // Build enhanced prompt
          const focusedPrompt = focusElement 
            ? `${journalText} (Focus especially on "${focusElement}" in your question)`
            : journalText;
          
          // Try getting an AI-generated question
          const newQuestions = await generateJournalPrompts(
            focusedPrompt,
            location,
            minWordCount,
            seed
          );
          
          console.log("New questions generated:", newQuestions);
          
          if (newQuestions && newQuestions.length > 0) {
            // Check if it's unique and relevant
            const newQuestion = newQuestions[0];
            
            if (!questions.includes(newQuestion) && isRelevantQuestion(newQuestion, journalText)) {
              // Add to question list and display
              setQuestions(prevQuestions => [...prevQuestions, newQuestion]);
              setCurrentQuestion(newQuestion);
              console.log("Added new question:", newQuestion);
            } else {
              // Get a fresh direct question
              const directQuestions = generateDirectQuestions(journalText);
              
              // Find a direct question that isn't already in our list
              const newDirectQuestion = directQuestions.find(q => !questions.includes(q));
              
              if (newDirectQuestion) {
                setQuestions(prevQuestions => [...prevQuestions, newDirectQuestion]);
                setCurrentQuestion(newDirectQuestion);
                console.log("Added new direct question:", newDirectQuestion);
              } else {
                // Just cycle to the next question if we can't generate a unique one
                const currentIndex = questions.indexOf(currentQuestion);
                const nextIndex = (currentIndex + 1) % questions.length;
                setCurrentQuestion(questions[nextIndex]);
                console.log("Cycling to next question:", questions[nextIndex]);
              }
            }
          } else {
            throw new Error("No new questions generated");
          }
        } catch (error) {
          console.error("Error generating new question:", error);
          
          // Generate fresh direct questions
          const directQuestions = generateDirectQuestions(journalText);
          const newDirectQuestion = directQuestions.find(q => !questions.includes(q));
          
          if (newDirectQuestion) {
            setQuestions(prevQuestions => [...prevQuestions, newDirectQuestion]);
            setCurrentQuestion(newDirectQuestion);
            console.log("Added fallback direct question:", newDirectQuestion);
          } else {
            // Cycle questions if we can't generate a unique one
            const currentIndex = questions.indexOf(currentQuestion);
            const nextIndex = (currentIndex + 1) % questions.length;
            setCurrentQuestion(questions[nextIndex]);
            console.log("Cycling to next question after error:", questions[nextIndex]);
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
              Make this juicier... ☕️
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
              {isShuffling || isLoading ? (
                <div className="space-y-2">
                  <div className="w-full text-left p-3 rounded-lg bg-white border border-[#e8e4d5] font-medium text-base overflow-hidden relative h-[60px]">
                    <div className="flex justify-center items-center h-full">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#b5a890] animate-bounce"></div>
                        <div className="w-2 h-2 rounded-full bg-[#b5a890] animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                        <div className="w-2 h-2 rounded-full bg-[#b5a890] animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-full text-left p-3 rounded-lg bg-white border border-[#e8e4d5] font-medium text-base">
                    {currentQuestion}
                  </div>
                  <div className="flex justify-end items-center gap-2 mt-2">
                    <button
                      onClick={handleGetAnotherQuestion}
                      disabled={isShuffling || isGeneratingQuestion.current}
                      className={`text-xs flex items-center gap-1 ${isShuffling || isGeneratingQuestion.current ? 'text-gray-400 cursor-not-allowed' : 'text-[#b5a890] hover:text-[#a39580] cursor-pointer'} py-1.5 px-3 rounded border border-[#e8e4d5] hover:border-[#d1cdc0] transition-colors font-medium`}
                    >
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                      </svg>
                      Get another question
                    </button>
                  </div>
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