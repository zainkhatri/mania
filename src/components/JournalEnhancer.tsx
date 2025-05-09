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
    
    // Extract specific details to use in questions
    const specificDetails = {
      coffeeDetails: text.match(/(\w+) through my (\w+) cup of coffee/i),
      timeOfDay: text.match(/(morning|afternoon|evening|night)/i),
      locations: text.match(/at (the|my) ([a-zA-Z\s]+)/g),
      emotionalStates: text.match(/(frozen|shocked|surprised|happy|excited|worried|anxious|upset|scared|intense)/gi),
      tvEvents: text.match(/(TV|news|tower|burning|hit)/gi),
      thoughts: text.match(/"([^"]+)"/g), // Captures quoted thoughts
      actions: text.match(/I (was|am|had|have|did|went|saw|felt|thought)([^,.;:!?]+)/gi),
      sportDetails: {
        teams: text.match(/(against|versus|vs\.?) ([A-Z][a-z]+)/i),
        players: text.match(/([A-Z][a-z]+ [A-Z][a-z]+)/g), // Potential player names (capitalized first & last)
        score: text.match(/(score|goal|point|lead)s?/gi),
        specific_actions: text.match(/(spashed|kicked|shot|blocked|passed|threw|dunked|scored|missed|tackled|fouled)/i)
      }
    };
    
    // Extract potential names of people (capitalized words that aren't at the start of sentences)
    const potentialNames = text.match(/\s([A-Z][a-z]{2,})/g) || [];
    const cleanedNames = potentialNames.map(name => name.trim());
    
    // ---- GENERATE HYPER-SPECIFIC QUESTIONS ----
    
    // Sports game related questions
    if (lowerText.includes("game against") || lowerText.includes("match against") || 
        lowerText.includes("played against") || lowerText.includes("score")) {
      
      // Extract team name if present
      const teamMatch = specificDetails.sportDetails.teams;
      const opponentTeam = teamMatch ? teamMatch[2] : null;
      
      // Extract player names if present
      const playerMatches = specificDetails.sportDetails.players;
      const playerName = playerMatches && playerMatches.length > 0 ? 
        playerMatches[0] : (cleanedNames.length > 0 ? cleanedNames[0] : null);
      
      // Action-specific questions (using exact verbs from entry)
      if (specificDetails.sportDetails.specific_actions) {
        const action = specificDetails.sportDetails.specific_actions[0].toLowerCase();
        
        if (action === "spashed") {
          questions.push(`When you say you \"spashed it on his face,\" what was going through your mind in that moment?`);
          questions.push(`What was the reaction from your teammates when you made that move in the final minutes?`);
        } else {
          questions.push(`How did it feel when you ${action} in those crucial final minutes?`);
          questions.push(`What was running through your mind right before you ${action}?`);
        }
      }
      
      // Team-specific questions
      if (opponentTeam) {
        questions.push(`What was your strategy going into the game against ${opponentTeam}?`);
        questions.push(`What impressed you most about how ${opponentTeam} played?`);
        questions.push(`How did your preparation for facing ${opponentTeam} differ from other opponents?`);
      }
      
      // Player-specific questions
      if (playerName) {
        // Check if this might be referring to Wembanyama (or similar basketball player)
        if (playerName.includes("Victor") || playerName.includes("Wembanyama")) {
          questions.push(`What was most intimidating about facing ${playerName} on the court?`);
          questions.push(`Did you have a specific plan for dealing with ${playerName}'s height advantage?`);
          questions.push(`What surprised you most about ${playerName}'s playing style in person?`);
        } else {
          questions.push(`What aspects of ${playerName}'s game presented the biggest challenge for you?`);
          questions.push(`Was there a moment when you felt you had figured out how to counter ${playerName}?`);
        }
      }
      
      // Score/intensity questions
      if (lowerText.includes("score tightening") || lowerText.includes("close game") || 
          lowerText.includes("intense") || lowerText.includes("tight")) {
        questions.push("How do you typically handle the pressure when the score gets tight in the final minutes?");
        questions.push("Did the intensity of this particular game differ from others you've played? How so?");
      }
      
      // Final minutes drama
      if (lowerText.includes("final minute") || lowerText.includes("last minute") || 
          lowerText.includes("final moments") || lowerText.includes("final seconds")) {
        questions.push("What emotions were cycling through you during those final tense minutes of the game?");
        questions.push("How does your mindset change when you know you're in the closing minutes of a tight game?");
      }
      
      // Add a few more personable game-related questions
      questions.push("What was going through your mind when you realized you needed to make a decisive move?");
      questions.push("How did the crowd's energy affect your performance in this game?");
    }
    
    // Questions about witnessing news events with specific details
    if (lowerText.includes("news") || (lowerText.includes("tv") && lowerText.includes("tower"))) {
      if (specificDetails.tvEvents && specificDetails.tvEvents.length > 1) {
        // Create question with specific tower/burning references
        if (lowerText.includes("tower") && lowerText.includes("burning")) {
          questions.push("As you watched the tower burning on TV, what specific image from the footage has stayed with you most vividly?");
        }
        
        // Create question referencing the second hit if mentioned
        if (lowerText.includes("second hit")) {
          questions.push("When you witnessed the second hit on TV, how did your understanding of what was happening change in that moment?");
        }
        
        // Create question about the "didn't feel real" aspect if mentioned
        if (lowerText.includes("didn't feel real") || lowerText.includes("feel real")) {
          questions.push("You mentioned it 'didn't feel real' as you watched the news - at what point did the reality of the situation finally sink in for you?");
        }
        
        // Reference specific emotional state if mentioned
        if (specificDetails.emotionalStates && specificDetails.emotionalStates.length > 0) {
          const emotion = specificDetails.emotionalStates[0].toLowerCase();
          questions.push(`You described feeling ${emotion} watching the events unfold - how did this emotional response evolve over the hours and days that followed?`);
        }
      }
    }
    
    // Coffee-related questions with specific details
    if (lowerText.includes("coffee")) {
      if (specificDetails.coffeeDetails && specificDetails.coffeeDetails.length > 2) {
        const coffeeProgress = specificDetails.coffeeDetails[1]; // "halfway" or similar
        const cupNumber = specificDetails.coffeeDetails[2]; // "second" or similar
        questions.push(`You were ${coffeeProgress} through your ${cupNumber} cup of coffee when the news broke - how did this everyday moment contrast with the extraordinary events unfolding?`);
        questions.push(`How was the rest of your morning coffee routine disrupted by what you saw on TV?`);
      } else {
        questions.push("How did the interruption of your coffee ritual affect your processing of the news?");
      }
    }
    
    // Questions referencing specific thoughts
    if (specificDetails.thoughts && specificDetails.thoughts.length > 0) {
      // Clean up the thought by removing quotes
      const thought = specificDetails.thoughts[0].replace(/"/g, '');
      questions.push(`You recall thinking "${thought}" - what other thoughts were competing for attention in your mind at that moment?`);
    }
    
    // Specific emotional response questions
    if (lowerText.includes("frozen")) {
      questions.push("You mentioned sitting there 'frozen' - what physical sensations do you remember experiencing in that moment of shock?");
    }
    
    if (lowerText.includes("chaos")) {
      questions.push("How did the 'chaos' you witnessed on TV compare to the environment around you as you watched?");
    }
    
    // Morning-focused questions with specific details
    if (lowerText.includes("morning")) {
      questions.push("How did the rest of that morning unfold for you after the news broke?");
      questions.push("Did your perception of ordinary morning routines change after this experience?");
    }
    
    // If we have specific actions mentioned, create questions about them
    const actionMatch = text.match(/I ([a-z]+ed) ([^,.;!?]+)/i);
    if (actionMatch && actionMatch.length >= 3) {
      const verb = actionMatch[1];
      const object = actionMatch[2];
      questions.push(`What led to the moment when you ${verb} ${object}?`);
      questions.push(`How did you feel immediately after you ${verb} ${object}?`);
    }
    
    // If we don't have enough questions yet, add some general but still context-aware ones
    if (questions.length < 3) {
      if (lowerText.includes("tv") || lowerText.includes("news")) {
        questions.push("After the initial shock subsided, what actions did you take in response to what you'd seen?");
        questions.push("How did conversations with others help you process what you witnessed on TV?");
      }
      
      if (lowerText.includes("didn't feel real") || lowerText.includes("frozen") || lowerText.includes("happening here")) {
        questions.push("What strategies helped you cope with the surreal nature of what you were witnessing?");
      }
    }
    
    // Ensure we have at least a few questions
    if (questions.length === 0) {
      questions.push("What details of this experience stand out most vividly in your memory?");
      questions.push("How did this moment change your perspective on everyday life?");
      questions.push("What thoughts were running through your mind that you didn't express at the time?");
    }
    
    // Shuffle and return questions
    return questions.sort(() => Math.random() - 0.5);
  }, [analyzeJournalContent]);

  // Helper function to extract specific phrases for more personalized questions
  const extractSpecificPhrases = (text: string): string[] => {
    const phrases: string[] = [];
    
    // Extract noun phrases (adjective + noun combinations)
    const nounPhraseMatches = text.match(/(\w+\s+\w+)/g) || [];
    
    // Filter to only meaningful phrases (at least 5 characters)
    const meaningfulPhrases = nounPhraseMatches.filter(phrase => 
      phrase.length > 5 && 
      !['the a', 'a the', 'of the', 'in the', 'on the', 'to the'].includes(phrase.toLowerCase())
    );
    
    // Add specific numbers and measurements
    const numberMatches = text.match(/(\d+\s+\w+)/g) || [];
    
    return [...meaningfulPhrases, ...numberMatches];
  };

  // Check if a question is relevant to journal content
  const isRelevantQuestion = useCallback((question: string, journalText: string): boolean => {
    // Reject questions that ask about "experience with X" where X is a single word
    // This pattern is usually a sign of poor comprehension
    if (/experience with \w+\??$/.test(question.toLowerCase())) {
      console.log("Rejecting question with 'experience with' pattern:", question);
      return false;
    }
    
    // Detect if this is likely lyrics
    const lowerText = journalText.toLowerCase();
    const isLyrics = 
      (lowerText.match(/i'd rather/g) || []).length >= 2 || 
      (lowerText.includes("truth is") && lowerText.includes("love")) ||
      journalText.split('\n').length >= 3;
    
    // For lyrics, any question about lyrics, emotions, or meaning is good
    if (isLyrics) {
      const goodLyricQuestionPatterns = [
        "lyric", "song", "verse", "line", "passage", "emotion", "feel", "meaning",
        "resonate", "connect", "truth", "represent", "express"
      ];
      
      return goodLyricQuestionPatterns.some(pattern => 
        question.toLowerCase().includes(pattern)
      );
    }
    
    // If not lyrics, use the original analysis-based approach
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
      
      // Detect if this is lyrics
      const lowerText = journalText.toLowerCase();
      const isLyrics = 
        (lowerText.match(/i'd rather/g) || []).length >= 2 || 
        (lowerText.includes("truth is") && lowerText.includes("love")) ||
        journalText.split('\n').length >= 3;
      
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
            
            if (!questions.includes(newQuestion) && 
                isRelevantQuestion(newQuestion, journalText) &&
                !newQuestion.toLowerCase().includes("experience with rather")) {
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