
import React, { useState, useEffect } from 'react';
import { GameState } from '../types';
import { getSurvivalAdvice } from '../services/geminiService';

/**
 * AIAdvisor component that contextually triggers survival tips using the Gemini API
 * when the player's stats reach critical levels.
 */

interface AIAdvisorProps {
  gameState: GameState;
}

const AIAdvisor: React.FC<AIAdvisorProps> = ({ gameState }) => {
  const [advice, setAdvice] = useState<string>("");
  const [visible, setVisible] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(0);

  useEffect(() => {
    // Advice is triggered when stats are low or environment is harsh.
    const needsAdvice = 
      gameState.stats.health < 40 || 
      gameState.stats.hunger < 25 || 
      gameState.stats.thirst < 25 || 
      gameState.stats.temperature < 18 ||
      gameState.stats.temperature > 37;

    const now = Date.now();
    // Throttle advice requests to once every 60 seconds to manage API quota and prevent UI spam.
    if (needsAdvice && now - lastCheckTime > 60000) {
      const fetchAdvice = async () => {
        const text = await getSurvivalAdvice(gameState);
        if (text) {
          setAdvice(text);
          setVisible(true);
          setLastCheckTime(now);
          // Hide the advice bubble after a reading period.
          setTimeout(() => setVisible(false), 10000);
        }
      };
      fetchAdvice();
    }
  }, [gameState, lastCheckTime]);

  if (!visible || !advice) return null;

  return (
    <div className="fixed top-24 right-4 z-[100] pointer-events-none">
      <div className="bg-slate-900/90 backdrop-blur-3xl border border-indigo-500/40 p-5 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.6)] max-w-[280px] animate-in slide-in-from-right fade-in duration-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
             <span className="text-2xl">🦉</span>
             <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping" />
          </div>
          <span className="text-xs font-black uppercase tracking-[0.25em] text-indigo-400">Advisor</span>
        </div>
        <p className="text-sm text-indigo-50/95 leading-relaxed font-medium italic drop-shadow-sm">
          "{advice}"
        </p>
      </div>
    </div>
  );
};

export default AIAdvisor;
