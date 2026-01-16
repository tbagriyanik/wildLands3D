
import React from 'react';
import { GameState, InteractionTarget, InventoryItem } from '../types';
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
    case 'Torch': return '🔦';
    case 'Meat': return '🍗';
    case 'Cooked Meat': return '🍖';
    case 'Cooked Fruit': return '🥧';
    default: return '📦';
  }
};

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  gameState, interaction, isVisible, isCraftingOpen, activeSlot, setIsCraftingOpen, onCraft, onToggleLanguage, onUseItem, playerRotation, isNearFire, notifications
}) => {
  const t = TRANSLATIONS[gameState.settings.language];
  const { stats, day, time, inventory, activeTorch, activeBow, campfires } = gameState;

  const hasInteraction = interaction.type !== 'none';
  const interactingCampfire = interaction.type === 'campfire' ? campfires.find(f => f.id === interaction.id) : null;
  const fuelPercent = interactingCampfire ? Math.round((interactingCampfire.life / 800) * 100) : null;

  const getInventoryCount = (name: string) => inventory.find(i => i.name === name)?.count || 0;

  const checkRequirements = (type: string) => {
    switch(type) {
      case 'campfire':
        return { can: getInventoryCount('Wood') >= 3 && getInventoryCount('Flint Stone') >= 1, msg: `3 Wood, 1 Flint` };
      case 'bow':
        return { can: getInventoryCount('Wood') >= 5, msg: `5 Wood` };
      case 'arrow':
        return { can: getInventoryCount('Wood') >= 1 && getInventoryCount('Stone') >= 1, msg: `1 Wood, 1 Stone` };
      case 'torch':
        return { can: getInventoryCount('Wood') >= 1 && getInventoryCount('Flint Stone') >= 1, msg: `1 Wood, 1 Flint` };
      case 'waterskin':
        return { can: getInventoryCount('Wood') >= 2, msg: `2 Wood` };
      case 'cook_meat':
        return { 
          can: getInventoryCount('Meat') >= 1 && isNearFire, 
          msg: !isNearFire ? t.requiresFire : (getInventoryCount('Meat') < 1 ? `1 Raw Meat Required` : `1 Raw Meat`) 
        };
      case 'cook_fruit':
        const hasFruit = getInventoryCount('Apple') >= 1 || getInventoryCount('Pear') >= 1 || getInventoryCount('Berries') >= 1;
        return { 
          can: hasFruit && isNearFire, 
          msg: !isNearFire ? t.requiresFire : (!hasFruit ? `1 Fruit Required` : `1 Fruit`) 
        };
      default: return { can: false, msg: "" };
    }
  };

  const getHotbarItems = () => {
    const slots = new Array(7).fill(null);
    slots[0] = inventory.find(i => i.name === 'Bow');
    slots[1] = inventory.find(i => i.name === 'Torch');
    slots[2] = inventory.find(i => i.name === 'Waterskin') || inventory.find(i => i.name === 'Water');
    slots[3] = inventory.find(i => i.name === 'Meat');
    slots[4] = inventory.find(i => ['Apple', 'Pear', 'Berries'].includes(i.name));
    slots[5] = inventory.find(i => i.name === 'Cooked Meat');
    slots[6] = inventory.find(i => i.name === 'Cooked Fruit');
    return slots;
  };

  const hotbarItems = getHotbarItems();
  const resources = inventory.filter(i => ['Wood', 'Stone', 'Flint Stone', 'Arrow'].includes(i.name));

  const hours = Math.floor(time / 100);
  const minutes = Math.floor((time % 100) * 0.6);
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  const headingDegrees = ((180 - (playerRotation * 180 / Math.PI)) + 360) % 360;
  const compassOffset = -(headingDegrees * (100 / 90)); 

  // Compact Card-based Stat Component
  const StatCard = ({ icon, val, col, label, unit = "%" }: { icon: string, val: number, col: string, label: string, unit?: string }) => {
    const isCritical = val < 20 && label !== t.dirt;
    return (
      <div className={`relative flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-900/60 border border-white/5 overflow-hidden transition-all duration-300 group ${isCritical ? 'animate-pulse ring-1 ring-red-500/50' : 'hover:bg-slate-800/80 hover:scale-105'}`}>
        {/* Progress Fill Background */}
        <div 
          className="absolute bottom-0 left-0 w-full transition-all duration-1000 ease-out opacity-20 pointer-events-none"
          style={{ height: `${Math.min(100, val)}%`, backgroundColor: col }}
        />
        
        <span className="text-xl sm:text-2xl mb-1 relative z-10 drop-shadow-sm">{icon}</span>
        
        <div className="flex flex-col items-center relative z-10 leading-none">
          <div className="flex items-baseline gap-0.5">
            <span className={`text-sm sm:text-base font-black italic ${isCritical ? 'text-red-500' : 'text-white'}`}>{Math.round(val)}</span>
            <span className="text-[8px] sm:text-[9px] font-bold opacity-30 italic">{unit}</span>
          </div>
          <span className="text-[7px] sm:text-[8px] font-black uppercase opacity-20 tracking-tighter mt-0.5">{label}</span>
        </div>
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none p-3 sm:p-6 flex flex-col justify-between z-50 overflow-hidden">
      {/* Notifications - Top Right */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex flex-col gap-2 z-[100] items-end max-w-[200px] sm:max-w-xs">
        {notifications.map(n => (
          <div key={n.id} className="bg-emerald-600/90 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-white/20 text-[9px] sm:text-[11px] font-black uppercase tracking-wider shadow-xl animate-in slide-in-from-right duration-300">
            {n.text}
          </div>
        ))}
      </div>

      {/* Crosshair */}
      {!isCraftingOpen && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
          <div className={`relative flex items-center justify-center transition-all duration-200 transform ${hasInteraction ? 'scale-150' : 'scale-100'}`}>
            <div className={`w-4 h-4 sm:w-6 sm:h-6 border-2 rounded-full flex items-center justify-center shadow-lg ${hasInteraction ? 'border-orange-400 bg-orange-400/30' : 'border-white/50 bg-white/10'}`}>
               <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full shadow-inner ${hasInteraction ? 'bg-orange-400' : 'bg-white'}`} />
            </div>
          </div>
        </div>
      )}

      {/* Main UI Sidebar - Top Left */}
      <div className="flex flex-col gap-2 pointer-events-auto">
        <div className="bg-slate-950/80 backdrop-blur-3xl p-3 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 flex flex-col gap-3 shadow-2xl w-40 sm:w-52 relative overflow-hidden transition-all">
          {isNearFire && (
            <div className="absolute top-0 right-0 bg-orange-600/30 px-2 py-0.5 text-[7px] sm:text-[8px] font-black uppercase text-orange-400 border-l border-b border-orange-500/20 animate-pulse tracking-tighter z-20">
               HOT
            </div>
          )}
          
          {/* Day & Time Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex flex-col">
              <span className="text-[8px] sm:text-[9px] font-black opacity-20 uppercase tracking-widest">{t.day}</span>
              <span className="text-xl sm:text-2xl font-black italic text-emerald-400 leading-none">{day}</span>
            </div>
            <span className="text-base sm:text-xl font-black italic text-white/70 tracking-widest">{timeStr}</span>
          </div>

          {/* Compact 2-Column Grid of Stat Cards */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <StatCard label={t.health} val={stats.health} icon="❤️" col={COLORS.health} />
            <StatCard label={t.hunger} val={stats.hunger} icon="🍞" col={COLORS.hunger} />
            <StatCard label={t.thirst} val={stats.thirst} icon="💧" col={COLORS.thirst} />
            <StatCard label={t.temp} val={stats.temperature} icon="🔥" col={COLORS.temperature} unit="°C" />
            <StatCard label={t.energy} val={stats.energy} icon="⚡" col={COLORS.energy} />
            <StatCard label={t.dirt} val={stats.dirtiness} icon="🧼" col={COLORS.dirtiness} />
          </div>

          {/* Minimalist Compass */}
          <div className="bg-slate-900/40 h-4 sm:h-5 rounded-lg border border-white/5 flex items-center justify-center overflow-hidden relative">
            <div className="flex gap-[50px] sm:gap-[65px] text-[7px] sm:text-[9px] font-black text-white/40 absolute whitespace-nowrap transition-transform duration-100 ease-out" style={{ transform: `translateX(${compassOffset + (window.innerWidth < 640 ? 65 : 85)}px)` }}>
              <span>S</span><span>W</span><span className="text-white/80">N</span><span>E</span><span>S</span>
            </div>
            <div className="w-px h-full bg-orange-500/30 absolute z-10" />
          </div>
        </div>

        {/* Resources Panel */}
        <div className="flex flex-col gap-1 sm:ml-1">
          {resources.map(res => (
            <div key={res.id} className="bg-slate-900/40 backdrop-blur-md px-2 py-1 rounded-lg border border-white/5 flex items-center justify-between shadow-lg w-28 sm:w-36 animate-in slide-in-from-left duration-300">
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base">{getItemIcon(res.name)}</span>
                <span className="text-[7px] sm:text-[8px] font-black text-white/40 uppercase tracking-tight">{res.name}</span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-black text-orange-400/80">{res.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Interaction Label - Top Center */}
      <div className="absolute top-8 sm:top-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 max-w-[90vw]">
         {interaction.type !== 'none' && (
           <div className="px-5 py-2 sm:px-8 sm:py-3 bg-emerald-600/90 backdrop-blur-md rounded-2xl text-[10px] sm:text-[13px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] shadow-2xl animate-in zoom-in duration-200 border border-white/20 text-white flex flex-col items-center">
             <div className="flex items-center gap-2 sm:gap-3">
               <span className="bg-white text-emerald-700 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[11px]">E</span>
               {fuelPercent !== null ? `${t.campfire} (${t.fuel}: ${fuelPercent}%)` : (t[interaction.type as keyof typeof t] || interaction.type)}
             </div>
             {fuelPercent !== null && (
               <div className="w-full h-1 bg-black/40 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${fuelPercent}%` }} />
               </div>
             )}
           </div>
         )}
      </div>

      {/* Hotbar - Bottom Center */}
      <div className="flex flex-col items-center gap-2 w-full mb-1 sm:mb-2">
        <div className="bg-slate-950/80 backdrop-blur-3xl p-2 sm:p-3 rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 flex gap-1.5 sm:gap-2.5 pointer-events-auto shadow-2xl relative">
          <div className="hidden sm:block absolute -top-8 left-1/2 -translate-x-1/2 text-[8px] font-black text-white/10 uppercase tracking-[0.3em] whitespace-nowrap">HOTBAR (1-7)</div>
          {hotbarItems.map((item, idx) => {
            const isKeyPressed = activeSlot === (idx + 1);
            const isActive = item && ((item.name === 'Bow' && activeBow) || (item.name === 'Torch' && activeTorch));
            return (
              <button 
                key={idx} 
                onClick={() => item && onUseItem(item.id)}
                className={`relative w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl border transition-all flex items-center justify-center text-xl sm:text-2xl hover:bg-white/10 active:scale-95 ${isActive ? 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-500/40 scale-105 sm:scale-110 -translate-y-1' : 'bg-white/5 border-white/5'} ${isKeyPressed ? 'scale-90 bg-emerald-500/40 border-emerald-300' : ''}`}
              >
                <span className="absolute top-0.5 left-1.5 text-[7px] sm:text-[9px] font-black text-white/20">{idx + 1}</span>
                {item ? getItemIcon(item.name) : <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full border border-white/5 bg-black/20" />}
                {item && item.count > 1 && (
                  <span className="absolute -bottom-1 -right-1 bg-orange-600 text-[8px] sm:text-[10px] font-black px-1 sm:px-1.5 rounded-lg border border-white/10 shadow-md">{item.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Crafting Menu Overlay */}
      {isCraftingOpen && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-3xl pointer-events-auto z-[60] flex items-center justify-center p-4 sm:p-8">
           <div className="bg-slate-900/80 p-6 sm:p-12 rounded-[2rem] sm:rounded-[4rem] border border-orange-500/20 w-full max-w-4xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col backdrop-blur-md max-h-[90vh]">
              <div className="flex justify-between items-center mb-6 sm:mb-12 border-b border-white/10 pb-4 sm:pb-8">
                <div>
                  <h2 className="text-3xl sm:text-6xl font-black italic text-orange-500 uppercase leading-none tracking-tighter text-glow">SURVIVAL KIT</h2>
                  <p className="text-[8px] sm:text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mt-1 sm:mt-2">Tools & Crafting</p>
                </div>
                <button onClick={() => setIsCraftingOpen(false)} className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-2xl sm:text-4xl hover:bg-red-500/20 hover:text-red-500 transition-all active:scale-90">×</button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-12 overflow-y-auto pr-2 custom-scrollbar pb-6">
                <div className="space-y-4 sm:space-y-6">
                  <div className="text-[10px] sm:text-xs font-black text-emerald-500 uppercase tracking-widest pl-2">Equipment & Fire</div>
                  <div className="space-y-2 sm:space-y-3">
                    {['campfire', 'bow', 'arrow', 'torch', 'waterskin'].map(type => {
                       const { can, msg } = checkRequirements(type);
                       const craftNames: Record<string, string> = { campfire: t.campfire, bow: t.bow, arrow: t.arrow, torch: t.torch, waterskin: t.waterskin };
                       const craftIcons: Record<string, string> = { campfire: "🔥", bow: "🏹", arrow: "🎯", torch: "🔦", waterskin: "🍶" };
                       return (
                         <CraftItem 
                           key={type}
                           name={craftNames[type]} 
                           icon={craftIcons[type]} 
                           req={msg} 
                           disabled={!can}
                           onClick={() => onCraft(type)} 
                         />
                       );
                    })}
                  </div>
                </div>
                <div className="space-y-4 sm:space-y-6">
                  <div className="text-[10px] sm:text-xs font-black text-orange-500 uppercase tracking-widest pl-2">Cooking Station</div>
                  <div className="space-y-2 sm:space-y-3">
                    {['cook_meat', 'cook_fruit'].map(type => {
                       const { can, msg } = checkRequirements(type);
                       const craftNames: Record<string, string> = { cook_meat: t.cookedMeat, cook_fruit: t.cookedFruit };
                       const craftIcons: Record<string, string> = { cook_meat: "🍖", cook_fruit: "🥧" };
                       return (
                         <CraftItem 
                           key={type}
                           name={craftNames[type]} 
                           icon={craftIcons[type]} 
                           req={msg} 
                           disabled={!can}
                           onClick={() => onCraft(type)} 
                         />
                       );
                    })}
                  </div>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const CraftItem: React.FC<{ name: string, icon: string, req: string, onClick: () => void, disabled?: boolean }> = ({ name, icon, req, onClick, disabled }) => (
  <button 
    onClick={disabled ? undefined : onClick} 
    className={`p-4 sm:p-6 bg-white/5 rounded-[1.5rem] sm:rounded-[2.5rem] text-left flex justify-between items-center group transition-all border border-white/5 shadow-xl relative overflow-hidden w-full ${disabled ? 'opacity-40 cursor-not-allowed grayscale-[0.5]' : 'hover:bg-emerald-600/10 hover:border-emerald-500/50 hover:-translate-y-1 active:scale-95'}`}
  >
    {!disabled && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 -translate-x-full group-hover:translate-x-full duration-1000 transition-transform" />}
    <div className="flex flex-col relative z-10">
      <span className={`text-sm sm:text-xl font-black uppercase tracking-tight transition-colors ${disabled ? 'text-white/40' : 'group-hover:text-emerald-300'}`}>{name}</span>
      <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-widest mt-0.5 sm:mt-1 ${disabled ? 'text-red-500' : 'text-orange-400 opacity-60'}`}>{disabled ? `MISSING: ${req}` : req}</span>
    </div>
    <span className={`text-2xl sm:text-4xl relative z-10 transition-transform ${disabled ? 'opacity-30' : 'group-hover:scale-125 group-hover:rotate-12'}`}>{icon}</span>
  </button>
);

export default UIOverlay;
