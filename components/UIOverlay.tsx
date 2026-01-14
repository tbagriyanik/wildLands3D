
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { GameState, InteractionTarget, MobileInput, InventoryItem } from '../types';
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

const StatBar: React.FC<{ label: string, value: number, color: string, pulse?: boolean, icon?: React.ReactNode, unit?: string }> = ({ label, value, color, pulse = false, icon = null, unit = "%" }) => (
  <div className={`mb-1.5 w-full group ${pulse ? 'animate-pulse' : ''}`}>
    <div className="flex justify-between items-center text-[10px] sm:text-[12px] font-black text-black/70 group-hover:text-black transition-colors uppercase tracking-widest mb-0.5 px-0.5">
      <div className="flex items-center gap-1">{icon}<span>{label}</span></div>
      <span className="tabular-nums">{Math.round(value)}{unit}</span>
    </div>
    <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden border border-black/5">
      <div className="h-full transition-all duration-700 ease-out" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}80` }} />
    </div>
  </div>
);

const ResourceIndicator: React.FC<{ item: InventoryItem }> = ({ item }) => {
  const [pop, setPop] = useState(false);
  const prevCount = useRef(item.count);

  useEffect(() => {
    if (item.count !== prevCount.current) {
      setPop(true);
      const timer = setTimeout(() => setPop(false), 350);
      prevCount.current = item.count;
      return () => clearTimeout(timer);
    }
  }, [item.count]);

  return (
    <div className={`flex items-center justify-between gap-3 bg-white/60 backdrop-blur-md p-2 px-3 rounded-2xl border border-white/40 shadow-xl min-w-[90px] hover:bg-white/80 transition-all duration-300 ${pop ? 'scale-125 border-indigo-500 bg-white shadow-indigo-500/30' : 'scale-100'}`}>
      <span className="text-2xl">{getItemIcon(item.name)}</span>
      <span className="text-xs font-black text-black tabular-nums">{item.count}</span>
    </div>
  );
};

const CraftItem: React.FC<{ label: string, onClick: () => void, disabled: boolean, icon: string, req: string }> = ({ label, onClick, disabled, icon, req }) => (
  <div className={`group p-4 rounded-3xl border transition-all flex flex-col items-center text-center gap-1 ${disabled ? 'bg-black/40 border-white/5 opacity-50 grayscale' : 'bg-white/5 border-white/10 hover:bg-white/20 hover:scale-105 cursor-pointer shadow-2xl active:scale-95'}`} onClick={() => !disabled && onClick()}>
    <span className="text-4xl group-hover:scale-110 transition-transform">{icon}</span>
    <span className="text-[10px] font-black uppercase tracking-tighter text-white/90">{label}</span>
    <span className={`text-[8px] font-bold ${disabled ? 'text-red-400' : 'text-emerald-400'}`}>{req}</span>
  </div>
);

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  gameState, interaction, onUseItem, onCraft, isVisible, isHungerCritical, isThirstCritical, isWarmingUp, isMobile, onMobileInput, playerRotation, activeToolId, isCraftingOpen, setIsCraftingOpen, onToggleLanguage
}) => {
  const { stats, inventory, time, settings } = gameState;
  const t = TRANSLATIONS[settings.language];
  const joystickRef = useRef<{ startX: number; startY: number; isActive: boolean }>({ startX: 0, startY: 0, isActive: false });
  const [popId, setPopId] = useState<string | null>(null);

  const { hotbarItems, resourceItems } = useMemo(() => {
    const usable = inventory.filter(item => item.type === 'food' || item.type === 'tool').slice(0, 9);
    const resources = inventory.filter(item => item.type === 'resource');
    return { hotbarItems: usable, resourceItems: resources };
  }, [inventory]);

  // Eşya pop efekti
  useEffect(() => {
    if (inventory.length > 0) {
      const last = inventory[inventory.length - 1];
      setPopId(last.id);
      const timeout = setTimeout(() => setPopId(null), 400);
      return () => clearTimeout(timeout);
    }
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

  return (
    <div className={`absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-4 sm:p-10 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      
      <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-6 w-full">
        {/* Sol Üst Stats Paneli */}
        <div className="bg-white/80 backdrop-blur-2xl p-6 sm:p-8 rounded-[2.5rem] border border-white/60 w-full sm:w-72 pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
          <div className="flex justify-between items-center text-lg sm:text-xl text-black font-black mb-6 border-b-4 border-black/10 pb-3">
             <span className="uppercase tracking-tighter">{t.day} {gameState.day}</span>
             <span className="bg-indigo-600 px-4 py-1.5 rounded-3xl tabular-nums text-white text-base shadow-lg">{formatTime(time)}</span>
          </div>
          <StatBar label={t.health} value={stats.health} color={COLORS.health} pulse={stats.health < 25} />
          <StatBar label={t.hunger} value={stats.hunger} color={COLORS.hunger} pulse={isHungerCritical} />
          <StatBar label={t.thirst} value={stats.thirst} color={COLORS.thirst} pulse={isThirstCritical} />
          <StatBar label={t.temp} value={stats.temperature} color={COLORS.temperature} pulse={isWarmingUp} icon={isWarmingUp ? "🔥" : null} unit="°C" />
        </div>

        <div className="flex items-center gap-3 pointer-events-auto w-full sm:w-auto justify-center">
          <div className="relative flex-grow sm:flex-grow-0 w-full sm:w-72 h-12 sm:h-14 bg-white/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/50 flex items-center justify-center overflow-hidden shadow-2xl">
            <div className="absolute w-[400%] flex justify-around text-xs sm:text-sm font-black tracking-[0.5em] text-black" style={{ transform: `translateX(${-((playerRotation * 180 / Math.PI) % 360)}px)` }}>
              <span>S</span><span>W</span><span>N</span><span>E</span><span>S</span><span>W</span><span>N</span><span>E</span>
            </div>
            <div className="absolute w-1 h-6 sm:h-8 bg-indigo-600 z-10 rounded-full" />
          </div>
          <button onClick={onToggleLanguage} className="w-12 h-12 sm:w-14 sm:h-14 bg-white/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/50 flex items-center justify-center text-[10px] sm:text-[12px] font-black text-black hover:bg-white active:scale-90 transition-all uppercase tracking-widest shadow-2xl">
            {settings.language}
          </button>
        </div>
      </div>

      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 pointer-events-auto">
        <div className="bg-white/30 backdrop-blur-3xl p-3 rounded-[2rem] border border-white/40 flex flex-col gap-3 shadow-2xl">
          {resourceItems.length > 0 ? resourceItems.map(item => (
            <ResourceIndicator key={item.id} item={item} />
          )) : (
            <div className="text-[10px] text-black/50 font-black p-4 uppercase text-center italic">Envanter Boş</div>
          )}
        </div>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
        <div className={`transition-all duration-500 ${interaction.type !== 'none' ? 'scale-125 sm:scale-150' : 'scale-100 opacity-20'}`}>
          <div className={`relative flex items-center justify-center transition-all ${interaction.type !== 'none' ? 'w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-full border border-white/50 shadow-2xl' : 'w-2 h-2 sm:w-3 sm:h-3 bg-white/80 rounded-full'}`}>
            <span className={`text-2xl sm:text-3xl drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] ${interaction.type !== 'none' ? 'opacity-100' : 'opacity-0'}`}>{getInteractionIcon(interaction.type)}</span>
          </div>
          {interaction.type !== 'none' && (
            <div className="mt-4 bg-indigo-600/90 backdrop-blur-xl px-5 py-2.5 rounded-2xl text-[10px] sm:text-[12px] font-black uppercase tracking-widest animate-in slide-in-from-bottom-4 shadow-2xl text-white border border-white/20">
              {t[interaction.type as keyof typeof t] || interaction.type}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 sm:gap-8 w-full">
        {isMobile && (
          <div className="w-full flex justify-between px-6 sm:px-12 items-end pointer-events-none mb-4">
            <div className="w-32 h-32 sm:w-40 sm:h-40 bg-white/10 backdrop-blur-2xl rounded-full border border-white/20 pointer-events-auto flex items-center justify-center shadow-2xl" onTouchStart={handleJoystickStart} onTouchMove={handleJoystickMove} onTouchEnd={handleJoystickEnd}>
               <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-500/40 rounded-full border border-indigo-400/50 shadow-inner" />
            </div>
            <div className="flex flex-col gap-4 sm:gap-6 pointer-events-auto">
               <button onClick={() => setIsCraftingOpen(true)} className="w-16 h-16 sm:w-24 sm:h-24 bg-amber-500/90 backdrop-blur-xl rounded-3xl text-3xl sm:text-4xl flex items-center justify-center active:scale-90 shadow-2xl border border-white/20">🛠️</button>
               <button onTouchStart={() => onMobileInput(prev => ({ ...prev, jump: true }))} onTouchEnd={() => onMobileInput(prev => ({ ...prev, jump: false }))} className="w-18 h-18 sm:w-28 sm:h-28 bg-indigo-600/90 backdrop-blur-xl rounded-full text-3xl sm:text-4xl flex items-center justify-center active:scale-90 shadow-2xl border border-white/20">⬆️</button>
            </div>
          </div>
        )}

        <div className="bg-white/40 backdrop-blur-2xl p-3 sm:p-5 rounded-[2.5rem] border border-white/50 flex gap-3 sm:gap-5 pointer-events-auto overflow-x-auto no-scrollbar max-w-full sm:max-w-[85vw] shadow-[0_30px_60px_rgba(0,0,0,0.3)]">
          {hotbarItems.map((item, index) => (
            <button key={item.id} onClick={() => onUseItem(item.id)} className={`relative min-w-[64px] sm:min-w-[80px] h-[64px] sm:h-[80px] rounded-2xl sm:rounded-3xl border transition-all duration-500 flex items-center justify-center text-3xl sm:text-4xl ${activeToolId === item.id ? 'bg-indigo-600/60 border-indigo-400 shadow-[0_0_25px_rgba(79,70,229,0.5)] scale-110' : 'bg-white/20 border-white/30'} ${popId === item.id ? 'scale-125 border-emerald-400 shadow-emerald-500/30' : 'scale-100'} hover:bg-white/40 group active:scale-95`}>
              <span className="absolute top-1.5 left-2.5 text-[10px] sm:text-[12px] font-black text-black/30 group-hover:text-black/80 transition-colors uppercase tracking-widest">{index + 1}</span>
              {getItemIcon(item.name)}
              <span className={`absolute -bottom-2 -right-2 sm:-bottom-3 sm:-right-3 bg-indigo-700 text-[10px] sm:text-[12px] font-black min-w-[22px] sm:min-w-[28px] h-[22px] sm:h-[28px] rounded-xl flex items-center justify-center border-2 border-white shadow-xl text-white transition-all duration-300 ${popId === item.id ? 'scale-150 rotate-12' : 'scale-100'}`}>{item.count}</span>
            </button>
          ))}
          {hotbarItems.length === 0 && <span className="px-8 sm:px-12 py-4 sm:py-6 text-black/30 font-black italic tracking-[0.2em] text-xs sm:text-base uppercase whitespace-nowrap">Ekipman Yok</span>}
        </div>
      </div>

      {isCraftingOpen && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center pointer-events-auto z-50 animate-in fade-in duration-500 p-4">
          <div className="bg-slate-900/40 p-10 sm:p-14 rounded-[3.5rem] border border-white/10 w-full max-w-[45rem] shadow-[0_0_100px_rgba(99,102,241,0.2)] overflow-hidden relative max-h-[95vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-10 sm:mb-14">
              <h2 className="text-3xl sm:text-5xl font-black italic tracking-tighter text-indigo-400 uppercase drop-shadow-[0_0_20px_rgba(99,102,241,0.5)]">ÜRETİM</h2>
              <button onClick={() => setIsCraftingOpen(false)} className="text-4xl sm:text-6xl font-thin hover:text-red-500 hover:rotate-90 transition-all duration-500">×</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 sm:gap-8">
              <CraftItem label={t.campfire} icon="🔥" req="3 Wood, 1 Flint" disabled={!canCraftCampfire} onClick={() => onCraft('campfire')} />
              <CraftItem label={t.Arrow} icon="🏹" req="1 Wood (5x)" disabled={!canCraftArrow} onClick={() => onCraft('arrows')} />
              <CraftItem label={t.Bow} icon="🏹" req="3 Wood" disabled={!canCraftBow} onClick={() => onCraft('bow')} />
              <CraftItem label={t.Torch} icon="🔦" req="1 Wood, 1 Flint" disabled={!canCraftTorch} onClick={() => onCraft('torch')} />
              <CraftItem label={t.craftWaterskin} icon="🍶" req={t.waterskinReq} disabled={!canCraftWaterskin} onClick={() => onCraft('waterskin')} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UIOverlay;
