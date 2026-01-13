
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { Water } from 'three/examples/jsm/objects/Water';
import { InteractionTarget, WeatherType, CampfireData, MobileInput } from '../types';
import { SFX_URLS } from '../constants';

interface GameSceneProps {
  onInteract: (target: InteractionTarget) => void;
  onCollect: (type: string) => void;
  onDrink: () => void;
  onMovementChange: (status: { moving: boolean, sprinting: boolean }) => void;
  onPositionUpdate: (info: { x: number, z: number, dirX: number, dirZ: number }) => void;
  onLockChange: (locked: boolean) => void;
  onCook: () => void;
  onShoot: () => void;
  hasBow: boolean;
  arrowCount: number;
  hasTorch: boolean;
  time: number;
  weather: WeatherType;
  isLocked: boolean;
  isMobile: boolean;
  mobileInput: MobileInput;
  sfxEnabled: boolean;
  campfires: CampfireData[];
}

export interface GameSceneHandle {
  triggerAction: () => void;
  requestLock: () => void;
}

interface AnimalData { mesh: THREE.Group; targetPos: THREE.Vector3; state: 'idle' | 'moving'; timer: number; }
interface ProjectileData { mesh: THREE.Mesh; velocity: THREE.Vector3; isStuck: boolean; creationTime: number; }

