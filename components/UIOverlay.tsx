
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { GameState, InteractionTarget, MobileInput, InventoryItem } from '../types';
import { COLORS, TRANSLATIONS } from '../constants';

interface UIOverlayProps {
  gameState: GameState;
  interaction: InteractionTarget;
  onUseItem: (id: string) => void;
  onCraft: (type: 'campfire' | 'arrows' | 'bow' | 'torch') => void;
  onCook: () => void;
  cookingItem: string | null;
  isVisible: boolean;
  isHungerCritical: boolean;
  isThirstCritical: boolean;
  isWarmingUp: boolean;
  showTodoList: boolean;
  isMobile: boolean;
  onMobileInput: (input: (prev: MobileInput) => MobileInput) => void;
  playerRotation: number;
  activeToolId: string | null;
  isCraftingOpen: boolean;
  setIsCraftingOpen: (open: boolean) => void;
}

interface DeltaIndicator {
  id: string;
  amount: number;
  itemName: string; 
}

const ArrowIconSVG = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <line x1="20" y1="80" x2="70" y2="30" stroke="#8b4513" strokeWidth="6" />
    <polygon points="70,30 85,15 75,45" fill="#333" />
    <rect x="15" y="75" width="15" height="15" fill="#fff" transform="rotate(-45 22 82)" opacity="0.8" />
  </svg>
);

