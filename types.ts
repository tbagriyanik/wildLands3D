
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
}

export interface GameState {
  stats: PlayerStats;
  inventory: InventoryItem[];
  day: number;
  time: number; // 0 to 2400
  settings: GameSettings;
  weather: WeatherType;
  campfires: CampfireData[];
  playerPosition?: { x: number, y: number, z: number };
  playerRotation?: number;
}

export interface InteractionTarget {
  type: 'tree' | 'appleTree' | 'bush' | 'water' | 'rock' | 'campfire' | 'critter' | 'arrow' | 'none';
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
