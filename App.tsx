
import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameScene, { GameSceneHandle } from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import { GameState, InteractionTarget, MobileInput, InventoryItem } from './types';
import { INITIAL_STATS, SURVIVAL_DECAY_RATES, TRANSLATIONS, SFX_URLS, ITEM_LIMITS } from './constants';

const SAVE_KEY = 'wildlands_survival_v34';

const ITEM_PRIORITY: Record<string, number> = {
  'Bow': 100,
  'Torch': 99,
  'Waterskin (Full)': 95,
  'Waterskin (Empty)': 94,
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

const getItemType = (name: string): 'resource' | 'food' | 'tool' => {
  if (['Bow', 'Torch', 'Waterskin (Empty)', 'Waterskin (Full)'].includes(name)) return 'tool';
  if (['Apple', 'Berries', 'Raw Meat', 'Cooked Meat', 'Roasted Apple'].includes(name)) return 'food';
  return 'resource';
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
  const [notifications, setNotifications] = useState<{id: number, text: string, icon: string}[]>([]);
  
  const playerInfoRef = useRef({ x: 120, y: 1.8, z: 120, dirX: 0, dirZ: -1 });

  const addNotification = useCallback((text: string, icon: string) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, text, icon }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

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
    time: 700, // Sabah 07:00'da başlasın
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

  // Oyun başında "C" tuşu ipucunu göster
  useEffect(() => {
    if (view === 'game' && !isGameOver) {
      const timer = setTimeout(() => {
        addNotification('craftHint', '🛠️');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [view, isGameOver, addNotification]);

  const playSFX = useCallback((url: string, volume = 0.4) => {
    if (gameState.settings.sfxEnabled) {
      const sfx = new Audio(url);
      sfx.volume = volume;
      sfx.play().catch(() => {});
    }
  }, [gameState.settings.sfxEnabled]);

  const toggleLanguage = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      settings: { ...prev.settings, language: prev.settings.language === 'tr' ? 'en' : 'tr' }
    }));
    playSFX(SFX_URLS.ui_click);
  }, [playSFX]);

  const handleUseItem = useCallback((itemId: string) => {
    setGameState(prev => {
      if (itemId === 'campfire') {
        let newInv = [...prev.inventory];
        let rawMeatIndex = newInv.findIndex(i => i.name === 'Raw Meat');
        let appleIndex = newInv.findIndex(i => i.name === 'Apple');
        
        if (rawMeatIndex !== -1) {
          playSFX(SFX_URLS.campfire_cook);
          if (newInv[rawMeatIndex].count > 1) newInv[rawMeatIndex] = { ...newInv[rawMeatIndex], count: newInv[rawMeatIndex].count - 1 };
          else newInv.splice(rawMeatIndex, 1);
          let cookedIndex = newInv.findIndex(i => i.name === 'Cooked Meat');
          if (cookedIndex !== -1) newInv[cookedIndex].count++;
          else newInv.push({ id: 'cooked_' + Date.now(), name: 'Cooked Meat', type: 'food', count: 1 });
          addNotification('Cooked Meat', '🍖');
          return { ...prev, inventory: sortInventory(newInv) };
        } else if (appleIndex !== -1) {
          playSFX(SFX_URLS.campfire_cook);
          if (newInv[appleIndex].count > 1) newInv[appleIndex] = { ...newInv[appleIndex], count: newInv[appleIndex].count - 1 };
          else newInv.splice(appleIndex, 1);
          let roastedIndex = newInv.findIndex(i => i.name === 'Roasted Apple');
          if (roastedIndex !== -1) newInv[roastedIndex].count++;
          else newInv.push({ id: 'roasted_' + Date.now(), name: 'Roasted Apple', type: 'food', count: 1 });
          addNotification('Roasted Apple', '🍎');
          return { ...prev, inventory: sortInventory(newInv) };
        }
        return prev;
      }

      const itemIndex = prev.inventory.findIndex(i => i.id === itemId);
      if (itemIndex === -1) return prev;
      const item = prev.inventory[itemIndex];
      
      if (item.name === 'Bow' || item.name === 'Torch') {
        setActiveToolId(current => (current !== itemId ? itemId : null));
        if (activeToolId !== itemId && item.name === 'Torch') playSFX(SFX_URLS.torch_light);
        return prev;
      }

      if (item.name === 'Waterskin (Full)') {
        playSFX(SFX_URLS.drink_swallow);
        const newInv = [...prev.inventory];
        newInv[itemIndex] = { ...newInv[itemIndex], name: 'Waterskin (Empty)' };
        addNotification('thirstQuenched', '💧');
        return { ...prev, stats: { ...prev.stats, thirst: Math.min(100, prev.stats.thirst + 40) }, inventory: sortInventory(newInv) };
      }

      const consumableEffects: Record<string, Partial<GameState['stats']>> = {
        'Apple': { hunger: 15, thirst: 10 },
        'Roasted Apple': { hunger: 25, thirst: 3 },
        'Cooked Meat': { hunger: 55 },
        'Raw Meat': { hunger: 12, health: -8 },
        'Berries': { hunger: 10, thirst: 15 }
      };

      const effect = consumableEffects[item.name];
      if (effect) {
        playSFX(SFX_URLS.eat_crunchy);
        const newStats = { ...prev.stats };
        Object.keys(effect).forEach((key) => {
          const k = key as keyof typeof newStats;
          newStats[k] = Math.max(0, Math.min(100, (newStats[k] || 0) + (effect[k] || 0)));
        });
        const newInv = [...prev.inventory];
        if (newInv[itemIndex].count > 1) newInv[itemIndex] = { ...newInv[itemIndex], count: newInv[itemIndex].count - 1 };
        else newInv.splice(itemIndex, 1);
        return { ...prev, stats: newStats, inventory: sortInventory(newInv) };
      }
      return prev;
    });
  }, [playSFX, activeToolId, addNotification]);

  const onDrinkFromLake = useCallback(() => {
    setGameState(prev => {
      let newInv = [...prev.inventory];
      let waterskinIdx = newInv.findIndex(i => i.name === 'Waterskin (Empty)');
      if (waterskinIdx !== -1) {
        newInv[waterskinIdx] = { ...newInv[waterskinIdx], name: 'Waterskin (Full)' };
        addNotification('WaterskinFull', '🍶');
      } else {
        addNotification('thirstQuenched', '💧');
      }
      playSFX(SFX_URLS.drink_swallow);
      return { ...prev, stats: { ...prev.stats, thirst: Math.min(100, prev.stats.thirst + 20) }, inventory: sortInventory(newInv) };
    });
  }, [playSFX, addNotification]);

  const onCollectItem = useCallback((name: string, icon: string) => {
    setGameState(prev => {
      const inv = [...prev.inventory];
      const type = getItemType(name);
      const limit = ITEM_LIMITS[type as keyof typeof ITEM_LIMITS] || 30;
      // Stacking logic updated to allow tools to stack if they aren't at limit
      const existing = inv.find(i => i.name === name && i.count < limit);
      if (existing) {
        existing.count++;
      } else {
        if (inv.length >= 25) { addNotification('inventoryFull', '⚠️'); return prev; }
        inv.push({ id: Math.random().toString(), name, type, count: 1 });
      }
      addNotification(name, icon);
      return { ...prev, inventory: sortInventory(inv) };
    });
  }, [addNotification]);

  const handleCraft = useCallback((type: string) => {
    setGameState(prev => {
      const inv = [...prev.inventory];
      const woodItem = inv.find(i => i.name === 'Wood');
      const flintItem = inv.find(i => i.name === 'Flint Stone');
      const woodCount = woodItem?.count || 0;
      const flintCount = flintItem?.count || 0;

      const consumeResource = (name: string, count: number) => {
        const idx = inv.findIndex(i => i.name === name);
        if (idx !== -1) {
          if (inv[idx].count > count) {
            inv[idx] = { ...inv[idx], count: inv[idx].count - count };
          } else {
            inv.splice(idx, 1);
          }
        }
      };

      if (type === 'campfire' && woodCount >= 3 && flintCount >= 1) {
        consumeResource('Wood', 3);
        consumeResource('Flint Stone', 1);
        playSFX(SFX_URLS.campfire_craft);
        const newCampfire = {
          id: Math.random().toString(),
          x: playerInfoRef.current.x + playerInfoRef.current.dirX * 2,
          z: playerInfoRef.current.z + playerInfoRef.current.dirZ * 2
        };
        addNotification('campfireAdded', '🔥');
        setIsCraftingOpen(false); // Ateş yakınca menüyü kapat
        return { ...prev, inventory: sortInventory(inv), campfires: [...prev.campfires, newCampfire] };
      }

      if (type === 'arrows' && woodCount >= 1) {
        consumeResource('Wood', 1);
        playSFX(SFX_URLS.collect_item_generic);
        const arrowIdx = inv.findIndex(i => i.name === 'Arrow');
        if (arrowIdx !== -1) {
          inv[arrowIdx] = { ...inv[arrowIdx], count: inv[arrowIdx].count + 5 };
        } else {
          inv.push({ id: Math.random().toString(), name: 'Arrow', type: 'resource', count: 5 });
        }
        addNotification('Arrow', '🏹');
        return { ...prev, inventory: sortInventory(inv) };
      }

      if (type === 'bow' && woodCount >= 3) {
        consumeResource('Wood', 3);
        playSFX(SFX_URLS.collect_item_generic);
        const existing = inv.find(i => i.name === 'Bow');
        if (existing && existing.count < ITEM_LIMITS.tool) {
            existing.count++;
        } else {
            inv.push({ id: Math.random().toString(), name: 'Bow', type: 'tool', count: 1 });
        }
        addNotification('Bow', '🏹');
        return { ...prev, inventory: sortInventory(inv) };
      }

      if (type === 'torch' && woodCount >= 1 && flintCount >= 1) {
        consumeResource('Wood', 1);
        consumeResource('Flint Stone', 1);
        playSFX(SFX_URLS.torch_light);
        const existing = inv.find(i => i.name === 'Torch');
        if (existing && existing.count < ITEM_LIMITS.tool) {
            existing.count++;
        } else {
            inv.push({ id: Math.random().toString(), name: 'Torch', type: 'tool', count: 1 });
        }
        addNotification('Torch', '🔦');
        return { ...prev, inventory: sortInventory(inv) };
      }

      if (type === 'waterskin' && woodCount >= 2) {
        consumeResource('Wood', 2);
        playSFX(SFX_URLS.collect_item_generic);
        const existing = inv.find(i => i.name === 'Waterskin (Empty)');
        if (existing && existing.count < ITEM_LIMITS.tool) {
            existing.count++;
        } else {
            inv.push({ id: Math.random().toString(), name: 'Waterskin (Empty)', type: 'tool', count: 1 });
        }
        addNotification('Waterskin', '🍶');
        return { ...prev, inventory: sortInventory(inv) };
      }

      return prev;
    });
  }, [playSFX, addNotification]);

  useEffect(() => {
    if (view !== 'game' || isGameOver) return;
    const interval = setInterval(() => {
      setGameState(prev => {
        if (prev.stats.health <= 0) { setIsGameOver(true); return prev; }
        const stats = { ...prev.stats };
        stats.hunger = Math.max(0, stats.hunger - SURVIVAL_DECAY_RATES.hunger);
        stats.thirst = Math.max(0, stats.thirst - SURVIVAL_DECAY_RATES.thirst);
        const isNight = prev.time > 1900 || prev.time < 500;
        let tempDelta = isNight ? -SURVIVAL_DECAY_RATES.temp_night_drop : -SURVIVAL_DECAY_RATES.temp_day_drop;
        let nearFire = false;
        prev.campfires.forEach(cf => {
           const dist = Math.sqrt(Math.pow(playerInfoRef.current.x - cf.x, 2) + Math.pow(playerInfoRef.current.z - cf.z, 2));
           if (dist < 8) { 
             tempDelta += SURVIVAL_DECAY_RATES.temp_fire_gain * Math.max(0, (8 - dist) / 8);
             nearFire = true;
           }
        });
        setIsWarmingUp(nearFire && tempDelta > 0);
        stats.temperature = Math.max(0, Math.min(100, stats.temperature + tempDelta));
        if (stats.hunger < 5 || stats.thirst < 5 || stats.temperature < 15) stats.health -= 0.4;
        let newTime = prev.time + 1;
        if (newTime >= 2400) { newTime = 0; }
        return { ...prev, stats, time: newTime, day: newTime === 0 ? prev.day + 1 : prev.day };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [view, isGameOver, isLocked, isMobile]);

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  const startNewGame = () => { localStorage.removeItem(SAVE_KEY); setGameState(getInitialState()); setGameKey(prev => prev + 1); setView('game'); setShowNewGameConfirm(false); setIsGameOver(false); };

  return (
    <div className="w-screen h-screen bg-slate-950 text-white font-sans overflow-hidden">
      <GameScene 
        key={gameKey} ref={sceneRef} initialPosition={gameState.playerPosition} initialRotation={gameState.playerRotation}
        onInteract={setInteraction} 
        onCollect={(t) => {
          const icons: Record<string, string> = { Apple: '🍎', Wood: '🪵', Stone: '🪨', Berries: '🍒', 'Raw Meat': '🥩', Arrow: '🏹', 'Flint Stone': '🔥' };
          onCollectItem(t, icons[t] || '📦');
        }}
        onDrink={onDrinkFromLake}
        onPositionUpdate={(info) => { playerInfoRef.current = info; setPlayerRotation(Math.atan2(info.dirX, info.dirZ)); }}
        onLockChange={setIsLocked} onCook={() => handleUseItem('campfire')}
        onShoot={() => setGameState(p => ({ ...p, inventory: p.inventory.map(i => i.name === 'Arrow' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0) }))}
        isBowActive={gameState.inventory.find(i => i.id === activeToolId)?.name === 'Bow'}
        isTorchActive={gameState.inventory.find(i => i.id === activeToolId)?.name === 'Torch'}
        arrowCount={gameState.inventory.find(i => i.name === 'Arrow')?.count || 0}
        time={gameState.time} weather={gameState.weather} isLocked={isLocked} isMobile={isMobile} mobileInput={mobileInput}
        sfxEnabled={gameState.settings.sfxEnabled} campfires={gameState.campfires} isCraftingOpen={isCraftingOpen}
        onToggleCrafting={() => setIsCraftingOpen(prev => !prev)}
      />
      <UIOverlay 
        gameState={gameState} interaction={interaction} onUseItem={handleUseItem} onCraft={handleCraft} isVisible={view === 'game'} 
        isCraftingOpen={isCraftingOpen} setIsCraftingOpen={setIsCraftingOpen} playerRotation={playerRotation} 
        activeToolId={activeToolId} onMobileInput={setMobileInput} isMobile={isMobile} onCook={() => handleUseItem('campfire')} cookingItem={null} 
        isHungerCritical={gameState.stats.hunger < 20} isThirstCritical={gameState.stats.thirst < 20} isWarmingUp={isWarmingUp} showTodoList={true} 
        onToggleLanguage={toggleLanguage}
      />
      
      <div className="fixed bottom-32 left-8 z-[200] flex flex-col-reverse gap-2 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className="bg-indigo-600/90 backdrop-blur-xl px-4 py-3 rounded-2xl border border-white/20 shadow-2xl animate-in slide-in-from-left fade-in zoom-in-95 duration-500 flex items-center gap-3 pointer-events-auto">
             <span className="text-2xl">{n.icon}</span>
             <span className="text-xs font-black uppercase tracking-widest text-white drop-shadow-md">
               {t[n.text as keyof typeof t] || n.text} { (n.text.includes('Hint') || n.text.includes('Added')) ? '' : TRANSLATIONS[gameState.settings.language].collected }
             </span>
          </div>
        ))}
      </div>

      {view === 'menu' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-2xl pointer-events-auto">
          <div className="mb-12 text-center animate-in zoom-in-95 duration-700">
            <h1 className="text-8xl font-black italic tracking-tighter text-indigo-500 drop-shadow-[0_0_30px_rgba(99,102,241,0.4)]">WILD LANDS</h1>
            <p className="text-indigo-300 font-bold tracking-[0.4em] text-xs mt-2 uppercase">{t.tagline}</p>
          </div>
          <div className="flex flex-col items-center">
            <button onClick={() => setView('game')} disabled={!hasSave} className={`w-64 py-4 rounded-xl font-black text-xl mb-4 bg-indigo-600 hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-20`}>{t.continue}</button>
            <button onClick={() => hasSave ? setShowNewGameConfirm(true) : startNewGame()} className="w-64 py-4 rounded-xl font-black text-xl mb-4 bg-white/10 hover:bg-white/20 transition-all active:scale-95">{t.newGame}</button>
          </div>
          {showNewGameConfirm && (
            <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-8 z-[60] animate-in zoom-in-95">
               <p className="text-red-400 font-black mb-6 uppercase tracking-widest text-center">{t.resetProgress}?<br/><span className="text-xs text-white/40">Tüm ilerlemeniz silinecek.</span></p>
               <button onClick={startNewGame} className="w-64 py-4 bg-red-600 rounded-xl font-black text-xl mb-4 hover:bg-red-500 active:scale-95 transition-all">{t.newGame}</button>
               <button onClick={() => setShowNewGameConfirm(false)} className="w-64 py-4 bg-white/10 rounded-xl font-black text-xl hover:bg-white/20 active:scale-95 transition-all">{t.close}</button>
            </div>
          )}
        </div>
      )}
      {isGameOver && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black text-red-600 animate-in fade-in duration-1000">
          <h1 className="text-9xl font-black mb-8 italic">ÖLDÜN</h1>
          <button onClick={() => window.location.reload()} className="px-12 py-5 bg-red-600 text-white rounded-2xl font-black text-2xl active:scale-90 transition-transform">{t.tryAgain}</button>
        </div>
      )}
    </div>
  );
};

export default App;
