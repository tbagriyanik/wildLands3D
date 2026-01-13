
import { GoogleGenAI } from "@google/genai";
import { GameState } from "../types";

/**
 * Service to interact with the Gemini API for tactical survival advice.
 * API key is handled via process.env.API_KEY as per security guidelines.
 */

// Initializing the AI client. process.env.API_KEY is pre-configured.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getSurvivalAdvice = async (gameState: GameState): Promise<string> => {
  try {
    // Creating a fresh instance for the call to ensure context is correct
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
        systemInstruction: "You are an expert survival advisor named 'Elder'. You provide extremely concise, actionable, and immersive advice based on the player's immediate needs and the environmental conditions. Do not use markdown, just plain text.",
        temperature: 0.8,
      },
    });

    // Accessing the text property directly (property, not method)
    return response.text?.trim() || "Stay focused on survival.";
  } catch (error) {
    console.error("Gemini advice fetch failed:", error);
    return gameState.settings.language === 'tr' ? "Vahşi doğada tetikte kal." : "Stay alert in the wildlands.";
  }
};
