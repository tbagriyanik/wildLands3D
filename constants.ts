
export const INITIAL_STATS = {
  health: 100,
  hunger: 100,
  thirst: 100,
  energy: 100,
  temperature: 36.6,
  dirtiness: 0,
};

export const SURVIVAL_DECAY_RATES = {
  hunger: 0.12,
  thirst: 0.18,
  energy_base: 0.05,
  energy_walk: 0.15,
  energy_sprint: 0.5,
  energy_recovery_fire: 0.8,
  health_recovery_fire: 0.3,
  temp_night_drop: 0.05,
  temp_day_drop: 0.01,
  temp_fire_gain: 0.15,
  dirtiness_gain: 0.08, 
};

export const TIME_TICK_RATE = 2400 / (24 * 60);

export const COLORS = {
  health: '#ef4444',
  hunger: '#f59e0b',
  thirst: '#3b82f6',
  energy: '#10b981',
  temperature: '#f43f5e',
  dirtiness: '#92400e',
};

export const TEXTURES = {
  grass: 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg',
  wood: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
  stone: 'https://threejs.org/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg', 
};

export const TRANSLATIONS = {
  en: {
    newGame: "NEW GAME",
    continue: "CONTINUE",
    settings: "SETTINGS",
    youDied: "YOU DIED",
    day: "DAY",
    health: "HEALTH",
    hunger: "HUNGER",
    thirst: "THIRST",
    energy: "ENERGY",
    temp: "TEMP",
    dirt: "DIRT",
    emptyInventory: "Empty...",
    tree: "CHOP TREE",
    appleTree: "GATHER APPLES",
    pearTree: "GATHER PEARS",
    bush: "PICK BERRIES",
    rock: "COLLECT STONE",
    water: "DRINK / FILL WATER",
    campfire: "CAMPFIRE",
    bow: "BOW",
    arrow: "ARROW",
    torch: "TORCH",
    waterskin: "WATERSKIN",
    craft: "CRAFT (TAB)",
    close: "CLOSE",
    collected: "Collected",
    clock: "TIME",
    meat: "RAW MEAT",
    cookedMeat: "COOKED MEAT",
    cookedFruit: "COOKED FRUIT",
    slogan: "Are you ready to survive the wild?",
    back: "BACK",
    music: "MUSIC",
    sfx: "SOUND EFFECTS",
    language: "LANGUAGE",
    on: "ON",
    off: "OFF",
    cook: "COOK",
    fuel: "FUEL",
    requiresFire: "REQUIRES FIRE"
  },
  tr: {
    newGame: "YENİ OYUN",
    continue: "DEVAM ET",
    settings: "AYARLAR",
    youDied: "ÖLDÜNÜZ",
    day: "GÜN",
    health: "SAĞLIK",
    hunger: "AÇLIK",
    thirst: "SUSUZLUK",
    energy: "ENERJİ",
    temp: "ISI",
    dirt: "KİR",
    emptyInventory: "Boş...",
    tree: "ODUN KES",
    appleTree: "ELMA TOPLA",
    pearTree: "ARMUT TOPLA",
    bush: "BÖĞÜRTLEN",
    rock: "TAŞ TOPLA",
    water: "SU İÇ / DOLDUR",
    campfire: "KAMP ATEŞİ",
    bow: "YAY",
    arrow: "OK",
    torch: "MEŞALE",
    waterskin: "MATARA",
    craft: "ÜRETİM (TAB)",
    close: "KAPAT",
    collected: "Toplandı",
    clock: "SAAT",
    meat: "ÇİĞ ET",
    cookedMeat: "PİŞMİŞ ET",
    cookedFruit: "PİŞMİŞ MEYVE",
    slogan: "Vahşi doğada hayatta kalmaya hazır mısın?",
    back: "GERİ",
    music: "MÜZİK",
    sfx: "SES EFEKTLERİ",
    language: "DİL",
    on: "AÇIK",
    off: "KAPALI",
    cook: "PİŞİR",
    fuel: "YAKIT",
    requiresFire: "ATEŞ GEREKLİ"
  }
};

export const MUSIC_URL = 'https://assets.mixkit.co/music/preview/mixkit-mysterious-pensive-722.mp3';

export const SFX_URLS = {
  hunger_critical: 'https://assets.mixkit.co/sfx/preview/mixkit-stomach-growl-1234.mp3',
  thirst_critical: 'https://assets.mixkit.co/sfx/preview/mixkit-dry-swallow-1323.mp3',
  footstep_grass: 'https://codeskulptor-demos.commondatastorage.googleapis.com/descent/footstep_grass_1.mp3',
  collect_wood: 'https://assets.mixkit.co/sfx/preview/mixkit-wood-hard-hit-2129.mp3',
  collect_stone: 'https://assets.mixkit.co/sfx/preview/mixkit-stone-hit-heavy-impact-2134.mp3',
  drink_swallow: 'https://assets.mixkit.co/sfx/preview/mixkit-drinking-swallow-2244.mp3',
  eat_crunchy: 'https://assets.mixkit.co/sfx/preview/mixkit-eating-crunchy-food-2243.mp3',
  campfire_craft: 'https://assets.mixkit.co/sfx/preview/mixkit-fire-crackling-burning-1333.mp3',
  arrow_shoot: 'https://assets.mixkit.co/sfx/preview/mixkit-fast-bow-shoot-2633.mp3',
  torch_light: 'https://assets.mixkit.co/sfx/preview/mixkit-fire-flare-1334.mp3',
  ui_click: 'https://assets.mixkit.co/sfx/preview/mixkit-modern-click-box-check-1120.mp3'
};
