
import React, { useState, useRef } from 'react';
import { GameState, InteractionTarget, InventoryItem, MobileInput } from '../types';
import { COLORS, TRANSLATIONS } from '../constants';

interface UIOverlayProps {
  gameState: GameState;
  interaction: InteractionTarget;
  isVisible: boolean;
  isCraftingOpen: boolean;
  activeSlot: number | null;
  setIsCraftingOpen: (o: boolean) => void;
  onCraft: (t: string) => void;
  onUseItem: (id: string) => void;
  onToggleLanguage: () => void;
  playerRotation: number;
  isNearFire: boolean;
  notifications: { id: number, text: string }[];
  isMobile: boolean;
  setMobileInput: React.Dispatch<React.SetStateAction<MobileInput>>;
}

const getItemIcon = (name: string): string => {
  switch (name) {
    case 'Wood': return '🪵';
    case 'Apple': return '🍎';
    case 'Pear': return '🍐';
    case 'Stone': return '🪨';
    case 'Flint Stone': return '🔥';
    case 'Water': return '💧';
    case 'Bow': return '🏹';
    case 'Arrow': return '🎯';
    case 'Waterskin': return '🍶';
    case 'Berries': return '🍒';
    case 'Fruit': return '🍎';
    case 'Torch': return '🔦';
    case 'Meat': return '🍗';
    case 'Cooked Meat': return '🍖';
    case 'Cooked Fruit': return '🥧';
    case 'Shelter': return '🏠';
    default: return '📦';
  }
};

