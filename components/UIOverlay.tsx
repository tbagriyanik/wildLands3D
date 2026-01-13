
import React, { useState, useEffect, useRef } from 'react';
import { GameState, InteractionTarget, MobileInput } from '../types';
import { COLORS, TRANSLATIONS } from '../constants';

interface UIOverlayProps {
  gameState: GameState;
  interaction: InteractionTarget;
  onUseItem: (id: string) => void;
  onCraft: (type: 'campfire' | 'arrows' | 'bow' | 'torch') => void;
  isVisible: boolean;
  isHungerCritical: boolean;
  isThirstCritical: boolean;
  showTodoList: boolean;
  isMobile: boolean;
  onMobileInput: (input: (prev: MobileInput) => MobileInput) => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  gameState, interaction, onUseItem, onCraft, isVisible, isHungerCritical, isThirstCritical, showTodoList, isMobile, onMobileInput
}) => {
  const { stats, inventory, time, settings, campfires } = gameState;
  const t = TRANSLATIONS[settings.language];
  const [internalMenuOpen, setInternalMenuOpen] = useState(showTodoList);

  useEffect(() => { setInternalMenuOpen(showTodoList); }, [showTodoList]);

  const woodCount = inventory.find(i => i.name === 'Wood')?.count || 0;
  const flintCount = inventory.find(i => i.name === 'Flint Stone')?.count || 0;
  const hasBow = inventory.some(i => i.name === 'Bow');
  const hasTorch = inventory.some(i => i.name === 'Torch');
  const hasMeat = inventory.some(i => i.name === 'Raw Meat' || i.name === 'Cooked Meat');
  
  const canCraftCampfire = woodCount >= 3 && flintCount >= 1;
  const canCraftArrow = woodCount >= 1;
  const canCraftBow = !hasBow && woodCount >= 3;
  const canCraftTorch = !hasTorch && woodCount >= 1 && flintCount >= 1;

  const formatTime = (t: number) => {
    const hours = Math.floor(t / 100);
    const minutes = Math.floor((t % 100) * 0.6);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const StatBar = ({ label, value, color, unit = "%" }: { label: string, value: number, color: string, unit?: string }) => (
    <div className="mb-1 md:mb-1.5 w-full">
      <div className="flex justify-between text-[8px] sm:text-[10px] font-bold text-white uppercase tracking-widest mb-0.5">
        <span>{label}</span>
        <span>{Math.round(value)}{unit}</span>
      </div>
      <div className="w-full h-1 sm:h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/10">
        <div className="h-full transition-all duration-300 ease-out" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
      </div>
    </div>
  );

  const TodoItem = ({ label, completed }: { label: string, completed: boolean }) => (
    <div className={`flex items-center gap-2 mb-1 sm:mb-1.5 transition-opacity duration-300 ${completed ? 'opacity-30' : 'opacity-100'}`}>
      <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border border-white/30 flex items-center justify-center transition-colors ${completed ? 'bg-green-500 border-green-400' : 'bg-transparent'}`}>
        {completed && <span className="text-[6px] sm:text-[7px] text-white">✓</span>}
      </div>
      <span className={`text-[8px] sm:text-[10px] font-black uppercase tracking-wider ${completed ? 'line-through text-green-500/50' : ''}`}>
        {label}
      </span>
    </div>
  );

  const CraftButton = ({ label, onClick, disabled, icon, hotkey }: { label: string, onClick: (e: any) => void, disabled: boolean, icon: string, hotkey: string }) => (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`group flex items-center justify-between w-full p-2 sm:p-3 rounded-xl sm:rounded-2xl border-2 transition-all shadow-lg pointer-events-auto mb-1.5 ${
        disabled 
        ? 'bg-black/40 border-white/5 text-white/20 cursor-not-allowed grayscale' 
        : 'bg-white/5 border-white/10 hover:bg-white/10 active:scale-95 text-white'
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-sm sm:text-lg">{icon}</span>
        <div className="flex flex-col items-start">
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest leading-none mb-0.5">{label}</span>
          {!isMobile && <span className="text-[7px] sm:text-[8px] opacity-40 font-bold">{hotkey}</span>}
        </div>
      </div>
    </button>
  );

  // Joystick Logic
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const handleJoyMove = (e: React.TouchEvent) => {
    if (!joyBaseRef.current) return;
    const rect = joyBaseRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxDist = rect.width / 2;
    const moveX = Math.max(-1, Math.min(1, dx / maxDist));
    const moveY = Math.max(-1, Math.min(1, -dy / maxDist));
    onMobileInput(prev => ({ ...prev, moveX, moveY }));
  };
  const handleJoyEnd = () => onMobileInput(prev => ({ ...prev, moveX: 0, moveY: 0 }));

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'tree': return '🪓'; case 'rock': return '⛏️'; case 'bush': case 'appleTree': return '✋';
      case 'water': return '💧'; case 'campfire': return '🍳'; case 'critter': return '🏹'; case 'arrow': return '⬇️';
      default: return null;
    }
  };

  const interactionIcon = getInteractionIcon(interaction.type);

  return (
    <div className={`absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-6 select-none transition-opacity duration-500 z-20 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* Critical Overlays */}
      {isHungerCritical && <div className="absolute inset-0 z-50 bg-red-900/10 backdrop-blur-[1px] animate-pulse pointer-events-none"></div>}
      {isThirstCritical && <div className="absolute inset-0 z-50 bg-blue-900/10 backdrop-blur-[1px] animate-pulse pointer-events-none"></div>}

      {/* Reticle / Interaction UI */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10">
          <div className={`w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full transition-all duration-200 ${interaction.type !== 'none' ? 'scale-0 bg-green-400' : 'bg-white/50'}`} />
          <div className={`absolute transition-all duration-300 flex flex-col items-center gap-1 ${interaction.type !== 'none' ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
             <div className="text-xl sm:text-2xl drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-bounce-slow">{interactionIcon}</div>
             <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white/50 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-sm">
                <div className="w-0.5 h-0.5 sm:w-1 sm:h-1 bg-white rounded-full" />
             </div>
             <div className="text-[6px] sm:text-[8px] font-black text-white uppercase tracking-widest bg-black/40 px-1.5 py-0.5 rounded shadow-lg border border-white/10 whitespace-nowrap">
                {t[interaction.type as keyof typeof t] || interaction.type}
             </div>
          </div>
      </div>

      {/* Left HUD Area */}
      <div className="flex flex-col gap-2 sm:gap-3 pointer-events-none z-10 items-start max-h-[80vh] overflow-y-auto no-scrollbar">
        {/* Stats */}
        <div className="bg-black/60 backdrop-blur-xl p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-white/10 w-36 sm:w-56 shadow-2xl pointer-events-auto">
          <div className="text-white font-mono text-[10px] sm:text-base mb-1 sm:mb-2 flex items-center gap-3">
             <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                {gameState.day}
             </div>
             <div className="text-indigo-300 font-black tracking-tighter ml-auto">
                {formatTime(time)}
             </div>
          </div>
          <StatBar label={t.health} value={stats.health} color={COLORS.health} />
          <StatBar label={t.hunger} value={stats.hunger} color={COLORS.hunger} />
          <StatBar label={t.thirst} value={stats.thirst} color={COLORS.thirst} />
          <StatBar label={t.energy} value={stats.energy} color={COLORS.energy} />
          <StatBar label={t.temp} value={stats.temperature} color={COLORS.temperature} unit="°" />
        </div>

        {/* Toggle Menu */}
        <div className={`flex flex-col gap-2 transition-all duration-300 origin-top-left ${internalMenuOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 h-0 overflow-hidden pointer-events-none'}`}>
           <div className="bg-slate-900/60 backdrop-blur-2xl p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-white/5 w-40 sm:w-52 shadow-xl pointer-events-auto">
              <h3 className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">{t.todoList}</h3>
              <TodoItem label={t.taskWood} completed={woodCount > 0} />
              <TodoItem label={t.taskFlint} completed={flintCount > 0} />
              <TodoItem label={t.taskCampfire} completed={campfires.length > 0} />
              <TodoItem label={t.taskBow} completed={hasBow} />
           </div>

           <div className="bg-slate-900/60 backdrop-blur-2xl p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-white/5 w-40 sm:w-52 shadow-xl pointer-events-auto">
              <h3 className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-orange-300 mb-2">{t.craft}</h3>
              <CraftButton label={t.campfire} onClick={() => onCraft('campfire')} disabled={!canCraftCampfire} icon="🔥" hotkey="[C]" />
              <CraftButton label={t.Arrow} onClick={() => onCraft('arrows')} disabled={!canCraftArrow} icon="➡️" hotkey="[X]" />
              <CraftButton label={t.Bow} onClick={() => onCraft('bow')} disabled={!canCraftBow} icon="🏹" hotkey="[V]" />
              <CraftButton label={t.Torch} onClick={() => onCraft('torch')} disabled={!canCraftTorch} icon="🔦" hotkey="[T]" />
           </div>
        </div>

        {isMobile && (
          <button 
            onClick={() => setInternalMenuOpen(!internalMenuOpen)} 
            className="pointer-events-auto w-10 h-10 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-lg active:scale-90 transition-transform"
          >
            {internalMenuOpen ? '✕' : '🛠️'}
          </button>
        )}
      </div>

      {/* Mobile Controls */}
      {isMobile && (
        <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end z-30 pointer-events-none">
          {/* Virtual Joystick */}
          <div 
            ref={joyBaseRef}
            onTouchMove={handleJoyMove}
            onTouchEnd={handleJoyEnd}
            className="w-32 h-32 sm:w-40 sm:h-40 bg-white/5 border border-white/10 rounded-full flex items-center justify-center pointer-events-auto backdrop-blur-md"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-full border border-white/30 shadow-xl" />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pointer-events-auto items-end">
            <div className="flex gap-3">
              <button 
                onPointerDown={() => onMobileInput(prev => ({ ...prev, sprint: true }))}
                onPointerUp={() => onMobileInput(prev => ({ ...prev, sprint: false }))}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-xl font-bold active:bg-indigo-600/50"
              >
                💨
              </button>
              <button 
                onPointerDown={() => onMobileInput(prev => ({ ...prev, jump: true }))}
                onPointerUp={() => onMobileInput(prev => ({ ...prev, jump: false }))}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-xl active:bg-indigo-600/50"
              >
                ⏫
              </button>
            </div>
            <button 
              onPointerDown={() => onMobileInput(prev => ({ ...prev, attack: true }))}
              onPointerUp={() => onMobileInput(prev => ({ ...prev, attack: false }))}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-indigo-600/80 border-4 border-white/20 flex items-center justify-center text-3xl shadow-2xl active:scale-90"
            >
              🎯
            </button>
          </div>
        </div>
      )}

      {/* Bottom Inventory */}
      <div className="flex flex-col gap-3 z-10 w-full items-center mb-24 sm:mb-0">
        <div className="bg-black/60 backdrop-blur-xl p-2 sm:p-3 rounded-2xl sm:rounded-3xl border border-white/10 flex gap-2 max-w-[90vw] sm:max-w-4xl overflow-x-auto no-scrollbar shadow-2xl pointer-events-auto">
          {inventory.length === 0 && <div className="px-6 py-2 text-white/20 italic text-[10px] sm:text-xs tracking-widest uppercase font-black">{t.emptyInventory}</div>}
          {inventory.map((item, index) => (
            <button 
              key={item.id} 
              onClick={() => onUseItem(item.id)} 
              className="relative group min-w-[50px] h-[50px] sm:min-w-[70px] sm:h-[70px] bg-white/5 hover:bg-white/10 rounded-xl sm:rounded-2xl border border-white/5 flex flex-col items-center justify-center active:scale-90"
            >
              {!isMobile && <span className="absolute top-1 left-1.5 text-[7px] font-black text-white/30">{index + 1}</span>}
              <span className="text-xl sm:text-2xl drop-shadow-lg">
                {item.name === 'Wood' && '🪵'} {item.name === 'Berries' && '🍒'}
                {item.name === 'Apple' && '🍎'} {item.name === 'Stone' && '🪨'}
                {item.name === 'Flint Stone' && '🔥'} {item.name === 'Roasted Apple' && '🍢'}
                {item.name === 'Cooked Berries' && '🥣'} {item.name === 'Raw Meat' && '🥩'}
                {item.name === 'Cooked Meat' && '🍖'} {item.name === 'Arrow' && '➡️'}
                {item.name === 'Bow' && '🏹'} {item.name === 'Torch' && '🔦'}
              </span>
              <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[8px] sm:text-[9px] font-black w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded shadow-lg">
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>
      
      <style>{`
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default UIOverlay;
