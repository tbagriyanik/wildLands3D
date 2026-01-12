
import { GoogleGenAI } from "@google/genai";
import { GameState } from "../types";

// Initialize the Gemini API client with the environment variable API key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates survival advice based on the current game state using Gemini 3 Flash.
 * This provides immersive tips for the player.
 */
export const getSurvivalAdvice = async (gameState: GameState): Promise<string> => {
  try {
    const prompt = `You are a survival advisor in a wilderness simulation game. 
Current Game State:
- Day: ${gameState.day}
- Time of Day: ${gameState.time} (0-2400)
- Health: ${Math.round(gameState.stats.health)}%
- Hunger: ${Math.round(gameState.stats.hunger)}%
- Thirst: ${Math.round(gameState.stats.thirst)}%
- Temperature: ${Math.round(gameState.stats.temperature)}°C
- Inventory: ${gameState.inventory.length > 0 ? gameState.inventory.map(i => `${i.count}x ${i.name}`).join(', ') : 'Empty'}

Based on this state, give a very short (max 12 words) survival tip or warning in ${gameState.settings.language === 'tr' ? 'Turkish' : 'English'}. 
Be atmospheric and concise.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.8,
        topP: 0.9,
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Survival Advisor Gemini API Error:", error);
    return "";
  }
};
