
import React, { useRef, useState, useEffect } from 'react';
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
  isWarmingUp: boolean;
  showTodoList: boolean;
  isMobile: boolean;
  onMobileInput: (input: (prev: MobileInput) => MobileInput) => void;
  playerRotation: number;
  activeToolId: string | null;
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
  gameState, interaction, onUseItem, onCraft, isVisible, isHungerCritical, isThirstCritical, isWarmingUp, showTodoList, isMobile, onMobileInput, playerRotation, activeToolId
}) => {
  const { stats, inventory, time, settings, campfires } = gameState;
  const t = TRANSLATIONS[settings.language];
  const [cookingProgress, setCookingProgress] = useState(0);

  const woodCount = inventory.find(i => i.name === 'Wood')?.count || 0;
  const flintCount = inventory.find(i => i.name === 'Flint Stone')?.count || 0;
  const hasBow = inventory.some(i => i.name === 'Bow');
  
  const canCraftCampfire = woodCount >= 3 && flintCount >= 1;
  const canCraftArrow = woodCount >= 1;
  const canCraftBow = !hasBow && woodCount >= 3;
  const canCraftTorch = !inventory.some(i => i.name === 'Torch') && woodCount >= 1 && flintCount >= 1;

  useEffect(() => {
    if (interaction.type === 'campfire' && isVisible) {
      const interval = setInterval(() => {
        setCookingProgress(p => (p + 3.33) % 103.33); // Match the 1.5s cooking time
      }, 50);
      return () => {
        clearInterval(interval);
        setCookingProgress(0);
      };
    }
  }, [interaction.type, isVisible]);

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
      <div className={`w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10 shadow-inner ${glow ? 'shadow-[0_0_12px_rgba(244,63,94,0.4)] border-rose-500/30' : ''}`}>
        <div className={`h-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(255,255,255,0.2)]`} style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
      </div>
    </div>
  );

  const TodoItem = ({ label, completed }: { label: string, completed: boolean }) => (
    <div className={`flex items-center gap-2.5 mb-2 transition-all duration-300 ${completed ? 'opacity-30 translate-x-1' : 'opacity-100'}`}>
      <div className={`w-4 h-4 rounded-md border-2 transition-all flex items-center justify-center ${completed ? 'bg-green-500 border-green-400 rotate-12' : 'bg-transparent border-white/20'}`}>
        {completed && <span className="text-[10px] text-white font-bold">✓</span>}
      </div>
      <span className={`text-xs font-black uppercase tracking-tight ${completed ? 'line-through text-green-500/50' : 'text-white/90'}`}>
        {label}
      </span>
    </div>
  );

  const CraftButton = ({ label, onClick, disabled, icon, hotkey }: { label: string, onClick: (e: any) => void, disabled: boolean, icon: React.ReactNode, hotkey: string }) => (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`group flex items-center justify-between w-full p-2.5 rounded-xl border-2 transition-all shadow-xl pointer-events-auto mb-2 ${
        disabled 
        ? 'bg-black/50 border-white/5 text-white/10 cursor-not-allowed grayscale' 
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
          <div className={`relative flex items-center justify-center transition-all duration-300 ${interaction.type !== 'none' ? 'scale-125' : 'scale-100'}`}>
            <div className={`w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-opacity duration-200 ${interaction.type !== 'none' ? 'opacity-0' : 'opacity-100'}`} />
            
            <div className={`absolute transition-all duration-500 ease-out flex flex-col items-center ${interaction.type !== 'none' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
               <div className="text-3xl mb-1 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] animate-bounce-gentle flex items-center justify-center w-12 h-12">
                 {interactionIcon}
               </div>
               
               <div className="relative w-10 h-10 border-2 border-white/30 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm shadow-2xl">
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  {interaction.type === 'campfire' && (
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle 
                        cx="20" cy="20" r="18" 
                        fill="none" 
                        stroke="rgba(99, 102, 241, 0.8)" 
                        strokeWidth="3" 
                        strokeDasharray="113" 
                        strokeDashoffset={113 - (113 * Math.min(100, cookingProgress)) / 100}
                      />
                    </svg>
                  )}
               </div>

               <div className="mt-3 flex flex-col items-center gap-1.5">
                  <div className="text-xs font-black text-white uppercase tracking-[0.2em] bg-indigo-600/95 px-4 py-2 rounded-lg shadow-[0_8px_25px_rgba(0,0,0,0.5)] border border-white/20 whitespace-nowrap">
                    {t[interaction.type as keyof typeof t] || interaction.type}
                  </div>
               </div>
            </div>
          </div>
      </div>

      <div className={`absolute top-16 right-6 transition-all duration-700 pointer-events-none ${showTodoList ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'}`}>
         <div className="bg-slate-900/80 backdrop-blur-3xl p-4 rounded-2xl border border-white/10 w-52 sm:w-60 shadow-2xl">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400 mb-4 flex justify-between items-center border-b border-white/5 pb-2">
              {t.todoList} <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded opacity-50">I</span>
            </h3>
            <TodoItem label={t.taskWood} completed={woodCount > 0} />
            <TodoItem label={t.taskFlint} completed={flintCount > 0} />
            <TodoItem label={t.taskCampfire} completed={campfires.length > 0} />
            <TodoItem label={t.taskBow} completed={inventory.some(i => i.name === 'Bow')} />
            <TodoItem label={t.taskTorch} completed={inventory.some(i => i.name === 'Torch')} />
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
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-yellow-400 to-indigo-900 transition-all duration-1000"
                  style={{ width: `${(time / 2400) * 100}%` }}
                />
             </div>
          </div>
          <StatBar label={t.health} value={stats.health} color={COLORS.health} pulse={stats.health < 25} />
          <StatBar label={t.hunger} value={stats.hunger} color={COLORS.hunger} pulse={isHungerCritical} />
          <StatBar label={t.thirst} value={stats.thirst} color={COLORS.thirst} pulse={isThirstCritical} />
          <StatBar label={t.energy} value={stats.energy} color={COLORS.energy} flicker={isCritical} />
          <StatBar label={t.temp} value={stats.temperature} color={COLORS.temperature} unit="°" pulse={stats.temperature < 15} glow={isWarmingUp} />
        </div>

        <div className="bg-slate-900/80 backdrop-blur-3xl p-3 rounded-2xl border border-white/10 w-44 sm:w-52 shadow-2xl pointer-events-auto">
           <h3 className="text-xs font-black uppercase tracking-[0.15em] text-orange-400 mb-3 px-1">{t.craft}</h3>
           <CraftButton label={t.campfire} onClick={() => onCraft('campfire')} disabled={!canCraftCampfire} icon="🔥" hotkey="[C]" />
           <CraftButton label={t.Arrow} onClick={() => onCraft('arrows')} disabled={!canCraftArrow} icon={<ArrowIconSVG />} hotkey="[X]" />
           <CraftButton label={t.Bow} onClick={() => onCraft('bow')} disabled={!canCraftBow} icon="🏹" hotkey="[V]" />
           <CraftButton label={t.Torch} onClick={() => onCraft('torch')} disabled={!canCraftTorch} icon="🔦" hotkey="[T]" />
        </div>
      </div>

      <div className="flex flex-col gap-4 z-10 w-full items-center mb-20 sm:mb-6">
        <div className="bg-black/80 backdrop-blur-3xl p-2.5 rounded-2xl border border-white/10 flex gap-2.5 max-w-[95vw] sm:max-w-3xl overflow-x-auto no-scrollbar shadow-[0_20px_60px_rgba(0,0,0,0.8)] pointer-events-auto ring-1 ring-white/5">
          {inventory.length === 0 && (
            <div className="px-8 py-3 text-white/20 italic text-xs tracking-[0.2em] uppercase font-black">
              {t.emptyInventory}
            </div>
          )}
          {inventory.map((item, index) => (
            <button 
              key={item.id} 
              onClick={() => onUseItem(item.id)} 
              className={`relative group min-w-[52px] h-[52px] sm:min-w-[64px] sm:h-[64px] bg-white/5 hover:bg-white/10 rounded-xl border-2 transition-all flex flex-col items-center justify-center active:scale-90 ${activeToolId === item.id ? 'border-indigo-500 bg-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.5)] scale-110 z-10' : 'border-white/5'}`}
            >
              {!isMobile && <span className="absolute top-1 left-1.5 text-[10px] font-black text-white/30">{index + 1}</span>}
              <span className="text-2xl sm:text-3xl drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] w-10 h-10 flex items-center justify-center">
                {item.name === 'Wood' && '🪵'} {item.name === 'Berries' && '🍒'}
                {item.name === 'Apple' && '🍎'} {item.name === 'Stone' && '🪨'}
                {item.name === 'Flint Stone' && '🔥'} {item.name === 'Roasted Apple' && '🍢'}
                {item.name === 'Cooked Berries' && '🥣'} {item.name === 'Raw Meat' && '🥩'}
                {item.name === 'Cooked Meat' && '🍖'} 
                {item.name === 'Arrow' && <ArrowIconSVG />}
                {item.name === 'Bow' && '🏹'} {item.name === 'Torch' && '🔦'}
              </span>
              <span 
                key={item.count}
                className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg shadow-xl ring-2 ring-black/50 animate-badge-pop"
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>
      
      <style>{`
        @keyframes bounce-gentle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes dizzy {
          0%, 100% { filter: blur(0px) contrast(1); transform: rotate(0deg); }
          50% { filter: blur(1.5px) contrast(1.1); transform: rotate(0.2deg) scale(1.005); }
        }
        @keyframes weak-flicker {
          0%, 100% { opacity: 1; transform: scale(1); }
          20% { opacity: 0.6; transform: scale(0.98); }
          40% { opacity: 0.9; transform: scale(1.02); }
          60% { opacity: 0.5; }
          80% { opacity: 0.8; }
        }
        @keyframes badge-pop {
          0% { transform: scale(1); }
          40% { transform: scale(1.6) rotate(10deg); filter: brightness(1.5); }
          100% { transform: scale(1); }
        }
        .animate-bounce-gentle { animation: bounce-gentle 2s ease-in-out infinite; }
        .animate-dizzy { animation: dizzy 8s ease-in-out infinite; }
        .animate-weak-flicker { animation: weak-flicker 0.8s ease-in-out infinite; }
        .animate-badge-pop { animation: badge-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default UIOverlay;
