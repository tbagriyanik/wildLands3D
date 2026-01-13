
import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameScene, { GameSceneHandle } from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import { GameState, InteractionTarget, MobileInput, InventoryItem } from './types';
import { INITIAL_STATS, SURVIVAL_DECAY_RATES, TRANSLATIONS, SFX_URLS } from './constants';

const SAVE_KEY = 'wildlands_survival_v18';

// Priority sorting for items: Tools > Cooked Food > Raw Food > Resources
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
  return [...items].sort((a, b) => {
    const pA = ITEM_PRIORITY[a.name] || 0;
    const pB = ITEM_PRIORITY[b.name] || 0;
    return pB - pA;
  });
};

const App: React.FC = () => {
  const [view, setView] = useState<'menu' | 'game' | 'settings'>('menu');
  const [isMobile, setIsMobile] = useState(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  
  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...parsed, 
          settings: parsed.settings || { language: 'en', musicEnabled: true, sfxEnabled: true },
          campfires: parsed.campfires || [],
          activeTool: null,
          inventory: sortInventory(parsed.inventory || [])
        };
      } catch (e) { console.error("Save load failed:", e); }
    }
    return {
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
      settings: { language: 'en', musicEnabled: true, sfxEnabled: true },
      weather: 'sunny',
      campfires: []
    };
  });

  const [interaction, setInteraction] = useState<InteractionTarget>({ type: 'none' });
  const [isGameOver, setIsGameOver] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showTodoList, setShowTodoList] = useState(true);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [cookingItem, setCookingItem] = useState<string | null>(null);
  
  const todoTimeoutRef = useRef<number | null>(null);
  const cookingTimeoutRef = useRef<number | null>(null);
  
  const [movementStatus, setMovementStatus] = useState({ moving: false, sprinting: false });
  const [mobileInput, setMobileInput] = useState<MobileInput>({ moveX: 0, moveY: 0, lookX: 0, lookY: 0, jump: false, sprint: false, interact: false, attack: false });
  
  const playerInfoRef = useRef({ x: 120, z: 120, dirX: 0, dirZ: -1 });
  const [isHungerCritical, setIsHungerCritical] = useState(false);
  const [isThirstCritical, setIsThirstCritical] = useState(false);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const lastCriticalSoundRef = useRef({ hunger: 0, thirst: 0 });
  
  const menuAudioRef = useRef<HTMLAudioElement | null>(null);
  const gameAudioRef = useRef<HTMLAudioElement | null>(null);
  const sceneRef = useRef<GameSceneHandle>(null);
  const t = TRANSLATIONS[gameState.settings.language];

  const equippedItem = gameState.inventory.find(i => i.id === activeToolId);
  const isBowActive = equippedItem?.name === 'Bow';
  const isTorchActive = equippedItem?.name === 'Torch';
  const arrowCount = gameState.inventory.find(i => i.name === 'Arrow')?.count || 0;

  useEffect(() => {
    if (showTodoList) {
      if (todoTimeoutRef.current) window.clearTimeout(todoTimeoutRef.current);
      todoTimeoutRef.current = window.setTimeout(() => {
        setShowTodoList(false);
      }, 10000);
    }
    return () => {
      if (todoTimeoutRef.current) window.clearTimeout(todoTimeoutRef.current);
    };
  }, [showTodoList]);

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  useEffect(() => {
    if (!menuAudioRef.current) {
      menuAudioRef.current = new Audio('https://assets.mixkit.co/music/preview/mixkit-sun-and-high-mountains-573.mp3');
      menuAudioRef.current.loop = true;
      menuAudioRef.current.volume = 0.25;
    }
    if (!gameAudioRef.current) {
      gameAudioRef.current = new Audio('https://assets.mixkit.co/music/preview/mixkit-forest-river-615.mp3');
      gameAudioRef.current.loop = true;
      gameAudioRef.current.volume = 0.15;
    }
  }, []);

  const playSFX = useCallback((url: string, volume = 0.4, randomizePitch = true) => {
    if (gameState.settings.sfxEnabled) {
      const sfx = new Audio(url);
      sfx.volume = volume;
      if (randomizePitch) sfx.playbackRate = 0.9 + Math.random() * 0.2;
      sfx.play().catch(e => console.debug("Audio play failed (waiting for interaction):", e));
    }
  }, [gameState.settings.sfxEnabled]);

  const startMusic = useCallback(() => {
    if (!gameState.settings.musicEnabled) {
      menuAudioRef.current?.pause();
      gameAudioRef.current?.pause();
      return;
    }

    if (view === 'menu' || view === 'settings') {
      gameAudioRef.current?.pause();
      if (menuAudioRef.current?.paused) menuAudioRef.current.play().catch(() => {});
    } else if (view === 'game') {
      menuAudioRef.current?.pause();
      if (isLocked || isMobile) {
        if (gameAudioRef.current?.paused) gameAudioRef.current?.play().catch(() => {});
      } else {
        gameAudioRef.current?.pause();
      }
    }
  }, [gameState.settings.musicEnabled, view, isLocked, isMobile]);

  useEffect(() => { startMusic(); }, [startMusic, view, isLocked, gameState.settings.musicEnabled]);

  const handleUseItem = useCallback((itemId: string) => {
    setGameState(prev => {
      const item = prev.inventory.find(i => i.id === itemId);
      if (!item) return prev;
      
      if (item.name === 'Bow' || item.name === 'Torch') {
        setActiveToolId(current => current === itemId ? null : itemId);
        playSFX(SFX_URLS.collect_item_generic, 0.4);
        return prev;
      }

      let newStats = { ...prev.stats };
      let consumed = false;
      
      if (item.name === 'Berries' || item.name === 'Cooked Berries') { 
        newStats.hunger = Math.min(100, newStats.hunger + (item.name === 'Berries' ? 15 : 30)); 
        newStats.thirst = Math.min(100, newStats.thirst + 5);
        consumed = true; 
        playSFX(SFX_URLS.eat_crunchy, 0.5);
      } else if (item.name === 'Apple' || item.name === 'Roasted Apple') { 
        newStats.hunger = Math.min(100, newStats.hunger + (item.name === 'Apple' ? 25 : 50)); 
        newStats.thirst = Math.min(100, newStats.thirst + 10);
        consumed = true; 
        playSFX(SFX_URLS.eat_crunchy, 0.5);
      } else if (item.name === 'Raw Meat') {
        newStats.hunger = Math.min(100, newStats.hunger + 10);
        newStats.health = Math.max(0, newStats.health - 5); 
        consumed = true;
        playSFX(SFX_URLS.eat_crunchy, 0.5);
      } else if (item.name === 'Cooked Meat') {
        newStats.hunger = Math.min(100, newStats.hunger + 60);
        newStats.health = Math.min(100, newStats.health + 15);
        consumed = true;
        playSFX(SFX_URLS.eat_crunchy, 0.5);
      }

      if (!consumed) return prev;
      const newInventory = prev.inventory.map(i => i.id === itemId ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
      return { ...prev, stats: newStats, inventory: sortInventory(newInventory) };
    });
  }, [playSFX]);

  const handleCollect = (type: string) => {
    let sfxUrl = SFX_URLS.collect_wood;
    let vol = 0.3;
    if (type === 'Wood') { sfxUrl = SFX_URLS.collect_wood; vol = 0.6; }
    else if (type === 'Stone') { sfxUrl = SFX_URLS.collect_stone; vol = 0.5; }
    else if (type === 'Raw Meat' || type === 'rabbit' || type === 'partridge' || type === 'critter') { 
      sfxUrl = SFX_URLS.collect_meat; 
      vol = 0.6; 
      type = 'Raw Meat';
    } else {
      sfxUrl = SFX_URLS.collect_item_generic;
      vol = 0.4;
    }
    playSFX(sfxUrl, vol);
    setGameState(prev => {
      const inv = [...prev.inventory];
      const item = inv.find(i => i.name === type);
      if (item) item.count++;
      else inv.push({ id: Math.random().toString(), name: type, type: type === 'Wood' || type === 'Stone' || type === 'Arrow' ? 'resource' : 'food', count: 1 });
      return { ...prev, inventory: sortInventory(inv) };
    });
  };

  const handleDrink = () => {
    playSFX(SFX_URLS.drink_splash, 0.4);
    setTimeout(() => playSFX(SFX_URLS.drink_swallow, 0.6), 200);
    setGameState(prev => ({ 
      ...prev, 
      stats: { ...prev.stats, thirst: Math.min(100, prev.stats.thirst + 20) } 
    }));
  };

  const handleCraft = useCallback((type: 'campfire' | 'arrows' | 'bow' | 'torch') => {
    setGameState(prev => {
      const wood = prev.inventory.find(i => i.name === 'Wood');
      const flint = prev.inventory.find(i => i.name === 'Flint Stone');
      let newInventory = [...prev.inventory];
      let crafted = false;

      if (type === 'campfire') {
        if (wood && wood.count >= 3 && flint && flint.count >= 1) {
          playSFX(SFX_URLS.campfire_craft, 0.5);
          newInventory = newInventory.map(item => item.name === 'Wood' ? { ...item, count: item.count - 3 } : item);
          newInventory = newInventory.map(item => item.name === 'Flint Stone' ? { ...item, count: item.count - 1 } : item).filter(i => i.count > 0);
          crafted = true;
          const spawnX = playerInfoRef.current.x + playerInfoRef.current.dirX * 2.5;
          const spawnZ = playerInfoRef.current.z + playerInfoRef.current.dirZ * 2.5;
          return { ...prev, inventory: sortInventory(newInventory), campfires: [...prev.campfires, { id: Math.random().toString(), x: spawnX, z: spawnZ }]};
        }
      } else if (type === 'arrows') {
        if (wood && wood.count >= 1) {
          playSFX(SFX_URLS.collect_item_generic, 0.5);
          newInventory = newInventory.map(i => i.name === 'Wood' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
          const arrowItem = newInventory.find(i => i.name === 'Arrow');
          if (arrowItem) arrowItem.count += 5;
          else newInventory.push({ id: Math.random().toString(), name: 'Arrow', type: 'resource', count: 5 });
          crafted = true;
        }
      } else if (type === 'bow') {
        if (!prev.inventory.some(i => i.name === 'Bow') && wood && wood.count >= 3) {
          playSFX(SFX_URLS.collect_item_generic, 0.6);
          newInventory = newInventory.map(i => i.name === 'Wood' ? { ...i, count: i.count - 3 } : i).filter(i => i.count > 0);
          newInventory.push({ id: Math.random().toString(), name: 'Bow', type: 'tool', count: 1 });
          crafted = true;
        }
      } else if (type === 'torch') {
        if (!prev.inventory.some(i => i.name === 'Torch') && wood && wood.count >= 1 && flint && flint.count >= 1) {
          playSFX(SFX_URLS.torch_light, 0.7);
          newInventory = newInventory.map(item => item.name === 'Wood' ? { ...item, count: item.count - 1 } : item);
          newInventory = newInventory.map(item => item.name === 'Flint Stone' ? { ...item, count: item.count - 1 } : item).filter(i => i.count > 0);
          newInventory.push({ id: Math.random().toString(), name: 'Torch', type: 'tool', count: 1 });
          crafted = true;
        }
      }
      return crafted ? { ...prev, inventory: sortInventory(newInventory) } : prev;
    });
  }, [playSFX]);

  const handleCook = useCallback(() => {
    if (cookingTimeoutRef.current) return;
    
    const rawMeat = gameState.inventory.find(i => i.name === 'Raw Meat');
    const apple = gameState.inventory.find(i => i.name === 'Apple');
    const berries = gameState.inventory.find(i => i.name === 'Berries');
    
    if (!rawMeat && !apple && !berries) return;
    
    const target = rawMeat ? 'Raw Meat' : (apple ? 'Apple' : 'Berries');
    setCookingItem(target);
    
    playSFX(SFX_URLS.campfire_cook, 0.4);
    cookingTimeoutRef.current = window.setTimeout(() => {
      setGameState(prev => {
        let newInventory = [...prev.inventory];
        if (target === 'Raw Meat') {
          newInventory = newInventory.map(i => i.name === 'Raw Meat' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
          const existing = newInventory.find(i => i.name === 'Cooked Meat');
          if (existing) existing.count++;
          else newInventory.push({ id: Math.random().toString(), name: 'Cooked Meat', type: 'food', count: 1 });
        } else if (target === 'Apple') {
          newInventory = newInventory.map(i => i.name === 'Apple' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
          const existing = newInventory.find(i => i.name === 'Roasted Apple');
          if (existing) existing.count++;
          else newInventory.push({ id: Math.random().toString(), name: 'Roasted Apple', type: 'food', count: 1 });
        } else if (target === 'Berries') {
          newInventory = newInventory.map(i => i.name === 'Berries' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
          const existing = newInventory.find(i => i.name === 'Cooked Berries');
          if (existing) existing.count++;
          else newInventory.push({ id: Math.random().toString(), name: 'Cooked Berries', type: 'food', count: 1 });
        }
        return { ...prev, inventory: sortInventory(newInventory) };
      });
      setCookingItem(null);
      cookingTimeoutRef.current = null;
    }, 1500);
  }, [gameState.inventory, playSFX]);

  const handleShoot = useCallback(() => {
    setGameState(prev => {
      const newInventory = prev.inventory.map(i => i.name === 'Arrow' ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
      return { ...prev, inventory: sortInventory(newInventory) };
    });
  }, []);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (view === 'game') {
        if (e.key === 'Escape') { setView('menu'); return; }
        if (e.key.toLowerCase() === 'c') { handleCraft('campfire'); return; }
        if (e.key.toLowerCase() === 'x') { handleCraft('arrows'); return; }
        if (e.key.toLowerCase() === 'v') { handleCraft('bow'); return; }
        if (e.key.toLowerCase() === 't') { handleCraft('torch'); return; }
        if (e.key.toLowerCase() === 'i') { setShowTodoList(prev => !prev); return; }
        const keyNum = parseInt(e.key);
        if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 9) {
          const item = gameState.inventory[keyNum - 1];
          if (item) handleUseItem(item.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [view, gameState.inventory, handleUseItem, handleCraft]);

  useEffect(() => {
    if (view !== 'game' || (!isLocked && !isMobile)) return;
    const interval = setInterval(() => {
      setGameState(prev => {
        if (prev.stats.health <= 0) return prev;
        const now = Date.now();
        const newStats = { ...prev.stats };
        
        newStats.hunger = Math.max(0, newStats.hunger - SURVIVAL_DECAY_RATES.hunger);
        newStats.thirst = Math.max(0, newStats.thirst - SURVIVAL_DECAY_RATES.thirst);
        
        let currentEnergyDelta = -SURVIVAL_DECAY_RATES.energy_base;
        if (movementStatus.moving) {
          const loss = movementStatus.sprinting ? SURVIVAL_DECAY_RATES.energy_sprint : SURVIVAL_DECAY_RATES.energy_walk;
          currentEnergyDelta -= loss;
        } else {
          currentEnergyDelta += SURVIVAL_DECAY_RATES.energy_recovery;
        }

        const campfireDistances = prev.campfires.map(cf => {
          const dx = cf.x - playerInfoRef.current.x;
          const dz = cf.z - playerInfoRef.current.z;
          return Math.sqrt(dx*dx + dz*dz);
        });
        const minDistanceToFire = campfireDistances.length > 0 ? Math.min(...campfireDistances) : Infinity;
        
        const maxWarmthRange = 12.0;
        const isNight = prev.time > 1900 || prev.time < 500;
        const environmentalDrop = isNight ? SURVIVAL_DECAY_RATES.temp_night_drop : SURVIVAL_DECAY_RATES.temp_day_drop;

        if (minDistanceToFire < maxWarmthRange) {
          setIsWarmingUp(true);
          const warmthFactor = 1.0 - (minDistanceToFire / maxWarmthRange);
          const fireGain = warmthFactor * SURVIVAL_DECAY_RATES.temp_fire_gain * 2.5; 
          newStats.temperature = Math.min(38.5, newStats.temperature - environmentalDrop + fireGain);
          currentEnergyDelta += (warmthFactor * SURVIVAL_DECAY_RATES.energy_fire_gain * 2.0);
        } else {
          setIsWarmingUp(false);
          newStats.temperature = Math.max(10, newStats.temperature - environmentalDrop);
        }

        newStats.energy = Math.max(0, Math.min(100, newStats.energy + currentEnergyDelta));

        if (newStats.hunger <= 0 || newStats.thirst <= 0 || newStats.energy <= 0 || newStats.temperature < 15) {
          newStats.health = Math.max(0, newStats.health - 1.2);
        } else if (newStats.hunger > 60 && newStats.thirst > 60 && newStats.energy > 40 && newStats.temperature > 15) {
          newStats.health = Math.min(100, newStats.health + 0.15);
        }
        
        const hungerCrit = newStats.hunger <= 15;
        const thirstCrit = newStats.thirst <= 15;
        
        if (hungerCrit) {
          setIsHungerCritical(true);
          if (now - lastCriticalSoundRef.current.hunger > 10000) {
            playSFX(SFX_URLS.hunger_critical, 0.8);
            lastCriticalSoundRef.current.hunger = now;
          }
        } else setIsHungerCritical(false);

        if (thirstCrit) {
          setIsThirstCritical(true);
          if (now - lastCriticalSoundRef.current.thirst > 10000) {
            playSFX(SFX_URLS.thirst_critical, 0.8);
            lastCriticalSoundRef.current.thirst = now;
          }
        } else setIsThirstCritical(false);

        if (newStats.health <= 0) setIsGameOver(true);
        
        let newTime = prev.time + 12.0; 
        let newDay = prev.day;
        if (newTime >= 2400) { newTime = 0; newDay++; }
        
        let newWeather = prev.weather;
        if (Math.random() < 0.005) newWeather = Math.random() < 0.3 ? 'rainy' : 'sunny';
        
        return { ...prev, stats: newStats, time: newTime, day: newDay, weather: newWeather };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [view, isLocked, movementStatus, playSFX, isMobile]);

  const restartGame = () => {
    const newState: GameState = {
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
      settings: gameState.settings,
      weather: 'sunny',
      campfires: []
    };
    playerInfoRef.current = { x: 120, z: 120, dirX: 0, dirZ: -1 };
    setActiveToolId(null);
    setGameState(newState);
    setIsGameOver(false);
    setIsHungerCritical(false);
    setIsThirstCritical(false);
    setIsWarmingUp(false);
    lastCriticalSoundRef.current = { hunger: 0, thirst: 0 };
    setView('game');
    setShowTodoList(true);
    playSFX(SFX_URLS.ui_click);
  };

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden bg-slate-950 text-white font-sans select-none" 
      onClick={() => { 
        if (view === 'game' && !isMobile) sceneRef.current?.requestLock(); 
        startMusic(); 
      }}
    >
      {view === 'game' && (
        <>
          <GameScene 
            ref={sceneRef}
            onInteract={setInteraction} 
            onCollect={handleCollect} 
            onDrink={handleDrink}
            onMovementChange={setMovementStatus}
            onPositionUpdate={(info) => { 
              playerInfoRef.current = info;
              const angle = Math.atan2(info.dirX, info.dirZ);
              setPlayerRotation(angle);
            }}
            onLockChange={setIsLocked}
            onCook={handleCook}
            onShoot={handleShoot}
            isBowActive={isBowActive}
            isTorchActive={isTorchActive}
            arrowCount={arrowCount}
            time={gameState.time}
            weather={gameState.weather}
            isLocked={isLocked}
            isMobile={isMobile}
            mobileInput={mobileInput}
            sfxEnabled={gameState.settings.sfxEnabled}
            campfires={gameState.campfires}
          />
          <UIOverlay 
            gameState={gameState} 
            interaction={interaction}
            onUseItem={handleUseItem}
            isVisible={isLocked || isMobile}
            onCraft={handleCraft}
            onCook={handleCook}
            cookingItem={cookingItem}
            isHungerCritical={isHungerCritical}
            isThirstCritical={isThirstCritical}
            isWarmingUp={isWarmingUp}
            showTodoList={showTodoList}
            isMobile={isMobile}
            onMobileInput={setMobileInput}
            playerRotation={playerRotation}
            activeToolId={activeToolId}
          />
        </>
      )}

      {view === 'menu' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950 p-4 overflow-hidden">
          <div className="text-center w-full max-w-5xl animate-in fade-in zoom-in duration-700 px-4">
            <h1 className="text-6xl sm:text-8xl md:text-9xl lg:text-[12rem] font-black mb-4 tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-400 to-slate-800 drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] uppercase leading-[0.85] text-center select-none">
              WILD <br/> LANDS
            </h1>
            <p className="text-indigo-500 font-mono tracking-[1em] sm:tracking-[1.5em] mb-8 sm:mb-16 opacity-80 uppercase text-[10px] sm:text-sm">{t.tagline}</p>
            <div className="flex flex-col gap-4 sm:gap-5 max-w-xs sm:max-w-md mx-auto">
              <button 
                onClick={() => { setView('game'); playSFX(SFX_URLS.ui_click); }} 
                className="group relative py-4 sm:py-6 bg-white text-slate-950 font-black rounded-2xl sm:rounded-[2rem] hover:bg-indigo-50 transition-all shadow-[0_10px_40px_rgba(255,255,255,0.1)] text-lg sm:text-xl uppercase tracking-widest overflow-hidden"
              >
                <span className="relative z-10">{t.continue}</span>
                <div className="absolute inset-0 bg-indigo-100 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </button>
              <button onClick={restartGame} className="py-3 sm:py-5 bg-slate-900/50 hover:bg-slate-800 font-bold rounded-2xl sm:rounded-[2rem] border border-white/10 transition-all uppercase tracking-widest text-white/70 hover:text-white text-sm sm:text-base">{t.newGame}</button>
              <button onClick={() => { setView('settings'); playSFX(SFX_URLS.ui_click); }} className="py-3 sm:py-5 bg-slate-900/50 hover:bg-slate-800 font-bold rounded-2xl sm:rounded-[2rem] border border-white/10 transition-all uppercase tracking-widest text-white/70 hover:text-white text-sm sm:text-base">{t.settings}</button>
            </div>
          </div>
        </div>
      )}

      {view === 'settings' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4 sm:p-6">
          <div className="w-full max-w-md p-8 sm:p-12 bg-slate-900/80 border border-white/5 rounded-[2rem] sm:rounded-[3rem] shadow-2xl">
            <h2 className="text-3xl sm:text-4xl font-black mb-8 sm:mb-12 tracking-tight text-center uppercase text-white/90">{t.settings}</h2>
            <div className="flex flex-col gap-4 sm:gap-6">
              <button onClick={() => { setGameState(p => ({...p, settings: {...p.settings, language: p.settings.language === 'en' ? 'tr' : 'en'}})); playSFX(SFX_URLS.ui_click); }} className="flex justify-between items-center p-6 sm:p-8 bg-white/5 rounded-2xl sm:rounded-3xl border border-white/5 hover:bg-white/10 transition-all">
                <span className="text-slate-500 font-black uppercase text-[10px] sm:text-xs tracking-widest">{t.language}</span>
                <span className="font-black uppercase text-indigo-400 text-base sm:text-lg">{gameState.settings.language}</span>
              </button>
              <button onClick={() => { setGameState(p => ({...p, settings: {...p.settings, musicEnabled: !p.settings.musicEnabled}})); playSFX(SFX_URLS.ui_click); }} className="flex justify-between items-center p-6 sm:p-8 bg-white/5 rounded-2xl sm:rounded-3xl border border-white/5 hover:bg-white/10 transition-all">
                <span className="text-slate-500 font-black uppercase text-[10px] sm:text-xs tracking-widest">{t.music}</span>
                <span className={`font-black text-base sm:text-lg ${gameState.settings.musicEnabled ? 'text-green-400' : 'text-slate-600'}`}>{gameState.settings.musicEnabled ? t.on : t.off}</span>
              </button>
              <button onClick={() => { setGameState(p => ({...p, settings: {...p.settings, sfxEnabled: !p.settings.sfxEnabled}})); playSFX(SFX_URLS.ui_click); }} className="flex justify-between items-center p-6 sm:p-8 bg-white/5 rounded-2xl sm:rounded-3xl border border-white/5 hover:bg-white/10 transition-all">
                <span className="text-slate-500 font-black uppercase text-[10px] sm:text-xs tracking-widest">{t.sfx}</span>
                <span className={`font-black text-base sm:text-lg ${gameState.settings.sfxEnabled ? 'text-green-400' : 'text-slate-600'}`}>{gameState.settings.sfxEnabled ? t.on : t.off}</span>
              </button>
            </div>
            <button onClick={() => { setView('menu'); playSFX(SFX_URLS.ui_click); }} className="w-full mt-10 sm:mt-14 py-4 sm:py-6 bg-indigo-600 text-white font-black rounded-2xl sm:rounded-3xl hover:bg-indigo-500 transition-all shadow-xl uppercase tracking-[0.2em]">{t.close}</button>
          </div>
        </div>
      )}

      {isGameOver && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black p-4">
          <div className="text-center w-full max-w-lg p-10 sm:p-16 bg-red-950/10 border border-red-500/30 rounded-[3rem] sm:rounded-[4rem] shadow-2xl backdrop-blur-2xl">
            <h1 className="text-5xl sm:text-7xl md:text-8xl font-black text-red-600 mb-6 sm:mb-8 tracking-tighter uppercase italic drop-shadow-[0_0_30px_rgba(220,38,38,0.5)]">{t.youDied}</h1>
            <p className="text-slate-400 mb-10 sm:16 font-medium leading-relaxed uppercase text-xs sm:text-sm tracking-widest">{t.wildernessReclaimed}</p>
            <button onClick={restartGame} className="w-full py-5 sm:py-7 bg-red-600 text-white font-black rounded-2xl sm:rounded-[2.5rem] transition-all shadow-2xl hover:bg-red-500 active:scale-95 uppercase tracking-widest text-lg sm:text-xl">{t.tryAgain}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
