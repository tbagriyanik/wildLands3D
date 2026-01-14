
import React, { useRef, useState, useEffect } from 'react';
import { GameState, InteractionTarget, MobileInput } from '../types';
import { COLORS, TRANSLATIONS } from '../constants';

interface UIOverlayProps {
  gameState: GameState;
  interaction: InteractionTarget;
  onUseItem: (id: string) => void;
  onCraft: (type: string) => void;
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
  onToggleLanguage: () => void;
}

const getItemIcon = (name: string): string => {
  switch (name) {
    case 'Wood': return '🪵';
    case 'Berries': return '🍒';
    case 'Apple': return '🍎';
    case 'Stone': return '🪨';
    case 'Flint Stone': return '🔥';
    case 'Raw Meat': return '🥩';
    case 'Cooked Meat': return '🍖';
    case 'Arrow': return '🏹';
    case 'Bow': return '🏹';
    case 'Torch': return '🔦';
    case 'Waterskin (Empty)': return '🍶';
    case 'Waterskin (Full)': return '💦';
    case 'Roasted Apple': return '🍎';
    case 'Cooked Berries': return '🍒';
    default: return '📦';
  }
};

const getInteractionIcon = (type: string): string => {
  switch (type) {
    case 'tree': return '🪓';
    case 'appleTree': return '🧺';
    case 'bush': return '🍒';
    case 'rock': return '⛏️';
    case 'water': return '💧';
    case 'campfire': return '🍳';
    case 'rabbit':
    case 'squirrel':
    case 'partridge':
    case 'deer': return '🏹';
    case 'arrow': return '🤏';
    default: return '🖐️';
  }
};

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  gameState, interaction, onUseItem, onCraft, isVisible, isHungerCritical, isThirstCritical, isWarmingUp, isMobile, onMobileInput, playerRotation, activeToolId, isCraftingOpen, setIsCraftingOpen, onToggleLanguage
}) => {
  const { stats, inventory, time, settings } = gameState;
  const t = TRANSLATIONS[settings.language];
  const joystickRef = useRef<{ startX: number; startY: number; isActive: boolean }>({ startX: 0, startY: 0, isActive: false });
  const [popItem, setPopItem] = useState<string | null>(null);

  useEffect(() => {
    const lastItem = inventory[0]?.id;
    setPopItem(lastItem);
    const timeout = setTimeout(() => setPopItem(null), 300);
    return () => clearTimeout(timeout);
  }, [inventory]);

  const woodCount = inventory.find(i => i.name === 'Wood')?.count || 0;
  const flintCount = inventory.find(i => i.name === 'Flint Stone')?.count || 0;
  
  const canCraftCampfire = woodCount >= 3 && flintCount >= 1;
  const canCraftArrow = woodCount >= 1;
  const canCraftBow = woodCount >= 3;
  const canCraftTorch = woodCount >= 1 && flintCount >= 1;
  const canCraftWaterskin = woodCount >= 2;

  const handleJoystickStart = (e: React.TouchEvent) => { joystickRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, isActive: true }; };
  const handleJoystickMove = (e: React.TouchEvent) => {
    if (!joystickRef.current.isActive) return;
    const dx = e.touches[0].clientX - joystickRef.current.startX;
    const dy = e.touches[0].clientY - joystickRef.current.startY;
    const dist = Math.min(30, Math.sqrt(dx * dx + dy * dy));
    const angle = Math.atan2(dy, dx);
    onMobileInput(prev => ({ ...prev, moveX: (Math.cos(angle) * dist) / 30, moveY: -(Math.sin(angle) * dist) / 30 }));
  };
  const handleJoystickEnd = () => { joystickRef.current.isActive = false; onMobileInput(prev => ({ ...prev, moveX: 0, moveY: 0 })); };

  const formatTime = (t: number) => {
    const hours = Math.floor(t / 100);
    const minutes = Math.floor((t % 100) * 0.6);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const StatBar = ({ label, value, color, pulse = false, icon = null }: { label: string, value: number, color: string, pulse?: boolean, icon?: React.ReactNode }) => (
    <div className={`mb-1.5 w-full group ${pulse ? 'animate-pulse' : ''}`}>
      <div className="flex justify-between items-center text-[7px] font-black text-black/70 group-hover:text-black transition-colors uppercase tracking-widest mb-0.5 px-0.5">
        <div className="flex items-center gap-1">{icon}<span>{label}</span></div>
        <span className="tabular-nums">{Math.round(value)}%</span>
      </div>
      <div className="w-full h-1 bg-black/10 rounded-full overflow-hidden border border-black/5">
        <div className="h-full transition-all duration-700 ease-out" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}60` }} />
      </div>
    </div>
  );

  const CraftItem = ({ label, onClick, disabled, icon, req }: { label: string, onClick: () => void, disabled: boolean, icon: string, req: string }) => (
    <div className={`group p-4 rounded-2xl border transition-all flex flex-col items-center text-center gap-1 ${disabled ? 'bg-black/40 border-white/5 opacity-50 grayscale' : 'bg-white/5 border-white/10 hover:bg-white/20 hover:scale-105 cursor-pointer shadow-lg active:scale-95'}`} onClick={() => !disabled && onClick()}>
      <span className="text-3xl group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
      <span className={`text-[7px] font-bold ${disabled ? 'text-red-400' : 'text-green-400'}`}>{req}</span>
    </div>
  );

  return (
    <div className={`absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-4 sm:p-8 transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'} responsive-ui`}>
      
      {/* Üst Panel: Gün, Pusula, Dil */}
      <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4 w-full">
        <div className="top-left-stats bg-white/60 backdrop-blur-xl p-3 sm:p-4 rounded-[1.2rem] sm:rounded-[1.5rem] border border-white/40 w-full sm:w-44 pointer-events-auto shadow-xl">
          <div className="flex justify-between items-center text-[9px] sm:text-[10px] text-black font-black mb-2 border-b border-black/10 pb-2">
             <span>{t.day} {gameState.day}</span>
             <span className="bg-black/10 px-1.5 py-0.5 rounded-full text-[8px]">{formatTime(time)}</span>
          </div>
          <StatBar label={t.health} value={stats.health} color={COLORS.health} pulse={stats.health < 25} />
          <StatBar label={t.hunger} value={stats.hunger} color={COLORS.hunger} pulse={isHungerCritical} />
          <StatBar label={t.thirst} value={stats.thirst} color={COLORS.thirst} pulse={isThirstCritical} />
          <StatBar label={t.temp} value={stats.temperature} color={COLORS.temperature} pulse={isWarmingUp} icon={isWarmingUp ? "🔥" : null} />
        </div>

        <div className="top-right-controls flex items-center gap-2 pointer-events-auto w-full sm:w-auto justify-center">
          <div className="relative flex-grow sm:flex-grow-0 w-full sm:w-64 h-10 sm:h-12 bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/40 flex items-center justify-center overflow-hidden shadow-xl">
            <div className="absolute w-[400%] flex justify-around text-[10px] sm:text-[11px] font-black tracking-[0.4em] text-black" style={{ transform: `translateX(${-((playerRotation * 180 / Math.PI) % 360)}px)` }}>
              <span>S</span><span>W</span><span>N</span><span>E</span><span>S</span><span>W</span><span>N</span><span>E</span>
            </div>
            <div className="absolute w-0.5 h-5 sm:h-6 bg-indigo-600 z-10" />
          </div>
          <button 
            onClick={onToggleLanguage}
            className="w-10 h-10 sm:w-12 sm:h-12 bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/40 flex items-center justify-center text-[9px] sm:text-[10px] font-black text-black hover:bg-white/40 active:scale-95 transition-all uppercase tracking-widest shadow-xl"
          >
            {settings.language}
          </button>
        </div>
      </div>

      {/* Orta Etkileşim İkonu */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
        <div className={`transition-all duration-300 ${interaction.type !== 'none' ? 'scale-125 sm:scale-150' : 'scale-100'}`}>
          <div className={`relative flex items-center justify-center transition-all ${interaction.type !== 'none' ? 'w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full border border-white/40 shadow-lg' : 'w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/60 rounded-full'}`}>
            <span className={`text-xl sm:text-2xl drop-shadow-2xl ${interaction.type !== 'none' ? 'opacity-100' : 'opacity-0'}`}>{getInteractionIcon(interaction.type)}</span>
          </div>
          {interaction.type !== 'none' && (
            <div className="mt-3 bg-indigo-600/90 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-bottom-2 shadow-2xl text-white">
              {t[interaction.type as keyof typeof t] || interaction.type}
            </div>
          )}
        </div>
      </div>

      {/* Alt Panel: Joystick ve Envanter */}
      <div className="flex flex-col items-center gap-4 sm:gap-8 w-full">
        {isMobile && (
          <div className="mobile-controls-row w-full flex justify-between px-4 sm:px-8 items-end pointer-events-none mb-2">
            <div className="joystick-container w-28 h-28 sm:w-36 sm:h-36 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 pointer-events-auto flex items-center justify-center shadow-2xl" onTouchStart={handleJoystickStart} onTouchMove={handleJoystickMove} onTouchEnd={handleJoystickEnd}>
               <div className="w-10 h-10 sm:w-14 sm:h-14 bg-indigo-500/40 rounded-full border border-indigo-400/50" />
            </div>
            <div className="mobile-buttons flex flex-col gap-3 sm:gap-4 pointer-events-auto">
               <button onClick={() => setIsCraftingOpen(true)} className="w-14 h-14 sm:w-20 sm:h-20 bg-amber-500/90 backdrop-blur-md rounded-2xl sm:rounded-3xl text-2xl sm:text-3xl flex items-center justify-center active:scale-90 shadow-xl border border-white/20">🛠️</button>
               <button onTouchStart={() => onMobileInput(prev => ({ ...prev, jump: true }))} onTouchEnd={() => onMobileInput(prev => ({ ...prev, jump: false }))} className="w-16 h-16 sm:w-24 sm:h-24 bg-indigo-600/90 backdrop-blur-md rounded-full text-2xl sm:text-3xl flex items-center justify-center active:scale-90 shadow-xl border border-white/20">⬆️</button>
            </div>
          </div>
        )}

        <div className="inventory-bar bg-slate-950/60 backdrop-blur-3xl p-3 sm:p-4 rounded-[1.8rem] sm:rounded-[2.5rem] border border-white/10 flex gap-2 sm:gap-3 pointer-events-auto overflow-x-auto no-scrollbar max-w-full sm:max-w-[90vw] shadow-[0_15px_50px_rgba(0,0,0,0.7)]">
          {inventory.map((item, index) => (
            <button key={item.id} onClick={() => onUseItem(item.id)} className={`relative min-w-[50px] sm:min-w-[64px] h-[50px] sm:h-[64px] rounded-xl sm:rounded-2xl border transition-all duration-300 flex items-center justify-center text-2xl sm:text-3xl ${activeToolId === item.id ? 'bg-indigo-500/40 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-white/5 border-white/5'} ${popItem === item.id ? 'scale-110 sm:scale-125' : 'scale-100'} hover:bg-white/10 group`}>
              {!isMobile && index < 9 && (
                <span className="absolute top-1 left-2 text-[8px] sm:text-[10px] font-black text-white/30 group-hover:text-white/80 transition-colors uppercase tracking-widest">{index + 1}</span>
              )}
              {getItemIcon(item.name)}
              <span className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 bg-indigo-600 text-[9px] sm:text-[11px] font-black min-w-[18px] sm:min-w-[22px] h-[18px] sm:h-[22px] rounded-lg sm:rounded-xl flex items-center justify-center border border-white/10 shadow-lg text-white">{item.count}</span>
            </button>
          ))}
          {inventory.length === 0 && <span className="px-4 sm:px-6 py-3 sm:py-4 text-white/20 font-black italic tracking-widest text-[10px] sm:text-sm uppercase whitespace-nowrap">{t.emptyInventory}</span>}
        </div>
      </div>

      {isCraftingOpen && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-3xl flex items-center justify-center pointer-events-auto z-50 animate-in fade-in p-4">
          <div className="bg-slate-900/60 p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-white/10 w-full max-w-[40rem] shadow-2xl overflow-hidden relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6 sm:mb-10">
              <h2 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-indigo-400 uppercase">ÜRETİM</h2>
              <button onClick={() => setIsCraftingOpen(false)} className="text-3xl sm:text-4xl font-bold hover:text-red-500 transition-colors">×</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <CraftItem label={t.campfire} icon="🔥" req="3 Wood, 1 Flint" disabled={!canCraftCampfire} onClick={() => onCraft('campfire')} />
              <CraftItem label={t.Arrow} icon="🏹" req="1 Wood (5x)" disabled={!canCraftArrow} onClick={() => onCraft('arrows')} />
              <CraftItem label={t.Bow} icon="🏹" req="3 Wood" disabled={!canCraftBow} onClick={() => onCraft('bow')} />
              <CraftItem label={t.Torch} icon="🔦" req="1 Wood, 1 Flint" disabled={!canCraftTorch} onClick={() => onCraft('torch')} />
              <CraftItem label={t.craftWaterskin} icon="🍶" req={t.waterskinReq} disabled={!canCraftWaterskin} onClick={() => onCraft('waterskin')} />
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        
        /* Mobil Oryantasyon Uyumluluğu */
        @media (orientation: portrait) {
          .top-left-stats { width: 100% !important; max-width: 250px; }
          .top-right-controls { width: 100% !important; margin-top: 0.5rem; }
          .inventory-bar { padding: 0.5rem !important; border-radius: 1.5rem !important; }
        }
        
        @media (max-width: 640px) {
          .responsive-ui { padding: 1rem !important; }
        }
        
        @keyframes pop { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default UIOverlay;