const Compass: React.FC<{ rotation: number }> = ({ rotation }) => {
  const degree = (rotation * 180) / Math.PI;
  const markers = [
    { label: 'S', pos: 0 },
    { label: 'E', pos: 90 },
    { label: 'N', pos: 180 },
    { label: 'W', pos: 270 },
    { label: 'S', pos: 360 },
  ];

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-48 sm:w-64 h-10 bg-black/60 backdrop-blur-md rounded-full border border-white/20 overflow-hidden pointer-events-none flex items-center justify-center shadow-2xl">
      <div className="relative w-full h-full flex items-center transition-transform duration-150 ease-out" style={{ transform: `translateX(${-degree * 0.8}px)` }}>
        {[-360, 0, 360].map(offset => (
          <React.Fragment key={offset}>
            {markers.map(m => (
              <div key={m.label + offset + m.pos} className="absolute flex flex-col items-center" style={{ left: `${(m.pos + offset) * 0.8 + 32}px` }}>
                <span className="text-xs font-black text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{m.label}</span>
                <div className="w-0.5 h-1.5 bg-white/50" />
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,1)] z-10" />
    </div>
  );
};

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  gameState, interaction, onUseItem, onCraft, onCook, cookingItem, isVisible, isHungerCritical, isThirstCritical, isWarmingUp, showTodoList, isMobile, onMobileInput, playerRotation, activeToolId, isCraftingOpen, setIsCraftingOpen
}) => {
  const { stats, inventory, time, settings, campfires } = gameState;
  const t = TRANSLATIONS[settings.language];
  const [cookingProgress, setCookingProgress] = useState(0);
  const [deltas, setDeltas] = useState<DeltaIndicator[]>([]);
  const [pulseItems, setPulseItems] = useState<Record<string, boolean>>({});
  const prevInventoryRef = useRef<InventoryItem[]>([]);
  const joystickRef = useRef<{ startX: number; startY: number; isActive: boolean }>({ startX: 0, startY: 0, isActive: false });
  const lookRef = useRef<{ lastX: number; lastY: number; isActive: boolean }>({ lastX: 0, lastY: 0, isActive: false });

  const handleJoystickStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    joystickRef.current = { startX: touch.clientX, startY: touch.clientY, isActive: true };
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    if (!joystickRef.current.isActive) return;
    const touch = e.touches[0];
    const dx = touch.clientX - joystickRef.current.startX;
    const dy = touch.clientY - joystickRef.current.startY;
    const dist = Math.min(30, Math.sqrt(dx * dx + dy * dy));
    const angle = Math.atan2(dy, dx);
    const moveX = (Math.cos(angle) * dist) / 30;
    const moveY = -(Math.sin(angle) * dist) / 30;
    onMobileInput(prev => ({ ...prev, moveX, moveY }));
  };

  const handleJoystickEnd = () => {
    joystickRef.current.isActive = false;
    onMobileInput(prev => ({ ...prev, moveX: 0, moveY: 0 }));
  };

  const handleLookStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    lookRef.current = { lastX: touch.clientX, lastY: touch.clientY, isActive: true };
  };

  const handleLookMove = (e: React.TouchEvent) => {
    if (!lookRef.current.isActive) return;
    const touch = e.touches[0];
    const dx = touch.clientX - lookRef.current.lastX;
    const dy = touch.clientY - lookRef.current.lastY;
    lookRef.current.lastX = touch.clientX;
    lookRef.current.lastY = touch.clientY;
    onMobileInput(prev => ({ ...prev, lookX: dx, lookY: dy }));
    setTimeout(() => onMobileInput(prev => ({ ...prev, lookX: 0, lookY: 0 })), 0);
  };

  const handleLookEnd = () => {
    lookRef.current.isActive = false;
    onMobileInput(prev => ({ ...prev, lookX: 0, lookY: 0 }));
  };

  useEffect(() => {
    const newDeltas: DeltaIndicator[] = [];
    const newPulses: Record<string, boolean> = {};

    inventory.forEach(item => {
      const prevItem = prevInventoryRef.current.find(pi => pi.name === item.name);
      const prevCount = prevItem ? prevItem.count : 0;
      
      if (item.count !== prevCount) {
        newDeltas.push({
          id: Math.random().toString(36).substr(2, 9),
          itemName: item.name,
          amount: item.count - prevCount
        });
        newPulses[item.name] = true;
      }
    });

    prevInventoryRef.current.forEach(prevItem => {
      if (!inventory.some(i => i.name === prevItem.name)) {
        newDeltas.push({ 
          id: Math.random().toString(36).substr(2, 9), 
          itemName: prevItem.name, 
          amount: -prevItem.count 
        });
      }
    });

    if (newDeltas.length > 0) {
      setDeltas(prev => [...prev, ...newDeltas]);
      setPulseItems(prev => ({ ...prev, ...newPulses }));
      
      setTimeout(() => {
        setDeltas(prev => prev.filter(d => !newDeltas.find(nd => nd.id === d.id)));
      }, 1500);

      setTimeout(() => {
        setPulseItems(prev => {
          const updated = { ...prev };
          Object.keys(newPulses).forEach(k => delete updated[k]);
          return updated;
        });
      }, 600);
    }
    prevInventoryRef.current = inventory;
  }, [inventory]);

  const woodCount = inventory.find(i => i.name === 'Wood')?.count || 0;
  const flintCount = inventory.find(i => i.name === 'Flint Stone')?.count || 0;
  const rawMeatCount = inventory.find(i => i.name === 'Raw Meat')?.count || 0;
  const appleCount = inventory.find(i => i.name === 'Apple')?.count || 0;
  const berriesCount = inventory.find(i => i.name === 'Berries')?.count || 0;
  
  const canCraftCampfire = woodCount >= 3 && flintCount >= 1;
  const canCraftArrow = woodCount >= 1;
  const canCraftBow = !inventory.some(i => i.name === 'Bow') && woodCount >= 3;
  const canCraftTorch = !inventory.some(i => i.name === 'Torch') && woodCount >= 1 && flintCount >= 1;
  const canCookSomething = (rawMeatCount > 0 || appleCount > 0 || berriesCount > 0);

  useEffect(() => {
    if (cookingItem && isVisible) {
      const interval = setInterval(() => {
        setCookingProgress(p => (p + 3.33) % 103.33);
      }, 50);
      return () => {
        clearInterval(interval);
        setCookingProgress(0);
      };
    } else {
      setCookingProgress(0);
    }
  }, [cookingItem, isVisible]);

  const formatTime = (t: number) => {
    const hours = Math.floor(t / 100);
    const minutes = Math.floor((t % 100) * 0.6);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const StatBar = ({ label, value, color, unit = "%", pulse = false, flicker = false, glow = false, icon = null }: { label: string, value: number, color: string, unit?: string, pulse?: boolean, flicker?: boolean, glow?: boolean, icon?: React.ReactNode }) => (
    <div className={`mb-2.5 w-full ${pulse ? 'animate-pulse' : ''} ${flicker ? 'animate-weak-flicker' : ''}`}>
      <div className="flex justify-between items-center text-xs font-black text-white uppercase tracking-wider mb-1 px-1">
        <div className="flex items-center gap-1.5">
          <span>{label}</span>
          {icon}
        </div>
        <span>{Math.round(value)}{unit}</span>
      </div>
      <div className={`w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10 shadow-inner ${glow ? `shadow-[0_0_12px_rgba(255,255,255,0.4)] border-white/30` : ''}`} style={{ borderColor: glow ? color : '' }}>
        <div className={`h-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(255,255,255,0.2)]`} style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
      </div>
    </div>
  );

  const CraftButton = ({ label, onClick, disabled, icon, hotkey, highlight = false }: { label: string, onClick: (e: any) => void, disabled: boolean, icon: React.ReactNode, hotkey: string, highlight?: boolean }) => (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`group flex items-center justify-between w-full p-2.5 rounded-xl border-2 transition-all shadow-xl pointer-events-auto mb-2 ${
        disabled 
        ? 'bg-black/50 border-white/5 text-white/10 cursor-not-allowed grayscale' 
        : highlight 
          ? 'bg-orange-600/40 border-orange-500 hover:bg-orange-500/60 text-white animate-pulse'
          : 'bg-white/5 border-white/10 hover:bg-white/15 hover:border-indigo-500/50 active:scale-95 text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="w-6 h-6 flex items-center justify-center drop-shadow-md">{icon}</span>
        <div className="flex flex-col items-start text-left">
          <span className="text-xs font-black uppercase tracking-tight leading-none">{label}</span>
          {!isMobile && <span className="text-[10px] opacity-40 font-bold tracking-widest mt-0.5">{hotkey}</span>}
        </div>
      </div>
    </button>
  );

  const interactionIcon = (() => {
    switch (interaction.type) {
      case 'tree': case 'appleTree': return '🪓'; 
      case 'rock': return '⛏️'; 
      case 'bush': return '🫐';
      case 'water': return '💧'; 
      case 'campfire': return '🍳'; 
      case 'rabbit': return '🐇';
      case 'partridge': return '🐦';
      case 'critter': return '🐿️'; 
      case 'arrow': return <div className="w-8 h-8"><ArrowIconSVG /></div>;
      default: return null;
    }
  })();

  const isCritical = isHungerCritical || isThirstCritical;

  return (
    <div className={`absolute inset-0 pointer-events-none flex flex-col justify-between p-4 select-none transition-opacity duration-700 z-20 ${isVisible ? 'opacity-100' : 'opacity-0'} ${isCritical ? 'animate-dizzy' : ''}`}>
      
      {isHungerCritical && (
        <div className="absolute inset-0 z-50 pointer-events-none shadow-[inset_0_0_150px_rgba(153,27,27,0.8)] animate-pulse border-[4px] border-red-600/10" />
      )}
      {isThirstCritical && (
        <div className="absolute inset-0 z-50 pointer-events-none shadow-[inset_0_0_150px_rgba(30,58,138,0.8)] animate-pulse border-[4px] border-blue-600/10" />
      )}

      <Compass rotation={playerRotation} />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10">
          <div className={`relative flex items-center justify-center transition-all duration-300 ${interaction.type !== 'none' || cookingItem ? 'scale-125' : 'scale-100'}`}>
            <div className={`w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-opacity duration-200 ${interaction.type !== 'none' || cookingItem ? 'opacity-0' : 'opacity-100'}`} />
            
            <div className={`absolute transition-all duration-200 ease-out flex flex-col items-center ${interaction.type !== 'none' || cookingItem ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
               <div className="text-3xl mb-1 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] animate-bounce-gentle flex items-center justify-center w-12 h-12">
                 {cookingItem ? '🍳' : interactionIcon}
               </div>
               
               <div className="relative w-10 h-10 border-2 border-white/30 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm shadow-2xl">
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  {cookingItem && (
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle 
                        cx="20" cy="20" r="18" 
                        fill="none" 
                        stroke="rgba(245, 158, 11, 0.8)" 
                        strokeWidth="3" 
                        strokeDasharray="113" 
                        strokeDashoffset={113 - (113 * Math.min(100, cookingProgress)) / 100}
                      />
                    </svg>
                  )}
               </div>

               <div className="mt-3 flex flex-col items-center gap-1.5">
                  <div className="text-xs font-black text-white uppercase tracking-[0.2em] bg-indigo-600/95 px-4 py-2 rounded-lg shadow-[0_8px_25px_rgba(0,0,0,0.5)] border border-white/20 whitespace-nowrap">
                    {cookingItem ? `${t.campfire} (${t[cookingItem as keyof typeof t] || cookingItem})` : (t[interaction.type as keyof typeof t] || interaction.type)}
                  </div>
               </div>
            </div>
          </div>
      </div>

      <div className="flex flex-col gap-4 pointer-events-none z-10 items-start max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="bg-black/80 backdrop-blur-3xl p-4 rounded-2xl border border-white/10 w-40 sm:w-48 shadow-2xl pointer-events-auto">
          <div className="flex flex-col gap-2 mb-3 border-b border-white/5 pb-3">
             <div className="flex items-center justify-between text-white font-mono text-xs">
                <div className="flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,1)]" />
                   <span className="font-black tracking-widest uppercase">{t.day} {gameState.day}</span>
                </div>
                <div className="text-indigo-400 font-black tracking-tighter text-sm">
                   {formatTime(time)}
                </div>
             </div>
             <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 via-yellow-400 to-indigo-900 transition-all duration-1000" style={{ width: `${(time / 2400) * 100}%` }} />
             </div>
          </div>
          <StatBar label={t.health} value={stats.health} color={COLORS.health} pulse={stats.health < 25} />
          <StatBar label={t.hunger} value={stats.hunger} color={COLORS.hunger} pulse={isHungerCritical} />
          <StatBar label={t.thirst} value={stats.thirst} color={COLORS.thirst} pulse={isThirstCritical} />
          <StatBar label={t.energy} value={stats.energy} color={COLORS.energy} flicker={isCritical} glow={isWarmingUp} />
          <StatBar label={t.temp} value={stats.temperature} color={COLORS.temperature} unit="°" pulse={stats.temperature < 15} glow={isWarmingUp} />
        </div>

        <div className={`transition-all duration-300 pointer-events-auto flex flex-col items-start ${isCraftingOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}>
          <div className="bg-slate-900/80 backdrop-blur-3xl p-3 rounded-2xl border border-white/10 w-44 sm:w-52 shadow-2xl">
             <div className="flex justify-between items-center mb-3 px-1">
               <h3 className="text-xs font-black uppercase tracking-[0.15em] text-orange-400">{t.craft}</h3>
               <button onClick={() => setIsCraftingOpen(false)} className="text-white/40 hover:text-white text-xs">×</button>
             </div>
             {isWarmingUp && (
               <CraftButton label={`${t.campfire} / ${t.use}`} onClick={onCook} disabled={!canCookSomething || !!cookingItem} icon="🍗" hotkey="[E]" highlight />
             )}
             <CraftButton label={t.campfire} onClick={() => onCraft('campfire')} disabled={!canCraftCampfire} icon="🔥" hotkey="[C]" />
             <CraftButton label={t.Arrow} onClick={() => onCraft('arrows')} disabled={!canCraftArrow} icon={<ArrowIconSVG />} hotkey="[X]" />
             <CraftButton label={t.Bow} onClick={() => onCraft('bow')} disabled={!canCraftBow} icon="🏹" hotkey="[V]" />
             <CraftButton label={t.Torch} onClick={() => onCraft('torch')} disabled={!canCraftTorch} icon="🔦" hotkey="[T]" />
          </div>
        </div>
      </div>

      {isMobile && (
        <div className="absolute inset-0 pointer-events-none z-30">
          <div 
            className="absolute bottom-6 left-6 w-24 h-24 bg-white/5 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center pointer-events-auto touch-none shadow-2xl"
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
          >
            <div className="w-8 h-8 bg-indigo-500 rounded-full border border-white shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
          </div>

          <div 
            className="absolute bottom-6 right-6 w-24 h-24 bg-white/5 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center pointer-events-auto touch-none shadow-2xl"
            onTouchStart={handleLookStart}
            onTouchMove={handleLookMove}
            onTouchEnd={handleLookEnd}
          >
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{t.look}</span>
          </div>

          <button 
            onClick={() => setIsCraftingOpen(!isCraftingOpen)}
            className="absolute bottom-32 left-8 w-12 h-12 bg-orange-600 rounded-xl border border-white/20 flex items-center justify-center pointer-events-auto shadow-2xl text-lg"
          >
            🛠️
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 z-10 w-full items-center mb-6">
        <div className="bg-black/80 backdrop-blur-3xl p-2 rounded-2xl border border-white/10 flex gap-2 max-w-[95vw] sm:max-w-3xl overflow-x-auto no-scrollbar shadow-[0_15px_45px_rgba(0,0,0,0.8)] pointer-events-auto ring-1 ring-white/5">
          {inventory.map((item, index) => (
            <button 
              key={item.id} 
              onClick={() => onUseItem(item.id)} 
              className={`relative group min-w-[48px] h-[48px] sm:min-w-[64px] sm:h-[64px] bg-white/5 hover:bg-white/10 rounded-xl border-2 transition-all flex flex-col items-center justify-center active:scale-90 ${activeToolId === item.id ? 'border-indigo-500 bg-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.5)] scale-110 z-10' : 'border-white/5'} ${pulseItems[item.name] ? 'animate-item-pop border-indigo-400 shadow-[0_0_60px_rgba(99,102,241,1)] z-50' : ''}`}
            >
              {!isMobile && index < 9 && <span className="absolute top-0.5 left-1 text-[10px] font-black text-indigo-400">{index + 1}</span>}
              <span className="text-xl sm:text-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] w-8 sm:w-10 h-8 sm:h-10 flex items-center justify-center">
                {item.name === 'Wood' && '🪵'} {item.name === 'Berries' && '🍒'}
                {item.name === 'Apple' && '🍎'} {item.name === 'Stone' && '🪨'}
                {item.name === 'Flint Stone' && '🔥'} {item.name === 'Roasted Apple' && '🍢'}
                {item.name === 'Cooked Berries' && '🥣'} {item.name === 'Raw Meat' && '🥩'}
                {item.name === 'Cooked Meat' && '🍖'} 
                {item.name === 'Arrow' && <ArrowIconSVG />}
                {item.name === 'Bow' && '🏹'} {item.name === 'Torch' && '🔦'}
              </span>
              <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white text-[9px] sm:text-[10px] font-black w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg shadow-xl ring-2 ring-black/50">{item.count}</span>
              
              {deltas.filter(d => d.itemName === item.name).map(delta => (
                <div 
                  key={delta.id} 
                  className={`absolute -top-16 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-full font-black text-2xl sm:text-3xl z-[100] pointer-events-none shadow-[0_0_100px_rgba(0,0,0,1)] animate-delta-float border-4 ${
                    delta.amount > 0 
                    ? 'bg-green-500 border-green-200 text-white shadow-green-500/80' 
                    : 'bg-red-500 border-red-200 text-white shadow-red-500/80'
                  }`}
                >
                  <span className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">{delta.amount > 0 ? `+${delta.amount}` : delta.amount}</span>
                </div>
              ))}
            </button>
          ))}
        </div>
      </div>
      
      <style>{`
        @keyframes bounce-gentle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes dizzy { 0%, 100% { filter: blur(0px); transform: rotate(0deg); } 50% { filter: blur(1.5px); transform: rotate(0.2deg); } }
        @keyframes delta-float { 
          0% { transform: translate(-50%, 80px) scale(0); opacity: 0; filter: blur(30px) brightness(2); } 
          12% { opacity: 1; transform: translate(-50%, -60px) scale(2.8); filter: blur(0px) brightness(1.5); } 
          30% { transform: translate(-50%, -100px) scale(1.8); }
          75% { opacity: 1; transform: translate(-50%, -220px) scale(1.6); } 
          100% { transform: translate(-50%, -350px) scale(0.4); opacity: 0; filter: blur(10px); } 
        }
        @keyframes item-pop {
          0% { transform: scale(1); rotate: 0deg; filter: brightness(1) saturate(1); }
          20% { transform: scale(2.5); rotate: 30deg; filter: brightness(2.5) saturate(2) drop-shadow(0 0 50px white); }
          40% { transform: scale(1.4); rotate: -30deg; }
          65% { transform: scale(1.8); rotate: 15deg; }
          100% { transform: scale(1); rotate: 0deg; filter: brightness(1) saturate(1); }
        }
        .animate-bounce-gentle { animation: bounce-gentle 2s ease-in-out infinite; }
        .animate-dizzy { animation: dizzy 8s ease-in-out infinite; }
        .animate-delta-float { animation: delta-float 2.5s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards; }
        .animate-item-pop { animation: item-pop 0.9s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default UIOverlay;
