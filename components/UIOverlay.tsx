
import React from 'react';
import { GameState, InteractionTarget } from '../types';
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
}

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  gameState, interaction, onUseItem, onCraft, isVisible, isHungerCritical, isThirstCritical, showTodoList
}) => {
  const { stats, inventory, time, settings, campfires } = gameState;
  const t = TRANSLATIONS[settings.language];

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
    <div className="mb-1.5 md:mb-2">
      <div className="flex justify-between text-[9px] md:text-[10px] font-bold text-white uppercase tracking-widest mb-0.5">
        <span>{label}</span>
        <span>{Math.round(value)}{unit}</span>
      </div>
      <div className="w-32 md:w-48 h-1 md:h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/10">
        <div className="h-full transition-all duration-300 ease-out" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
      </div>
    </div>
  );

  const TodoItem = ({ label, completed }: { label: string, completed: boolean }) => (
    <div className={`flex items-center gap-2 mb-1.5 transition-opacity duration-300 ${completed ? 'opacity-30' : 'opacity-100'}`}>
      <div className={`w-3 h-3 rounded-full border border-white/30 flex items-center justify-center transition-colors ${completed ? 'bg-green-500 border-green-400' : 'bg-transparent'}`}>
        {completed && <span className="text-[7px] text-white">✓</span>}
      </div>
      <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-wider ${completed ? 'line-through text-green-500/50' : ''}`}>
        {label}
      </span>
    </div>
  );

  const overlayClasses = [];
  if (isHungerCritical) overlayClasses.push('bg-red-900/10 backdrop-blur-sm');
  if (isThirstCritical) overlayClasses.push('bg-blue-900/10 backdrop-blur-sm');
  const overlayCombinedClass = overlayClasses.length > 0 ? overlayClasses.join(' ') : '';


  return (
    <div className={`absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 select-none transition-opacity duration-500 z-20 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* Critical State Overlay */}
      {overlayCombinedClass && (
        <div className={`absolute inset-0 z-50 transition-all duration-500 ${overlayCombinedClass}`}></div>
      )}

      {/* Reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10">
          <div className={`w-1 h-1 rounded-full transition-all duration-200 ${interaction.type !== 'none' ? 'scale-[4] bg-green-400' : 'bg-white/70'}`} />
          <div className={`absolute w-4 h-4 border-2 rounded-full transition-all duration-200 ${interaction.type !== 'none' ? 'scale-150 border-green-400 opacity-100' : 'border-white/20 opacity-0'}`} />
      </div>

      {/* Top Left Stats & To-Do List */}
      <div className="flex flex-col gap-3 pointer-events-auto z-10 items-start">
        <div className="bg-black/60 backdrop-blur-xl p-3 md:p-5 rounded-3xl border border-white/10 w-fit shadow-2xl">
          <div className="text-white font-mono text-sm md:text-xl mb-2 md:mb-4 flex items-center gap-4">
             <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                {t.day} {gameState.day}
             </div>
             <div className="text-indigo-300 font-black tracking-tighter">
                {formatTime(time)}
             </div>
          </div>
          <StatBar label={t.health} value={stats.health} color={COLORS.health} />
          <StatBar label={t.hunger} value={stats.hunger} color={COLORS.hunger} />
          <StatBar label={t.thirst} value={stats.thirst} color={COLORS.thirst} />
          <StatBar label={t.energy} value={stats.energy} color={COLORS.energy} />
          <StatBar label={t.temp} value={stats.temperature} color={COLORS.temperature} unit="°C" />
        </div>

        {/* To-Do List Panel (Toggled by L) */}
        <div className={`bg-slate-900/40 backdrop-blur-2xl p-4 md:p-5 rounded-3xl border border-white/5 w-40 md:w-56 shadow-xl transition-all duration-500 overflow-hidden ${showTodoList ? 'max-h-96 opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-4'}`}>
           <div className="flex items-center justify-between mb-3 opacity-60">
              <div className="flex items-center gap-2">
                <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-indigo-300">{t.todoList}</h3>
              </div>
              <span className="text-[8px] bg-white/10 px-1 rounded font-black text-indigo-200">L</span>
           </div>
           <div className="flex flex-col">
              <TodoItem label={t.taskWood} completed={woodCount > 0} />
              <TodoItem label={t.taskFlint} completed={flintCount > 0} />
              <TodoItem label={t.taskCampfire} completed={campfires.length > 0} />
              <TodoItem label={t.taskBow} completed={hasBow} />
              <TodoItem label={t.taskTorch} completed={hasTorch} />
              <TodoItem label={t.taskMeat} completed={hasMeat} />
           </div>
        </div>
        {!showTodoList && (
          <div className="text-[8px] font-black uppercase text-white/30 tracking-widest bg-black/20 px-2 py-1 rounded-full">
            [L] {t.todoList}
          </div>
        )}
      </div>

      {/* Bottom Inventory and Crafting */}
      <div className="flex flex-col gap-4 z-10">
        <div className="flex justify-center gap-2 md:gap-4 pointer-events-auto overflow-x-auto no-scrollbar pb-2">
           <button 
             onClick={(e) => { e.stopPropagation(); onCraft('campfire'); }}
             disabled={!canCraftCampfire}
             className="px-4 py-2 md:px-6 md:py-3 rounded-2xl font-black text-[10px] md:text-xs tracking-widest uppercase transition-all shadow-2xl border-2 enabled:hover:scale-105 enabled:active:scale-95 disabled:cursor-not-allowed disabled:bg-black/40 disabled:border-white/5 disabled:text-white/20 bg-orange-600 border-white/20 whitespace-nowrap"
           >
              {canCraftCampfire ? t.craft : t.notEnough}
           </button>
           <button 
             onClick={(e) => { e.stopPropagation(); onCraft('arrows'); }}
             disabled={!canCraftArrow}
             className="px-4 py-2 md:px-6 md:py-3 rounded-2xl font-black text-[10px] md:text-xs tracking-widest uppercase transition-all shadow-2xl border-2 enabled:hover:scale-105 enabled:active:scale-95 disabled:cursor-not-allowed disabled:bg-black/40 disabled:border-white/5 disabled:text-white/20 bg-slate-700 border-white/20 whitespace-nowrap"
           >
              {canCraftArrow ? t.craftArrow : t.notEnoughWood}
           </button>
           <button 
             onClick={(e) => { e.stopPropagation(); onCraft('bow'); }}
             disabled={!canCraftBow}
             className="px-4 py-2 md:px-6 md:py-3 rounded-2xl font-black text-[10px] md:text-xs tracking-widest uppercase transition-all shadow-2xl border-2 enabled:hover:scale-105 enabled:active:scale-95 disabled:cursor-not-allowed disabled:bg-black/40 disabled:border-white/5 disabled:text-white/20 bg-indigo-600 border-white/20 whitespace-nowrap"
           >
              {canCraftBow ? t.craftBow : t.notEnoughBowWood}
           </button>
           <button 
             onClick={(e) => { e.stopPropagation(); onCraft('torch'); }}
             disabled={!canCraftTorch}
             className="px-4 py-2 md:px-6 md:py-3 rounded-2xl font-black text-[10px] md:text-xs tracking-widest uppercase transition-all shadow-2xl border-2 enabled:hover:scale-105 enabled:active:scale-95 disabled:cursor-not-allowed disabled:bg-black/40 disabled:border-white/5 disabled:text-white/20 bg-yellow-600 border-white/20 whitespace-nowrap"
           >
              {canCraftTorch ? t.craftTorch : t.notEnoughTorch}
           </button>
        </div>

        <div className="flex justify-center w-full pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-2xl p-2 md:p-4 rounded-3xl border border-white/10 flex gap-2 md:gap-3 max-w-full overflow-x-auto no-scrollbar shadow-2xl">
            {inventory.length === 0 && <div className="px-6 py-4 md:px-10 md:py-5 text-white/20 italic text-xs md:text-sm tracking-widest uppercase font-black">{t.emptyInventory}</div>}
            {inventory.map((item, index) => (
              <button key={item.id} onClick={(e) => { e.stopPropagation(); onUseItem(item.id); }} className="relative group min-w-[60px] h-[60px] md:min-w-[75px] md:h-[75px] bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 flex flex-col items-center justify-center transition-all active:scale-90">
                <span className="absolute top-1 left-2 text-[8px] font-black text-white/30">{index + 1}</span>
                <span className="text-2xl md:text-3xl mb-0.5 drop-shadow-lg">
                  {item.name === 'Wood' && '🪵'} {item.name === 'Berries' && '🍒'}
                  {item.name === 'Apple' && '🍎'} {item.name === 'Stone' && '🪨'}
                  {item.name === 'Flint Stone' && '🔥'}
                  {item.name === 'Roasted Apple' && '🍢'}
                  {item.name === 'Cooked Berries' && '🥣'}
                  {item.name === 'Raw Meat' && '🥩'}
                  {item.name === 'Cooked Meat' && '🍖'}
                  {item.name === 'Arrow' && '➡️'}
                  {item.name === 'Bow' && '🏹'}
                  {item.name === 'Torch' && '🔦'}
                </span>
                <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white text-[9px] md:text-[10px] font-black w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-lg shadow-xl">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UIOverlay;
