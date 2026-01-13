
import React, { useState, useEffect } from 'react';
import { GameState } from '../types';

/**
 * AIAdvisor component that contextually triggers survival tips locally
 * when the player's stats reach critical levels.
 */

interface AIAdvisorProps {
  gameState: GameState;
}

const AIAdvisor: React.FC<AIAdvisorProps> = ({ gameState }) => {
  const [advice, setAdvice] = useState<string>("");
  const [visible, setVisible] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(0);

  const getLocalAdvice = (state: GameState): string => {
    const isTr = state.settings.language === 'tr';
    const isNight = state.time > 1900 || state.time < 500;
    
    // Priority 1: Health
    if (state.stats.health < 30) {
      return isTr ? "Ölmek üzeresin! Hemen bir ateş yak ve yemek ye." : "You are near death! Build a fire and eat immediately.";
    }
    // Priority 2: Temperature
    if (state.stats.temperature < 15) {
      return isTr ? "Donuyorsun! Acilen bir kamp ateşi bul veya yap." : "You're freezing! Find or build a campfire now.";
    }
    // Priority 3: Thirst
    if (state.stats.thirst < 20) {
      return isTr ? "Dehidrasyon kapıda. Yakınlarda bir su birikintisi ara." : "Dehydration is imminent. Look for a puddle nearby.";
    }
    // Priority 4: Hunger
    if (state.stats.hunger < 20) {
      return isTr ? "Miden kazınıyor. Elma ağaçlarını veya böğürtlenleri bul." : "Your stomach is growling. Find apple trees or berries.";
    }
    // Priority 5: Environment/Inventory
    if (isNight && !state.inventory.some(i => i.name === 'Torch')) {
      return isTr ? "Gece karanlık ve tehlikeli. Bir meşale üretmek için odun ve çakmaktaşı topla." : "The night is dark and dangerous. Gather wood and flint for a torch.";
    }
    if (state.inventory.filter(i => i.type === 'food').length === 0) {
      return isTr ? "Erzak bitti. Hayvan avlamak için bir yay ve ok üret." : "Food supplies are out. Craft a bow and arrows to hunt.";
    }
    
    return isTr ? "Vahşi doğada tetikte kal, her kaynak değerlidir." : "Stay alert, every resource is precious in the wild.";
  };

  useEffect(() => {
    const needsAdvice = 
      gameState.stats.health < 40 || 
      gameState.stats.hunger < 25 || 
      gameState.stats.thirst < 25 || 
      gameState.stats.temperature < 18 ||
      (gameState.time > 1900 && !gameState.inventory.some(i => i.name === 'Torch'));

    const now = Date.now();
    // Throttle advice to once every 45 seconds
    if (needsAdvice && now - lastCheckTime > 45000) {
      const text = getLocalAdvice(gameState);
      setAdvice(text);
      setVisible(true);
      setLastCheckTime(now);
      setTimeout(() => setVisible(false), 8000);
    }
  }, [gameState, lastCheckTime]);

  if (!visible || !advice) return null;

  return (
    <div className="fixed top-24 right-4 z-[100] pointer-events-none">
      <div className="bg-slate-900/95 backdrop-blur-3xl border border-indigo-500/40 p-5 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.8)] max-w-[280px] animate-in slide-in-from-right fade-in duration-700">
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
