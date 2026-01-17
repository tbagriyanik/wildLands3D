
import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameScene, { GameSceneHandle } from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import { GameState, InteractionTarget, MobileInput } from './types';
import { INITIAL_STATS, SURVIVAL_DECAY_RATES, TRANSLATIONS, SFX_URLS, MUSIC_URL, TIME_TICK_RATE } from './constants';

const SAVE_KEY = 'wildlands_survival_v6.4.3'; 
const VERSION = 'v6.4.3 "Precision & Clarity"';
const SPAWN_X = 160; 
const CENTER_Z = 120;
const LAKE_POS = { x: 220, z: 180, radius: 45 };

interface Notification {
  id: number;
  text: string;
}

const App: React.FC = () => {
  const [view, setView] = useState<'menu' | 'game' | 'loading'>('loading');
  const [activeSlot, setActiveSlot] = useState<number | null>(null); 
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isMobile] = useState(/Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent));
  const [isCraftingOpen, setIsCraftingOpen] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const [interaction, setInteraction] = useState<InteractionTarget>({ type: 'none' });
  const [mobileInput, setMobileInput] = useState<MobileInput>({
    moveX: 0, moveY: 0, lookX: 0, lookY: 0, jump: false, sprint: false, interact: false, attack: false
  });

  const playerInfoRef = useRef({ x: SPAWN_X, y: 1.8, z: CENTER_Z, dirX: 0, dirZ: -1, rot: 0 });
  const sceneRef = useRef<GameSceneHandle>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  useEffect(() => {
    const urls = [MUSIC_URL, ...Object.values(SFX_URLS)];
    let loadedCount = 0;
    urls.forEach(url => {
      const audio = new Audio();
      audio.oncanplaythrough = () => {
        loadedCount++;
        setLoadingProgress(Math.floor((loadedCount / urls.length) * 100));
        if (loadedCount === urls.length) setView('menu');
      };
      audio.onerror = () => {
        loadedCount++;
        if (loadedCount === urls.length) setView('menu');
      };
      audio.src = url;
      audio.load();
    });
  }, []);

  const getInitialState = (): GameState => ({
    stats: { ...INITIAL_STATS },
    inventory: [
      { id: '1', name: 'Wood', type: 'resource', count: 100 },
      { id: '2', name: 'Stone', type: 'resource', count: 100 },
      { id: '3', name: 'Flint Stone', type: 'resource', count: 10 },
      { id: '4', name: 'Arrow', type: 'resource', count: 12 },
      { id: '5', name: 'Bow', type: 'tool', count: 1 }
    ],
    xp: 0,
    day: 1, time: 800, settings: { language: 'tr', musicEnabled: true, sfxEnabled: true },
    weather: 'sunny', campfires: [], shelters: [], playerPosition: { x: SPAWN_X, y: 1.8, z: CENTER_Z }, playerRotation: 0,
    activeTorch: false, activeBow: false, torchLife: 100
  });

  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.playerPosition) {
          playerInfoRef.current = { ...parsed.playerPosition, dirX: 0, dirZ: -1, rot: parsed.playerRotation || 0 };
          return parsed;
        }
      }
    } catch (e) { localStorage.removeItem(SAVE_KEY); }
    return getInitialState();
  });

  // Otomatik Kayıt Sistemi (Her 5 saniyede bir konumu ve dünyayı kaydet)
  useEffect(() => {
    if (view !== 'game') return;
    const saveTimer = setInterval(() => {
      setGameState(prev => {
        const stateToSave = {
          ...prev,
          playerPosition: { ...playerInfoRef.current },
          playerRotation: playerRotation
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
        return stateToSave;
      });
    }, 5000);
    return () => clearInterval(saveTimer);
  }, [view, playerRotation]);

  const addNotification = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, text }].slice(-5));
    setTimeout(() => { 
      setNotifications(prev => prev.filter(n => n.id !== id)); 
    }, 4000);
  }, []);

  const playSFX = useCallback((url: string, volume = 0.4) => {
    if (gameState.settings.sfxEnabled) {
      const sfx = new Audio(url); sfx.volume = volume;
      sfx.play().catch(() => {});
    }
  }, [gameState.settings.sfxEnabled]);

  const handleUseItem = useCallback((itemIdOrName: string) => {
    setGameState(prev => {
      const index = prev.inventory.findIndex(i => i.id === itemIdOrName || i.name === itemIdOrName);
      if (index === -1) return prev;
      const item = prev.inventory[index];
      const stats = { ...prev.stats };
      let consumed = false;

      if (item.name === 'Meat') { stats.hunger = Math.min(100, stats.hunger + 15); stats.health = Math.max(0, stats.health - 5); playSFX(SFX_URLS.eat_crunchy); consumed = true; }
      else if (item.name === 'Cooked Meat') { stats.hunger = Math.min(100, stats.hunger + 55); stats.health = Math.min(100, stats.health + 25); stats.energy = Math.min(100, stats.energy + 20); playSFX(SFX_URLS.eat_crunchy); consumed = true; }
      else if (item.name === 'Fruit') { stats.hunger = Math.min(100, stats.hunger + 12); stats.thirst = Math.min(100, stats.thirst + 8); playSFX(SFX_URLS.eat_crunchy); consumed = true; }
      else if (item.name === 'Cooked Fruit') { stats.hunger = Math.min(100, stats.hunger + 35); stats.thirst = Math.min(100, stats.thirst + 15); stats.health = Math.min(100, stats.health + 10); stats.energy = Math.min(100, stats.energy + 10); playSFX(SFX_URLS.eat_crunchy); consumed = true; }
      else if (item.name === 'Water' || item.name === 'Waterskin') { 
        if (stats.thirst >= 100 && item.name !== 'Waterskin') return prev; 
        stats.thirst = Math.min(100, stats.thirst + 40); 
        playSFX(SFX_URLS.drink_swallow); 
        if (item.name === 'Water') consumed = true; 
      }

      if (consumed) {
        const newInv = [...prev.inventory];
        if (newInv[index].count > 1) newInv[index] = { ...newInv[index], count: newInv[index].count - 1 };
        else newInv.splice(index, 1);
        return { ...prev, stats, inventory: newInv };
      }
      return prev;
    });
  }, [playSFX]);

  const handleCraft = useCallback((type: string) => {
    setGameState(prev => {
      const getCount = (name: string) => prev.inventory.find(i => i.name === name)?.count || 0;
      const nearestFireIndex = prev.campfires.findIndex(cf => Math.sqrt(Math.pow(playerInfoRef.current.x - cf.x, 2) + Math.pow(playerInfoRef.current.z - cf.z, 2)) < 8);
      const nearestShelterIndex = prev.shelters.findIndex(sh => Math.sqrt(Math.pow(playerInfoRef.current.x - sh.x, 2) + Math.pow(playerInfoRef.current.z - sh.z, 2)) < 6);
      const isNearFire = nearestFireIndex > -1 || nearestShelterIndex > -1;
      let success = false; let cost: Record<string, number> = {}; let resultName = ""; let fuelCost = 0; let xpGain = 15;

      if (type === 'campfire' && getCount('Wood') >= 3 && getCount('Flint Stone') >= 1) { success = true; cost = { 'Wood': 3, 'Flint Stone': 1 }; xpGain = 20; }
      else if (type === 'shelter' && getCount('Wood') >= 30 && getCount('Stone') >= 20) { success = true; cost = { 'Wood': 30, 'Stone': 20 }; xpGain = 100; }
      else if (type === 'bow' && getCount('Wood') >= 5) { success = true; cost = { 'Wood': 5 }; resultName = "Bow"; xpGain = 40; }
      else if (type === 'arrow' && getCount('Wood') >= 1 && getCount('Stone') >= 1) { success = true; cost = { 'Wood': 1, 'Stone': 1 }; resultName = "Arrow"; xpGain = 5; }
      else if (type === 'waterskin' && getCount('Wood') >= 2) { success = true; cost = { 'Wood': 2 }; resultName = "Waterskin"; xpGain = 10; }
      else if (type === 'torch' && getCount('Wood') >= 1 && getCount('Flint Stone') >= 1) { success = true; cost = { 'Wood': 1, 'Flint Stone': 1 }; resultName = "Torch"; xpGain = 15; }
      else if (type === 'cook_meat' && getCount('Meat') >= 1 && isNearFire) { success = true; cost = { 'Meat': 1 }; resultName = "Cooked Meat"; fuelCost = 50; xpGain = 20; }
      else if (type === 'cook_fruit' && getCount('Fruit') >= 1 && isNearFire) { success = true; cost = { 'Fruit': 1 }; resultName = "Cooked Fruit"; fuelCost = 30; xpGain = 10; }
      
      if (success) {
        playSFX(SFX_URLS.campfire_craft);
        let newInv = prev.inventory.map(item => cost[item.name] ? { ...item, count: item.count - cost[item.name] } : item).filter(item => item.count > 0);
        let newFires = [...prev.campfires];
        if (fuelCost > 0 && nearestFireIndex > -1) { newFires[nearestFireIndex].life = Math.max(0, newFires[nearestFireIndex].life - fuelCost); }
        
        if (type === 'campfire') {
          const spawnDist = 2.5; const spawnX = playerInfoRef.current.x + playerInfoRef.current.dirX * spawnDist; const spawnZ = playerInfoRef.current.z + playerInfoRef.current.dirZ * spawnDist;
          return { ...prev, xp: prev.xp + xpGain, inventory: newInv, campfires: [...prev.campfires, { id: Date.now().toString(), x: spawnX, z: spawnZ, life: 800 }] };
        } else if (type === 'shelter') {
          const upgradeRadius = 6.5;
          const spawnDist = 4.5; 
          const targetX = playerInfoRef.current.x + playerInfoRef.current.dirX * spawnDist; 
          const targetZ = playerInfoRef.current.z + playerInfoRef.current.dirZ * spawnDist;
          const nearShelterIdx = prev.shelters.findIndex(sh => Math.sqrt(Math.pow(targetX - sh.x, 2) + Math.pow(targetZ - sh.z, 2)) < upgradeRadius);
          
          if (nearShelterIdx > -1) {
            const updatedShelters = [...prev.shelters];
            const currentTier = updatedShelters[nearShelterIdx].tier;
            if (currentTier < 3) {
              updatedShelters[nearShelterIdx] = { ...updatedShelters[nearShelterIdx], tier: currentTier + 1 };
              addNotification(prev.settings.language === 'tr' ? 'Barınak Geliştirildi!' : 'Shelter Upgraded!');
              return { ...prev, xp: prev.xp + xpGain * 1.5, inventory: newInv, shelters: updatedShelters };
            }
          }
          return { ...prev, xp: prev.xp + xpGain, inventory: newInv, shelters: [...prev.shelters, { id: Date.now().toString(), x: targetX, z: targetZ, rotation: playerRotation + Math.PI, tier: 1 }] };
        } else if (type === 'torch') {
            const existingIdx = newInv.findIndex(i => i.name === resultName);
            if (existingIdx > -1) newInv[existingIdx].count += 1; else newInv.push({ id: Math.random().toString(), name: resultName, type: 'tool', count: 1 });
            return { ...prev, xp: prev.xp + xpGain, inventory: newInv, torchLife: 100 };
        } else {
          const existingIdx = newInv.findIndex(i => i.name === resultName);
          if (existingIdx > -1) newInv[existingIdx].count += 1; else newInv.push({ id: Math.random().toString(), name: resultName, type: resultName.includes('Cooked') ? 'food' : 'tool', count: 1 });
          addNotification((TRANSLATIONS[prev.settings.language][resultName === 'Cooked Meat' ? 'meat' : 'fruit'] || resultName) + " " + (prev.settings.language === 'tr' ? 'Pişirildi' : 'Cooked'));
          return { ...prev, xp: prev.xp + xpGain, inventory: newInv, campfires: newFires };
        }
      }
      return prev;
    });
  }, [playSFX, addNotification, playerRotation]);

  const handleCraftMenuToggle = useCallback((forceState?: boolean) => {
    const nextState = forceState !== undefined ? forceState : !isCraftingOpen;
    setIsCraftingOpen(nextState);
    if (!nextState) { setTimeout(() => sceneRef.current?.requestLock(), 50); } 
    else { sceneRef.current?.requestUnlock(); }
  }, [isCraftingOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view === 'loading' || isSleeping) return;
      if (e.code === 'Escape') {
        if (isCraftingOpen) { handleCraftMenuToggle(false); } 
        else if (view === 'menu') { setView('game'); setTimeout(() => sceneRef.current?.requestLock(), 200); } 
        else { setView('menu'); sceneRef.current?.requestUnlock(); }
        return;
      }
      if (view !== 'game') return;
      if (e.code === 'KeyC' || e.code === 'Tab') { e.preventDefault(); handleCraftMenuToggle(); return; }
      if (isCraftingOpen) return;
      if (e.code === 'KeyE') { sceneRef.current?.interact(); return; }
      if (interaction.type === 'campfire' || interaction.type === 'shelter') {
        if (e.code === 'KeyF') { handleCraft('cook_meat'); return; }
        if (e.code === 'KeyG') { handleCraft('cook_fruit'); return; }
      }
      const code = e.code;
      if (code.startsWith('Digit')) {
        const slot = parseInt(code.replace('Digit', ''));
        if (slot >= 1 && slot <= 7) {
          setActiveSlot(slot);
          setTimeout(() => setActiveSlot(null), 150);
          switch(slot) {
            case 1: if (gameState.inventory.some(i => i.name === 'Bow')) setGameState(p => ({ ...p, activeBow: !p.activeBow, activeTorch: false })); break;
            case 2: if (gameState.inventory.some(i => i.name === 'Torch')) setGameState(p => ({ ...p, activeTorch: p.torchLife > 0 ? !p.activeTorch : false, activeBow: false })); break;
            case 3: handleUseItem('Waterskin'); handleUseItem('Water'); break;
            case 4: handleUseItem('Meat'); break;
            case 5: handleUseItem('Fruit'); break;
            case 6: handleUseItem('Cooked Meat'); break;
            case 7: handleUseItem('Cooked Fruit'); break;
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, isCraftingOpen, isSleeping, gameState.inventory, interaction.type, gameState.torchLife, handleUseItem, handleCraftMenuToggle, handleCraft]);

  useEffect(() => {
    if (view !== 'game') return;
    const timer = setInterval(() => {
      setGameState(prev => {
        const stats = { ...prev.stats };
        stats.hunger = Math.max(0, stats.hunger - SURVIVAL_DECAY_RATES.hunger);
        stats.thirst = Math.max(0, stats.thirst - SURVIVAL_DECAY_RATES.thirst);
        stats.energy = Math.max(0, stats.energy - SURVIVAL_DECAY_RATES.energy_base);
        stats.dirtiness = Math.min(100, stats.dirtiness + SURVIVAL_DECAY_RATES.dirtiness_gain);

        const distToLake = Math.sqrt(Math.pow(playerInfoRef.current.x - LAKE_POS.x, 2) + Math.pow(playerInfoRef.current.z - LAKE_POS.z, 2));
        const isInWater = distToLake < LAKE_POS.radius;
        if (isInWater) {
          stats.dirtiness = Math.max(0, stats.dirtiness - 2.5);
          stats.temperature = Math.max(5, stats.temperature - 0.3);
        }

        let newTorchLife = prev.torchLife;
        let isActiveTorch = prev.activeTorch;
        if (isActiveTorch) {
          newTorchLife = Math.max(0, newTorchLife - 0.15);
          if (newTorchLife <= 0) {
            isActiveTorch = false;
            addNotification(prev.settings.language === 'tr' ? 'Meşale Bitti!' : 'Torch Burned Out!');
          }
        }

        const updatedFires = prev.campfires.map(f => ({ ...f, life: f.life - (TIME_TICK_RATE / 4) })).filter(f => f.life > 0);
        let minFireDist = Infinity;
        updatedFires.forEach(cf => {
          const d = Math.sqrt(Math.pow(playerInfoRef.current.x - cf.x, 2) + Math.pow(playerInfoRef.current.z - cf.z, 2));
          if (d < minFireDist) minFireDist = d;
        });
        
        let minShelterDist = Infinity;
        let activeShelterTier = 1;
        prev.shelters.forEach(sh => {
          const d = Math.sqrt(Math.pow(playerInfoRef.current.x - sh.x, 2) + Math.pow(playerInfoRef.current.z - sh.z, 2));
          if (d < minShelterDist) { minShelterDist = d; activeShelterTier = sh.tier; }
        });

        const cycle = (prev.time - 400 + 2400) % 2400; 
        const cycleNormal = Math.sin((cycle / 2400) * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5;
        const isDayTime = prev.time >= 500 && prev.time <= 1900;
        let targetAmbient = (isDayTime ? 15 : 0) + cycleNormal * (isDayTime ? 10 : 10);

        const isNearFire = minFireDist < 8;
        const isNearShelter = minShelterDist < 6;
        if (isNearFire || isNearShelter) {
          const proximityMult = Math.max(0, 1 - (Math.min(minFireDist, minShelterDist) / 8));
          const warmthBonus = isNearFire ? SURVIVAL_DECAY_RATES.temp_fire_bonus : (SURVIVAL_DECAY_RATES.temp_fire_bonus * 0.5 * activeShelterTier);
          targetAmbient += (warmthBonus * proximityMult);
          stats.health = Math.min(100, stats.health + 0.4 * proximityMult);
          stats.energy = Math.min(100, stats.energy + 0.6 * proximityMult);
        }
        stats.temperature += (targetAmbient - stats.temperature) * SURVIVAL_DECAY_RATES.temp_lerp_speed;

        let healthPenalty = 0;
        if (stats.hunger < 10) healthPenalty += 0.4;
        if (stats.thirst < 10) healthPenalty += 0.6;
        if (stats.dirtiness > 85) healthPenalty += 0.15;
        if (stats.temperature < 10) healthPenalty += (10 - stats.temperature) * 0.1;
        
        stats.health = Math.max(0, stats.health - healthPenalty);
        if (stats.health <= 0) setIsGameOver(true);

        let newTime = prev.time + TIME_TICK_RATE;
        if (newTime >= 2400) newTime = 0;
        return { ...prev, stats, time: newTime, day: newTime < prev.time ? prev.day + 1 : prev.day, campfires: updatedFires, playerPosition: { ...playerInfoRef.current }, torchLife: newTorchLife, activeTorch: isActiveTorch };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [view, addNotification]);

  const handleCollect = useCallback((type: string) => {
    setGameState(prev => {
      const t = TRANSLATIONS[prev.settings.language];
      if (type === 'Sleep') {
        setIsSleeping(true); playSFX(SFX_URLS.ui_click);
        setNotifications([]); 
        setTimeout(() => {
          setGameState(p => {
            let nextTime = p.time + 500; let nextDay = p.day;
            if (nextTime >= 2400) { nextTime -= 2400; nextDay += 1; }
            return { ...p, xp: p.xp + 50, time: nextTime, day: nextDay, stats: { ...p.stats, health: 100, energy: 100, temperature: 25 } };
          });
          addNotification(t.sleep + " (+5h)");
        }, 1500);
        setTimeout(() => setIsSleeping(false), 3000);
        return prev;
      }
      if (type === 'Water') {
        const waterskinCount = prev.inventory.find(i => i.name === 'Waterskin')?.count || 0;
        const currentWaterCount = prev.inventory.find(i => i.name === 'Water')?.count || 0;
        if (waterskinCount > 0) {
          if (currentWaterCount >= waterskinCount) { addNotification(t.waterskin + " " + (prev.settings.language === 'tr' ? 'ZATEN DOLU' : 'ALREADY FULL')); return prev; }
          playSFX(SFX_URLS.drink_swallow); addNotification(`${waterskinCount} ${t.waterskin} ${prev.settings.language === 'tr' ? 'Dolduruldu' : 'Filled'}`);
          const inv = [...prev.inventory]; const waterIdx = inv.findIndex(i => i.name === 'Water');
          if (waterIdx > -1) { inv[waterIdx] = { ...inv[waterIdx], count: waterskinCount }; } 
          else { inv.push({ id: Math.random().toString(), name: 'Water', type: 'food', count: waterskinCount }); }
          return { ...prev, xp: prev.xp + 5, inventory: inv };
        } else {
          playSFX(SFX_URLS.drink_swallow); addNotification(t.water + " " + t.collected);
          return { ...prev, xp: prev.xp + 5, stats: { ...prev.stats, thirst: Math.min(100, prev.stats.thirst + 40) } };
        }
      }
      playSFX(type === 'Wood' ? SFX_URLS.collect_wood : type === 'Stone' ? SFX_URLS.collect_stone : SFX_URLS.ui_click);
      const isFruit = ['Apple', 'Pear', 'Berries'].includes(type); const effectiveType = isFruit ? 'Fruit' : type;
      addNotification((t[type.toLowerCase() as keyof typeof t] || type) + " " + t.collected);
      let inv = [...prev.inventory]; let xpGain = type === 'Meat' ? 50 : (isFruit ? 5 : 10);
      const addItem = (currentInv: any[], name: string) => {
        const idx = currentInv.findIndex(i => i.name === name);
        if (idx > -1) { currentInv[idx] = { ...currentInv[idx], count: currentInv[idx].count + 1 }; } 
        else { currentInv.push({ id: Math.random().toString(), name, type: ['Meat', 'Fruit'].includes(name) ? 'food' : 'resource', count: 1 }); }
      };
      addItem(inv, effectiveType);
      if (type === 'Stone' && Math.random() < 0.35) { addItem(inv, 'Flint Stone'); addNotification(prev.settings.language === 'tr' ? 'Çakmak Taşı Bulundu!' : 'Found Flint Stone!'); }
      return { ...prev, xp: prev.xp + xpGain, inventory: inv };
    });
  }, [playSFX, addNotification]);

  const handleShoot = useCallback(() => {
    setGameState(prev => {
      const arrowIdx = prev.inventory.findIndex(i => i.name === 'Arrow');
      if (arrowIdx === -1) return prev;
      playSFX(SFX_URLS.arrow_shoot); const newInv = [...prev.inventory];
      if (newInv[arrowIdx].count > 1) newInv[arrowIdx].count -= 1; else newInv.splice(arrowIdx, 1);
      return { ...prev, inventory: newInv };
    });
  }, [playSFX]);

  const [isGameOver, setIsGameOver] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const startNewGame = useCallback(() => { localStorage.removeItem(SAVE_KEY); window.location.reload(); }, []);
  const setLanguage = (lang: 'tr' | 'en') => { setGameState(prev => ({ ...prev, settings: { ...prev.settings, language: lang } })); playSFX(SFX_URLS.ui_click); };
  const t = TRANSLATIONS[gameState.settings.language];

  return (
    <div className="w-screen h-screen bg-slate-950 text-white font-sans overflow-hidden select-none">
      {view === 'loading' && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950">
           <div className="text-4xl font-black italic mb-4 text-orange-500 animate-pulse uppercase tracking-tighter">WILD LANDS</div>
           <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${loadingProgress}%` }} /></div>
        </div>
      )}
      {view !== 'loading' && (
        <>
          <GameScene 
            ref={sceneRef} day={gameState.day} time={gameState.time} campfires={gameState.campfires} shelters={gameState.shelters} isLocked={isLocked} isMobile={isMobile}
            mobileInput={mobileInput} activeTorch={gameState.activeTorch} activeBow={gameState.activeBow} hasArrows={gameState.inventory.some(i => i.name === 'Arrow')}
            onLockChange={setIsLocked} onInteract={setInteraction} onPositionUpdate={info => { playerInfoRef.current = { ...info }; setPlayerRotation(info.rot); }}
            onCollect={handleCollect} onShoot={handleShoot} initialPosition={gameState.playerPosition}
            onClean={() => setGameState(p => ({ ...p, stats: { ...p.stats, dirtiness: Math.max(0, p.stats.dirtiness - 1) } }))}
          />
          <UIOverlay 
            gameState={gameState} interaction={interaction} isVisible={view === 'game'} isCraftingOpen={isCraftingOpen}
            activeSlot={activeSlot} setIsCraftingOpen={handleCraftMenuToggle} onCraft={handleCraft} onUseItem={handleUseItem}
            playerRotation={playerRotation} notifications={notifications} onToggleLanguage={() => setLanguage(gameState.settings.language === 'tr' ? 'en' : 'tr')}
            setMobileInput={setMobileInput} isMobile={isMobile}
            isNearFire={gameState.campfires.some(cf => Math.sqrt(Math.pow(playerInfoRef.current.x - cf.x, 2) + Math.pow(playerInfoRef.current.z - cf.z, 2)) < 8) || gameState.shelters.some(sh => Math.sqrt(Math.pow(playerInfoRef.current.x - sh.x, 2) + Math.pow(playerInfoRef.current.z - sh.z, 2)) < 6)}
          />
          <div className={`fixed inset-0 bg-black z-[1000] pointer-events-none transition-opacity duration-[1500ms] ${isSleeping ? 'opacity-100' : 'opacity-0'}`} />
          {view === 'menu' && (
            <div className="absolute inset-0 z-[100] bg-slate-950/40 backdrop-blur-xl flex flex-col items-center justify-center p-8 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/20 to-slate-950 pointer-events-none" />
                <div className="flex flex-col items-center animate-in zoom-in fade-in duration-500 relative z-10">
                  <h1 className="text-[6rem] sm:text-[10rem] leading-none font-black italic mb-2 text-orange-500 tracking-tighter drop-shadow-[0_0_50px_rgba(249,115,22,0.4)] text-center">WILD LANDS</h1>
                  <p className="text-white/40 font-black uppercase tracking-[0.3em] sm:tracking-[0.5em] mb-12 sm:mb-16 text-sm sm:text-lg text-center px-4">{t.slogan}</p>
                  <div className="flex gap-4 mb-8 sm:mb-12 pointer-events-auto">
                    <button onClick={() => setLanguage('tr')} className={`px-4 py-2 rounded-xl font-black border transition-all ${gameState.settings.language === 'tr' ? 'bg-orange-600 border-orange-400 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}>TR</button>
                    <button onClick={() => setLanguage('en')} className={`px-4 py-2 rounded-xl font-black border transition-all ${gameState.settings.language === 'en' ? 'bg-orange-600 border-orange-400 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}>EN</button>
                  </div>
                  <div className="flex flex-col gap-5 w-64 sm:w-80 pointer-events-auto">
                    <button onClick={() => { setView('game'); setTimeout(() => sceneRef.current?.requestLock(), 200); }} className="group relative py-5 sm:py-6 bg-emerald-600 rounded-2xl sm:rounded-3xl font-black text-xl sm:text-2xl overflow-hidden hover:scale-105 hover:bg-emerald-500 transition-all shadow-[0_20px_40px_rgba(16,185,129,0.3)]">
                      <span className="relative z-10">{t.continue}</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full duration-1000 transition-transform" />
                    </button>
                    <button onClick={startNewGame} className="py-4 sm:py-5 bg-white/5 border border-orange-500/20 rounded-2xl sm:rounded-3xl font-black text-lg sm:text-xl hover:bg-orange-500/10 transition-all text-orange-200 backdrop-blur-md">{t.newGame}</button>
                  </div>
                  <p className="absolute -bottom-24 sm:-bottom-32 text-[8px] sm:text-[10px] font-black tracking-widest text-white/20 uppercase">{VERSION}</p>
                </div>
            </div>
          )}
          {isGameOver && (
            <div className="absolute inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in duration-700">
              <h1 className="text-6xl sm:text-9xl font-black italic text-red-600 mb-8 uppercase tracking-tighter scale-110 drop-shadow-[0_0_30px_rgba(220,38,38,0.5)]">{t.youDied}</h1>
              <button onClick={startNewGame} className="px-12 py-5 sm:px-16 sm:py-6 bg-red-600 text-white rounded-2xl sm:rounded-3xl font-black text-2xl sm:text-3xl hover:scale-110 pointer-events-auto transition-transform shadow-2xl">RESTART</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
export default App;
