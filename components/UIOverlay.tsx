
import React, { useRef, useState, useEffect } from 'react';
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

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  gameState, interaction, onUseItem, onCraft, onCook, cookingItem, isVisible, isHungerCritical, isThirstCritical, isWarmingUp, isMobile, onMobileInput, playerRotation, activeToolId, isCraftingOpen, setIsCraftingOpen
}) => {
  const { stats, inventory, time, settings } = gameState;
  const t = TRANSLATIONS[settings.language];
  const [pulseItems, setPulseItems] = useState<Record<string, boolean>>({});
  const joystickRef = useRef<{ startX: number; startY: number; isActive: boolean }>({ startX: 0, startY: 0, isActive: false });
  const lookRef = useRef<{ lastX: number; lastY: number; isActive: boolean }>({ lastX: 0, lastY: 0, isActive: false });

  const woodCount = inventory.find(i => i.name === 'Wood')?.count || 0;
  const flintCount = inventory.find(i => i.name === 'Flint Stone')?.count || 0;
  
  const canCraftCampfire = woodCount >= 3 && flintCount >= 1;
  const canCraftArrow = woodCount >= 1;
  const canCraftBow = !inventory.some(i => i.name === 'Bow') && woodCount >= 3;
  const canCraftTorch = !inventory.some(i => i.name === 'Torch') && woodCount >= 1 && flintCount >= 1;

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

  const StatBar = ({ label, value, color, pulse = false }: { label: string, value: number, color: string, pulse?: boolean }) => (
    <div className={`mb-2 w-full ${pulse ? 'animate-pulse' : ''}`}>
      <div className="flex justify-between items-center text-[10px] font-black text-white/80 uppercase tracking-widest mb-1 px-1">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
        <div className="h-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
      </div>
    </div>
  );

  const CraftItem = ({ label, onClick, disabled, icon, req }: { label: string, onClick: () => void, disabled: boolean, icon: string, req: string }) => (
    <div className={`p-4 rounded-2xl border transition-all flex flex-col items-center text-center gap-2 ${disabled ? 'bg-black/40 border-white/5 opacity-50' : 'bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer'}`} onClick={() => !disabled && onClick()}>
      <span className="text-4xl mb-1">{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
      <span className={`text-[8px] font-bold ${disabled ? 'text-red-400' : 'text-green-400'}`}>{req}</span>
    </div>
  );

  return (
    <div className={`absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-6 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* HUD - Stats */}
      <div className="flex justify-between items-start">
        <div className="bg-black/60 backdrop-blur-xl p-4 rounded-2xl border border-white/10 w-44 pointer-events-auto">
          <div className="flex justify-between items-center text-[11px] text-indigo-400 font-black mb-3 border-b border-white/5 pb-2">
             <span>{t.day} {gameState.day}</span>
             <span>{formatTime(time)}</span>
          </div>
          <StatBar label={t.health} value={stats.health} color={COLORS.health} pulse={stats.health < 25} />
          <StatBar label={t.hunger} value={stats.hunger} color={COLORS.hunger} pulse={isHungerCritical} />
          <StatBar label={t.thirst} value={stats.thirst} color={COLORS.thirst} pulse={isThirstCritical} />
          <StatBar label={t.energy} value={stats.energy} color={COLORS.energy} />
        </div>

        {/* Compass */}
        <div className="relative w-48 h-10 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center overflow-hidden">
          <div className="absolute w-[200%] flex justify-around text-[10px] font-black tracking-widest transition-transform duration-100" style={{ transform: `translateX(${-((playerRotation * 180 / Math.PI) % 360) * 0.5}px)` }}>
            <span>S</span><span>W</span><span>N</span><span>E</span><span>S</span><span>W</span><span>N</span><span>E</span>
          </div>
          <div className="absolute w-0.5 h-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" />
        </div>
      </div>

      {/* Interaction Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
        <div className={`w-1 h-1 rounded-full bg-white/50 ${interaction.type !== 'none' ? 'scale-0' : 'scale-100'}`} />
        {interaction.type !== 'none' && (
          <div className="flex flex-col items-center animate-in zoom-in fade-in duration-300">
            <span className="text-4xl mb-2 drop-shadow-lg">
              {interaction.type === 'tree' ? '🪓' : interaction.type === 'rock' ? '⛏️' : interaction.type === 'campfire' ? '🔥' : '📦'}
            </span>
            <div className="bg-black/80 px-4 py-2 rounded-xl border border-white/20 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
              {t[interaction.type as keyof typeof t] || interaction.type} (E)
            </div>
          </div>
        )}
      </div>

      {/* Crafting Modal */}
      {isCraftingOpen && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center pointer-events-auto z-50">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-white/10 w-[32rem] shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black italic text-indigo-400 tracking-tighter">CRAFTING MENU</h2>
              <button onClick={() => setIsCraftingOpen(false)} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center font-bold">×</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CraftItem label={t.campfire} icon="🔥" req="3 Wood, 1 Flint" disabled={!canCraftCampfire} onClick={() => onCraft('campfire')} />
              <CraftItem label={t.Arrow} icon="🏹" req="1 Wood (5x)" disabled={!canCraftArrow} onClick={() => onCraft('arrows')} />
              <CraftItem label={t.Bow} icon="🏹" req="3 Wood" disabled={!canCraftBow} onClick={() => onCraft('bow')} />
              <CraftItem label={t.Torch} icon="🔦" req="1 Wood, 1 Flint" disabled={!canCraftTorch} onClick={() => onCraft('torch')} />
            </div>
            <p className="mt-8 text-center text-[10px] text-white/20 font-bold uppercase tracking-widest">Resources: {woodCount} Wood | {flintCount} Flint</p>
          </div>
        </div>
      )}

      {/* Bottom bar - Inventory & Mobile Controls */}
      <div className="flex flex-col items-center gap-6">
        {isMobile && (
          <div className="w-full flex justify-between px-6 mb-4">
            <div className="w-24 h-24 bg-white/5 rounded-full border border-white/10 pointer-events-auto" onTouchStart={handleJoystickStart} onTouchMove={handleJoystickMove} onTouchEnd={handleJoystickEnd} />
            <button onClick={() => setIsCraftingOpen(true)} className="w-16 h-16 bg-orange-600 rounded-2xl border-4 border-white/20 shadow-xl text-2xl flex items-center justify-center pointer-events-auto active:scale-90 transition-transform">🛠️</button>
            <div className="w-24 h-24 bg-white/5 rounded-2xl border border-white/10 pointer-events-auto flex items-center justify-center text-[10px] font-black uppercase text-white/20" onTouchStart={handleLookStart} onTouchMove={handleLookMove} onTouchEnd={handleLookEnd}>LOOK</div>
          </div>
        )}

        <div className="bg-black/60 backdrop-blur-xl p-3 rounded-2xl border border-white/10 flex gap-2 pointer-events-auto overflow-x-auto no-scrollbar max-w-full">
          {inventory.map((item, index) => (
            <button key={item.id} onClick={() => onUseItem(item.id)} className={`relative min-w-[50px] h-[50px] rounded-xl border flex items-center justify-center text-2xl transition-all ${activeToolId === item.id ? 'bg-indigo-500/30 border-indigo-400' : 'bg-white/5 border-white/5 hover:bg-white/10'} ${pulseItems[item.name] ? 'scale-110' : ''}`}>
              {!isMobile && <span className="absolute top-0.5 left-1 text-[8px] font-black text-white/30">{index + 1}</span>}
              {getItemIcon(item.name)}
              <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-md flex items-center justify-center shadow-lg border border-white/10">{item.count}</span>
            </button>
          ))}
        </div>
      </div>
      
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};

export default UIOverlay;
