
import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameScene, { GameSceneHandle } from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import { GameState, InteractionTarget, MobileInput, InventoryItem } from './types';
import { INITIAL_STATS, SURVIVAL_DECAY_RATES, TRANSLATIONS, SFX_URLS, MUSIC_URL } from './constants';

const SAVE_KEY = 'wildlands_survival_v21';

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
  const [cookingItem, setCookingItem] = useState<string | null>(null);
  const [mobileInput, setMobileInput] = useState<MobileInput>({ moveX: 0, moveY: 0, lookX: 0, lookY: 0, jump: false, sprint: false, interact: false, attack: false });
  
  const sceneRef = useRef<GameSceneHandle>(null);
  const t = TRANSLATIONS[gameState.settings.language];

  // ESC Tuşu Kontrolü
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (view === 'game') {
          if (isCraftingOpen) {
            setIsCraftingOpen(false);
          } else {
            setView('menu');
            if (document.pointerLockElement) document.exitPointerLock();
          }
        } else if (view === 'settings') {
          setView('menu');
        }
      }
      if (e.code === 'KeyC' && view === 'game') {
        setIsCraftingOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, isCraftingOpen]);

  const playSFX = useCallback((url: string, volume = 0.4) => {
    if (gameState.settings.sfxEnabled) {
      const sfx = new Audio(url);
      sfx.volume = volume;
      sfx.play().catch(() => {});
    }
  }, [gameState.settings.sfxEnabled]);

  useEffect(() => {
    if (!musicRef.current) {
      musicRef.current = new Audio(MUSIC_URL);
      musicRef.current.loop = true;
      musicRef.current.volume = 0.3;
    }
    if (gameState.settings.musicEnabled) {
      musicRef.current.play().catch(() => {});
    } else {
      musicRef.current.pause();
    }
  }, [gameState.settings.musicEnabled]);

  const handleUseItem = useCallback((itemId: string) => {
    setGameState(prev => {
      const item = prev.inventory.find(i => i.id === itemId);
      if (!item) return prev;
      if (item.name === 'Bow' || item.name === 'Torch') {
        setActiveToolId(current => current === itemId ? null : itemId);
        playSFX(SFX_URLS.collect_item_generic);
        return prev;
      }
      let newStats = { ...prev.stats };
      if (item.name.includes('Meat') || item.name.includes('Apple') || item.name.includes('Berries')) {
        const bonus = item.name.includes('Cooked') || item.name.includes('Roasted') ? 2 : 1;
        newStats.hunger = Math.min(100, newStats.hunger + (20 * bonus));
        newStats.thirst = Math.min(100, newStats.thirst + 5);
        playSFX(SFX_URLS.eat_crunchy);
        const newInv = prev.inventory.map(i => i.id === itemId ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
        return { ...prev, stats: newStats, inventory: sortInventory(newInv) };
      }
      return prev;
    });
  }, [playSFX]);

  const handleCraft = useCallback((type: 'campfire' | 'arrows' | 'bow' | 'torch') => {
    setGameState(prev => {
      const wood = prev.inventory.find(i => i.name === 'Wood');
      const flint = prev.inventory.find(i => i.name === 'Flint Stone');
      let newInv = [...prev.inventory];
      if (type === 'campfire' && wood && wood.count >= 3 && flint && flint.count >= 1) {
        playSFX(SFX_URLS.campfire_craft);
        newInv = newInv.map(i => i.name === 'Wood' ? { ...i, count: i.count - 3 } : i.name === 'Flint Stone' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
        const cf = { id: Math.random().toString(), x: playerInfoRef.current.x + playerInfoRef.current.dirX * 3, z: playerInfoRef.current.z + playerInfoRef.current.dirZ * 3 };
        return { ...prev, inventory: sortInventory(newInv), campfires: [...prev.campfires, cf] };
      }
      if (type === 'arrows' && wood && wood.count >= 1) {
        playSFX(SFX_URLS.collect_item_generic);
        newInv = newInv.map(i => i.name === 'Wood' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
        const arrows = newInv.find(i => i.name === 'Arrow');
        if (arrows) arrows.count += 5; else newInv.push({ id: 'arrow_' + Date.now(), name: 'Arrow', type: 'resource', count: 5 });
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
        stats.hunger = Math.max(0, stats.hunger - 0.1);
        stats.thirst = Math.max(0, stats.thirst - 0.15);
        let newTime = prev.time + (2400 / 1440);
        if (newTime >= 2400) { newTime = 0; return { ...prev, stats, time: newTime, day: prev.day + 1 }; }
        return { ...prev, stats, time: newTime };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [view, isLocked, isMobile]);

  useEffect(() => {
    if (view !== 'game') return;
    const saveInterval = setInterval(() => {
      const updated = { 
        ...gameState, 
        playerPosition: { x: playerInfoRef.current.x, y: playerInfoRef.current.y, z: playerInfoRef.current.z },
        playerRotation: Math.atan2(playerInfoRef.current.dirX, playerInfoRef.current.dirZ)
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(updated));
    }, 2000);
    return () => clearInterval(saveInterval);
  }, [view, gameState]);

  const startNewGame = () => {
    localStorage.removeItem(SAVE_KEY);
    setGameState(getInitialState());
    setGameKey(prev => prev + 1);
    setView('game');
    setShowNewGameConfirm(false);
    setIsCraftingOpen(false);
  };

  return (
    <div className="w-screen h-screen bg-slate-950 text-white font-sans overflow-hidden">
      <GameScene 
        key={gameKey}
        ref={sceneRef}
        initialPosition={gameState.playerPosition}
        initialRotation={gameState.playerRotation}
        onInteract={setInteraction} 
        onCollect={(t) => {
          setGameState(prev => {
            const inv = [...prev.inventory];
            const item = inv.find(i => i.name === t);
            if (item) item.count++; else inv.push({ id: Math.random().toString(), name: t, type: 'resource', count: 1 });
            return { ...prev, inventory: sortInventory(inv) };
          });
          playSFX(SFX_URLS.collect_item_generic);
        }}
        onDrink={() => setGameState(p => ({ ...p, stats: { ...p.stats, thirst: Math.min(100, p.stats.thirst + 20) }}))}
        onPositionUpdate={(info) => {
          playerInfoRef.current = info;
          setPlayerRotation(Math.atan2(info.dirX, info.dirZ));
        }}
        onLockChange={setIsLocked}
        onCook={handleUseItem}
        onShoot={() => setGameState(p => ({ ...p, inventory: p.inventory.map(i => i.name === 'Arrow' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0) }))}
        isBowActive={gameState.inventory.find(i => i.id === activeToolId)?.name === 'Bow'}
        isTorchActive={gameState.inventory.find(i => i.id === activeToolId)?.name === 'Torch'}
        arrowCount={gameState.inventory.find(i => i.name === 'Arrow')?.count || 0}
        time={gameState.time}
        weather={gameState.weather}
        isLocked={isLocked}
        isMobile={isMobile}
        mobileInput={mobileInput}
        sfxEnabled={gameState.settings.sfxEnabled}
        campfires={gameState.campfires}
        isCraftingOpen={isCraftingOpen}
      />
      
      <UIOverlay 
        gameState={gameState} 
        interaction={interaction} 
        onUseItem={handleUseItem} 
        onCraft={handleCraft} 
        isVisible={view === 'game'} 
        isCraftingOpen={isCraftingOpen} 
        setIsCraftingOpen={setIsCraftingOpen} 
        playerRotation={playerRotation} 
        activeToolId={activeToolId} 
        onMobileInput={setMobileInput} 
        isMobile={isMobile} 
        onCook={() => {}} 
        cookingItem={cookingItem} 
        isHungerCritical={gameState.stats.hunger < 20} 
        isThirstCritical={gameState.stats.thirst < 20} 
        isWarmingUp={false} 
        showTodoList={true} 
      />

      {view === 'menu' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-2xl pointer-events-auto">
          <div className="mb-12 text-center">
            <h1 className="text-8xl font-black italic tracking-tighter text-indigo-500 drop-shadow-[0_0_30px_rgba(99,102,241,0.4)]">WILD LANDS</h1>
            <p className="text-indigo-300 font-bold tracking-[0.4em] text-xs mt-2 uppercase">{t.tagline}</p>
          </div>
          <div className="flex flex-col items-center">
            <button onClick={() => setView('game')} disabled={!hasSave} className={`w-64 py-4 rounded-xl font-black text-xl mb-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20`}>{t.continue}</button>
            <button onClick={() => hasSave ? setShowNewGameConfirm(true) : startNewGame()} className="w-64 py-4 rounded-xl font-black text-xl mb-4 bg-white/10 hover:bg-white/20">{t.newGame}</button>
            <button onClick={() => setView('settings')} className="w-64 py-4 rounded-xl font-black text-xl bg-white/10 hover:bg-white/20">{t.settings}</button>
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
