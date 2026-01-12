
import React, { useState, useEffect } from 'react';
import { GameState } from '../types';
import { getSurvivalAdvice } from '../services/geminiService';

interface AIAdvisorProps {
  gameState: GameState;
  isVisible: boolean;
}

const AIAdvisor: React.FC<AIAdvisorProps> = ({ gameState, isVisible }) => {
  const [advice, setAdvice] = useState<string>("");
  const [lastCheckTime, setLastCheckTime] = useState(0);

  useEffect(() => {
    // Check for advice every 30 game-minutes or when critical stats change
    const currentTime = gameState.day * 2400 + gameState.time;
    const isCritical = gameState.stats.hunger < 20 || gameState.stats.thirst < 20 || gameState.stats.health < 40;
    
    if (isVisible && (currentTime - lastCheckTime > 50 || (isCritical && currentTime - lastCheckTime > 20))) {
      const fetchAdvice = async () => {
        const tip = await getSurvivalAdvice(gameState);
        if (tip) {
          setAdvice(tip);
          setLastCheckTime(currentTime);
          // Auto-hide advice after 10 seconds
          setTimeout(() => setAdvice(""), 10000);
        }
      };
      fetchAdvice();
    }
  }, [isVisible, gameState.time, gameState.day, gameState.stats.hunger, gameState.stats.thirst, gameState.stats.health]);

  if (!isVisible || !advice) return null;

  return (
    <div className="absolute top-4 right-4 z-[100] max-w-[280px] animate-in fade-in slide-in-from-right duration-500 pointer-events-none">
      <div className="bg-slate-900/60 backdrop-blur-3xl border border-indigo-500/30 p-4 md:p-6 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2 mb-2 opacity-50">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-300">
            {gameState.settings.language === 'tr' ? 'VAHŞİ DOĞA REHBERİ' : 'WILDERNESS GUIDE'}
          </span>
        </div>
        <p className="text-xs md:text-sm font-medium italic text-indigo-50 leading-relaxed drop-shadow-sm">
          "{advice}"
        </p>
      </div>
    </div>
  );
};

export default AIAdvisor;