const HorizontalCompass: React.FC<{ rotation: number }> = ({ rotation }) => {
  const deg = ((-rotation * 180 / Math.PI) + 360) % 360;
  const markers = [
    { n: 'N', a: 0 }, { n: 'NE', a: 45 }, { n: 'E', a: 90 }, { n: 'SE', a: 135 },
    { n: 'S', a: 180 }, { n: 'SW', a: 225 }, { n: 'W', a: 270 }, { n: 'NW', a: 315 },
    { n: 'N', a: 360 }, { n: 'NE', a: 405 }, { n: 'E', a: 450 }
  ];

  return (
    <div className="relative w-full h-4 sm:h-6 overflow-hidden bg-black/40 rounded-lg mt-1 border border-white/5">
      <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-orange-500 z-10 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
      <div className="flex items-center h-full transition-transform duration-100 ease-out" style={{ transform: `translateX(calc(50% - ${deg * 2}px))` }}>
        {markers.map((m, i) => (
          <div key={i} className="absolute flex flex-col items-center" style={{ left: `${m.a * 2}px` }}>
            <span className={`text-[8px] sm:text-[10px] font-black ${m.n.length === 1 ? 'text-white' : 'text-white/40'}`}>{m.n}</span>
            <div className={`w-[1px] ${m.n.length === 1 ? 'h-1.5 bg-white' : 'h-1 bg-white/20'}`} />
          </div>
        ))}
      </div>
    </div>
  );
};

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  gameState, interaction, isVisible, isCraftingOpen, activeSlot, setIsCraftingOpen, onCraft, onToggleLanguage, onUseItem, playerRotation, isNearFire, notifications, isMobile, setMobileInput
}) => {
  const t = TRANSLATIONS[gameState.settings.language];
  const { stats, day, time, inventory, activeTorch, activeBow, campfires, torchLife, xp, shelters } = gameState;

  const isCriticalHunger = stats.hunger < 20;
  const isCriticalThirst = stats.thirst < 20;
  const isCriticalEnergy = stats.energy < 20;
  const anyCritical = isCriticalHunger || isCriticalThirst || isCriticalEnergy;

  const hasInteraction = interaction.type !== 'none' && interaction.type !== undefined;
  const interactingCampfire = interaction.type === 'campfire' ? campfires.find(f => f.id === interaction.id) : null;
  const interactingShelter = interaction.type === 'shelter' ? shelters.find(s => s.id === interaction.id) : null;
  const fuelPercent = interactingCampfire ? Math.round((interactingCampfire.life / 800) * 100) : null;

  const getInventoryCount = (name: string) => inventory.find(i => i.name === name)?.count || 0;
  
  const checkRequirements = (type: string) => {
    switch(type) {
      case 'campfire': return { can: getInventoryCount('Wood') >= 3 && getInventoryCount('Flint Stone') >= 1, msg: `3 Wood, 1 Flint` };
      case 'shelter': return { can: getInventoryCount('Wood') >= 30 && getInventoryCount('Stone') >= 20, msg: `30 Wood, 20 Stone` };
      case 'bow': return { can: getInventoryCount('Wood') >= 5, msg: `5 Wood` };
      case 'arrow': return { can: getInventoryCount('Wood') >= 1 && getInventoryCount('Stone') >= 1, msg: `1 Wood, 1 Stone` };
      case 'torch': return { can: getInventoryCount('Wood') >= 1 && getInventoryCount('Flint Stone') >= 1, msg: `1 Wood, 1 Flint` };
      case 'waterskin': return { can: getInventoryCount('Wood') >= 2, msg: `2 Wood` };
      case 'cook_meat': return { can: getInventoryCount('Meat') >= 1 && isNearFire, msg: !isNearFire ? t.requiresFire : (getInventoryCount('Meat') < 1 ? `1 Raw Meat` : `1 Raw Meat`) };
      case 'cook_fruit': return { can: getInventoryCount('Fruit') >= 1 && isNearFire, msg: !isNearFire ? t.requiresFire : (getInventoryCount('Fruit') < 1 ? `1 Fruit` : `1 Fruit`) };
      default: return { can: false, msg: "" };
    }
  };

  const getHotbarItems = () => {
    const slots = new Array(7).fill(null);
    slots[0] = inventory.find(i => i.name === 'Bow' && i.count > 0);
    slots[1] = inventory.find(i => i.name === 'Torch' && i.count > 0);
    slots[2] = inventory.find(i => (i.name === 'Waterskin' || i.name === 'Water') && i.count > 0);
    slots[3] = inventory.find(i => i.name === 'Meat' && i.count > 0);
    slots[4] = inventory.find(i => i.name === 'Fruit' && i.count > 0);
    slots[5] = inventory.find(i => i.name === 'Cooked Meat' && i.count > 0);
    slots[6] = inventory.find(i => i.name === 'Cooked Fruit' && i.count > 0);
    return slots;
  };

  const hotbarItems = getHotbarItems();
  const resources = inventory.filter(i => ['Wood', 'Stone', 'Flint Stone', 'Arrow'].includes(i.name) && i.count > 0);
  const timeStr = `${Math.floor(time / 100).toString().padStart(2, '0')}:${Math.floor((time % 100) * 0.6).toString().padStart(2, '0')}`;

  const StatCard = ({ icon, val, col, label, unit = "%", isPercent = true }: { icon: string, val: number, col: string, label: string, unit?: string, isPercent?: boolean }) => {
    const isCritical = isPercent ? (val < 20 && label !== t.dirt) : (label === t.temp && val < 10);
    return (
      <div className={`relative flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-slate-900/60 border border-white/5 overflow-hidden transition-all duration-300 group ${isCritical ? 'animate-pulse ring-1 ring-red-500/50' : 'hover:bg-slate-800/80 hover:scale-105'}`}>
        {isPercent && <div className="absolute bottom-0 left-0 w-full transition-all duration-1000 ease-out opacity-20 pointer-events-none" style={{ height: `${Math.min(100, val)}%`, backgroundColor: col }} />}
        <span className="text-lg sm:text-2xl mb-0.5 sm:mb-1 relative z-10 drop-shadow-sm">{icon}</span>
        <div className="flex flex-col items-center relative z-10 leading-none">
          <div className="flex items-baseline gap-0.5"><span className={`text-xs sm:text-base font-black italic text-white`}>{Math.round(val)}</span><span className="text-[7px] sm:text-[9px] font-bold opacity-30 italic text-white">{unit}</span></div>
          <span className="text-[6px] sm:text-[8px] font-black uppercase opacity-60 tracking-tighter mt-0.5 text-white">{label}</span>
        </div>
      </div>
    );
  };

  if (!isVisible) return null;
  const waterskinCount = getInventoryCount('Waterskin');
  const waterCount = getInventoryCount('Water');
  const getShelterName = (tier: number) => { if (tier === 1) return t.shelter; if (tier === 2) return gameState.settings.language === 'tr' ? 'Kulübe' : 'Hut'; return gameState.settings.language === 'tr' ? 'Ev' : 'House'; };

  return (
    <div className="absolute inset-0 pointer-events-none p-2 sm:p-4 lg:p-6 flex flex-col justify-between z-50 overflow-hidden">
      {/* Reticle / Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-0">
          <div className={`w-1 h-1 rounded-full ${hasInteraction ? 'bg-yellow-400 scale-150' : 'bg-white/40'} transition-all duration-150 shadow-sm`} />
          <div className={`absolute w-4 h-4 border border-white/10 rounded-full ${hasInteraction ? 'scale-125 border-yellow-400/50' : 'scale-100'} transition-all duration-200`} />
      </div>

      <div className="fixed top-4 right-4 sm:top-10 sm:right-10 flex flex-col gap-1.5 z-[1000] items-end pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className="bg-emerald-600/90 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/20 text-[10px] sm:text-[13px] font-black uppercase tracking-wider shadow-2xl animate-in slide-in-from-right fade-in-0 duration-300 flex items-center gap-2 text-white">
            <span className="text-base">✨</span> {n.text}
          </div>
        ))}
      </div>

      {anyCritical && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-pulse z-[2000]">
           <div className="bg-red-600 text-white px-8 py-3 rounded-full font-black italic text-sm sm:text-xl border-4 border-white/20 shadow-[0_0_50px_rgba(220,38,38,0.6)] uppercase tracking-tighter">
              CRITICAL STATE DETECTED
           </div>
           <div className="flex gap-2">
              {isCriticalHunger && <span className="bg-orange-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase">HUNGER</span>}
              {isCriticalThirst && <span className="bg-blue-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase">THIRST</span>}
              {isCriticalEnergy && <span className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase">ENERGY</span>}
           </div>
        </div>
      )}

      {/* Main HUD: Left Side */}
      <div className="flex flex-row justify-between w-full pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto max-w-[120px] sm:max-w-[200px]">
          <div className="bg-slate-950/85 backdrop-blur-3xl p-2 sm:p-4 rounded-[25px] border border-white/10 flex flex-col gap-2 sm:gap-3 shadow-2xl relative overflow-hidden">
            {isNearFire && <div className="absolute top-0 right-0 bg-orange-600/50 px-1.5 py-0.5 text-[6px] sm:text-[8px] font-black uppercase text-white border-l border-b border-orange-500/20 animate-pulse tracking-tighter z-20">WARM</div>}
            <div className="flex flex-col border-b border-white/5 pb-1.5 sm:pb-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[7px] sm:text-[9px] font-black opacity-40 uppercase tracking-widest leading-none text-white">{t.day}</span>
                  <span className="text-lg sm:text-2xl font-black italic text-white leading-none">{day}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm sm:text-xl font-black italic text-white tracking-widest leading-none">{timeStr}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1 px-1">
                 <span className="text-[8px] sm:text-[11px] font-black text-white/40 tracking-widest uppercase">XP</span>
                 <span className="text-[9px] sm:text-[13px] font-black text-white">{Math.round(xp)}</span>
              </div>
              <HorizontalCompass rotation={playerRotation} />
            </div>
            <div className="grid grid-cols-2 gap-1 sm:gap-2">
              <StatCard label={t.health} val={stats.health} icon="❤️" col={COLORS.health} />
              <StatCard label={t.hunger} val={stats.hunger} icon="🍞" col={COLORS.hunger} />
              <StatCard label={t.thirst} val={stats.thirst} icon="💧" col={COLORS.thirst} />
              <StatCard label={t.temp} val={stats.temperature} icon="🌡️" col={COLORS.temperature} unit="°C" isPercent={false} />
              <StatCard label={t.energy} val={stats.energy} icon="⚡" col={COLORS.energy} />
              <StatCard label={t.dirt} val={stats.dirtiness} icon="🧼" col={COLORS.dirtiness} />
            </div>
          </div>

          {resources.length > 0 && (
            <div className="flex flex-col bg-slate-950/70 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-xl w-full max-w-[120px] sm:max-w-[160px] animate-in slide-in-from-left">
              {resources.map((res, idx) => (
                <div key={res.id} className={`flex items-center justify-between px-3 py-1.5 sm:px-4 sm:py-2 hover:bg-white/5 transition-colors ${idx !== resources.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-xs sm:text-lg flex-shrink-0">{getItemIcon(res.name)}</span>
                    <span className="text-[7px] sm:text-[10px] font-black text-white uppercase tracking-tight truncate">{res.name}</span>
                  </div>
                  <span className="text-[8px] sm:text-[11px] font-black text-white ml-1">{res.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Crafting Menu: Center Modal */}
        {isCraftingOpen && (
          <div className="absolute inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center pointer-events-auto p-4">
            <div className="bg-slate-950/95 p-6 sm:p-8 rounded-[40px] border border-orange-500/50 w-full max-w-2xl shadow-2xl flex flex-col gap-6 animate-in zoom-in duration-300">
               <div className="flex items-center justify-between border-b border-white/10 pb-4">
                 <h2 className="text-3xl sm:text-4xl font-black text-orange-500 italic uppercase tracking-tighter">CRAFTING</h2>
                 <button onClick={() => setIsCraftingOpen(false)} className="text-white/40 hover:text-white text-4xl leading-none transition-colors">×</button>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {['campfire', 'shelter', 'bow', 'arrow', 'torch', 'waterskin', 'cook_meat', 'cook_fruit'].map(type => {
                   const { can, msg } = checkRequirements(type);
                   const names: Record<string, string> = { campfire: t.campfire, shelter: t.shelter, bow: t.bow, arrow: t.arrow, torch: t.torch, waterskin: t.waterskin, cook_meat: t.cookMeat, cook_fruit: t.cookFruit };
                   const icons: Record<string, string> = { campfire: "🔥", shelter: "🏠", bow: "🏹", arrow: "🎯", torch: "🔦", waterskin: "🍶", cook_meat: "🍖", cook_fruit: "🥧" };
                   return (
                     <button 
                        key={type} 
                        onClick={can ? () => onCraft(type) : undefined}
                        className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${can ? 'bg-white/5 border-white/10 hover:bg-orange-600/30 hover:border-orange-500 hover:scale-[1.02]' : 'bg-black/40 border-white/5 opacity-30 cursor-not-allowed'}`}
                     >
                       <div className="flex flex-col leading-tight text-left">
                         <span className="text-[14px] sm:text-[16px] font-black text-white uppercase group-hover:text-white">{names[type]}</span>
                         <span className={`text-[9px] sm:text-[11px] font-bold ${can ? 'text-orange-400' : 'text-red-500'}`}>{msg}</span>
                       </div>
                       <span className="text-3xl sm:text-4xl">{icons[type]}</span>
                     </button>
                   );
                 })}
               </div>
               <div className="bg-white/5 p-4 rounded-2xl text-[10px] font-black opacity-30 uppercase tracking-widest text-center text-white">
                  Navigate the world to find more resources and unlock recipes
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Interaction Prompts */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 w-full max-w-[90vw] pointer-events-none">
         {hasInteraction && (
           <div className="flex flex-col items-center gap-2 animate-in slide-in-from-top duration-300">
             <div className="px-6 py-3 sm:px-10 sm:py-4 bg-slate-950/90 backdrop-blur-2xl rounded-2xl sm:rounded-full border-2 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.3)] flex flex-col items-center gap-1">
               <div className="flex items-center gap-3 sm:gap-4">
                 <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-400 text-slate-950 rounded-full flex items-center justify-center font-black text-xs sm:text-lg shadow-xl animate-pulse">E</div>
                 <div className="flex flex-col leading-none">
                   <span className="text-[11px] sm:text-[14px] font-black text-white uppercase tracking-widest">{fuelPercent !== null ? `${t.campfire} (${t.fuel}: ${fuelPercent}%)` : (interaction.type === 'shelter' && interactingShelter ? `${getShelterName(interactingShelter.tier)} - ${t.sleep}` : (t[interaction.type as keyof typeof t] || interaction.type))}</span>
                   <span className="text-[7px] sm:text-[9px] font-bold text-yellow-400 uppercase tracking-[0.2em] mt-1">{interaction.type === 'shelter' && interactingShelter && interactingShelter.tier < 3 ? (gameState.settings.language === 'tr' ? 'GELİŞTİRİLEBİLİR' : 'UPGRADABLE') : 'Ready to Interact'}</span>
                 </div>
               </div>
             </div>
           </div>
         )}
      </div>

      {/* Hotbar */}
      <div className="flex flex-col items-center gap-1 sm:gap-2 w-full mb-1 sm:mb-2 pointer-events-none">
        <div className="bg-slate-950/85 backdrop-blur-3xl p-1.5 sm:p-3 rounded-2xl sm:rounded-[2.5rem] border border-white/10 flex gap-1 sm:gap-3 pointer-events-auto shadow-2xl relative max-w-full overflow-x-auto scrollbar-hide">
          {hotbarItems.map((item, idx) => {
            const slotNum = idx + 1;
            const isToolActive = item && ((item.name === 'Bow' && activeBow) || (item.name === 'Torch' && activeTorch));
            const isWaterSlot = item && (item.name === 'Water' || item.name === 'Waterskin');
            const isTorchSlot = item && item.name === 'Torch';
            const waterFullness = waterskinCount > 0 ? (waterCount / waterskinCount) * 100 : 0;
            return (
              <button key={idx} onClick={() => { if(item) onUseItem(item.id); else if(slotNum === 1) onUseItem('Bow'); }} className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl border transition-all duration-300 flex items-center justify-center text-xl sm:text-3xl hover:bg-white/10 active:scale-90 flex-shrink-0 ${isToolActive ? 'bg-orange-600 border-orange-400 ring-4 ring-orange-500/20 scale-110 -translate-y-2 z-10' : 'bg-white/5 border-white/5'} ${activeSlot === slotNum ? 'scale-90 bg-white/20' : ''}`}>
                <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] sm:text-[10px] font-black text-white/60 pointer-events-none">{slotNum}</span>
                {isTorchSlot && <div className="absolute top-3 left-1/2 -translate-x-1/2 w-8 sm:w-10 h-0.5 bg-black/40 rounded-full overflow-hidden border border-white/5 z-20"><div className="h-full bg-orange-400 transition-all duration-300" style={{ width: `${torchLife}%` }} /></div>}
                {isWaterSlot && waterskinCount > 0 && <div className="absolute top-3 left-1/2 -translate-x-1/2 w-8 sm:w-10 h-0.5 bg-black/40 rounded-full overflow-hidden border border-white/5 z-20"><div className="h-full bg-blue-400 transition-all duration-300" style={{ width: `${waterFullness}%` }} /></div>}
                {item ? <span className="mt-2">{getItemIcon(item.name)}</span> : <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border border-white/10 bg-black/30 opacity-5" />}
                {item && item.count > 1 && !isWaterSlot && <span className="absolute -bottom-1 -right-1 bg-white text-slate-950 text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-md border border-slate-950/20 min-w-[1.2rem] text-center shadow-lg">{item.count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export default UIOverlay;
