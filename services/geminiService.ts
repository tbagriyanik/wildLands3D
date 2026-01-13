
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
    // Using systemInstruction for role definition as per best practices
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Current Game State:
- Day: ${gameState.day}
- Time of Day: ${gameState.time} (0-2400)
- Health: ${Math.round(gameState.stats.health)}%
- Hunger: ${Math.round(gameState.stats.hunger)}%
- Thirst: ${Math.round(gameState.stats.thirst)}%
- Temperature: ${Math.round(gameState.stats.temperature)}°C
- Inventory: ${gameState.inventory.length > 0 ? gameState.inventory.map(i => `${i.count}x ${i.name}`).join(', ') : 'Empty'}`,
      config: {
        systemInstruction: `You are a survival advisor in a wilderness simulation game. Give a very short (max 12 words) survival tip or warning in ${gameState.settings.language === 'tr' ? 'Turkish' : 'English'}. Be atmospheric and concise.`,
        temperature: 0.8,
        topP: 0.9,
      }
    });

    // Directly access the text property as per @google/genai guidelines
    return response.text || "";
  } catch (error) {
    console.error("Survival Advisor Gemini API Error:", error);
    return "";
  }
};
