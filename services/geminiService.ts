
import { GoogleGenAI } from "@google/genai";
import { GameState } from "../types";

/**
 * Service to interact with the Gemini API for tactical survival advice.
 * Uses the @google/genai SDK following strict guidelines.
 */

// Initialize the GoogleGenAI with the API key from environment variables.
// Always use a named parameter for the API key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getSurvivalAdvice = async (gameState: GameState): Promise<string> => {
  try {
    // For basic text tasks like providing survival tips, 'gemini-3-flash-preview' is the optimal choice.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `The player is currently in a survival situation in a game called "Wild Lands".
        Current stats:
        - Health: ${Math.round(gameState.stats.health)}%
        - Hunger: ${Math.round(gameState.stats.hunger)}%
        - Thirst: ${Math.round(gameState.stats.thirst)}%
        - Energy: ${Math.round(gameState.stats.energy)}%
        - Temperature: ${Math.round(gameState.stats.temperature)}°C
        - Time: ${Math.floor(gameState.time / 100)}:00 (${gameState.time > 1900 || gameState.time < 500 ? 'Night' : 'Day'})
        - Weather: ${gameState.weather}
        - Inventory: ${gameState.inventory.length > 0 ? gameState.inventory.map(i => `${i.count}x ${i.name}`).join(', ') : 'Empty'}
        
        Provide ONE short sentence of urgent, helpful tactical advice in ${gameState.settings.language === 'tr' ? 'Turkish' : 'English'}.
        Make it sound like a seasoned survivalist mentor.`,
      config: {
        systemInstruction: "You are an expert survival advisor. You provide extremely concise, actionable, and immersive advice based on the player's immediate needs and the environmental conditions.",
        temperature: 0.8,
      },
    });

    // Directly access the .text property (property access, not a function call).
    return response.text || "Focus on staying alive.";
  } catch (error) {
    console.error("Gemini survival advice fetch failed:", error);
    // Graceful fallback for API errors.
    return gameState.settings.language === 'tr' ? "Hayatta kalmaya odaklan." : "Stay focused on survival.";
  }
};
