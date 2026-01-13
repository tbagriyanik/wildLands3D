
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

    if (newDeltas.length > 0) {
      setDeltas(prev => [...prev, ...newDeltas]);
      setPulseItems(prev => ({ ...prev, ...newPulses }));
      setTimeout(() => setDeltas(prev => prev.filter(d => !newDeltas.find(nd => nd.id === d.id))), 1500);
      setTimeout(() => setPulseItems(prev => {
          const updated = { ...prev };
          Object.keys(newPulses).forEach(k => delete updated[k]);
          return updated;
      }), 600);
    }
    prevInventoryRef.current = inventory;
  }, [inventory]);

  const woodCount = inventory.find(i => i.name === 'Wood')?.count || 0;
  const flintCount = inventory.find(i => i.name === 'Flint Stone')?.count || 0;
  const rawMeatCount = inventory.find(i => i.name === 'Raw Meat')?.count || 0;
  
  const canCraftCampfire = woodCount >= 3 && flintCount >= 1;
  const canCraftArrow = woodCount >= 1;
  const canCraftBow = !inventory.some(i => i.name === 'Bow') && woodCount >= 3;
  const canCraftTorch = !inventory.some(i => i.name === 'Torch') && woodCount >= 1 && flintCount >= 1;

  const formatTime = (t: number) => {
    const hours = Math.floor(t / 100);
    const minutes = Math.floor((t % 100) * 0.6);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const StatBar = ({ label, value, color, unit = "%", pulse = false, flicker = false, glow = false }: { label: string, value: number, color: string, unit?: string, pulse?: boolean, flicker?: boolean, glow?: boolean }) => (
    <div className={`mb-2 w-full ${pulse ? 'animate-pulse' : ''} ${flicker ? 'animate-weak-flicker' : ''}`}>
      <div className="flex justify-between items-center text-[10px] font-black text-white/90 uppercase tracking-widest mb-1 px-1">
        <span>{label}</span>
        <span>{Math.round(value)}{unit}</span>
      </div>
      <div className={`w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5 shadow-inner ${glow ? `shadow-[0_0_8px_rgba(255,255,255,0.4)]` : ''}`}>
        <div className={`h-full transition-all duration-500 ease-out`} style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
      </div>
    </div>
  );

  const CraftButton = ({ label, onClick, disabled, icon, hotkey }: { label: string, onClick: (e: any) => void, disabled: boolean, icon: React.ReactNode, hotkey: string }) => (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-between w-full p-2 rounded-xl border transition-all mb-1 ${
        disabled 
        ? 'bg-black/40 border-white/5 text-white/20' 
        : 'bg-white/5 border-white/10 hover:bg-white/15 text-white'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
      </div>
      <span className="text-[8px] opacity-30 font-bold">{hotkey}</span>
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
      case 'arrow': return '🏹';
      default: return null;
    }
  })();

  return (
    <div className={`absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-20 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      
      {isHungerCritical && <div className="absolute inset-0 z-50 pointer-events-none shadow-[inset_0_0_100px_rgba(153,27,27,0.5)] animate-pulse" />}
      {isThirstCritical && <div className="absolute inset-0 z-50 pointer-events-none shadow-[inset_0_0_100px_rgba(30,58,138,0.5)] animate-pulse" />}

      <Compass rotation={playerRotation} />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
          <div className={`relative flex items-center justify-center transition-all duration-300 ${interaction.type !== 'none' || cookingItem ? 'scale-125' : 'scale-100'}`}>
            <div className={`w-1 h-1 rounded-full bg-white transition-opacity ${interaction.type !== 'none' || cookingItem ? 'opacity-0' : 'opacity-50'}`} />
            
            <div className={`absolute transition-all duration-200 flex flex-col items-center ${interaction.type !== 'none' || cookingItem ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
               <div className="text-2xl mb-1 drop-shadow-lg">{cookingItem ? '🍳' : interactionIcon}</div>
               <div className="text-[10px] font-black text-white uppercase bg-indigo-600 px-3 py-1 rounded shadow-lg">
                 {cookingItem ? t.campfire : (t[interaction.type as keyof typeof t] || interaction.type)}
               </div>
            </div>
          </div>
      </div>

      <div className="flex flex-col gap-3 items-start">
        <div className="bg-black/70 backdrop-blur-xl p-3 rounded-xl border border-white/10 w-40 shadow-xl pointer-events-auto">
          <div className="flex justify-between items-center text-[10px] text-indigo-400 font-black mb-2 border-b border-white/5 pb-1">
             <span>{t.day} {gameState.day}</span>
             <span>{formatTime(time)}</span>
          </div>
          <StatBar label={t.health} value={stats.health} color={COLORS.health} pulse={stats.health < 25} />
          <StatBar label={t.hunger} value={stats.hunger} color={COLORS.hunger} pulse={isHungerCritical} />
          <StatBar label={t.thirst} value={stats.thirst} color={COLORS.thirst} pulse={isThirstCritical} />
          <StatBar label={t.energy} value={stats.energy} color={COLORS.energy} glow={isWarmingUp} />
          <StatBar label={t.temp} value={stats.temperature} color={COLORS.temperature} unit="°" glow={isWarmingUp} />
        </div>

        <div className={`transition-all duration-300 pointer-events-auto flex flex-col items-start ${isCraftingOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}>
          <div className="bg-slate-900/80 backdrop-blur-xl p-3 rounded-xl border border-white/10 w-48 shadow-2xl">
             <div className="flex justify-between items-center mb-2 px-1">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-400">{t.craft}</h3>
               <button onClick={() => setIsCraftingOpen(false)} className="text-white/30 text-xs">×</button>
             </div>
             <CraftButton label={t.campfire} onClick={() => onCraft('campfire')} disabled={!canCraftCampfire} icon="🔥" hotkey="F" />
             <CraftButton label={t.Arrow} onClick={() => onCraft('arrows')} disabled={!canCraftArrow} icon={<ArrowIconSVG />} hotkey="X" />
             <CraftButton label={t.Bow} onClick={() => onCraft('bow')} disabled={!canCraftBow} icon="🏹" hotkey="V" />
             <CraftButton label={t.Torch} onClick={() => onCraft('torch')} disabled={!canCraftTorch} icon="🔦" hotkey="T" />
          </div>
        </div>
      </div>

      {isMobile && (
        <div className="absolute inset-0 pointer-events-none z-30">
          <div className="absolute bottom-6 left-6 w-20 h-20 bg-white/5 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center pointer-events-auto shadow-2xl" onTouchStart={handleJoystickStart} onTouchMove={handleJoystickMove} onTouchEnd={handleJoystickEnd}>
            <div className="w-6 h-6 bg-indigo-500 rounded-full border border-white shadow-lg" />
          </div>
          <div className="absolute bottom-6 right-6 w-20 h-20 bg-white/5 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center pointer-events-auto shadow-2xl" onTouchStart={handleLookStart} onTouchMove={handleLookMove} onTouchEnd={handleLookEnd}>
            <span className="text-[8px] font-black text-white/30">{t.look}</span>
          </div>
          <button onClick={() => setIsCraftingOpen(!isCraftingOpen)} className="absolute bottom-28 left-6 w-10 h-10 bg-orange-600 rounded-lg pointer-events-auto shadow-xl text-lg flex items-center justify-center">🛠️</button>
        </div>
      )}

      <div className="flex flex-col gap-2 z-10 w-full items-center mb-2">
        <div className="bg-black/70 backdrop-blur-xl p-1.5 rounded-xl border border-white/5 flex gap-1 max-w-[95vw] overflow-x-auto no-scrollbar pointer-events-auto shadow-2xl">
          {inventory.map((item, index) => (
            <button key={item.id} onClick={() => onUseItem(item.id)} className={`relative min-w-[44px] h-[44px] bg-white/5 hover:bg-white/10 rounded-lg border transition-all flex flex-col items-center justify-center ${activeToolId === item.id ? 'border-indigo-500 bg-indigo-500/20' : 'border-white/5'} ${pulseItems[item.name] ? 'animate-bounce border-indigo-400' : ''}`}>
              {!isMobile && index < 9 && <span className="absolute top-0 left-0.5 text-[8px] font-black text-indigo-400 opacity-50">{index + 1}</span>}
              <span className="text-xl sm:text-2xl">
                {item.name === 'Wood' && '🪵'} {item.name === 'Berries' && '🍒'}
                {item.name === 'Apple' && '🍎'} {item.name === 'Stone' && '🪨'}
                {item.name === 'Flint Stone' && '🔥'} {item.name === 'Raw Meat' && '🥩'}
                {item.name === 'Cooked Meat' && '🍖'} {item.name === 'Arrow' && '🏹'}
                {item.name === 'Bow' && '🏹'} {item.name === 'Torch' && '🔦'}
              </span>
              <span className="absolute -top-1 -right-1 bg-indigo-600 text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-md">{item.count}</span>
            </button>
          ))}
        </div>
      </div>
      
      <style>{`
        @keyframes bounce-gentle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes dizzy { 0%, 100% { filter: blur(0px); } 50% { filter: blur(1.5px); } }
        .animate-bounce-gentle { animation: bounce-gentle 2s ease-in-out infinite; }
        .animate-dizzy { animation: dizzy 8s ease-in-out infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default UIOverlay;
