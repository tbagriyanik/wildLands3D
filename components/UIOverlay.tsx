
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

  // Crafting Requirement Logic
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

  const Bar = ({ label, val, col }: { label: string, val: number, col: string }) => (
    <div className="flex flex-col gap-0.5 w-full">
      <div className="flex justify-between text-[11px] font-black uppercase opacity-60">
        <span>{label}</span>
        <span>{Math.round(val)}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div className="h-full transition-all duration-500 ease-out" style={{ width: `${Math.min(100, val)}%`, backgroundColor: col }} />
      </div>
    </div>
  );

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-50 overflow-hidden">
      <div className="absolute top-6 right-6 flex flex-col gap-2 z-[100] items-end">
        {notifications.map(n => (
          <div key={n.id} className="bg-emerald-600/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-[11px] font-black uppercase tracking-wider shadow-lg animate-in slide-in-from-right duration-300">
            {n.text}
          </div>
        ))}
      </div>

      {!isCraftingOpen && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
          <div className={`relative flex items-center justify-center transition-all duration-200 transform ${hasInteraction ? 'scale-150' : 'scale-100'}`}>
            <div className={`w-6 h-6 border-2 rounded-full flex items-center justify-center shadow-lg ${hasInteraction ? 'border-orange-400 bg-orange-400/30' : 'border-white/50 bg-white/10'}`}>
               <div className={`w-1.5 h-1.5 rounded-full shadow-inner ${hasInteraction ? 'bg-orange-400' : 'bg-white'}`} />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 pointer-events-auto">
        <div className="bg-slate-950/85 backdrop-blur-2xl p-5 rounded-[2rem] border border-white/10 flex flex-col gap-3 shadow-2xl w-64 relative overflow-hidden">
          {isNearFire && (
            <div className="absolute top-0 right-0 bg-orange-600/20 px-3 py-1 text-[9px] font-black uppercase text-orange-400 border-l border-b border-orange-500/30 animate-pulse">
               FIRE
            </div>
          )}
          
          <div className="flex items-baseline justify-between border-b border-white/10 pb-2 mb-1 pt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] font-black opacity-40 uppercase tracking-widest">{t.day}</span>
              <span className="text-4xl font-black italic text-emerald-400 leading-none">{day}</span>
            </div>
            <span className="text-2xl font-black italic text-white/90 tracking-widest">{timeStr}</span>
          </div>

          <Bar label={t.health} val={stats.health} col={COLORS.health} />
          <Bar label={t.hunger} val={stats.hunger} col={COLORS.hunger} />
          <Bar label={t.thirst} val={stats.thirst} col={COLORS.thirst} />
          <Bar label={t.energy} val={stats.energy} col={COLORS.energy} />
          <Bar label={t.dirt} val={stats.dirtiness} col={COLORS.dirtiness} />

          <div className="mt-2 bg-white/5 h-8 rounded-xl border border-white/5 flex items-center justify-center overflow-hidden relative">
            <div className="flex gap-[80px] text-[11px] font-black text-white absolute whitespace-nowrap transition-transform duration-100 ease-out" style={{ transform: `translateX(${compassOffset + 160}px)` }}>
              <span className="opacity-40">S</span><span className="opacity-40">W</span><span className="text-white">N</span><span className="opacity-40">E</span><span className="opacity-40">S</span><span className="opacity-40">W</span><span className="text-white">N</span><span className="opacity-40">E</span>
            </div>
            <div className="w-0.5 h-full bg-white/20 absolute z-10" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {resources.map(res => (
            <div key={res.id} className="bg-slate-900/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 flex items-center justify-between shadow-lg w-48 animate-in slide-in-from-left duration-300">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getItemIcon(res.name)}</span>
                <span className="text-[9px] font-black text-white/70 uppercase tracking-tight">{res.name}</span>
              </div>
              <span className="text-[11px] font-black text-orange-400">{res.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute top-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
         {interaction.type !== 'none' && (
           <div className="px-8 py-3 bg-emerald-600/90 backdrop-blur-md rounded-2xl text-[13px] font-black uppercase tracking-[0.2em] shadow-[0_0_40px_rgba(16,185,129,0.3)] animate-in zoom-in duration-200 border border-white/20 text-white flex flex-col items-center">
             <div className="flex items-center gap-3">
               <span className="bg-white text-emerald-700 px-2 py-0.5 rounded-lg text-[11px]">E</span>
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

      <div className="flex flex-col items-center gap-4 w-full mb-2">
        <div className="bg-slate-950/80 backdrop-blur-3xl p-3 rounded-[2.5rem] border border-white/10 flex gap-2.5 pointer-events-auto shadow-2xl relative">
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Quick Slots (1-7)</div>
          {hotbarItems.map((item, idx) => {
            const isKeyPressed = activeSlot === (idx + 1);
            const isActive = item && ((item.name === 'Bow' && activeBow) || (item.name === 'Torch' && activeTorch));
            return (
              <button 
                key={idx} 
                onClick={() => item && onUseItem(item.id)}
                className={`relative w-16 h-16 rounded-2xl border transition-all flex items-center justify-center text-2xl hover:bg-white/10 active:scale-95 ${isActive ? 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-500/40 scale-110 -translate-y-1' : 'bg-white/5 border-white/5'} ${isKeyPressed ? 'scale-90 bg-emerald-500/40 border-emerald-300' : ''}`}
              >
                <span className="absolute top-1 left-2 text-[10px] font-black text-white/40">{idx + 1}</span>
                {item ? getItemIcon(item.name) : <div className="w-4 h-4 rounded-full border border-white/5 bg-black/20" />}
                {item && item.count > 1 && (
                  <span className="absolute -bottom-1 -right-1 bg-orange-600 text-[11px] font-black px-2 rounded-lg border border-white/10 shadow-md">{item.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {isCraftingOpen && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-3xl pointer-events-auto z-[60] flex items-center justify-center p-8">
           <div className="bg-slate-900/80 p-12 rounded-[4rem] border border-orange-500/20 w-full max-w-4xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col backdrop-blur-md">
              <div className="flex justify-between items-center mb-12 border-b border-white/10 pb-8">
                <div>
                  <h2 className="text-6xl font-black italic text-orange-500 uppercase leading-none tracking-tighter">SURVIVAL KIT</h2>
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mt-2">Tools & Cooking stations</p>
                </div>
                <button onClick={() => setIsCraftingOpen(false)} className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-4xl hover:bg-red-500/20 hover:text-red-500 transition-all active:scale-90">×</button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 overflow-y-auto pr-4 custom-scrollbar max-h-[60vh] pb-6">
                <div className="space-y-6">
                  <div className="text-xs font-black text-emerald-500 uppercase tracking-widest pl-4">Equipment & Fire</div>
                  <div className="space-y-3">
                    {['campfire', 'bow', 'arrow', 'torch', 'waterskin'].map(type => {
                       const { can, msg } = checkRequirements(type);
                       // Fix: Explicitly define the map values as strings to avoid 'any' inference and fix TS errors
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
                <div className="space-y-6">
                  <div className="text-xs font-black text-orange-500 uppercase tracking-widest pl-4">Cooking Station</div>
                  <div className="space-y-3">
                    {['cook_meat', 'cook_fruit'].map(type => {
                       const { can, msg } = checkRequirements(type);
                       // Fix: Explicitly define the map values as strings to avoid 'any' inference and fix TS errors
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
              
              <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                <p className="text-[10px] font-black text-white/10 uppercase tracking-widest">WILD LANDS SURVIVAL SYSTEM</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

// Fix: Redefined CraftItem using React.FC to properly handle React's 'key' prop and fix the 'is not assignable' error
const CraftItem: React.FC<{ name: string, icon: string, req: string, onClick: () => void, disabled?: boolean }> = ({ name, icon, req, onClick, disabled }) => (
  <button 
    onClick={disabled ? undefined : onClick} 
    className={`p-6 bg-white/5 rounded-[2.5rem] text-left flex justify-between items-center group transition-all border border-white/5 shadow-xl relative overflow-hidden w-full ${disabled ? 'opacity-40 cursor-not-allowed grayscale-[0.5]' : 'hover:bg-emerald-600/10 hover:border-emerald-500/50 hover:-translate-y-1 active:scale-95'}`}
  >
    {!disabled && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 -translate-x-full group-hover:translate-x-full duration-1000 transition-transform" />}
    <div className="flex flex-col relative z-10">
      <span className={`text-xl font-black uppercase tracking-tight transition-colors ${disabled ? 'text-white/40' : 'group-hover:text-emerald-300'}`}>{name}</span>
      <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${disabled ? 'text-red-500' : 'text-orange-400 opacity-60'}`}>{disabled ? `MISSING: ${req}` : req}</span>
    </div>
    <span className={`text-4xl relative z-10 transition-transform ${disabled ? 'opacity-30' : 'group-hover:scale-125 group-hover:rotate-12'}`}>{icon}</span>
  </button>
);

export default UIOverlay;
