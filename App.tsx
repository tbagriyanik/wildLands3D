
import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameScene, { GameSceneHandle } from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import { GameState, InteractionTarget, MobileInput, InventoryItem } from './types';
import { INITIAL_STATS, SURVIVAL_DECAY_RATES, TRANSLATIONS, SFX_URLS } from './constants';

const SAVE_KEY = 'wildlands_survival_v19';

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
  const [isCraftingOpen, setIsCraftingOpen] = useState(true);
  const [gameKey, setGameKey] = useState(0); // Key to force-reset GameScene world
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  
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
    campfires: []
  });

  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...parsed, 
          inventory: sortInventory(parsed.inventory || [])
        };
      } catch (e) { console.error("Save load failed:", e); }
    }
    return getInitialState();
  });

  const hasSave = !!localStorage.getItem(SAVE_KEY);

  const [interaction, setInteraction] = useState<InteractionTarget>({ type: 'none' });
  const [isGameOver, setIsGameOver] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showTodoList, setShowTodoList] = useState(true);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [cookingItem, setCookingItem] = useState<string | null>(null);
  
  const craftingTimeoutRef = useRef<number | null>(null);
  const playerInfoRef = useRef({ x: 120, z: 120, dirX: 0, dirZ: -1 });
  const [mobileInput, setMobileInput] = useState<MobileInput>({ moveX: 0, moveY: 0, lookX: 0, lookY: 0, jump: false, sprint: false, interact: false, attack: false });
  
  const sceneRef = useRef<GameSceneHandle>(null);
  const t = TRANSLATIONS[gameState.settings.language];

  const resetCraftTimer = useCallback(() => {
    if (craftingTimeoutRef.current) window.clearTimeout(craftingTimeoutRef.current);
    if (isCraftingOpen) {
      craftingTimeoutRef.current = window.setTimeout(() => setIsCraftingOpen(false), 10000);
    }
  }, [isCraftingOpen]);

  useEffect(() => { resetCraftTimer(); }, [isCraftingOpen, resetCraftTimer]);

  const playSFX = useCallback((url: string, volume = 0.4) => {
    if (gameState.settings.sfxEnabled) {
      const sfx = new Audio(url);
      sfx.volume = volume;
      sfx.play().catch(() => {});
    }
  }, [gameState.settings.sfxEnabled]);

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
      let consumed = false;
      if (item.name.includes('Meat') || item.name.includes('Apple') || item.name.includes('Berries')) {
        const bonus = item.name.includes('Cooked') || item.name.includes('Roasted') ? 2 : 1;
        newStats.hunger = Math.min(100, newStats.hunger + (20 * bonus));
        newStats.thirst = Math.min(100, newStats.thirst + 5);
        consumed = true;
        playSFX(SFX_URLS.eat_crunchy);
      }

      if (!consumed) return prev;
      const newInv = prev.inventory.map(i => i.id === itemId ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
      return { ...prev, stats: newStats, inventory: sortInventory(newInv) };
    });
  }, [playSFX]);

  const handleCook = useCallback(() => {
    setGameState(prev => {
      const rawMeat = prev.inventory.find(i => i.name === 'Raw Meat');
      const apple = prev.inventory.find(i => i.name === 'Apple');
      const berries = prev.inventory.find(i => i.name === 'Berries');

      let itemToCook = null;
      let cookedName = "";

      if (rawMeat && rawMeat.count > 0) {
        itemToCook = 'Raw Meat';
        cookedName = 'Cooked Meat';
      } else if (apple && apple.count > 0) {
        itemToCook = 'Apple';
        cookedName = 'Roasted Apple';
      } else if (berries && berries.count > 0) {
        itemToCook = 'Berries';
        cookedName = 'Cooked Berries';
      }

      if (!itemToCook) return prev;

      playSFX(SFX_URLS.campfire_cook);
      setCookingItem(itemToCook);
      setTimeout(() => setCookingItem(null), 1200);

      const newInv = [...prev.inventory].map(i => {
        if (i.name === itemToCook) return { ...i, count: i.count - 1 };
        return i;
      }).filter(i => i.count > 0);

      const existingCooked = newInv.find(i => i.name === cookedName);
      if (existingCooked) {
        existingCooked.count += 1;
      } else {
        newInv.push({ id: cookedName + Date.now(), name: cookedName, type: 'food', count: 1 });
      }

      return { ...prev, inventory: sortInventory(newInv) };
    });
  }, [playSFX]);

  const handleCraft = useCallback((type: 'campfire' | 'arrows' | 'bow' | 'torch') => {
    resetCraftTimer();
    setGameState(prev => {
      const wood = prev.inventory.find(i => i.name === 'Wood');
      const flint = prev.inventory.find(i => i.name === 'Flint Stone');
      let newInv = [...prev.inventory];
      let craftedItem: InventoryItem | null = null;
      
      if (type === 'campfire' && wood && wood.count >= 3 && flint && flint.count >= 1) {
        playSFX(SFX_URLS.campfire_craft);
        newInv = newInv.map(i => i.name === 'Wood' ? { ...i, count: i.count - 3 } : i.name === 'Flint Stone' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
        const cf = { id: Math.random().toString(), x: playerInfoRef.current.x + playerInfoRef.current.dirX * 3, z: playerInfoRef.current.z + playerInfoRef.current.dirZ * 3 };
        return { ...prev, inventory: sortInventory(newInv), campfires: [...prev.campfires, cf] };
      }
      
      if (type === 'torch' && wood && wood.count >= 1 && flint && flint.count >= 1) {
        if (prev.inventory.some(i => i.name === 'Torch')) return prev;
        playSFX(SFX_URLS.torch_light);
        newInv = newInv.map(i => i.name === 'Wood' ? { ...i, count: i.count - 1 } : i.name === 'Flint Stone' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
        craftedItem = { id: 'torch_' + Date.now(), name: 'Torch', type: 'tool', count: 1 };
        newInv.push(craftedItem);
        setActiveToolId(craftedItem.id);
        return { ...prev, inventory: sortInventory(newInv) };
      }

      if (type === 'arrows' && wood && wood.count >= 1) {
        playSFX(SFX_URLS.collect_item_generic);
        newInv = newInv.map(i => i.name === 'Wood' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
        const arrows = newInv.find(i => i.name === 'Arrow');
        if (arrows) arrows.count += 5; else newInv.push({ id: 'arrow_' + Date.now(), name: 'Arrow', type: 'resource', count: 5 });
        return { ...prev, inventory: sortInventory(newInv) };
      }

      if (type === 'bow' && wood && wood.count >= 3) {
        if (prev.inventory.some(i => i.name === 'Bow')) return prev;
        playSFX(SFX_URLS.collect_item_generic);
        newInv = newInv.map(i => i.name === 'Wood' ? { ...i, count: i.count - 3 } : i).filter(i => i.count > 0);
        craftedItem = { id: 'bow_' + Date.now(), name: 'Bow', type: 'tool', count: 1 };
        newInv.push(craftedItem);
        setActiveToolId(craftedItem.id);
        return { ...prev, inventory: sortInventory(newInv) };
      }
      return prev;
    });
  }, [playSFX, resetCraftTimer]);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (view !== 'game') return;
      const code = e.code;
      if (code === 'KeyC') setIsCraftingOpen(p => !p);
      if (code === 'KeyF') handleCraft('campfire');
      if (code === 'KeyX') handleCraft('arrows');
      if (code === 'KeyV') handleCraft('bow');
      if (code === 'KeyT') {
        const item = gameState.inventory.find(i => i.name === 'Torch');
        if (item) handleUseItem(item.id); else handleCraft('torch');
      }
      if (code === 'KeyE') sceneRef.current?.triggerAction();
      if (code === 'Escape') {
        if (isCraftingOpen) setIsCraftingOpen(false); else setView('menu');
      }
      const keyNum = parseInt(e.key);
      if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 9) {
        const item = gameState.inventory[keyNum - 1];
        if (item) handleUseItem(item.id);
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [view, isCraftingOpen, gameState.inventory, handleUseItem, handleCraft]);

  useEffect(() => {
    if (view !== 'game' || (!isLocked && !isMobile)) return;
    const timer = setInterval(() => {
      setGameState(prev => {
        if (prev.stats.health <= 0) { setIsGameOver(true); return prev; }
        const stats = { ...prev.stats };
        stats.hunger = Math.max(0, stats.hunger - 0.1);
        stats.thirst = Math.max(0, stats.thirst - 0.15);
        let newTime = prev.time + 10;
        if (newTime >= 2400) newTime = 0;
        return { ...prev, stats, time: newTime };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [view, isLocked, isMobile]);

  useEffect(() => {
    if (view === 'game') {
      localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    }
  }, [gameState, view]);

  const startNewGame = () => {
    localStorage.removeItem(SAVE_KEY);
    setGameState(getInitialState());
    setGameKey(prev => prev + 1); // Incremented key forces GameScene remount and world reset
    setView('game');
    setShowNewGameConfirm(false);
    setIsCraftingOpen(true); // Open crafting menu for 10s tutorial again
  };

  const MenuButton = ({ label, onClick, disabled = false, primary = false, danger = false }: { label: string, onClick: () => void, disabled?: boolean, primary?: boolean, danger?: boolean }) => (
    <button 
      disabled={disabled}
      onClick={() => { playSFX(SFX_URLS.ui_click); onClick(); }}
      className={`w-64 py-4 rounded-xl font-black text-xl transition-all transform hover:scale-105 active:scale-95 mb-4 shadow-xl border ${
        disabled ? 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed' :
        danger ? 'bg-red-600 border-red-500 text-white hover:bg-red-500' :
        primary ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500' :
        'bg-white/10 border-white/10 text-white hover:bg-white/20 backdrop-blur-md'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-screen h-screen bg-slate-950 text-white font-sans overflow-hidden" onClick={() => view === 'game' && !isMobile && sceneRef.current?.requestLock()}>
      <GameScene 
        key={gameKey} // Crucial for resetting the whole 3D world
        ref={sceneRef}
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
        onCook={handleCook}
        onPositionUpdate={(info) => {
          playerInfoRef.current = info;
          setPlayerRotation(Math.atan2(info.dirX, info.dirZ));
        }}
        onLockChange={setIsLocked}
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
        onShoot={() => setGameState(p => ({ ...p, inventory: p.inventory.map(i => i.name === 'Arrow' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0) }))}
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
        onCook={handleCook}
        cookingItem={cookingItem}
        isHungerCritical={gameState.stats.hunger < 20}
        isThirstCritical={gameState.stats.thirst < 20}
        isWarmingUp={false}
        showTodoList={showTodoList}
      />
      
      {view === 'menu' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-2xl">
          <div className="mb-12 text-center">
            <h1 className="text-8xl font-black italic tracking-tighter text-indigo-500 drop-shadow-[0_0_30px_rgba(99,102,241,0.4)]">WILD LANDS</h1>
            <p className="text-indigo-300 font-bold tracking-[0.4em] text-xs mt-2 uppercase">{t.tagline}</p>
          </div>
          
          {!showNewGameConfirm ? (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
              <MenuButton label={t.continue} onClick={() => setView('game')} disabled={!hasSave} primary />
              <MenuButton label={t.newGame} onClick={() => hasSave ? setShowNewGameConfirm(true) : startNewGame()} />
              <MenuButton label={t.settings} onClick={() => setView('settings')} />
            </div>
          ) : (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300 p-8 bg-slate-900/60 rounded-3xl border border-red-500/20 max-w-sm text-center">
              <p className="text-red-400 font-black mb-6 uppercase tracking-widest">{t.resetProgress}?</p>
              <MenuButton label={t.newGame} onClick={startNewGame} danger />
              <MenuButton label={t.close} onClick={() => setShowNewGameConfirm(false)} />
            </div>
          )}
        </div>
      )}

      {view === 'settings' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-3xl">
          <div className="bg-slate-900/50 p-8 rounded-3xl border border-white/10 w-80 shadow-2xl">
            <h2 className="text-2xl font-black mb-6 border-b border-white/10 pb-2 text-indigo-400">{t.settings}</h2>
            <div className="space-y-6 mb-8">
              <div className="flex justify-between items-center">
                 <span className="text-sm font-bold">{t.language}</span>
                 <button 
                  onClick={() => setGameState(p => ({ ...p, settings: { ...p.settings, language: p.settings.language === 'tr' ? 'en' : 'tr' }}))}
                  className="bg-indigo-600 px-4 py-1 rounded-lg text-xs font-black"
                 >
                   {gameState.settings.language.toUpperCase()}
                 </button>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-sm font-bold">SFX</span>
                 <button 
                  onClick={() => setGameState(p => ({ ...p, settings: { ...p.settings, sfxEnabled: !p.settings.sfxEnabled }}))}
                  className={`${gameState.settings.sfxEnabled ? 'bg-green-600' : 'bg-red-600'} px-4 py-1 rounded-lg text-xs font-black`}
                 >
                   {gameState.settings.sfxEnabled ? 'ON' : 'OFF'}
                 </button>
              </div>
            </div>
            <button onClick={() => setView('menu')} className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-black text-sm uppercase tracking-widest">{t.close}</button>
          </div>
        </div>
      )}

      {isGameOver && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black text-red-600 backdrop-blur-xl">
          <h1 className="text-9xl font-black mb-8 italic tracking-tighter">ÖLDÜN</h1>
          <p className="mb-12 text-xl font-medium text-red-400/80">{t.wildernessReclaimed}</p>
          <button onClick={() => window.location.reload()} className="px-12 py-5 bg-red-600 text-white rounded-2xl font-black text-2xl hover:bg-red-500 transition-colors shadow-[0_0_50px_rgba(220,38,38,0.4)]">{t.tryAgain}</button>
        </div>
      )}
    </div>
  );
};

export default App;
