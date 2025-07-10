/**
 * Utility functions for generating personalized journal questions
 */

/**
 * Analyzes a journal entry and returns a targeted, personalized question
 * based on the specific content mentioned
 */
export const getPersonalizedQuestion = (
  text: string, 
  previousQuestion: string = '', 
  attemptCount: number = 0
): string => {
  // Convert to lowercase for easier matching
  const textLower = text.toLowerCase();
  
  // Create an array of all possible questions we could return
  const possibleQuestions = [];
  
  // Check for waking up late (3PM)
  if (textLower.includes('woke up at 3') || textLower.includes('woke up late')) {
    possibleQuestions.push("Why did you really sleep in until 3PM - late night or avoiding something?");
    possibleQuestions.push("What kept you up the night before that made you sleep in so late?");
  }
  
  // Check for Geisel library references
  if (textLower.includes('geisel')) {
    possibleQuestions.push("What made you choose Geisel instead of studying somewhere else?");
    possibleQuestions.push("Who were you hoping to run into at Geisel?");
  }
  
  // Check for job application mentions
  if (textLower.includes('applied to a job') || textLower.includes('job application')) {
    possibleQuestions.push("What's the job you applied for, and are you actually excited about it?");
    possibleQuestions.push("What would be your real reason for taking this job if offered?");
  }
  
  // Check for Bronny's senate mentions
  if (textLower.includes('senate')) {
    possibleQuestions.push("What actually happens at Bronny's senate that made you want to go?");
    possibleQuestions.push("Is there someone specific at the senate meetings you're interested in?");
  }
  
  // Check for mentions of specific friends (Fiza, Bronny)
  if (textLower.includes('fiza') && textLower.includes('bronny')) {
    possibleQuestions.push("Is there any tension between Fiza and Bronny that you noticed?");
    possibleQuestions.push("Do you feel caught in the middle between Fiza and Bronny sometimes?");
  } else if (textLower.includes('fiza')) {
    possibleQuestions.push("What's your real relationship with Fiza?");
    possibleQuestions.push("Has something changed recently between you and Fiza?");
  } else if (textLower.includes('bronny')) {
    possibleQuestions.push("How do you really feel about hanging out with Bronny so much?");
    possibleQuestions.push("Is there something about Bronny that frustrates you but you don't mention?");
  }
  
  // Check for "chill" or "chilled" mentions
  if (textLower.includes('chill')) {
    possibleQuestions.push("What were you really doing when you say you were 'chilling'?");
    possibleQuestions.push("Was your 'chill' time actually relaxing, or were you avoiding something?");
  }
  
  // Check for food mentions
  if (textLower.includes('food') || textLower.includes('eat') || textLower.includes('dinner') || textLower.includes('lunch')) {
    possibleQuestions.push("Who picked where to eat, and was there any drama about it?");
    possibleQuestions.push("Did the conversation over food get awkward at any point?");
  }
  
  // Check for specific locations like 2W
  if (textLower.includes('2w')) {
    possibleQuestions.push("Why specifically 2W? Is there someone you were hoping to run into there?");
    possibleQuestions.push("What's the real reason you chose to go to 2W?");
  }
  
  // If we have multiple questions available, choose one based on attemptCount or make sure it's different from previous
  if (possibleQuestions.length > 0) {
    // If we have a previous question and multiple options, ensure we don't return the same one
    if (previousQuestion && possibleQuestions.length > 1) {
      const filteredQuestions = possibleQuestions.filter(q => q !== previousQuestion);
      // Use the attemptCount to get a different question each time
      return filteredQuestions[attemptCount % filteredQuestions.length];
    }
    
    // Otherwise return based on the attemptCount
    return possibleQuestions[attemptCount % possibleQuestions.length];
  }
  
  // Default fallback questions if nothing specific was matched
  const defaultQuestions = [
    "What's the part of your day you're deliberately not mentioning?",
    "Who were you really thinking about during all this?",
    "What's the thing about today you wouldn't tell just anyone?",
    "Did something happen that made you uncomfortable?",
    "What's the real story behind what you just wrote?",
    "Is there someone involved you're purposely not mentioning?",
    "What would your friends say if they knew the whole truth about this?"
  ];
  
  // Make sure we don't return the same default question
  if (previousQuestion && defaultQuestions.includes(previousQuestion)) {
    const filteredDefaults = defaultQuestions.filter(q => q !== previousQuestion);
    return filteredDefaults[attemptCount % filteredDefaults.length];
  }
  
  return defaultQuestions[attemptCount % defaultQuestions.length];
}; 