
import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameScene, { GameSceneHandle } from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import { GameState, InteractionTarget, MobileInput } from './types';
import { INITIAL_STATS, SURVIVAL_DECAY_RATES, TRANSLATIONS, SFX_URLS, MUSIC_URL, TIME_TICK_RATE } from './constants';

const SAVE_KEY = 'wildlands_survival_v5.3'; 
const VERSION = 'v5.3.4 "Stable Explorer"';
const SPAWN_X = 160; 
const CENTER_Z = 120;

interface Notification {
  id: number;
  text: string;
}

const App: React.FC = () => {
  const [view, setView] = useState<'menu' | 'game' | 'loading'>('loading');
  const [menuTab, setMenuTab] = useState<'main' | 'settings'>('main');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isMobile] = useState(/Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent));
  const [isCraftingOpen, setIsCraftingOpen] = useState(false);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Define interaction state to track what the player is looking at
  const [interaction, setInteraction] = useState<InteractionTarget>({ type: 'none' });
  // Define mobileInput state for touch controls
  const [mobileInput] = useState<MobileInput>({
    moveX: 0, moveY: 0, lookX: 0, lookY: 0, jump: false, sprint: false, interact: false, attack: false
  });

  const playerInfoRef = useRef({ x: SPAWN_X, y: 1.8, z: CENTER_Z, dirX: 0, dirZ: -1, rot: 0 });
  const sceneRef = useRef<GameSceneHandle>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);

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
      { id: '1', name: 'Wood', type: 'resource', count: 20 },
      { id: '2', name: 'Flint Stone', type: 'resource', count: 10 },
      { id: '3', name: 'Arrow', type: 'resource', count: 8 },
      { id: '4', name: 'Bow', type: 'tool', count: 1 }
    ],
    day: 1, time: 800, settings: { language: 'tr', musicEnabled: true, sfxEnabled: true },
    weather: 'sunny', campfires: [], playerPosition: { x: SPAWN_X, y: 1.8, z: CENTER_Z }, playerRotation: 0,
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
    } catch (e) { 
      localStorage.removeItem(SAVE_KEY);
    }
    return getInitialState();
  });

  const addNotification = useCallback((text: string) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, text }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 2500);
  }, []);

  useEffect(() => {
    if (!musicRef.current) {
      musicRef.current = new Audio(MUSIC_URL);
      musicRef.current.loop = true;
      musicRef.current.volume = 0.2;
    }
    if (gameState.settings.musicEnabled && (view === 'menu' || view === 'game')) {
      musicRef.current.play().catch(() => {});
    } else {
      musicRef.current.pause();
    }
  }, [gameState.settings.musicEnabled, view]);

  const t = TRANSLATIONS[gameState.settings.language];

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
      else if (item.name === 'Cooked Meat') { stats.hunger = Math.min(100, stats.hunger + 45); stats.health = Math.min(100, stats.health + 15); stats.energy = Math.min(100, stats.energy + 10); playSFX(SFX_URLS.eat_crunchy); consumed = true; }
      else if (['Apple', 'Pear', 'Berries'].includes(item.name)) { stats.hunger = Math.min(100, stats.hunger + 10); stats.thirst = Math.min(100, stats.thirst + 5); playSFX(SFX_URLS.eat_crunchy); consumed = true; }
      else if (item.name === 'Cooked Fruit') { stats.hunger = Math.min(100, stats.hunger + 25); stats.health = Math.min(100, stats.health + 5); playSFX(SFX_URLS.eat_crunchy); consumed = true; }
      else if (item.name === 'Water' || item.name === 'Waterskin') { if (stats.thirst >= 100) return prev; stats.thirst = Math.min(100, stats.thirst + 30); playSFX(SFX_URLS.drink_swallow); if (item.name === 'Water') consumed = true; }

      if (consumed) {
        const newInv = [...prev.inventory];
        if (newInv[index].count > 1) newInv[index] = { ...newInv[index], count: newInv[index].count - 1 };
        else newInv.splice(index, 1);
        return { ...prev, stats, inventory: newInv };
      }
      return prev;
    });
  }, [playSFX]);

  const handleCraftMenuToggle = useCallback((forceState?: boolean) => {
    const nextState = forceState !== undefined ? forceState : !isCraftingOpen;
    setIsCraftingOpen(nextState);
    if (!nextState) {
      setTimeout(() => sceneRef.current?.requestLock(), 100);
    } else {
      sceneRef.current?.requestUnlock();
    }
  }, [isCraftingOpen]);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (view !== 'game') return;
      if (e.code === 'Tab' || e.code === 'KeyC') {
        e.preventDefault();
        handleCraftMenuToggle();
        return;
      }
      if (isCraftingOpen) return;
      
      const keyMap: Record<string, () => void> = {
        'Digit1': () => {
          const hasBow = gameState.inventory.some(i => i.name === 'Bow');
          if (hasBow) setGameState(p => ({ ...p, activeBow: !p.activeBow, activeTorch: false }));
        },
        'Digit2': () => {
          const hasTorch = gameState.inventory.some(i => i.name === 'Torch');
          if (hasTorch) setGameState(p => ({ ...p, activeTorch: !p.activeTorch, activeBow: false }));
        },
        'Digit3': () => { handleUseItem('Waterskin'); handleUseItem('Water'); },
        'Digit4': () => { handleUseItem('Meat'); },
        'Digit5': () => { handleUseItem('Apple'); handleUseItem('Pear'); handleUseItem('Berries'); },
        'Digit6': () => { handleUseItem('Cooked Meat'); },
        'Digit7': () => { handleUseItem('Cooked Fruit'); },
        'Escape': () => {
          if (isCraftingOpen) handleCraftMenuToggle(false);
          else { setView('menu'); setMenuTab('main'); sceneRef.current?.requestUnlock(); }
        }
      };
      if (keyMap[e.code]) keyMap[e.code]();
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [view, isCraftingOpen, gameState.inventory, handleUseItem, handleCraftMenuToggle, gameState.activeBow, gameState.activeTorch]);

  useEffect(() => {
    if (view !== 'game') return;
    const timer = setInterval(() => {
      setGameState(prev => {
        const stats = { ...prev.stats };
        stats.hunger = Math.max(0, stats.hunger - SURVIVAL_DECAY_RATES.hunger);
        stats.thirst = Math.max(0, stats.thirst - SURVIVAL_DECAY_RATES.thirst);
        stats.energy = Math.max(0, stats.energy - SURVIVAL_DECAY_RATES.energy_base);

        const isNight = prev.time > 1900 || prev.time < 500;
        let tempDelta = isNight ? -SURVIVAL_DECAY_RATES.temp_night_drop : -SURVIVAL_DECAY_RATES.temp_day_drop;
        const updatedFires = prev.campfires.map(f => ({ ...f, life: f.life - TIME_TICK_RATE })).filter(f => f.life > 0);
        let nearFire = updatedFires.some(cf => Math.sqrt(Math.pow(playerInfoRef.current.x - cf.x, 2) + Math.pow(playerInfoRef.current.z - cf.z, 2)) < 8);

        if (nearFire) {
          tempDelta = SURVIVAL_DECAY_RATES.temp_fire_gain;
          stats.health = Math.min(100, stats.health + SURVIVAL_DECAY_RATES.health_recovery_fire);
          stats.energy = Math.min(100, stats.energy + SURVIVAL_DECAY_RATES.energy_recovery_fire);
        }

        let newTorchLife = prev.torchLife;
        let activeTorch = prev.activeTorch;
        let newInv = [...prev.inventory];
        if (activeTorch) {
          newTorchLife -= TIME_TICK_RATE; tempDelta += 0.02;
          if (newTorchLife <= 0) {
            activeTorch = false; newTorchLife = 100;
            const torchIdx = newInv.findIndex(i => i.name === 'Torch');
            if (torchIdx > -1) { if (newInv[torchIdx].count > 1) newInv[torchIdx].count -= 1; else newInv.splice(torchIdx, 1); }
          }
        }

        stats.temperature = Math.min(37.5, Math.max(20, stats.temperature + tempDelta));
        if (stats.hunger < 5 || stats.thirst < 5 || stats.temperature < 25) stats.health = Math.max(0, stats.health - 0.5);
        if (stats.health <= 0) setIsGameOver(true);

        let newTime = prev.time + TIME_TICK_RATE;
        if (newTime >= 2400) newTime = 0;
        return { ...prev, stats, time: newTime, day: newTime < prev.time ? prev.day + 1 : prev.day, campfires: updatedFires, inventory: newInv, activeTorch, torchLife: newTorchLife, playerPosition: { ...playerInfoRef.current } };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [view]);

  const handleCollect = (type: string) => {
    setGameState(prev => {
      if (type === 'Water') {
        if (prev.stats.thirst >= 100) return prev;
        const hasWaterskin = prev.inventory.some(i => i.name === 'Waterskin');
        if (!hasWaterskin) { 
          playSFX(SFX_URLS.drink_swallow); 
          addNotification(t.water + " " + t.collected);
          return { ...prev, stats: { ...prev.stats, thirst: Math.min(100, prev.stats.thirst + 40) } }; 
        }
      }
      playSFX(type === 'Wood' ? SFX_URLS.collect_wood : type === 'Stone' ? SFX_URLS.collect_stone : SFX_URLS.ui_click);
      addNotification((t[type.toLowerCase() as keyof typeof t] || type) + " " + t.collected);
      const inv = [...prev.inventory];
      const existingIdx = inv.findIndex(i => i.name === type);
      if (existingIdx > -1) inv[existingIdx] = { ...inv[existingIdx], count: inv[existingIdx].count + 1 };
      else inv.push({ id: Math.random().toString(), name: type, type: type === 'Meat' ? 'food' : 'resource', count: 1 });
      return { ...prev, inventory: inv };
    });
  };

  const handleShoot = () => {
    setGameState(prev => {
      const arrowIdx = prev.inventory.findIndex(i => i.name === 'Arrow');
      if (arrowIdx === -1) return prev;
      playSFX(SFX_URLS.arrow_shoot);
      const newInv = [...prev.inventory];
      if (newInv[arrowIdx].count > 1) newInv[arrowIdx] = { ...newInv[arrowIdx], count: newInv[arrowIdx].count - 1 };
      else newInv.splice(arrowIdx, 1);
      return { ...prev, inventory: newInv };
    });
  };

  const handleCraft = (type: string) => {
    setGameState(prev => {
      const getCount = (name: string) => prev.inventory.find(i => i.name === name)?.count || 0;
      const isNearFire = prev.campfires.some(cf => Math.sqrt(Math.pow(playerInfoRef.current.x - cf.x, 2) + Math.pow(playerInfoRef.current.z - cf.z, 2)) < 6);
      let success = false; let cost: Record<string, number> = {}; let resultName = "";
      if (type === 'campfire' && getCount('Wood') >= 3 && getCount('Flint Stone') >= 1) { success = true; cost = { 'Wood': 3, 'Flint Stone': 1 }; }
      else if (type === 'bow' && getCount('Wood') >= 5) { success = true; cost = { 'Wood': 5 }; resultName = "Bow"; }
      else if (type === 'arrow' && getCount('Wood') >= 1 && getCount('Stone') >= 1) { success = true; cost = { 'Wood': 1, 'Stone': 1 }; resultName = "Arrow"; }
      else if (type === 'waterskin' && getCount('Wood') >= 2) { success = true; cost = { 'Wood': 2 }; resultName = "Waterskin"; }
      else if (type === 'torch' && getCount('Wood') >= 1 && getCount('Flint Stone') >= 1) { success = true; cost = { 'Wood': 1, 'Flint Stone': 1 }; resultName = "Torch"; }
      else if (type === 'cook_meat' && getCount('Meat') >= 1 && isNearFire) { success = true; cost = { 'Meat': 1 }; resultName = "Cooked Meat"; }
      else if (type === 'cook_fruit' && isNearFire) { 
        const fName = getCount('Apple') > 0 ? 'Apple' : getCount('Pear') > 0 ? 'Pear' : getCount('Berries') > 0 ? 'Berries' : null;
        if (fName) { success = true; cost = { [fName]: 1 }; resultName = "Cooked Fruit"; }
      }
      if (success) {
        playSFX(type.startsWith('cook') ? SFX_URLS.eat_crunchy : SFX_URLS.campfire_craft);
        let newInv = prev.inventory.map(item => cost[item.name] ? { ...item, count: item.count - cost[item.name] } : item).filter(item => item.count > 0);
        if (type === 'campfire') {
          const spawnDist = 2.5;
          const spawnX = playerInfoRef.current.x + playerInfoRef.current.dirX * spawnDist;
          const spawnZ = playerInfoRef.current.z + playerInfoRef.current.dirZ * spawnDist;
          addNotification(t.campfire + " " + t.collected);
          return { ...prev, inventory: newInv, campfires: [...prev.campfires, { id: Date.now().toString(), x: spawnX, z: spawnZ, life: 800 }] };
        }
        else {
          addNotification(resultName + " " + t.collected);
          const existingIdx = newInv.findIndex(i => i.name === resultName);
          if (existingIdx > -1) newInv[existingIdx] = { ...newInv[existingIdx], count: newInv[existingIdx].count + 1 };
          else newInv.push({ id: Math.random().toString(), name: resultName, type: 'tool', count: 1 });
          return { ...prev, inventory: newInv };
        }
      }
      return prev;
    });
  };

  const [isGameOver, setIsGameOver] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const startNewGame = useCallback(() => { localStorage.removeItem(SAVE_KEY); window.location.reload(); }, []);

  return (
    <div className="w-screen h-screen bg-slate-950 text-white font-sans overflow-hidden">
      {view === 'loading' && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center">
           <div className="text-4xl font-black italic mb-4 text-orange-500 animate-pulse uppercase tracking-tighter">WILD LANDS V5.3</div>
           <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${loadingProgress}%` }} />
           </div>
        </div>
      )}
      {view !== 'loading' && (
        <>
          <GameScene 
            ref={sceneRef}
            time={gameState.time}
            campfires={gameState.campfires}
            isLocked={isLocked}
            isMobile={isMobile}
            mobileInput={mobileInput}
            activeTorch={gameState.activeTorch}
            activeBow={gameState.activeBow}
            hasArrows={gameState.inventory.some(i => i.name === 'Arrow')}
            onLockChange={setIsLocked}
            onInteract={setInteraction}
            onPositionUpdate={info => { playerInfoRef.current = { ...info, rot: info.rot }; setPlayerRotation(info.rot); }}
            onCollect={handleCollect}
            onShoot={handleShoot}
            initialPosition={gameState.playerPosition}
          />
          <UIOverlay 
            gameState={gameState}
            interaction={interaction}
            isVisible={view === 'game'}
            isCraftingOpen={isCraftingOpen}
            setIsCraftingOpen={handleCraftMenuToggle}
            onCraft={handleCraft}
            onUseItem={handleUseItem}
            playerRotation={playerRotation}
            notifications={notifications}
            onToggleLanguage={() => setGameState(p => ({...p, settings: {...p.settings, language: p.settings.language === 'tr' ? 'en' : 'tr'}}))}
            isNearFire={gameState.campfires.some(cf => Math.sqrt(Math.pow(playerInfoRef.current.x - cf.x, 2) + Math.pow(playerInfoRef.current.z - cf.z, 2)) < 8)}
          />
          {view === 'menu' && (
            <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-8">
              {menuTab === 'main' ? (
                <div className="flex flex-col items-center animate-in zoom-in duration-300">
                  <h1 className="text-8xl font-black italic mb-2 text-orange-500 tracking-tighter drop-shadow-2xl">WILD LANDS</h1>
                  <p className="text-white/60 font-black uppercase tracking-[0.3em] mb-4 text-sm">{t.slogan}</p>
                  <p className="text-emerald-400/40 font-black text-xs mb-12 tracking-widest">{VERSION}</p>
                  <div className="flex flex-col gap-4 w-72 pointer-events-auto">
                    <button onClick={() => setView('game')} className="py-5 bg-emerald-600 rounded-2xl font-black text-xl hover:scale-105 hover:bg-emerald-500 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]">{t.continue}</button>
                    <button onClick={startNewGame} className="py-4 bg-white/5 border border-orange-500/20 rounded-2xl font-black text-lg hover:bg-orange-500/10 transition-all text-orange-200">{t.newGame}</button>
                    <button onClick={() => setMenuTab('settings')} className="py-4 bg-white/5 border border-orange-500/20 rounded-2xl font-black text-lg hover:bg-orange-500/10 transition-all text-orange-200">{t.settings}</button>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-md bg-slate-900/90 p-10 rounded-[3rem] border border-orange-500/20 shadow-2xl animate-in fade-in slide-in-from-bottom-10 duration-300 pointer-events-auto">
                  <h2 className="text-4xl font-black italic mb-8 text-orange-500 uppercase tracking-tight">{t.settings}</h2>
                  <div className="flex flex-col gap-6 mb-12">
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                       <span className="font-black text-sm uppercase opacity-60 tracking-widest">{t.language}</span>
                       <button onClick={() => setGameState(p => ({...p, settings: {...p.settings, language: p.settings.language === 'tr' ? 'en' : 'tr'}}))} className="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs uppercase">{gameState.settings.language === 'tr' ? 'Türkçe' : 'English'}</button>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                       <span className="font-black text-sm uppercase opacity-60 tracking-widest">{t.music}</span>
                       <button onClick={() => setGameState(p => ({...p, settings: {...p.settings, musicEnabled: !p.settings.musicEnabled}}))} className={`px-4 py-2 rounded-xl font-black text-xs uppercase transition-colors ${gameState.settings.musicEnabled ? 'bg-emerald-600' : 'bg-red-500/20 text-red-400'}`}>{gameState.settings.musicEnabled ? t.on : t.off}</button>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                       <span className="font-black text-sm uppercase opacity-60 tracking-widest">{t.sfx}</span>
                       <button onClick={() => setGameState(p => ({...p, settings: {...p.settings, sfxEnabled: !p.settings.sfxEnabled}}))} className={`px-4 py-2 rounded-xl font-black text-xs uppercase transition-colors ${gameState.settings.sfxEnabled ? 'bg-emerald-600' : 'bg-red-500/20 text-red-400'}`}>{gameState.settings.sfxEnabled ? t.on : t.off}</button>
                    </div>
                  </div>
                  <button onClick={() => setMenuTab('main')} className="w-full py-4 bg-orange-600/10 border border-orange-500/30 rounded-2xl font-black text-orange-400 uppercase hover:bg-orange-600/20 transition-all">{t.back}</button>
                </div>
              )}
            </div>
          )}
          {isGameOver && (
            <div className="absolute inset-0 z-[200] bg-black flex flex-col items-center justify-center">
              <h1 className="text-9xl font-black italic text-red-600 mb-8">{t.youDied}</h1>
              <button onClick={startNewGame} className="px-12 py-5 bg-red-600 text-white rounded-2xl font-black text-2xl hover:scale-110 pointer-events-auto transition-transform">RESTART</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
export default App;
