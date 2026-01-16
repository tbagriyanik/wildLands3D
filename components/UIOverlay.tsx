
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

  const StatCard = ({ icon, val, col, label, unit = "%" }: { icon: string, val: number, col: string, label: string, unit?: string }) => {
    const isCritical = val < 20 && label !== t.dirt;
    return (
      <div className={`relative flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-slate-900/60 border border-white/5 overflow-hidden transition-all duration-300 group ${isCritical ? 'animate-pulse ring-1 ring-red-500/50' : 'hover:bg-slate-800/80 hover:scale-105'}`}>
        <div 
          className="absolute bottom-0 left-0 w-full transition-all duration-1000 ease-out opacity-20 pointer-events-none"
          style={{ height: `${Math.min(100, val)}%`, backgroundColor: col }}
        />
        <span className="text-lg sm:text-2xl mb-0.5 sm:mb-1 relative z-10 drop-shadow-sm">{icon}</span>
        <div className="flex flex-col items-center relative z-10 leading-none">
          <div className="flex items-baseline gap-0.5">
            <span className={`text-xs sm:text-base font-black italic ${isCritical ? 'text-red-500' : 'text-white'}`}>{Math.round(val)}</span>
            <span className="text-[7px] sm:text-[9px] font-bold opacity-30 italic">{unit}</span>
          </div>
          <span className="text-[6px] sm:text-[8px] font-black uppercase opacity-20 tracking-tighter mt-0.5">{label}</span>
        </div>
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none p-2 sm:p-4 lg:p-6 flex flex-col justify-between z-50 overflow-hidden">
      {/* Notifications - PERSISTENT ON TOP */}
      <div className="fixed top-2 right-2 sm:top-6 sm:right-6 flex flex-col gap-1.5 sm:gap-2 z-[1000] items-end max-w-[150px] sm:max-w-xs pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className="bg-emerald-600/90 backdrop-blur-md px-2.5 py-1 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl border border-white/20 text-[8px] sm:text-[11px] font-black uppercase tracking-wider shadow-2xl animate-in slide-in-from-right duration-300">
            {n.text}
          </div>
        ))}
      </div>

      {/* Crosshair */}
      {!isCraftingOpen && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
          <div className={`relative flex items-center justify-center transition-all duration-200 transform ${hasInteraction ? 'scale-125 sm:scale-150' : 'scale-100'}`}>
            <div className={`w-3 h-3 sm:w-6 sm:h-6 border-2 rounded-full flex items-center justify-center shadow-lg ${hasInteraction ? 'border-orange-400 bg-orange-400/30' : 'border-white/50 bg-white/10'}`}>
               <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full shadow-inner ${hasInteraction ? 'bg-orange-400' : 'bg-white'}`} />
            </div>
          </div>
        </div>
      )}

      {/* HUD - Top Left */}
      {!isCraftingOpen && (
        <div className="flex flex-col gap-2 pointer-events-auto max-w-[120px] sm:max-w-[200px]">
          <div className="bg-slate-950/80 backdrop-blur-3xl p-2 sm:p-4 rounded-2xl sm:rounded-[2rem] border border-white/10 flex flex-col gap-2 sm:gap-3 shadow-2xl relative overflow-hidden transition-all">
            {isNearFire && (
              <div className="absolute top-0 right-0 bg-orange-600/30 px-1.5 py-0.5 text-[6px] sm:text-[8px] font-black uppercase text-orange-400 border-l border-b border-orange-500/20 animate-pulse tracking-tighter z-20">
                HOT
              </div>
            )}
            
            <div className="flex items-center justify-between border-b border-white/5 pb-1.5 sm:pb-2">
              <div className="flex flex-col">
                <span className="text-[7px] sm:text-[9px] font-black opacity-20 uppercase tracking-widest leading-none">{t.day}</span>
                <span className="text-lg sm:text-2xl font-black italic text-emerald-400 leading-none">{day}</span>
              </div>
              <span className="text-sm sm:text-xl font-black italic text-white/70 tracking-widest">{timeStr}</span>
            </div>

            <div className="grid grid-cols-2 gap-1 sm:gap-2">
              <StatCard label={t.health} val={stats.health} icon="❤️" col={COLORS.health} />
              <StatCard label={t.hunger} val={stats.hunger} icon="🍞" col={COLORS.hunger} />
              <StatCard label={t.thirst} val={stats.thirst} icon="💧" col={COLORS.thirst} />
              <StatCard label={t.temp} val={stats.temperature} icon="🔥" col={COLORS.temperature} unit="°C" />
              <StatCard label={t.energy} val={stats.energy} icon="⚡" col={COLORS.energy} />
              <StatCard label={t.dirt} val={stats.dirtiness} icon="🧼" col={COLORS.dirtiness} />
            </div>
          </div>

          <div className="flex flex-col gap-1 sm:ml-1">
            {resources.map(res => (
              <div key={res.id} className="bg-slate-900/40 backdrop-blur-md px-1.5 py-1 sm:px-2 sm:py-1 rounded-lg border border-white/5 flex items-center justify-between shadow-lg w-full max-w-[100px] sm:max-w-[140px] animate-in slide-in-from-left duration-300">
                <div className="flex items-center gap-1 sm:gap-1.5 overflow-hidden">
                  <span className="text-xs sm:text-base flex-shrink-0">{getItemIcon(res.name)}</span>
                  <span className="text-[6px] sm:text-[8px] font-black text-white/40 uppercase tracking-tight truncate">{res.name}</span>
                </div>
                <span className="text-[8px] sm:text-[10px] font-black text-orange-400/80 ml-1">{res.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interaction Label */}
      <div className="absolute top-4 sm:top-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 max-w-[80vw] sm:max-w-[90vw]">
         {interaction.type !== 'none' && (
           <div className="px-4 py-1.5 sm:px-8 sm:py-3 bg-emerald-600/90 backdrop-blur-md rounded-xl sm:rounded-2xl text-[8px] sm:text-[13px] font-black uppercase tracking-widest shadow-2xl animate-in zoom-in duration-200 border border-white/20 text-white flex flex-col items-center">
             <div className="flex items-center gap-1.5 sm:gap-3">
               <span className="bg-white text-emerald-700 px-1 py-0.5 rounded sm:rounded-md text-[7px] sm:text-[11px]">E</span>
               {fuelPercent !== null ? `${t.campfire} (${t.fuel}: ${fuelPercent}%)` : (t[interaction.type as keyof typeof t] || interaction.type)}
             </div>
           </div>
         )}
      </div>

      {/* Hotbar */}
      <div className="flex flex-col items-center gap-1 sm:gap-2 w-full mb-1 sm:mb-2 pointer-events-none">
        <div className="bg-slate-950/80 backdrop-blur-3xl p-1.5 sm:p-3 rounded-2xl sm:rounded-[2rem] border border-white/10 flex gap-1 sm:gap-2.5 pointer-events-auto shadow-2xl relative max-w-full overflow-x-auto scrollbar-hide">
          {hotbarItems.map((item, idx) => {
            const isKeyPressed = activeSlot === (idx + 1);
            const isActive = item && ((item.name === 'Bow' && activeBow) || (item.name === 'Torch' && activeTorch));
            return (
              <button 
                key={idx} 
                onClick={() => item && onUseItem(item.id)}
                className={`relative w-9 h-9 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl border transition-all flex items-center justify-center text-lg sm:text-2xl hover:bg-white/10 active:scale-95 flex-shrink-0 ${isActive ? 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-500/40 scale-105 sm:scale-110 -translate-y-0.5 sm:-translate-y-1' : 'bg-white/5 border-white/5'} ${isKeyPressed ? 'scale-90 bg-emerald-500/40 border-emerald-300' : ''}`}
              >
                <span className="absolute top-0.5 left-1 text-[6px] sm:text-[9px] font-black text-white/20">{idx + 1}</span>
                {item ? getItemIcon(item.name) : <div className="w-2 h-2 sm:w-3.5 sm:h-3.5 rounded-full border border-white/5 bg-black/20" />}
                {item && item.count > 1 && (
                  <span className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 bg-orange-600 text-[7px] sm:text-[10px] font-black px-1 sm:px-1.5 rounded-md sm:rounded-lg border border-white/10 shadow-md">{item.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* COMPACT Crafting Menu Overlay */}
      {isCraftingOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg pointer-events-auto z-[600] flex items-center justify-center p-4">
           <div className="bg-slate-900/90 p-4 sm:p-8 rounded-3xl border border-orange-500/30 w-full max-w-2xl shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl sm:text-4xl">🛠️</span>
                  <div>
                    <h2 className="text-lg sm:text-3xl font-black italic text-orange-500 uppercase leading-none tracking-tight">SURVIVAL CRAFT</h2>
                    <p className="text-[6px] sm:text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mt-1">Manage Resources</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCraftingOpen(false)} 
                  className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-lg sm:text-2xl hover:bg-red-500/20 hover:text-red-500 transition-all active:scale-90"
                >
                  ×
                </button>
              </div>
              
              <div className="overflow-y-auto pr-1 custom-scrollbar space-y-4">
                <div className="space-y-2">
                  <div className="text-[8px] sm:text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] pl-1 border-l-2 border-emerald-500/50 mb-2">Essential Gear</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {['campfire', 'bow', 'arrow', 'torch', 'waterskin'].map(type => {
                       const { can, msg } = checkRequirements(type);
                       const craftNames: Record<string, string> = { campfire: t.campfire, bow: t.bow, arrow: t.arrow, torch: t.torch, waterskin: t.waterskin };
                       const craftIcons: Record<string, string> = { campfire: "🔥", bow: "🏹", arrow: "🎯", torch: "🔦", waterskin: "🍶" };
                       return (
                         <CompactCraftItem 
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
                
                <div className="space-y-2">
                  <div className="text-[8px] sm:text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] pl-1 border-l-2 border-orange-500/50 mb-2">Cooking</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {['cook_meat', 'cook_fruit'].map(type => {
                       const { can, msg } = checkRequirements(type);
                       const craftNames: Record<string, string> = { cook_meat: t.cookedMeat, cook_fruit: t.cookedFruit };
                       const craftIcons: Record<string, string> = { cook_meat: "🍖", cook_fruit: "🥧" };
                       return (
                         <CompactCraftItem 
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

const CompactCraftItem: React.FC<{ name: string, icon: string, req: string, onClick: () => void, disabled?: boolean }> = ({ name, icon, req, onClick, disabled }) => (
  <button 
    onClick={disabled ? undefined : onClick} 
    className={`p-2 sm:p-3 bg-white/5 rounded-xl text-left flex justify-between items-center group transition-all border border-white/5 relative overflow-hidden w-full ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-emerald-600/10 hover:border-emerald-500/40 active:scale-95'}`}
  >
    <div className="flex flex-col relative z-10 max-w-[75%] leading-tight">
      <span className={`text-[10px] sm:text-sm font-black uppercase tracking-tight truncate ${disabled ? 'text-white/40' : 'text-white'}`}>{name}</span>
      <span className={`text-[6px] sm:text-[8px] font-bold uppercase mt-0.5 truncate ${disabled ? 'text-red-500' : 'text-orange-400 opacity-60'}`}>
        {req}
      </span>
    </div>
    <span className={`text-base sm:text-2xl relative z-10 transition-transform flex-shrink-0 ${disabled ? 'opacity-30' : 'group-hover:scale-110'}`}>{icon}</span>
  </button>
);

export default UIOverlay;