const GameScene = forwardRef<GameSceneHandle, GameSceneProps>(({ 
  onInteract, onCollect, onDrink, onMovementChange, onPositionUpdate, onLockChange, onCook, onShoot, hasBow, arrowCount, hasTorch, time, weather, isLocked, isMobile, mobileInput, sfxEnabled, campfires
}, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const campfireGroupRef = useRef<THREE.Group>(new THREE.Group());
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);
  const starFieldRef = useRef<THREE.Points | null>(null);
  const bowModelRef = useRef<THREE.Group | null>(null);
  const arrowModelRef = useRef<THREE.Mesh | null>(null);
  const torchModelRef = useRef<THREE.Group | null>(null);
  const torchLightRef = useRef<THREE.PointLight | null>(null);
  const worldObjectsRef = useRef<THREE.Object3D[]>([]);
  const groundedArrowsRef = useRef<THREE.Object3D[]>([]);
  const rainSystemRef = useRef<THREE.Points | null>(null);
  const rainAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const propsRef = useRef({ onInteract, onCollect, onDrink, onCook, onShoot, onMovementChange, onPositionUpdate, onLockChange, hasBow, arrowCount, hasTorch, time, weather, sfxEnabled, isMobile });
  const touchState = useRef({ 
    startX: 0, startY: 0, 
    lon: 120, lat: 0, 
    phi: 0, theta: 0,
    active: false
  });

  const playSFX = (url: string, volume = 0.4, randomizePitch = true) => {
    if (propsRef.current.sfxEnabled) {
      const sfx = new Audio(url);
      sfx.volume = volume;
      if (randomizePitch) sfx.playbackRate = 0.9 + Math.random() * 0.2;
      sfx.play().catch((e) => console.log("SFX Play Error", e));
    }
  };

  useEffect(() => {
    propsRef.current = { onInteract, onCollect, onDrink, onCook, onShoot, onMovementChange, onPositionUpdate, onLockChange, hasBow, arrowCount, hasTorch, time, weather, sfxEnabled, isMobile };
    if (bowModelRef.current) bowModelRef.current.visible = hasBow;
    if (arrowModelRef.current) arrowModelRef.current.visible = hasBow && arrowCount > 0;
    if (torchModelRef.current) torchModelRef.current.visible = hasTorch;
    if (rainAudioRef.current) {
        if (weather === 'rainy' && (isLocked || isMobile) && sfxEnabled) {
            if (rainAudioRef.current.paused) rainAudioRef.current.play().catch(() => {});
        } else { rainAudioRef.current.pause(); }
    }
  }, [onInteract, onCollect, onDrink, onCook, onShoot, onMovementChange, onPositionUpdate, onLockChange, hasBow, arrowCount, hasTorch, time, weather, isLocked, isMobile, sfxEnabled]);

  useEffect(() => {
    if (!sceneRef.current) return;
    campfireGroupRef.current.clear();
    campfires.forEach(cf => {
      const group = new THREE.Group();
      group.position.set(cf.x, 0, cf.z);
      group.userData = { type: 'campfire', id: cf.id, isObstacle: true, radius: 0.8 };
      const logGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8);
      const logMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.8 });
      for(let i=0; i<4; i++) {
        const log = new THREE.Mesh(logGeo, logMat);
        log.rotation.x = Math.PI/2; log.rotation.z = (i * Math.PI) / 2;
        log.position.y = 0.1; log.castShadow = true; group.add(log);
      }
      group.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4500 })));
      const light = new THREE.PointLight(0xffa500, 4, 30); light.position.y = 1.2; light.castShadow = true; group.add(light);
      campfireGroupRef.current.add(group);
    });
  }, [campfires]);

  const triggerAction = () => {
    if (!cameraRef.current || !sceneRef.current) return;
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2(0,0), cameraRef.current);
    const hits = r.intersectObjects(worldObjectsRef.current.filter(o => o.visible), true);
    if(hits.length > 0 && hits[0].distance < 6) {
        let o = hits[0].object; while(o.parent && !o.userData.type) o = o.parent;
        const t = o.userData.type;
        if(t === 'water') propsRef.current.onDrink();
        else if(t === 'campfire') propsRef.current.onCook();
        else if(t === 'critter') { 
            propsRef.current.onCollect('Raw Meat'); 
            o.visible = false; 
            o.userData.type = 'none'; 
            o.userData.isObstacle = false;
        }
        else if (t === 'arrow') { 
            propsRef.current.onCollect('Arrow'); 
            sceneRef.current.remove(o); 
            groundedArrowsRef.current = groundedArrowsRef.current.filter(a => a !== o); 
        }
        else if (t === 'appleTree') {
            const apples = o.getObjectByName('apples');
            if (apples && apples.visible) { propsRef.current.onCollect('Apple'); apples.visible = false; o.userData.type = 'tree'; }
            else { 
                propsRef.current.onCollect('Wood'); 
                o.visible = false; 
                o.userData.type = 'none'; 
                o.userData.isObstacle = false; 
            }
        } else if (t === 'tree') { 
            propsRef.current.onCollect('Wood'); 
            o.visible = false; 
            o.userData.type = 'none'; 
            o.userData.isObstacle = false; 
        }
        else if (t === 'rock' || t === 'bush') { 
            propsRef.current.onCollect(t === 'rock' ? 'Stone' : 'Berries'); 
            o.visible = false; 
            o.userData.type = 'none'; 
            o.userData.isObstacle = false; 
        }
    }
  };

  const spawnArrow = () => {
    if (!cameraRef.current || !sceneRef.current || !propsRef.current.hasBow || propsRef.current.arrowCount <= 0) return;
    const arrowGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.8, 8);
    const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
    arrow.userData.type = 'arrow';
    
    const cameraDirection = new THREE.Vector3(); cameraRef.current.getWorldDirection(cameraDirection);
    const camSide = new THREE.Vector3().crossVectors(cameraDirection, new THREE.Vector3(0,1,0)).normalize();
    
    // Position slightly offset to the right for better visual flow
    arrow.position.copy(cameraRef.current.position)
      .add(cameraDirection.clone().multiplyScalar(0.6))
      .add(camSide.clone().multiplyScalar(0.15));
      
    const velocity = cameraDirection.clone().multiplyScalar(75);
    arrow.lookAt(arrow.position.clone().add(velocity)); arrow.rotateX(Math.PI/2);
    sceneRef.current.add(arrow);
    (window as any).projectiles = (window as any).projectiles || [];
    (window as any).projectiles.push({ mesh: arrow, velocity, isStuck: false, creationTime: Date.now() });
    propsRef.current.onShoot();
    if(bowModelRef.current) { bowModelRef.current.position.z += 0.2; setTimeout(() => { if(bowModelRef.current) bowModelRef.current.position.z -= 0.2; }, 100); }
    playSFX(SFX_URLS.arrow_shoot, 0.5);
  };

  const requestLock = () => { if (controlsRef.current && !controlsRef.current.isLocked && !isMobile) controlsRef.current.lock(); };
  useImperativeHandle(ref, () => ({ triggerAction, requestLock }));

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    scene.fog = new THREE.Fog(0x87ceeb, 20, 800); scene.add(campfireGroupRef.current);
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(120, 1.8, 120); cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mountRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x1e3a1a, 0.6));
    const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.8); sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024); sunLight.shadow.camera.far = 1500;
    scene.add(sunLight); sunLightRef.current = sunLight;
    sunMeshRef.current = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffee }));
    scene.add(sunMeshRef.current);
    moonMeshRef.current = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 16), new THREE.MeshBasicMaterial({ color: 0xcccccc }));
    scene.add(moonMeshRef.current);

    const starGeo = new THREE.BufferGeometry(); const starPos = new Float32Array(2000 * 3);
    for(let i=0; i<2000*3; i+=3) {
        const r = 2500; const t = Math.random() * Math.PI * 2; const p = Math.random() * Math.PI;
        starPos[i] = r * Math.sin(p) * Math.cos(t); starPos[i+1] = r * Math.sin(p) * Math.sin(t); starPos[i+2] = r * Math.cos(p);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starFieldRef.current = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0 }));
    scene.add(starFieldRef.current);

    const bowGroup = new THREE.Group();
    const bowCurve = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.015, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x3d2b1f }));
    bowCurve.rotation.y = Math.PI / 2; bowCurve.rotation.x = Math.PI / 2; bowGroup.add(bowCurve);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.6, 4), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
    string.position.x = -0.05; bowGroup.add(string);
    bowGroup.position.set(0.4, -0.3, -0.6); bowGroup.scale.setScalar(1.5); camera.add(bowGroup);
    bowModelRef.current = bowGroup; bowGroup.visible = propsRef.current.hasBow;

    arrowModelRef.current = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x3d2b1f }));
    arrowModelRef.current.rotation.x = Math.PI / 2; arrowModelRef.current.position.set(0.35, -0.3, -0.5);
    camera.add(arrowModelRef.current); arrowModelRef.current.visible = propsRef.current.hasBow && propsRef.current.arrowCount > 0;

    const torchGroup = new THREE.Group();
    const torchHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x4a3728 }));
    torchHandle.rotation.x = -Math.PI / 4; torchGroup.add(torchHandle);
    const torchTip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff8800 }));
    torchTip.position.set(0, 0.4, -0.4); torchGroup.add(torchTip);
    torchLightRef.current = new THREE.PointLight(0xffa500, 2.5, 25);
    torchLightRef.current.position.set(0, 0.4, -0.4); torchGroup.add(torchLightRef.current);
    torchGroup.position.set(-0.5, -0.4, -0.7); camera.add(torchGroup);
    torchModelRef.current = torchGroup; torchGroup.visible = propsRef.current.hasTorch;

    const rainCount = 15000; const rainGeo = new THREE.BufferGeometry(); const rainPositions = new Float32Array(rainCount * 3);
    const rainVelocities = new Float32Array(rainCount);
    for (let i = 0; i < rainCount; i++) {
        rainPositions[i * 3] = (Math.random() - 0.5) * 600; rainPositions[i * 3 + 1] = Math.random() * 200;
        rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 600; rainVelocities[i] = 1.5 + Math.random() * 2;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    rainSystemRef.current = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.25, transparent: true, opacity: 0.6 }));
    rainSystemRef.current.userData = { velocities: rainVelocities }; rainSystemRef.current.visible = false; scene.add(rainSystemRef.current);

    rainAudioRef.current = new Audio(SFX_URLS.rain_ambient); rainAudioRef.current.loop = true; rainAudioRef.current.volume = 0.25;

    // Procedural Textures
    const createGrassTexture = () => {
        const size = 512; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d'); if (!ctx) return null;
        ctx.fillStyle = '#1e3a1a'; ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 20000; i++) {
            const x = Math.random() * size; const y = Math.random() * size;
            ctx.fillStyle = `rgba(${40+Math.random()*40}, ${90+Math.random()*85}, ${40+Math.random()*40}, ${0.1+Math.random()*0.3})`;
            ctx.fillRect(x, y, 1+Math.random()*2, 2+Math.random()*4);
        }
        const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(150, 150); return t;
    };

    const createBarkTexture = () => {
        const size = 256; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d'); if (!ctx) return null;
        ctx.fillStyle = '#3d2b1f'; ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 1000; i++) {
            const x = Math.random() * size; const y = Math.random() * size;
            const w = 1 + Math.random() * 2; const h = 10 + Math.random() * 40;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(30, 20, 10, 0.4)' : 'rgba(80, 60, 40, 0.2)';
            ctx.fillRect(x, y, w, h);
        }
        const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    };

    const createStoneTexture = () => {
        const size = 256; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d'); if (!ctx) return null;
        ctx.fillStyle = '#666666'; ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 5000; i++) {
            const x = Math.random() * size; const y = Math.random() * size;
            const s = 1 + Math.random() * 2;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(40, 40, 40, 0.5)' : 'rgba(150, 150, 150, 0.3)';
            ctx.fillRect(x, y, s, s);
        }
        const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    };

    const barkTex = createBarkTexture();
    const stoneTex = createStoneTexture();

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ map: createGrassTexture(), roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    const water = new Water(new THREE.CircleGeometry(55, 32), {
        textureWidth: 512, textureHeight: 512,
        waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }),
        sunDirection: new THREE.Vector3(), sunColor: 0xffffff, waterColor: 0x002e40, distortionScale: 4, fog: true
    });
    water.rotation.x = -Math.PI / 2; water.position.set(0, 0.21, 0); water.userData = { type: 'water' };
    scene.add(water);

    const obstacles: THREE.Object3D[] = [];
    const createObj = (x: number, z: number, type: string) => {
        const group = new THREE.Group(); group.position.set(x, 0, z);
        if(type === 'tree' || type === 'appleTree') {
            const h = 5 + Math.random()*3;
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, h, 8), new THREE.MeshStandardMaterial({ map: barkTex, roughness: 1.0 }));
            trunk.position.y = h/2; trunk.castShadow = true; group.add(trunk);
            const leaves = new THREE.Mesh(new THREE.ConeGeometry(3.5, 7, 6), new THREE.MeshStandardMaterial({ color: type === 'appleTree' ? 0x2e5c26 : 0x163821 }));
            leaves.position.y = h+2; leaves.castShadow = true; group.add(leaves);
            if(type === 'appleTree') {
                const apples = new THREE.Group(); apples.name = 'apples';
                for(let i=0; i<5; i++) {
                    const a = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
                    a.position.set(Math.cos(i)*1.5, h + Math.random()*2, Math.sin(i)*1.5); apples.add(a);
                }
                group.add(apples);
            }
            group.userData = { type, isObstacle: true, radius: 0.9 };
        } else if (type === 'bush') {
            const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), new THREE.MeshStandardMaterial({ color: 0x2a601a }));
            b.position.y = 0.7; b.castShadow = true; group.add(b); group.userData = { type };
        } else if (type === 'rock') {
            const s = 1 + Math.random();
            const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8 }));
            r.position.y = s*0.4; r.castShadow = true; group.add(r); group.userData = { type, isObstacle: true, radius: s*0.8 };
        }
        scene.add(group); worldObjectsRef.current.push(group); if(group.userData.isObstacle) obstacles.push(group);
    };
    for(let i=0; i<400; i++) {
        const x = (Math.random()-0.5)*1400, z = (Math.random()-0.5)*1400; if(Math.sqrt(x*x+z*z) < 95) continue;
        createObj(x, z, ['tree', 'appleTree', 'bush', 'rock'][Math.floor(Math.random()*4)]);
    }

    const animals: AnimalData[] = [];
    for(let i=0; i<20; i++) {
        const group = new THREE.Group(); group.add(new THREE.Mesh(new THREE.BoxGeometry(0.4,0.3,0.6), new THREE.MeshStandardMaterial({ color: 0x8b4513 })));
        const x = (Math.random()-0.5)*1000, z = (Math.random()-0.5)*1000; group.position.set(x, 0.15, z);
        group.userData = {type: 'critter'}; scene.add(group); worldObjectsRef.current.push(group);
        animals.push({ mesh: group, targetPos: group.position.clone(), state: 'idle', timer: Math.random()*500 });
    }

    const controls = new PointerLockControls(camera, renderer.domElement); controlsRef.current = controls;
    const birdAudio = new Audio(SFX_URLS.bird_ambient); birdAudio.volume = 0.1; birdAudio.loop = true;
    controls.addEventListener('lock', () => { propsRef.current.onLockChange(true); if(propsRef.current.sfxEnabled) birdAudio.play().catch(()=>{}); });
    controls.addEventListener('unlock', () => { propsRef.current.onLockChange(false); birdAudio.pause(); });

    const handleTouchStart = (e: TouchEvent) => {
      if (!isMobile) return;
      const touch = e.touches[0];
      if (touch.clientX > window.innerWidth / 2) {
        touchState.current.active = true;
        touchState.current.startX = touch.clientX; touchState.current.startY = touch.clientY;
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!isMobile || !touchState.current.active) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchState.current.startX;
      const dy = touch.clientY - touchState.current.startY;
      touchState.current.lon += dx * 0.15; touchState.current.lat -= dy * 0.15;
      touchState.current.lat = Math.max(-85, Math.min(85, touchState.current.lat));
      touchState.current.startX = touch.clientX; touchState.current.startY = touch.clientY;
    };
    const handleTouchEnd = () => touchState.current.active = false;
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    const keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
    const onKD = (e: KeyboardEvent) => {
        const k = e.code.toLowerCase();
        if(k === 'keyw') keys.w = true; if(k === 'keya') keys.a = true; if(k === 'keys') keys.s = true; if(k === 'keyd') keys.d = true;
        if(k === 'shiftleft') keys.shift = true; if(k === 'space') keys.space = true; if(k === 'keye') triggerAction();
    };
    const onKU = (e: KeyboardEvent) => {
        const k = e.code.toLowerCase();
        if(k === 'keyw') keys.w = false; if(k === 'keya') keys.a = false; if(k === 'keys') keys.s = false; if(k === 'keyd') keys.d = false;
        if(k === 'shiftleft') keys.shift = false; if(k === 'space') keys.space = false;
    };
    window.addEventListener('keydown', onKD); window.addEventListener('keyup', onKU);
    renderer.domElement.addEventListener('mousedown', (e) => { 
        if(controls.isLocked && e.button === 0) { if (propsRef.current.hasBow && propsRef.current.arrowCount > 0) spawnArrow(); else triggerAction(); } 
    });

    const velocity = new THREE.Vector3(); const direction = new THREE.Vector3();
    let verticalVelocity = 0; let lastFootstep = 0;
    (window as any).projectiles = [];

    const animate = () => {
        requestAnimationFrame(animate);
        const now = Date.now(); const delta = 0.016;
        const { time, weather, isMobile: mobileActive } = propsRef.current;
        
        if (mobileActive) {
          touchState.current.phi = THREE.MathUtils.degToRad(90 - touchState.current.lat);
          touchState.current.theta = THREE.MathUtils.degToRad(touchState.current.lon);
          const target = new THREE.Vector3();
          target.setFromSphericalCoords(1, touchState.current.phi, touchState.current.theta);
          camera.lookAt(camera.position.clone().add(target));
        }

        const sunAngle = (time / 2400) * Math.PI * 2;
        const sunAltitude = Math.sin(sunAngle);
        const sunX = Math.cos(sunAngle) * 800; const sunH = sunAltitude * 800;
        if (sunLightRef.current) sunLightRef.current.position.set(sunX, sunH, 400);
        if (sunMeshRef.current) sunMeshRef.current.position.set(sunX, sunH, 400);
        if (moonMeshRef.current) moonMeshRef.current.position.set(-sunX, -sunH, -400);
        
        const skyCol = new THREE.Color(0x87ceeb);
        if (sunAltitude < -0.2) skyCol.set(0x050810);
        else if (sunAltitude < 0.2) skyCol.lerp(new THREE.Color(sunX > 0 ? 0xffd700 : 0xff8c00), (sunAltitude + 0.2) / 0.4);
        if (weather === 'rainy') skyCol.lerp(new THREE.Color(0x333333), 0.4);
        scene.background = skyCol; if(scene.fog instanceof THREE.Fog) { scene.fog.color.copy(skyCol); scene.fog.near = weather === 'rainy' ? 5 : 20; scene.fog.far = weather === 'rainy' ? 400 : 800; }
        
        const lFactor = Math.max(0, Math.min(1, sunAltitude + 0.2));
        if (sunLightRef.current) sunLightRef.current.intensity = lFactor * 1.5 * (weather === 'rainy' ? 0.4 : 1);
        if(starFieldRef.current) (starFieldRef.current.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - lFactor * 1.2) * (weather === 'rainy' ? 0.2 : 1);

        if (weather === 'rainy' && rainSystemRef.current) {
            rainSystemRef.current.visible = true; rainSystemRef.current.position.copy(camera.position); rainSystemRef.current.position.y = 0;
            const pos = rainSystemRef.current.geometry.attributes.position.array as Float32Array;
            const vels = rainSystemRef.current.userData.velocities;
            for (let i = 0; i < vels.length; i++) { pos[i * 3 + 1] -= vels[i] * 2; if (pos[i * 3 + 1] < -20) pos[i * 3 + 1] = 150 + Math.random() * 50; }
            rainSystemRef.current.geometry.attributes.position.needsUpdate = true;
        } else if (rainSystemRef.current) { rainSystemRef.current.visible = false; }

        if (torchLightRef.current) torchLightRef.current.intensity = 2.0 + Math.random() * 0.8;

        const currentProjectiles = (window as any).projectiles || [];
        const activeProjectiles: ProjectileData[] = [];
        currentProjectiles.forEach((p: ProjectileData) => {
            if (p.isStuck) { if (p.mesh.position.distanceTo(camera.position) < 6) { propsRef.current.onCollect('Arrow'); scene.remove(p.mesh); return; } activeProjectiles.push(p); return; }
            p.velocity.y -= 9.8 * delta; p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            p.mesh.lookAt(p.mesh.position.clone().add(p.velocity)); p.mesh.rotateX(Math.PI/2);
            animals.forEach(a => { if (a.mesh.visible && p.mesh.position.distanceTo(a.mesh.position) < 1) { propsRef.current.onCollect('Raw Meat'); a.mesh.visible = false; a.mesh.userData.type = 'none'; p.isStuck = true; playSFX(SFX_URLS.collect_meat, 0.6); } });
            if (p.mesh.position.y < 0.2) { p.isStuck = true; p.mesh.position.y = 0.2; groundedArrowsRef.current.push(p.mesh); } activeProjectiles.push(p);
        });
        (window as any).projectiles = activeProjectiles;

        groundedArrowsRef.current.forEach(arr => { if (arr.position.distanceTo(camera.position) < 5) { propsRef.current.onCollect('Arrow'); scene.remove(arr); groundedArrowsRef.current = groundedArrowsRef.current.filter(a => a !== arr); } });
        animals.forEach(a => { a.timer--; if (a.state === 'idle') { if (a.timer <= 0) { a.state = 'moving'; a.timer = 400 + Math.random()*800; a.targetPos.set(a.mesh.position.x+(Math.random()-0.5)*45, 0.15, a.mesh.position.z+(Math.random()-0.5)*45); a.mesh.lookAt(a.targetPos); } } else if (a.mesh.visible) { a.mesh.position.lerp(a.targetPos, 0.004); if (a.mesh.position.distanceTo(a.targetPos) < 1.5) a.state = 'idle'; } });

        velocity.x -= velocity.x * 10 * delta; velocity.z -= velocity.z * 10 * delta;
        verticalVelocity -= 15 * delta; camera.position.y += verticalVelocity * delta;
        if(camera.position.y < 1.8) { verticalVelocity = 0; camera.position.y = 1.8; }

        const moveX = mobileActive ? mobileInput.moveX : (Number(keys.d) - Number(keys.a));
        const moveY = mobileActive ? mobileInput.moveY : (Number(keys.w) - Number(keys.s));
        const moving = Math.abs(moveX) > 0.1 || Math.abs(moveY) > 0.1;
        const sprinting = mobileActive ? mobileInput.sprint : keys.shift;
        const jumping = mobileActive ? mobileInput.jump : keys.space;

        if(jumping && camera.position.y <= 1.81 && (controls.isLocked || mobileActive)) verticalVelocity = 6.2;

        if(moving && (controls.isLocked || mobileActive)) {
            const s = sprinting ? 420 : 210;
            const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
            const camSide = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0,1,0)).normalize();
            const forward = new THREE.Vector3(camDir.x, 0, camDir.z).normalize();
            
            camera.position.add(forward.multiplyScalar(moveY * s * delta * 0.03));
            camera.position.add(camSide.multiplyScalar(moveX * s * delta * 0.03));

            if(propsRef.current.sfxEnabled && camera.position.y <= 1.81 && now - lastFootstep > (sprinting ? 280 : 500)) {
                playSFX(SFX_URLS.footstep_grass, 0.15); lastFootstep = now;
            }
        }
        
        if (mobileActive && mobileInput.interact) { triggerAction(); mobileInput.interact = false; }
        if (mobileActive && mobileInput.attack) { if (propsRef.current.hasBow && propsRef.current.arrowCount > 0) spawnArrow(); else triggerAction(); mobileInput.attack = false; }

        if(controls.isLocked || mobileActive) {
            // Updated to filter only visible obstacles for collision detection
            obstacles.filter(o => o.visible).forEach(o => {
                const dx = camera.position.x - o.position.x; const dz = camera.position.z - o.position.z;
                const distSq = dx*dx + dz*dz; const min = (o.userData.radius || 1) + 0.65;
                if (distSq < min * min) { const d = Math.sqrt(distSq); if(d > 0.01) { const f = min/d; camera.position.x = o.position.x + dx*f; camera.position.z = o.position.z + dz*f; } }
            });
            
            const curCamDir = new THREE.Vector3();
            camera.getWorldDirection(curCamDir);
            propsRef.current.onMovementChange({ moving, sprinting: moving && sprinting });
            propsRef.current.onPositionUpdate({ 
              x: camera.position.x, 
              z: camera.position.z,
              dirX: curCamDir.x,
              dirZ: curCamDir.z
            });
            
            const r = new THREE.Raycaster(); r.setFromCamera(new THREE.Vector2(0,0), camera);
            const hits = r.intersectObjects(scene.children.filter(c => c.visible), true);
            const target = hits.find(h => h.object.userData && h.object.userData.type && h.object.userData.type !== 'none');
            propsRef.current.onInteract({ type: target ? target.object.userData.type : 'none' });
        }
        renderer.render(scene, camera);
    };
    animate();

    const res = () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
    window.addEventListener('resize', res);
    return () => {
        window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU); window.removeEventListener('resize', res);
        window.removeEventListener('touchstart', handleTouchStart); window.removeEventListener('touchmove', handleTouchMove); window.removeEventListener('touchend', handleTouchEnd);
        birdAudio.pause(); rainAudioRef.current?.pause(); controls.dispose(); renderer.dispose(); mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full" />;
});

export default GameScene;
