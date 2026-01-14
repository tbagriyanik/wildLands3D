
import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameScene, { GameSceneHandle } from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import AIAdvisor from './components/AIAdvisor';
import { GameState, InteractionTarget, MobileInput, InventoryItem } from './types';
import { INITIAL_STATS, SURVIVAL_DECAY_RATES, TRANSLATIONS, SFX_URLS, MUSIC_URL } from './constants';

const SAVE_KEY = 'wildlands_survival_v27';

const ITEM_PRIORITY: Record<string, number> = {
  'Bow': 100,
  'Torch': 99,
  'Cooked Meat': 90,
  'Roasted Apple': 89,
  'Cooked Berries': 88,
  'Raw Meat': 80,
  'Apple': 79,
  'Berries': 78,
  'Arrow': 50,
  'Flint Stone': 10,
  'Wood': 5,
  'Stone': 4
};

const sortInventory = (items: InventoryItem[]): InventoryItem[] => {
  return [...items].sort((a, b) => (ITEM_PRIORITY[b.name] || 0) - (ITEM_PRIORITY[a.name] || 0));
};

const App: React.FC = () => {
  const [view, setView] = useState<'menu' | 'game' | 'settings'>('menu');
  const [isMobile] = useState(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  const [isCraftingOpen, setIsCraftingOpen] = useState(false);
  const [gameKey, setGameKey] = useState(0); 
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const playerInfoRef = useRef({ x: 120, y: 1.8, z: 120, dirX: 0, dirZ: -1 });

  const getInitialState = (): GameState => ({
    stats: { ...INITIAL_STATS },
    inventory: sortInventory([
      { id: '1', name: 'Flint Stone', type: 'resource', count: 3 },
      { id: '2', name: 'Wood', type: 'resource', count: 12 },
      { id: '3', name: 'Stone', type: 'resource', count: 8 },
      { id: '4', name: 'Apple', type: 'food', count: 5 },
      { id: '5', name: 'Raw Meat', type: 'food', count: 2 },
      { id: '6', name: 'Arrow', type: 'resource', count: 10 }
    ]),
    day: 1,
    time: 1000,
    settings: { language: 'tr', musicEnabled: true, sfxEnabled: true },
    weather: 'sunny',
    campfires: [],
    playerPosition: { x: 120, y: 1.8, z: 120 },
    playerRotation: 0
  });

  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...parsed, inventory: sortInventory(parsed.inventory || []) };
      } catch (e) { console.error("Save load failed:", e); }
    }
    return getInitialState();
  });

  const hasSave = !!localStorage.getItem(SAVE_KEY);
  const [interaction, setInteraction] = useState<InteractionTarget>({ type: 'none' });
  const [isGameOver, setIsGameOver] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [playerRotation, setPlayerRotation] = useState(gameState.playerRotation || 0);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [mobileInput, setMobileInput] = useState<MobileInput>({ moveX: 0, moveY: 0, lookX: 0, lookY: 0, jump: false, sprint: false, interact: false, attack: false });
  
  const sceneRef = useRef<GameSceneHandle>(null);
  const t = TRANSLATIONS[gameState.settings.language];

  const playSFX = useCallback((url: string, volume = 0.4) => {
    if (gameState.settings.sfxEnabled) {
      const sfx = new Audio(url);
      sfx.volume = volume;
      sfx.play().catch(() => {});
    }
  }, [gameState.settings.sfxEnabled]);

  const handleUseItem = useCallback((itemId: string) => {
    setGameState(prev => {
      // Özel Etkileşim: Kamp Ateşi ile Pişirme
      if (itemId === 'campfire') {
        let newInv = [...prev.inventory];
        let rawMeatIndex = newInv.findIndex(i => i.name === 'Raw Meat');
        let appleIndex = newInv.findIndex(i => i.name === 'Apple');
        
        let cookedSomething = false;

        // Önce eti pişirmeyi dene
        if (rawMeatIndex !== -1) {
          playSFX(SFX_URLS.campfire_cook);
          // Çiğ eti azalt
          if (newInv[rawMeatIndex].count > 1) {
            newInv[rawMeatIndex] = { ...newInv[rawMeatIndex], count: newInv[rawMeatIndex].count - 1 };
          } else {
            newInv.splice(rawMeatIndex, 1);
          }
          // Pişmiş et ekle
          let cookedIndex = newInv.findIndex(i => i.name === 'Cooked Meat');
          if (cookedIndex !== -1) newInv[cookedIndex].count++;
          else newInv.push({ id: 'cooked_' + Date.now(), name: 'Cooked Meat', type: 'food', count: 1 });
          cookedSomething = true;
        } 
        // Yoksa elmayı pişir
        else if (appleIndex !== -1) {
          playSFX(SFX_URLS.campfire_cook);
          if (newInv[appleIndex].count > 1) {
            newInv[appleIndex] = { ...newInv[appleIndex], count: newInv[appleIndex].count - 1 };
          } else {
            newInv.splice(appleIndex, 1);
          }
          let roastedIndex = newInv.findIndex(i => i.name === 'Roasted Apple');
          if (roastedIndex !== -1) newInv[roastedIndex].count++;
          else newInv.push({ id: 'roasted_' + Date.now(), name: 'Roasted Apple', type: 'food', count: 1 });
          cookedSomething = true;
        }

        if (cookedSomething) {
          return { ...prev, inventory: sortInventory(newInv) };
        }
        return prev;
      }

      const itemIndex = prev.inventory.findIndex(i => i.id === itemId);
      if (itemIndex === -1) return prev;
      const item = prev.inventory[itemIndex];
      
      if (item.name === 'Bow' || item.name === 'Torch') {
        setActiveToolId(current => {
          const isTurningOn = current !== itemId;
          if (isTurningOn && item.name === 'Torch') playSFX(SFX_URLS.torch_light);
          return isTurningOn ? itemId : null;
        });
        return prev;
      }

      let newStats = { ...prev.stats };
      let consumed = false;

      if (item.name === 'Apple') {
        newStats.hunger = Math.min(100, newStats.hunger + 15);
        newStats.health = Math.min(100, newStats.health + 5);
        consumed = true;
      } else if (item.name === 'Roasted Apple') {
        newStats.hunger = Math.min(100, newStats.hunger + 25);
        newStats.health = Math.min(100, newStats.health + 12);
        consumed = true;
      } else if (item.name === 'Cooked Meat') {
        newStats.hunger = Math.min(100, newStats.hunger + 55);
        newStats.health = Math.min(100, newStats.health + 35);
        consumed = true;
      } else if (item.name === 'Raw Meat') {
        newStats.hunger = Math.min(100, newStats.hunger + 12);
        newStats.health = Math.max(0, newStats.health - 8); // Çiğ et zarar verebilir
        consumed = true;
      } else if (item.name === 'Berries') {
        newStats.hunger = Math.min(100, newStats.hunger + 10);
        newStats.health = Math.min(100, newStats.health + 2);
        consumed = true;
      }

      if (consumed) {
        playSFX(SFX_URLS.eat_crunchy);
        const newInv = [...prev.inventory];
        if (newInv[itemIndex].count > 1) {
          newInv[itemIndex] = { ...newInv[itemIndex], count: newInv[itemIndex].count - 1 };
        } else {
          newInv.splice(itemIndex, 1);
        }
        return { ...prev, stats: newStats, inventory: sortInventory(newInv) };
      }
      return prev;
    });
  }, [playSFX]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (view === 'game') {
          if (isCraftingOpen) setIsCraftingOpen(false);
          else { setView('menu'); if (document.pointerLockElement) document.exitPointerLock(); }
        } else setView('menu');
      }
      if (e.code === 'KeyC' && view === 'game') setIsCraftingOpen(prev => !prev);
      
      if (view === 'game' && !isCraftingOpen) {
        const keyNum = parseInt(e.key);
        if (keyNum >= 1 && keyNum <= 9) {
          const item = gameState.inventory[keyNum - 1];
          if (item) handleUseItem(item.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, isCraftingOpen, gameState.inventory, handleUseItem]);

  useEffect(() => {
    if (!musicRef.current) {
      musicRef.current = new Audio(MUSIC_URL);
      musicRef.current.loop = true;
      musicRef.current.volume = 0.2;
    }
    if (gameState.settings.musicEnabled && view === 'game') musicRef.current.play().catch(() => {});
    else musicRef.current.pause();
  }, [gameState.settings.musicEnabled, view]);

  const handleCraft = useCallback((type: 'campfire' | 'arrows' | 'bow' | 'torch') => {
    setGameState(prev => {
      const wood = prev.inventory.find(i => i.name === 'Wood');
      const flint = prev.inventory.find(i => i.name === 'Flint Stone');
      let newInv = [...prev.inventory];
      
      if (type === 'campfire' && wood && wood.count >= 3 && flint && flint.count >= 1) {
        playSFX(SFX_URLS.campfire_craft);
        newInv = newInv.map(i => i.name === 'Wood' ? { ...i, count: i.count - 3 } : i.name === 'Flint Stone' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
        const cf = { id: 'cf_' + Date.now(), x: playerInfoRef.current.x + playerInfoRef.current.dirX * 3, z: playerInfoRef.current.z + playerInfoRef.current.dirZ * 3 };
        return { ...prev, inventory: sortInventory(newInv), campfires: [...prev.campfires, cf] };
      }
      if (type === 'arrows' && wood && wood.count >= 1) {
        playSFX(SFX_URLS.collect_item_generic);
        newInv = newInv.map(i => i.name === 'Wood' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
        const arrows = newInv.find(i => i.name === 'Arrow');
        if (arrows) arrows.count += 5; else newInv.push({ id: 'arrow_' + Date.now(), name: 'Arrow', type: 'resource', count: 5 });
        return { ...prev, inventory: sortInventory(newInv) };
      }
      if (type === 'bow' && wood && wood.count >= 3) {
        playSFX(SFX_URLS.collect_item_generic);
        newInv = newInv.map(i => i.name === 'Wood' ? { ...i, count: i.count - 3 } : i).filter(i => i.count > 0);
        const existingBow = newInv.find(i => i.name === 'Bow');
        if (existingBow) {
          existingBow.count++;
        } else {
          newInv.push({ id: 'bow_' + Date.now(), name: 'Bow', type: 'tool', count: 1 });
        }
        return { ...prev, inventory: sortInventory(newInv) };
      }
      if (type === 'torch' && wood && wood.count >= 1 && flint && flint.count >= 1) {
        playSFX(SFX_URLS.torch_light);
        newInv = newInv.map(i => i.name === 'Wood' ? { ...i, count: i.count - 1 } : i.name === 'Flint Stone' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
        const existingTorch = newInv.find(i => i.name === 'Torch');
        if (existingTorch) {
          existingTorch.count++;
        } else {
          newInv.push({ id: 'torch_' + Date.now(), name: 'Torch', type: 'tool', count: 1 });
        }
        return { ...prev, inventory: sortInventory(newInv) };
      }
      return prev;
    });
  }, [playSFX]);

  useEffect(() => {
    if (view !== 'game' || (!isLocked && !isMobile)) return;
    const timer = setInterval(() => {
      setGameState(prev => {
        if (prev.stats.health <= 0) { setIsGameOver(true); return prev; }
        const stats = { ...prev.stats };
        stats.hunger = Math.max(0, stats.hunger - SURVIVAL_DECAY_RATES.hunger);
        stats.thirst = Math.max(0, stats.thirst - SURVIVAL_DECAY_RATES.thirst);
        const isNight = prev.time > 1900 || prev.time < 500;
        let tempDelta = isNight ? -SURVIVAL_DECAY_RATES.temp_night_drop : -SURVIVAL_DECAY_RATES.temp_day_drop;
        let nearestFireDist = Infinity;
        prev.campfires.forEach(cf => {
           const dist = Math.sqrt(Math.pow(playerInfoRef.current.x - cf.x, 2) + Math.pow(playerInfoRef.current.z - cf.z, 2));
           if (dist < nearestFireDist) nearestFireDist = dist;
        });
        if (nearestFireDist < 8) {
           const factor = Math.max(0, Math.min(1, (8 - nearestFireDist) / 6));
           tempDelta += SURVIVAL_DECAY_RATES.temp_fire_gain * factor;
           setIsWarmingUp(tempDelta > 0);
        } else {
           setIsWarmingUp(false);
        }
        stats.temperature = Math.max(0, Math.min(100, stats.temperature + tempDelta));
        if (stats.hunger < 5 || stats.thirst < 5 || stats.temperature < 15) {
          stats.health = Math.max(0, stats.health - 0.4);
        }
        let newTime = prev.time + 1;
        if (newTime >= 2400) newTime = 0;
        return { ...prev, stats, time: newTime };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [view, isLocked, isMobile]);

  const startNewGame = () => { localStorage.removeItem(SAVE_KEY); setGameState(getInitialState()); setGameKey(prev => prev + 1); setView('game'); setShowNewGameConfirm(false); setIsCraftingOpen(false); };

  useEffect(() => {
    if (gameState) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    }
  }, [gameState]);

  return (
    <div className="w-screen h-screen bg-slate-950 text-white font-sans overflow-hidden">
      <GameScene 
        key={gameKey} ref={sceneRef} initialPosition={gameState.playerPosition} initialRotation={gameState.playerRotation}
        onInteract={setInteraction} 
        onCollect={(t) => {
          setGameState(prev => {
            const inv = [...prev.inventory];
            const item = inv.find(i => i.name === t);
            if (item) item.count++; else inv.push({ id: Math.random().toString(), name: t, type: 'resource' as any, count: 1 });
            return { ...prev, inventory: sortInventory(inv) };
          });
        }}
        onDrink={() => { setGameState(p => ({ ...p, stats: { ...p.stats, thirst: Math.min(100, p.stats.thirst + 25) }})); playSFX(SFX_URLS.drink_swallow); }}
        onPositionUpdate={(info) => { playerInfoRef.current = info; setPlayerRotation(Math.atan2(info.dirX, info.dirZ)); }}
        onLockChange={setIsLocked} 
        onCook={(id) => handleUseItem('campfire')}
        onShoot={() => setGameState(p => ({ ...p, inventory: p.inventory.map(i => i.name === 'Arrow' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0) }))}
        isBowActive={gameState.inventory.find(i => i.id === activeToolId)?.name === 'Bow'}
        isTorchActive={gameState.inventory.find(i => i.id === activeToolId)?.name === 'Torch'}
        arrowCount={gameState.inventory.find(i => i.name === 'Arrow')?.count || 0}
        time={gameState.time} weather={gameState.weather} isLocked={isLocked} isMobile={isMobile} mobileInput={mobileInput}
        sfxEnabled={gameState.settings.sfxEnabled} campfires={gameState.campfires} isCraftingOpen={isCraftingOpen}
      />
      <UIOverlay 
        gameState={gameState} interaction={interaction} onUseItem={handleUseItem} onCraft={handleCraft} isVisible={view === 'game'} 
        isCraftingOpen={isCraftingOpen} setIsCraftingOpen={setIsCraftingOpen} playerRotation={playerRotation} 
        activeToolId={activeToolId} onMobileInput={setMobileInput} isMobile={isMobile} onCook={() => handleUseItem('campfire')} cookingItem={null} 
        isHungerCritical={gameState.stats.hunger < 20} isThirstCritical={gameState.stats.thirst < 20} isWarmingUp={isWarmingUp} showTodoList={true} 
      />
      <AIAdvisor gameState={gameState} />
      {view === 'menu' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-2xl pointer-events-auto">
          <div className="mb-12 text-center">
            <h1 className="text-8xl font-black italic tracking-tighter text-indigo-500 drop-shadow-[0_0_30px_rgba(99,102,241,0.4)]">WILD LANDS</h1>
            <p className="text-indigo-300 font-bold tracking-[0.4em] text-xs mt-2 uppercase">{t.tagline}</p>
          </div>
          <div className="flex flex-col items-center">
            <button onClick={() => setView('game')} disabled={!hasSave} className={`w-64 py-4 rounded-xl font-black text-xl mb-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20`}>{t.continue}</button>
            <button onClick={() => hasSave ? setShowNewGameConfirm(true) : startNewGame()} className="w-64 py-4 rounded-xl font-black text-xl mb-4 bg-white/10 hover:bg-white/20">{t.newGame}</button>
          </div>
          {showNewGameConfirm && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 z-[60]">
               <p className="text-red-400 font-black mb-6 uppercase tracking-widest">{t.resetProgress}?</p>
               <button onClick={startNewGame} className="w-64 py-4 bg-red-600 rounded-xl font-black text-xl mb-4">{t.newGame}</button>
               <button onClick={() => setShowNewGameConfirm(false)} className="w-64 py-4 bg-white/10 rounded-xl font-black text-xl">{t.close}</button>
            </div>
          )}
        </div>
      )}
      {isGameOver && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black text-red-600">
          <h1 className="text-9xl font-black mb-8 italic">ÖLDÜN</h1>
          <button onClick={() => window.location.reload()} className="px-12 py-5 bg-red-600 text-white rounded-2xl font-black text-2xl">{t.tryAgain}</button>
        </div>
      )}
    </div>
  );
};

export default App;
