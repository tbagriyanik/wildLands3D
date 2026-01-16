
export type Language = 'tr' | 'en';
export type WeatherType = 'sunny' | 'rainy' | 'snowy';

export interface PlayerStats {
  health: number;
  hunger: number;
  thirst: number;
  energy: number;
  temperature: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'resource' | 'food' | 'tool';
  count: number;
  life?: number; // Ömürlü eşyalar için (Meşale vb.)
}

export interface GameSettings {
  language: Language;
  musicEnabled: boolean;
  sfxEnabled: boolean;
}

export interface CampfireData {
  id: string;
  x: number;
  z: number;
  life: number;
}

export interface GameState {
  stats: PlayerStats;
  inventory: InventoryItem[];
  day: number;
  time: number;
  settings: GameSettings;
  weather: WeatherType;
  campfires: CampfireData[];
  playerPosition: { x: number, y: number, z: number };
  playerRotation: number;
  activeTorch: boolean;
  activeBow: boolean;
  torchLife: number; // 0-100 (1 saat)
}

export interface InteractionTarget {
  type: 'tree' | 'appleTree' | 'bush' | 'water' | 'rock' | 'campfire' | 'critter' | 'arrow' | 'partridge' | 'none' | 'boar' | 'fox' | 'wolf' | 'rabbit' | 'deer' | 'squirrel' | 'meat';
  id?: string;
}

export interface MobileInput {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  jump: boolean;
  sprint: boolean;
  interact: boolean;
  attack: boolean;
}
