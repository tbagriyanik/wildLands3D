# WILD LANDS - 3D Survival RPG

WILD LANDS is an immersive, high-performance 3D survival experience built using **React**, **Three.js**, and **Tailwind CSS**. Navigate a beautiful yet dangerous wilderness, manage your vital signs, and craft tools to survive.

## 🌟 Key Features

- **Immersive 3D Environment**: High-fidelity rendering with dynamic sky cycles, atmospheric fog, and realistic lighting.
- **Deep Survival Mechanics**: Monitor Health, Hunger, Thirst, and Temperature. Survival decay rates are dynamically affected by your actions and the environment.
- **Resource Gathering**: Interact with the world to chop trees for wood, mine rocks for stone/flint, and gather food from bushes and apple trees.
- **Advanced Crafting**: Use the crafting menu (C) to build campfires, bows, arrows, torches, and waterskins.
- **Dynamic Wildlife**: Hunt various animals including rabbits, squirrels, and deer, each with their own AI flight behaviors.
- **Localization**: Full support for both **English** and **Turkish** languages.

## 🛠 Latest Technical Updates

- **Fixed Movement & Rotation**: Re-engineered the PointerLockControls integration to ensure seamless mouse look and responsive WASD movement.
- **Optimized Map Generation**:
  - Foliage is now strictly generated in the map center for a more focused gameplay experience.
  - Exactly **100 trees** and **100 rocks** are spawned per session.
  - **Collision-Aware Spawning**: Implemented a 2.8m safety buffer between all spawned objects to prevent overlapping and clipping.
- **Visual Refinement**: Rocks have been scaled down by **75%** (to 0.375 units) to improve environmental realism and navigation.
- **Performance First**: Removed external AI dependencies to prioritize a smooth 60FPS core gameplay loop.
- **Enhanced UI**: A "glassmorphism" interface providing real-time stats, a compass, and an intuitive hotbar.

## 🎮 Controls

| Key | Action |
|-----|--------|
| **WASD** | Movement |
| **Mouse Move** | Look around (Lock with Click) |
| **Left Click / E** | Interact / Collect / Action |
| **Right Click** | Zoom / Aim |
| **Shift** | Sprint |
| **Space** | Jump |
| **C** | Open/Close Crafting Menu |
| **1-9** | Quick Use Hotbar Items |
| **Esc** | Pause / Unlock Mouse |

## 🏗 Technical Stack

- **Engine**: Three.js (WebGL)
- **Framework**: React 19
- **Styling**: Tailwind CSS
- **Controls**: PointerLockControls (Desktop) / Custom Virtual Joystick (Mobile)
- **Assets**: Procedural geometries with high-quality texture mapping.

---
*Created by a Senior Frontend Engineer. Optimized for modern browsers.*