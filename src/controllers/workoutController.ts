import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

// Define the interface for available days
interface AvailableDay {
  day: string;
  hours: number;
  timeOfDay: string[];
}

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');


// Set a timeout for the API request
const API_TIMEOUT = 50000; // 50 seconds

// Helper function to create a timeout promise
const createTimeout = (ms: number) => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
  });
};

export const generateWorkout = async (req: Request, res: Response) => {
  try {
    const { name, age, position, level, improvement, availableDays } = req.body;

    if (!name || !age || !position || !level || !improvement || !availableDays || availableDays.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: `You are a professional basketball trainer specializing in creating personalized workout plans. 
      Create a detailed basketball workout plan based on the user's profile information.`
    });

    const prompt = `
      Create a detailed basketball workout plan for a player with the following profile:
      
      Name: ${name}
      Age: ${age}
      Position: ${position}
      Level: ${level}
      Areas for improvement: ${improvement}
      
      Available days for training:
      ${availableDays.map((day: AvailableDay) => `- ${day.day.charAt(0).toUpperCase() + day.day.slice(1)}: ${day.hours} hours, Time: ${day.timeOfDay.join(', ')}`).join('\n')}
      
      For each day, create specific exercises with durations and descriptions. Describe the exercises in detail, including the equipment needed, the specific movements, and the target muscle groups.
      Specify each workout separately with amount of repetitions and sets.
      Return your response as a properly formatted JSON object with the following structure:
      {
        "name": "${name}",
        "age": "${age}",
        "position": "${position}",
        "level": "${level}",
        "focusAreas": "Brief summary of focus areas based on their improvement needs",
        "workoutSchedule": [
          {
            "day": "day name",
            "hours": number of hours,
            "timeOfDay": ["Morning", "Afternoon", "Evening"],
            "exercises": [
              {
                "name": "Exercise Name",
                "duration": "Duration in minutes",
                "description": "Detailed description of the exercise"
              }
              // more exercises...
            ]
          }
          // more days...
        ]
      }
      
      IMPORTANT: Ensure the response is a valid JSON object. Use standard JSON format without any markdown or code blocks.
      Make the exercises specific to basketball skills and appropriate for their position, level, and improvement areas.
      Keep the response concise and optimized for performance.
    `;

    try {
      // Race between the API call and a timeout
      const result = await Promise.race([
        model.generateContent(prompt),
        createTimeout(API_TIMEOUT)
      ]) as Awaited<ReturnType<typeof model.generateContent>>;

      // If we get here, the API call completed before the timeout
      const response = await result.response;
      const text = response.text();
      
      try {
        // Try to extract JSON from potential code blocks
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, text];
        const jsonText = jsonMatch[1];
        
        let jsonResponse;
        try {
          jsonResponse = JSON.parse(jsonText);
        } catch (innerParseError) {
          // If direct parsing fails, try to sanitize the text
          const cleanedText = jsonText.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
          jsonResponse = JSON.parse(cleanedText);
        }
        
        return res.json(jsonResponse);
      } catch (parseError) {
        console.error('Error parsing Gemini response as JSON:', parseError);
        console.log('Raw response:', text);
        
        // Try one more approach - find anything that looks like a JSON object
        try {
          const jsonObjectMatch = text.match(/{[\s\S]*}/);
          if (jsonObjectMatch) {
            const jsonObject = JSON.parse(jsonObjectMatch[0]);
            return res.json(jsonObject);
          }
        } catch (lastAttemptError) {
          console.error('Final parsing attempt failed:', lastAttemptError);
        }
        
        return res.status(500).json({
          error: 'Failed to generate a valid workout plan',
          details: 'The AI generated an invalid response format'
        });
      }
    } catch (timeoutError) {
      console.error('API request timed out:', timeoutError);
      return res.status(504).json({
        error: 'Request timed out',
        details: 'The workout plan generation is taking too long. Please try again.'
      });
    }
  } catch (error) {
    console.error('Error in generate-workout API:', error);
    
    return res.status(500).json({
      error: 'Failed to generate workout plan',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 