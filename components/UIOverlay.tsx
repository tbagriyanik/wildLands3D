
import React, { useRef } from 'react';
import { GameState, InteractionTarget, MobileInput } from '../types';
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
  gameState, interaction, onUseItem, onCraft, isVisible, isHungerCritical, isThirstCritical, isWarmingUp, isMobile, onMobileInput, playerRotation, activeToolId, isCraftingOpen, setIsCraftingOpen
}) => {
  const { stats, inventory, time, settings } = gameState;
  const t = TRANSLATIONS[settings.language];
  const joystickRef = useRef<{ startX: number; startY: number; isActive: boolean }>({ startX: 0, startY: 0, isActive: false });
  const lookRef = useRef<{ lastX: number; lastY: number; isActive: boolean }>({ lastX: 0, lastY: 0, isActive: false });

  const woodCount = inventory.find(i => i.name === 'Wood')?.count || 0;
  const flintCount = inventory.find(i => i.name === 'Flint Stone')?.count || 0;
  
  const canCraftCampfire = woodCount >= 3 && flintCount >= 1;
  const canCraftArrow = woodCount >= 1;
  const canCraftBow = woodCount >= 3;
  const canCraftTorch = woodCount >= 1 && flintCount >= 1;

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

  const handleLookStart = (e: React.TouchEvent) => { lookRef.current = { lastX: e.touches[0].clientX, lastY: e.touches[0].clientY, isActive: true }; };
  const handleLookMove = (e: React.TouchEvent) => {
    if (!lookRef.current.isActive) return;
    const dx = e.touches[0].clientX - lookRef.current.lastX;
    const dy = e.touches[0].clientY - lookRef.current.lastY;
    lookRef.current.lastX = e.touches[0].clientX; lookRef.current.lastY = e.touches[0].clientY;
    onMobileInput(prev => ({ ...prev, lookX: dx, lookY: dy }));
    setTimeout(() => onMobileInput(prev => ({ ...prev, lookX: 0, lookY: 0 })), 0);
  };
  const handleLookEnd = () => { lookRef.current.isActive = false; };

  const formatTime = (t: number) => {
    const hours = Math.floor(t / 100);
    const minutes = Math.floor((t % 100) * 0.6);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const StatBar = ({ label, value, color, pulse = false, icon = null }: { label: string, value: number, color: string, pulse?: boolean, icon?: React.ReactNode }) => (
    <div className={`mb-3 w-full group ${pulse ? 'animate-pulse' : ''}`}>
      <div className="flex justify-between items-center text-[9px] font-black text-white/50 group-hover:text-white transition-colors uppercase tracking-widest mb-1 px-1">
        <div className="flex items-center gap-1">
          {icon}
          <span>{label}</span>
        </div>
        <span className="tabular-nums">{Math.round(value)}%</span>
      </div>
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden backdrop-blur-md border border-white/5">
        <div className="h-full transition-all duration-700 ease-out" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}80` }} />
      </div>
    </div>
  );

  const CraftItem = ({ label, onClick, disabled, icon, req }: { label: string, onClick: () => void, disabled: boolean, icon: string, req: string }) => (
    <div className={`group p-5 rounded-3xl border transition-all flex flex-col items-center text-center gap-2 ${disabled ? 'bg-black/40 border-white/5 opacity-50 grayscale' : 'bg-white/5 border-white/10 hover:bg-white/20 hover:scale-105 cursor-pointer shadow-lg active:scale-95'}`} onClick={() => !disabled && onClick()}>
      <span className="text-4xl mb-1 group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
      <span className={`text-[8px] font-bold ${disabled ? 'text-red-400' : 'text-green-400'}`}>{req}</span>
    </div>
  );

  return (
    <div className={`absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-8 transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* HUD - Stats Container */}
      <div className="flex justify-between items-start">
        <div className="bg-slate-950/40 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/10 w-48 pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="flex justify-between items-center text-[10px] text-indigo-400 font-black mb-4 border-b border-white/5 pb-3">
             <span className="opacity-70">{t.day} {gameState.day}</span>
             <span className="bg-indigo-500/20 px-2 py-0.5 rounded-full">{formatTime(time)}</span>
          </div>
          <StatBar label={t.health} value={stats.health} color={COLORS.health} pulse={stats.health < 25} />
          <StatBar label={t.hunger} value={stats.hunger} color={COLORS.hunger} pulse={isHungerCritical} />
          <StatBar label={t.thirst} value={stats.thirst} color={COLORS.thirst} pulse={isThirstCritical} />
          <StatBar label={t.energy} value={stats.energy} color={COLORS.energy} />
          <StatBar 
            label={t.temp} 
            value={stats.temperature} 
            color={COLORS.temperature} 
            pulse={isWarmingUp || stats.temperature < 20} 
            icon={isWarmingUp ? <span className="text-[10px] animate-bounce">🔥</span> : null}
          />
        </div>

        {/* Improved Compass */}
        <div className="relative w-64 h-12 bg-slate-950/40 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden shadow-inner">
          <div className="absolute w-[400%] flex justify-around text-[11px] font-black tracking-[0.4em] text-white/40 transition-transform duration-150 ease-out" style={{ transform: `translateX(${-((playerRotation * 180 / Math.PI) % 360) * 1}px)` }}>
            <span>S</span><span>SW</span><span>W</span><span>NW</span><span>N</span><span>NE</span><span>E</span><span>SE</span><span>S</span><span>SW</span><span>W</span><span>NW</span><span>N</span><span>NE</span><span>E</span><span>SE</span>
          </div>
          <div className="absolute w-0.5 h-6 bg-indigo-500 shadow-[0_0_15px_#6366f1] z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/80 pointer-events-none" />
        </div>
      </div>

      {/* Interaction Crosshair - Advanced Cursor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
        <div className={`transition-all duration-300 flex flex-col items-center ${interaction.type !== 'none' ? 'scale-125' : 'scale-100'}`}>
          <div className={`relative flex items-center justify-center transition-all duration-500 ${interaction.type !== 'none' ? 'w-16 h-16 bg-white/10 rounded-full border border-white/30' : 'w-2 h-2 bg-white/60 rounded-full'}`}>
            <span className={`text-2xl drop-shadow-2xl transition-opacity duration-300 ${interaction.type !== 'none' ? 'opacity-100' : 'opacity-0'}`}>
               {getInteractionIcon(interaction.type)}
            </span>
            {interaction.type !== 'none' && <div className="absolute inset-0 border-2 border-indigo-400 rounded-full animate-ping opacity-20" />}
          </div>
          
          {interaction.type !== 'none' && (
            <div className="mt-6 bg-indigo-600/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl animate-in slide-in-from-bottom-2 duration-300">
              {t[interaction.type as keyof typeof t] || interaction.type}
            </div>
          )}
        </div>
      </div>

      {/* Crafting Menu (UX Optimized) */}
      {isCraftingOpen && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-3xl flex items-center justify-center pointer-events-auto z-50 animate-in fade-in duration-500">
          <div className="bg-slate-900/60 p-10 rounded-[3rem] border border-white/10 w-[36rem] shadow-[0_40px_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-3xl font-black italic text-white tracking-tighter">CRAFTING</h2>
                <p className="text-indigo-400 text-[10px] font-black tracking-widest uppercase opacity-60">Survival Guide v2.0</p>
              </div>
              <button onClick={() => setIsCraftingOpen(false)} className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-all flex items-center justify-center text-2xl font-bold">×</button>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <CraftItem label={t.campfire} icon="🔥" req="3 Wood, 1 Flint" disabled={!canCraftCampfire} onClick={() => onCraft('campfire')} />
              <CraftItem label={t.Arrow} icon="🏹" req="1 Wood (5x)" disabled={!canCraftArrow} onClick={() => onCraft('arrows')} />
              <CraftItem label={t.Bow} icon="🏹" req="3 Wood" disabled={!canCraftBow} onClick={() => onCraft('bow')} />
              <CraftItem label={t.Torch} icon="🔦" req="1 Wood, 1 Flint" disabled={!canCraftTorch} onClick={() => onCraft('torch')} />
            </div>
            <div className="mt-10 pt-6 border-t border-white/5 flex justify-center gap-8">
               <div className="flex flex-col items-center">
                 <span className="text-white font-black text-xl">{woodCount}</span>
                 <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">Wood</span>
               </div>
               <div className="flex flex-col items-center">
                 <span className="text-white font-black text-xl">{flintCount}</span>
                 <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">Flint</span>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Optimized Inventory Bar */}
      <div className="flex flex-col items-center gap-8">
        {isMobile && (
          <div className="w-full flex justify-between px-8 mb-4 items-end pointer-events-none">
            <div className="w-36 h-36 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 pointer-events-auto flex items-center justify-center shadow-2xl" onTouchStart={handleJoystickStart} onTouchMove={handleJoystickMove} onTouchEnd={handleJoystickEnd}>
               <div className="w-14 h-14 bg-indigo-500/40 rounded-full border border-white/20 shadow-inner" />
            </div>
            <div className="flex flex-col gap-4 pointer-events-auto">
               <button onClick={() => setIsCraftingOpen(true)} className="w-20 h-20 bg-amber-500 rounded-[2rem] border-4 border-white/20 shadow-2xl text-3xl flex items-center justify-center active:scale-90 transition-transform">🛠️</button>
               <button onTouchStart={() => onMobileInput(prev => ({ ...prev, jump: true }))} onTouchEnd={() => onMobileInput(prev => ({ ...prev, jump: false }))} className="w-24 h-24 bg-indigo-600 rounded-full border-4 border-white/20 shadow-2xl flex items-center justify-center text-3xl active:scale-90 transition-transform">⬆️</button>
            </div>
          </div>
        )}

        <div className="bg-slate-950/60 backdrop-blur-3xl p-4 rounded-[2.5rem] border border-white/10 flex gap-3 pointer-events-auto overflow-x-auto no-scrollbar max-w-full shadow-[0_30px_60px_rgba(0,0,0,0.6)] group">
          {inventory.map((item, index) => (
            <button key={item.id} onClick={() => onUseItem(item.id)} className={`relative min-w-[60px] h-[60px] rounded-2xl border transition-all duration-300 flex items-center justify-center text-3xl hover:-translate-y-2 ${activeToolId === item.id ? 'bg-indigo-500/40 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'}`}>
              {!isMobile && <span className="absolute -top-1 -left-1 w-5 h-5 bg-black/40 backdrop-blur-md rounded-lg flex items-center justify-center text-[9px] font-black text-white/40 border border-white/5">{index + 1}</span>}
              {getItemIcon(item.name)}
              <span className="absolute -bottom-2 -right-2 bg-indigo-600 text-[11px] font-black min-w-[22px] h-[22px] px-1.5 rounded-xl flex items-center justify-center shadow-2xl border border-white/10 tabular-nums">{item.count}</span>
            </button>
          ))}
          {inventory.length === 0 && <span className="px-6 py-4 text-white/20 font-black italic tracking-widest text-sm uppercase">{t.emptyInventory}</span>}
        </div>
      </div>
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
      `}</style>
    </div>
  );
};

export default UIOverlay;
