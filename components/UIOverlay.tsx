
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

const MovementJoystick: React.FC<{ onMove: (x: number, y: number) => void }> = ({ onMove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const touch = e.touches[0];
    const x = touch.clientX - rect.left - centerX;
    const y = touch.clientY - rect.top - centerY;
    const dist = Math.sqrt(x * x + y * y);
    const max = rect.width / 2.5;
    const normX = dist > max ? (x / dist) * max : x;
    const normY = dist > max ? (y / dist) * max : y;
    setPos({ x: normX, y: normY });
    onMove(normX / max, -normY / max);
  };

  const endTouch = () => {
    setPos({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-28 h-28 sm:w-36 sm:h-36 bg-white/5 border border-white/10 rounded-full flex items-center justify-center touch-none backdrop-blur-md"
      onTouchMove={handleTouchMove}
      onTouchEnd={endTouch}
    >
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black opacity-10 uppercase tracking-widest">Move</div>
      <div 
        className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 border border-white/30 rounded-full shadow-2xl transition-transform duration-75"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      />
    </div>
  );
};

const LookPad: React.FC<{ onLook: (dx: number, dy: number) => void }> = ({ onLook }) => {
  const lastTouchRef = useRef<{ x: number, y: number } | null>(null);

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (lastTouchRef.current) {
      const dx = touch.clientX - lastTouchRef.current.x;
      const dy = touch.clientY - lastTouchRef.current.y;
      onLook(dx, dy);
    }
    lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const endTouch = () => {
    lastTouchRef.current = null;
  };

  return (
    <div 
      className="w-full h-full bg-white/[0.02] flex items-center justify-center touch-none relative"
      onTouchMove={handleTouchMove}
      onTouchEnd={endTouch}
    >
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black opacity-5 uppercase tracking-[0.5em] pointer-events-none">Camera Look Pad</div>
    </div>
  );
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
      <div 
        className="flex items-center h-full transition-transform duration-100 ease-out"
        style={{ transform: `translateX(calc(50% - ${deg * 2}px))` }}
      >
        {markers.map((m, i) => (
          <div 
            key={i} 
            className="absolute flex flex-col items-center"
            style={{ left: `${m.a * 2}px` }}
          >
            <span className={`text-[8px] sm:text-[10px] font-black ${m.n.length === 1 ? 'text-white' : 'text-white/40'}`}>
              {m.n}
            </span>
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
  const { stats, day, time, inventory, activeTorch, activeBow, campfires } = gameState;

  const hasInteraction = interaction.type !== 'none';
  const interactingCampfire = interaction.type === 'campfire' ? campfires.find(f => f.id === interaction.id) : null;
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
      case 'cook_meat': return { can: getInventoryCount('Meat') >= 1 && isNearFire, msg: !isNearFire ? t.requiresFire : (getInventoryCount('Meat') < 1 ? `1 Raw Meat Required` : `1 Raw Meat`) };
      case 'cook_fruit': return { can: getInventoryCount('Fruit') >= 1 && isNearFire, msg: !isNearFire ? t.requiresFire : (getInventoryCount('Fruit') < 1 ? `1 Fruit Required` : `1 Fruit`) };
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
          <div className="flex items-baseline gap-0.5"><span className={`text-xs sm:text-base font-black italic ${isCritical ? 'text-red-500' : 'text-white'}`}>{Math.round(val)}</span><span className="text-[7px] sm:text-[9px] font-bold opacity-30 italic">{unit}</span></div>
          <span className="text-[6px] sm:text-[8px] font-black uppercase opacity-20 tracking-tighter mt-0.5">{label}</span>
        </div>
      </div>
    );
  };

  if (!isVisible) return null;

  const hasMeat = getInventoryCount('Meat') > 0;
  const hasFruit = getInventoryCount('Fruit') > 0;

  return (
    <div className="absolute inset-0 pointer-events-none p-2 sm:p-4 lg:p-6 flex flex-col justify-between z-50 overflow-hidden">
      {/* Modern Notifications System */}
      <div className="fixed top-4 right-4 sm:top-10 sm:right-10 flex flex-col gap-1.5 z-[1000] items-end pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className="bg-emerald-500/80 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/20 text-[9px] sm:text-[12px] font-bold uppercase tracking-wider shadow-2xl animate-in slide-in-from-right fade-in-0 duration-300 flex items-center gap-2">
            <span className="text-base">✨</span> {n.text}
          </div>
        ))}
      </div>

      {!isCraftingOpen && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
          <div className={`relative flex items-center justify-center transition-all duration-200 transform ${hasInteraction ? 'scale-125 sm:scale-150' : 'scale-100'}`}>
            <div className={`w-3 h-3 sm:w-6 sm:h-6 border-2 rounded-full flex items-center justify-center shadow-lg ${hasInteraction ? 'border-orange-400 bg-orange-400/30' : 'border-white/50 bg-white/10'}`}>
               <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full shadow-inner ${hasInteraction ? 'bg-orange-400' : 'bg-white'}`} />
            </div>
          </div>
        </div>
      )}

      {/* Stats Panel & Joined Resources List */}
      {!isCraftingOpen && (
        <div className="flex flex-col gap-2 pointer-events-auto max-w-[120px] sm:max-w-[200px]">
          <div className="bg-slate-950/80 backdrop-blur-3xl p-2 sm:p-4 rounded-2xl sm:rounded-[2.5rem] border border-white/10 flex flex-col gap-2 sm:gap-3 shadow-2xl relative overflow-hidden">
            {isNearFire && <div className="absolute top-0 right-0 bg-orange-600/30 px-1.5 py-0.5 text-[6px] sm:text-[8px] font-black uppercase text-orange-400 border-l border-b border-orange-500/20 animate-pulse tracking-tighter z-20">WARM</div>}
            <div className="flex flex-col border-b border-white/5 pb-1.5 sm:pb-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col"><span className="text-[7px] sm:text-[9px] font-black opacity-20 uppercase tracking-widest leading-none">{t.day}</span><span className="text-lg sm:text-2xl font-black italic text-emerald-400 leading-none">{day}</span></div>
                <div className="flex flex-col items-end"><span className="text-sm sm:text-xl font-black italic text-white/70 tracking-widest leading-none">{timeStr}</span></div>
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
          
          {/* Bitişik Kaynak Listesi - Modernized */}
          {resources.length > 0 && (
            <div className="flex flex-col bg-slate-950/60 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-xl w-full max-w-[120px] sm:max-w-[160px] animate-in slide-in-from-left">
              {resources.map((res, idx) => (
                <div key={res.id} className={`flex items-center justify-between px-3 py-1.5 sm:px-4 sm:py-2 hover:bg-white/5 transition-colors ${idx !== resources.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-xs sm:text-lg flex-shrink-0">{getItemIcon(res.name)}</span>
                    <span className="text-[7px] sm:text-[10px] font-black text-white/50 uppercase tracking-tight truncate">{res.name}</span>
                  </div>
                  <span className="text-[8px] sm:text-[11px] font-black text-orange-400 ml-1">{res.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mobile Controls */}
      {isMobile && !isCraftingOpen && isVisible && (
        <>
          <div className="fixed bottom-12 left-12 pointer-events-auto z-[100]"><MovementJoystick onMove={(x, y) => setMobileInput(prev => ({ ...prev, moveX: x, moveY: y }))} /></div>
          <div className="fixed bottom-0 right-0 w-1/2 h-full pointer-events-auto z-[50]"><LookPad onLook={(dx, dy) => setMobileInput(prev => ({ ...prev, lookX: dx, lookY: dy }))} /></div>
          <div className="fixed bottom-36 right-12 pointer-events-auto z-[100] flex flex-col gap-4">
             <button className="w-16 h-16 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-2xl active:scale-90" onTouchStart={() => setMobileInput(prev => ({ ...prev, interact: true }))} onTouchEnd={() => setMobileInput(prev => ({ ...prev, interact: false }))}>✋</button>
             {(interaction.type === 'campfire' || interaction.type === 'shelter') && (
               <>
                 {hasMeat && <button onClick={() => onCraft('cook_meat')} className="w-16 h-16 bg-orange-600/80 border border-orange-400 rounded-full flex items-center justify-center text-xl active:scale-90">🍖</button>}
                 {hasFruit && <button onClick={() => onCraft('cook_fruit')} className="w-16 h-16 bg-emerald-600/80 border border-emerald-400 rounded-full flex items-center justify-center text-xl active:scale-90">🥧</button>}
               </>
             )}
          </div>
        </>
      )}

      {/* Interaction Label & Quick Cook Options */}
      <div className="absolute top-4 sm:top-14 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 max-w-[80vw] sm:max-w-[90vw]">
         {interaction.type !== 'none' && (
           <div className="flex flex-col items-center gap-2 animate-in zoom-in slide-in-from-top duration-300">
             <div className="px-5 py-2 sm:px-10 sm:py-4 bg-emerald-600/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl text-[9px] sm:text-[14px] font-black uppercase tracking-widest shadow-2xl border border-white/20 text-white flex flex-col items-center">
               <div className="flex items-center gap-2 sm:gap-4">
                 <span className="bg-white text-emerald-700 px-2 py-0.5 rounded-lg sm:rounded-xl text-[9px] sm:text-12px font-bold">E</span>
                 {fuelPercent !== null ? `${t.campfire} (${t.fuel}: ${fuelPercent}%)` : (interaction.type === 'shelter' ? `${t.shelter} - ${t.sleep}` : (t[interaction.type as keyof typeof t] || interaction.type))}
               </div>
             </div>
             
             {/* Hızlı Pişirme Seçenekleri */}
             {(interaction.type === 'campfire' || interaction.type === 'shelter') && (
               <div className="flex gap-2">
                 {hasMeat && (
                   <button onClick={() => onCraft('cook_meat')} className="px-4 py-2 bg-orange-600/90 backdrop-blur-md rounded-xl border border-orange-400/50 text-[8px] sm:text-[12px] font-black uppercase flex items-center gap-2 hover:bg-orange-500 transition-colors pointer-events-auto">
                     <span className="bg-white text-orange-700 px-1.5 rounded font-bold">F</span> {t.cookMeat} 🍖
                   </button>
                 )}
                 {hasFruit && (
                   <button onClick={() => onCraft('cook_fruit')} className="px-4 py-2 bg-emerald-600/90 backdrop-blur-md rounded-xl border border-emerald-400/50 text-[8px] sm:text-[12px] font-black uppercase flex items-center gap-2 hover:bg-emerald-500 transition-colors pointer-events-auto">
                     <span className="bg-white text-emerald-700 px-1.5 rounded font-bold">G</span> {t.cookFruit} 🥧
                   </button>
                 )}
               </div>
             )}
           </div>
         )}
      </div>

      {/* Hotbar */}
      <div className="flex flex-col items-center gap-1 sm:gap-2 w-full mb-1 sm:mb-2 pointer-events-none">
        <div className="bg-slate-950/80 backdrop-blur-3xl p-1.5 sm:p-3 rounded-2xl sm:rounded-full border border-white/10 flex gap-1 sm:gap-3 pointer-events-auto shadow-2xl relative max-w-full overflow-x-auto scrollbar-hide">
          {hotbarItems.map((item, idx) => {
            const slotNum = idx + 1;
            const isToolActive = item && ((item.name === 'Bow' && gameState.activeBow) || (item.name === 'Torch' && gameState.activeTorch));
            return (
              <button key={idx} onClick={() => item && onUseItem(item.id)} className={`relative w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-full border transition-all duration-300 flex items-center justify-center text-xl sm:text-3xl hover:bg-white/10 active:scale-90 flex-shrink-0 ${isToolActive ? 'bg-orange-500 border-orange-400 ring-4 ring-orange-500/20 scale-110 -translate-y-2 z-10' : 'bg-white/5 border-white/5'} ${activeSlot === slotNum ? 'scale-90 bg-white/20' : ''}`}>
                <span className="absolute top-1 sm:top-2 text-[7px] sm:text-[10px] font-black text-white/40">{slotNum}</span>
                {item ? <span>{getItemIcon(item.name)}</span> : <div className="w-1.5 h-1.5 sm:w-3 sm:h-3 rounded-full border border-white/5 bg-black/30 opacity-10" />}
                {item && item.count > 1 && <span className="absolute -bottom-1 -right-1 bg-orange-600 text-[8px] sm:text-[11px] font-black px-2 py-0.5 rounded-full border border-white/10 min-w-[1.4rem] text-center shadow-lg">{item.count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {isCraftingOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-2xl pointer-events-auto z-[600] flex items-center justify-center p-4">
           <div className="bg-slate-900/90 p-6 sm:p-10 rounded-[3rem] border border-orange-500/30 w-full max-w-3xl shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-6">
                <div className="flex items-center gap-4"><span className="text-3xl sm:text-5xl">🛠️</span><div><h2 className="text-xl sm:text-4xl font-black italic text-orange-500 uppercase leading-none tracking-tight">SURVIVAL CRAFT</h2><p className="text-[7px] sm:text-[11px] font-black text-white/30 uppercase tracking-[0.3em] mt-2">Resource Management & Fabrication</p></div></div>
                <button onClick={() => setIsCraftingOpen(false)} className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl sm:text-3xl hover:bg-red-500 transition-all">×</button>
              </div>
              <div className="overflow-y-auto pr-2 custom-scrollbar space-y-6">
                <div className="space-y-3">
                  <div className="text-[9px] sm:text-[12px] font-black text-emerald-500 uppercase tracking-[0.3em] pl-2 border-l-4 border-emerald-500/50 mb-4">Essential Hardware</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['campfire', 'shelter', 'bow', 'arrow', 'torch', 'waterskin'].map(type => {
                       const { can, msg } = checkRequirements(type);
                       const names: Record<string, string> = { campfire: t.campfire, shelter: t.shelter, bow: t.bow, arrow: t.arrow, torch: t.torch, waterskin: t.waterskin };
                       const icons: Record<string, string> = { campfire: "🔥", shelter: "🏠", bow: "🏹", arrow: "🎯", torch: "🔦", waterskin: "🍶" };
                       return <CompactCraftItem key={type} name={names[type]} icon={icons[type]} req={msg} disabled={!can} onClick={() => onCraft(type)} />;
                    })}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-[9px] sm:text-[12px] font-black text-orange-500 uppercase tracking-[0.3em] pl-2 border-l-4 border-orange-500/50 mb-4">Cooking & Processing</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['cook_meat', 'cook_fruit'].map(type => {
                       const { can, msg } = checkRequirements(type);
                       const names: Record<string, string> = { cook_meat: t.cookMeat, cook_fruit: t.cookFruit };
                       const icons: Record<string, string> = { cook_meat: "🍖", cook_fruit: "🥧" };
                       return <CompactCraftItem key={type} name={names[type]} icon={icons[type]} req={msg} disabled={!can} onClick={() => onCraft(type)} />;
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
  <button onClick={disabled ? undefined : onClick} className={`p-3 sm:p-4 bg-white/5 rounded-2xl text-left flex justify-between items-center group transition-all border border-white/5 relative overflow-hidden w-full ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-emerald-600/20 hover:border-emerald-500/50 active:scale-95'}`}>
    <div className="flex flex-col relative z-10 max-w-[75%] leading-tight"><span className={`text-[11px] sm:text-base font-black uppercase tracking-tight truncate ${disabled ? 'text-white/30' : 'text-white'}`}>{name}</span><span className={`text-[7px] sm:text-[10px] font-bold uppercase mt-1 truncate ${disabled ? 'text-red-500' : 'text-orange-400 opacity-80'}`}>{req}</span></div>
    <span className={`text-xl sm:text-3xl relative z-10 transition-transform flex-shrink-0 ${disabled ? 'opacity-20' : 'group-hover:scale-110 group-hover:rotate-6'}`}>{icon}</span>
  </button>
);

export default UIOverlay;
