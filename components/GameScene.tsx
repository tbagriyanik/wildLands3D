
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { Water } from 'three/examples/jsm/objects/Water';
import { InteractionTarget, WeatherType, CampfireData } from '../types';
import { SFX_URLS } from '../constants';

interface GameSceneProps {
  onInteract: (target: InteractionTarget) => void;
  onCollect: (type: string) => void;
  onDrink: () => void;
  onMovementChange: (status: { moving: boolean, sprinting: boolean }) => void;
  onPositionUpdate: (pos: { x: number, z: number }) => void;
  onLockChange: (locked: boolean) => void;
  onCook: () => void;
  onShoot: () => void;
  hasBow: boolean;
  arrowCount: number;
  hasTorch: boolean;
  time: number;
  weather: WeatherType;
  isLocked: boolean;
  sfxEnabled: boolean;
  campfires: CampfireData[];
}

export interface GameSceneHandle {
  triggerAction: () => void;
  requestLock: () => void;
}

interface AnimalData {
  mesh: THREE.Group;
  targetPos: THREE.Vector3;
  state: 'idle' | 'moving';
  timer: number;
}

interface ProjectileData {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  isStuck: boolean;
  creationTime: number;
}

const GameScene = forwardRef<GameSceneHandle, GameSceneProps>(({ 
  onInteract, onCollect, onDrink, onMovementChange, onPositionUpdate, onLockChange, onCook, onShoot, hasBow, arrowCount, hasTorch, time, weather, isLocked, sfxEnabled, campfires
}, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const campfireGroupRef = useRef<THREE.Group>(new THREE.Group());
  const waterRef = useRef<Water | null>(null);
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
  
  const propsRef = useRef({ onInteract, onCollect, onDrink, onCook, onShoot, onMovementChange, onPositionUpdate, onLockChange, hasBow, arrowCount, hasTorch, time, sfxEnabled });

  useEffect(() => {
    propsRef.current = { onInteract, onCollect, onDrink, onCook, onShoot, onMovementChange, onPositionUpdate, onLockChange, hasBow, arrowCount, hasTorch, time, sfxEnabled };
    if (bowModelRef.current) bowModelRef.current.visible = hasBow;
    if (arrowModelRef.current) arrowModelRef.current.visible = hasBow && arrowCount > 0;
    if (torchModelRef.current) torchModelRef.current.visible = hasTorch;
  }, [onInteract, onCollect, onDrink, onCook, onShoot, onMovementChange, onPositionUpdate, onLockChange, hasBow, arrowCount, hasTorch, time, sfxEnabled]);

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
        log.rotation.x = Math.PI/2;
        log.rotation.z = (i * Math.PI) / 2;
        log.position.y = 0.1;
        log.castShadow = true;
        group.add(log);
      }
      const fireGeo = new THREE.SphereGeometry(0.4, 8, 8);
      const fireMat = new THREE.MeshBasicMaterial({ color: 0xff4500 });
      const fire = new THREE.Mesh(fireGeo, fireMat);
      fire.position.y = 0.4;
      group.add(fire);
      const light = new THREE.PointLight(0xffa500, 4, 30);
      light.position.y = 1.2;
      light.castShadow = true;
      light.name = "campfireLight";
      group.add(light);
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
        
        if(t === 'water') { propsRef.current.onDrink(); }
        else if(t === 'campfire') { propsRef.current.onCook(); }
        else if(t === 'critter') {
            propsRef.current.onCollect('Raw Meat');
            o.visible = false;
            o.userData.type = 'none';
        }
        else if (t === 'arrow') {
            propsRef.current.onCollect('Arrow');
            sceneRef.current.remove(o);
            groundedArrowsRef.current = groundedArrowsRef.current.filter(a => a !== o);
        }
        else if (t === 'appleTree') {
            const apples = o.getObjectByName('apples');
            if (apples && apples.visible) {
                propsRef.current.onCollect('Apple');
                apples.visible = false;
                o.userData.type = 'tree'; 
            } else {
                propsRef.current.onCollect('Wood');
                o.visible = false;
                o.userData.type = 'none';
                o.userData.isObstacle = false;
            }
        }
        else if (t === 'tree') {
            propsRef.current.onCollect('Wood');
            o.visible = false;
            o.userData.type = 'none';
            o.userData.isObstacle = false;
        }
        else if (t === 'rock' || t === 'bush') {
            const itemType = t === 'rock' ? 'Stone' : 'Berries';
            propsRef.current.onCollect(itemType);
            o.visible = false;
            o.userData.type = 'none';
            o.userData.isObstacle = false;
        }
    }
  };

  const spawnArrow = () => {
    if (!cameraRef.current || !sceneRef.current || !propsRef.current.hasBow || propsRef.current.arrowCount <= 0) return;
    const arrowGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.8, 8);
    const arrowMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.userData.type = 'arrow';
    const cameraDirection = new THREE.Vector3();
    cameraRef.current.getWorldDirection(cameraDirection);
    arrow.position.copy(cameraRef.current.position).add(cameraDirection.clone().multiplyScalar(0.5));
    const arrowSpeed = 70;
    const velocity = cameraDirection.clone().multiplyScalar(arrowSpeed);
    arrow.lookAt(arrow.position.clone().add(velocity));
    arrow.rotateX(Math.PI/2);
    sceneRef.current.add(arrow);
    
    (window as any).projectiles = (window as any).projectiles || [];
    (window as any).projectiles.push({ mesh: arrow, velocity, isStuck: false, creationTime: Date.now() });
    
    propsRef.current.onShoot();
    if(bowModelRef.current) {
        bowModelRef.current.position.z += 0.2;
        setTimeout(() => { if(bowModelRef.current) bowModelRef.current.position.z -= 0.2; }, 100);
    }
    const sfx = new Audio(SFX_URLS.arrow_shoot);
    sfx.volume = 0.5;
    sfx.play().catch(() => {});
  };

  const requestLock = () => {
    if (controlsRef.current && !controlsRef.current.isLocked) {
        controlsRef.current.lock();
    }
  };

  useImperativeHandle(ref, () => ({ triggerAction, requestLock }));

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.Fog(0x87ceeb, 20, 800);
    scene.add(campfireGroupRef.current);

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(120, 1.8, 120);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mountRef.current.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x1e3a1a, 0.6);
    scene.add(hemiLight);
    const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.far = 1500;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffee }));
    scene.add(sunMesh);
    sunMeshRef.current = sunMesh;
    const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 16), new THREE.MeshBasicMaterial({ color: 0xcccccc }));
    scene.add(moonMesh);
    moonMeshRef.current = moonMesh;

    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(2000 * 3);
    for(let i=0; i<2000*3; i+=3) {
        const r = 2500; const t = Math.random() * Math.PI * 2; const p = Math.random() * Math.PI;
        starPos[i] = r * Math.sin(p) * Math.cos(t); starPos[i+1] = r * Math.sin(p) * Math.sin(t); starPos[i+2] = r * Math.cos(p);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0 }));
    scene.add(starField);
    starFieldRef.current = starField;

    // Viewmodel: Bow
    const bowGroup = new THREE.Group();
    const bowCurve = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.015, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x3d2b1f }));
    bowCurve.rotation.y = Math.PI / 2; bowCurve.rotation.x = Math.PI / 2;
    bowGroup.add(bowCurve);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.6, 4), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
    string.position.x = -0.05; bowGroup.add(string);
    bowGroup.position.set(0.4, -0.3, -0.6); bowGroup.scale.setScalar(1.5);
    camera.add(bowGroup); bowModelRef.current = bowGroup; bowGroup.visible = propsRef.current.hasBow;

    const arrowView = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x3d2b1f }));
    arrowView.rotation.x = Math.PI / 2; arrowView.position.set(0.35, -0.3, -0.5);
    camera.add(arrowView); arrowModelRef.current = arrowView; arrowView.visible = propsRef.current.hasBow && propsRef.current.arrowCount > 0;

    // Viewmodel: Torch
    const torchGroup = new THREE.Group();
    const torchHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x4a3728 }));
    torchHandle.rotation.x = -Math.PI / 4;
    torchGroup.add(torchHandle);
    const torchTip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff8800 }));
    torchTip.position.set(0, 0.4, -0.4);
    torchGroup.add(torchTip);
    const torchLight = new THREE.PointLight(0xffa500, 2.5, 25);
    torchLight.position.set(0, 0.4, -0.4);
    torchGroup.add(torchLight);
    torchLightRef.current = torchLight;
    torchGroup.position.set(-0.5, -0.4, -0.7);
    camera.add(torchGroup);
    torchModelRef.current = torchGroup;
    torchGroup.visible = propsRef.current.hasTorch;

    // Enhanced Lush Green Ground Texture
    const createGrassTexture = () => {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Base color
        ctx.fillStyle = '#1e3a1a';
        ctx.fillRect(0, 0, size, size);

        // Add some noise for variation
        for (let i = 0; i < 50000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const w = Math.random() * 2 + 1;
            const h = Math.random() * 4 + 2;
            const opacity = Math.random() * 0.4;
            // Mix of lush greens
            const greenType = Math.random();
            if (greenType > 0.6) ctx.fillStyle = `rgba(45, 90, 39, ${opacity})`;
            else if (greenType > 0.3) ctx.fillStyle = `rgba(58, 125, 50, ${opacity})`;
            else ctx.fillStyle = `rgba(76, 175, 80, ${opacity})`;
            
            ctx.fillRect(x, y, w, h);
        }

        // Add some clumping details
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = Math.random() * 20 + 10;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(34, 139, 34, 0.2)');
            grad.addColorStop(1, 'rgba(10, 30, 10, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(150, 150);
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        return texture;
    };

    const grassTexture = createGrassTexture();
    const groundGeo = new THREE.PlaneGeometry(3000, 3000);
    const groundMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, // White because we apply the map
        map: grassTexture,
        roughness: 0.9,
        metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const water = new Water(new THREE.CircleGeometry(55, 32), {
        textureWidth: 512, textureHeight: 512,
        waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }),
        sunDirection: new THREE.Vector3(), sunColor: 0xffffff, waterColor: 0x002e40, distortionScale: 4, fog: true
    });
    water.rotation.x = -Math.PI / 2; water.position.set(0, 0.21, 0); water.userData = { type: 'water' };
    scene.add(water); waterRef.current = water;

    const obstacles: THREE.Object3D[] = [];
    const createObj = (x: number, z: number, type: string) => {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        if(type === 'tree' || type === 'appleTree') {
            const h = 5 + Math.random()*3;
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, h, 8), new THREE.MeshStandardMaterial({ color: 0x3d2b1f }));
            trunk.position.y = h/2; trunk.castShadow = true; group.add(trunk);
            const leafCol = type === 'appleTree' ? 0x2e5c26 : 0x163821;
            const leaves = new THREE.Mesh(new THREE.ConeGeometry(3.5, 7, 6), new THREE.MeshStandardMaterial({ color: leafCol }));
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
            b.position.y = 0.7; b.castShadow = true; group.add(b);
            group.userData = { type };
        } else if (type === 'rock') {
            const s = 1 + Math.random();
            const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), new THREE.MeshStandardMaterial({ color: 0x666666 }));
            r.position.y = s*0.4; r.castShadow = true; group.add(r);
            group.userData = { type, isObstacle: true, radius: s*0.8 };
        }
        scene.add(group); worldObjectsRef.current.push(group);
        if(group.userData.isObstacle) obstacles.push(group);
    };

    for(let i=0; i<400; i++) {
        const x = (Math.random()-0.5)*1400, z = (Math.random()-0.5)*1400;
        if(Math.sqrt(x*x+z*z) < 95) continue;
        createObj(x, z, ['tree', 'appleTree', 'bush', 'rock'][Math.floor(Math.random()*4)]);
    }

    const animals: AnimalData[] = [];
    for(let i=0; i<20; i++) {
        const group = new THREE.Group();
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.4,0.3,0.6), new THREE.MeshStandardMaterial({ color: 0x8b4513 })));
        const x = (Math.random()-0.5)*1000, z = (Math.random()-0.5)*1000;
        group.position.set(x, 0.15, z);
        group.userData = {type: 'critter'}; scene.add(group); worldObjectsRef.current.push(group);
        animals.push({ mesh: group, targetPos: group.position.clone(), state: 'idle', timer: Math.random()*500 });
    }

    const controls = new PointerLockControls(camera, renderer.domElement);
    controlsRef.current = controls;
    const birdAudio = new Audio(SFX_URLS.bird_ambient); birdAudio.volume = 0.1; birdAudio.loop = true;
    controls.addEventListener('lock', () => { propsRef.current.onLockChange(true); if(propsRef.current.sfxEnabled) birdAudio.play().catch(()=>{}); });
    controls.addEventListener('unlock', () => { propsRef.current.onLockChange(false); birdAudio.pause(); });

    const keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
    const onKD = (e: KeyboardEvent) => {
        const k = e.code.toLowerCase();
        if(k === 'keyw') keys.w = true; if(k === 'keya') keys.a = true;
        if(k === 'keys') keys.s = true; if(k === 'keyd') keys.d = true;
        if(k === 'shiftleft') keys.shift = true; if(k === 'space') keys.space = true;
        if(k === 'keye') triggerAction();
    };
    const onKU = (e: KeyboardEvent) => {
        const k = e.code.toLowerCase();
        if(k === 'keyw') keys.w = false; if(k === 'keya') keys.a = false;
        if(k === 'keys') keys.s = false; if(k === 'keyd') keys.d = false;
        if(k === 'shiftleft') keys.shift = false; if(k === 'space') keys.space = false;
    };
    window.addEventListener('keydown', onKD); window.addEventListener('keyup', onKU);
    renderer.domElement.addEventListener('mousedown', (e) => { 
        if(controls.isLocked && e.button === 0) {
            if (propsRef.current.hasBow && propsRef.current.arrowCount > 0) spawnArrow();
            else triggerAction();
        } 
    });

    const velocity = new THREE.Vector3(); const direction = new THREE.Vector3();
    let verticalVelocity = 0; let lastFootstep = 0;
    (window as any).projectiles = [];

    const animate = () => {
        requestAnimationFrame(animate);
        const now = Date.now(); const delta = 0.016;
        const { time } = propsRef.current;
        
        const sunAngle = (time / 2400) * Math.PI * 2;
        const sunAltitude = Math.sin(sunAngle);
        const sunH = sunAltitude * 800; const sunX = Math.cos(sunAngle) * 800;
        
        if (sunLightRef.current) sunLightRef.current.position.set(sunX, sunH, 400);
        if (sunMeshRef.current) sunMeshRef.current.position.set(sunX, sunH, 400);
        if (moonMeshRef.current) moonMeshRef.current.position.set(-sunX, -sunH, -400);
        
        const nightColor = new THREE.Color(0x050810);
        const sunsetColor = new THREE.Color(0xff8c00);
        const sunriseColor = new THREE.Color(0xffd700);
        const dayColor = new THREE.Color(0x87ceeb);

        let skyCol = new THREE.Color();
        if (sunAltitude < -0.2) {
          skyCol.copy(nightColor);
        } else if (sunAltitude < 0.2) {
          const factor = (sunAltitude + 0.2) / 0.4;
          if (sunX > 0) skyCol.lerpColors(nightColor, sunriseColor, factor);
          else skyCol.lerpColors(nightColor, sunsetColor, factor);
        } else if (sunAltitude < 0.5) {
          const factor = (sunAltitude - 0.2) / 0.3;
          const mixColor = sunX > 0 ? sunriseColor : sunsetColor;
          skyCol.lerpColors(mixColor, dayColor, factor);
        } else {
          skyCol.copy(dayColor);
        }

        scene.background = skyCol;
        if(scene.fog) scene.fog.color.copy(skyCol);
        
        const lFactor = Math.max(0, Math.min(1, sunAltitude + 0.2));
        hemiLight.intensity = 0.1 + lFactor * 0.5;
        if (sunLightRef.current) {
          sunLightRef.current.intensity = lFactor * 1.5;
          if (sunAltitude < 0.4 && sunAltitude > -0.1) sunLightRef.current.color.set(sunX > 0 ? 0xffe4b5 : 0xffa07a);
          else sunLightRef.current.color.set(0xfffaf0);
        }
        
        if(starFieldRef.current) (starFieldRef.current.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - lFactor * 1.2);

        if (waterRef.current) {
            waterRef.current.material.uniforms[ 'time' ].value += delta;
            waterRef.current.material.uniforms[ 'sunDirection' ].value.copy( sunLight.position ).normalize();
        }

        if (torchLightRef.current) {
          torchLightRef.current.intensity = 2.0 + Math.random() * 0.8;
        }

        const currentProjectiles = (window as any).projectiles || [];
        const activeProjectiles: ProjectileData[] = [];
        currentProjectiles.forEach((p: ProjectileData) => {
            if (p.isStuck) {
              const dist = p.mesh.position.distanceTo(camera.position);
              if (dist < 6) {
                propsRef.current.onCollect('Arrow');
                scene.remove(p.mesh);
                return;
              }
              activeProjectiles.push(p);
              return;
            }
            
            p.velocity.y -= 9.8 * delta;
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            p.mesh.lookAt(p.mesh.position.clone().add(p.velocity));
            p.mesh.rotateX(Math.PI/2);
            
            animals.forEach(a => {
              if (p.mesh.position.distanceTo(a.mesh.position) < 1) {
                propsRef.current.onCollect('Raw Meat');
                a.mesh.visible = false; a.mesh.userData.type = 'none';
                p.isStuck = true;
                const sfx = new Audio(SFX_URLS.collect_meat); sfx.play().catch(()=>{});
              }
            });

            if (p.mesh.position.y < 0.2) {
              p.isStuck = true; p.mesh.position.y = 0.2;
              groundedArrowsRef.current.push(p.mesh);
            }
            activeProjectiles.push(p);
        });
        (window as any).projectiles = activeProjectiles;

        groundedArrowsRef.current.forEach(arr => {
          if (arr.position.distanceTo(camera.position) < 5) {
            propsRef.current.onCollect('Arrow');
            scene.remove(arr);
            groundedArrowsRef.current = groundedArrowsRef.current.filter(a => a !== arr);
          }
        });

        worldObjectsRef.current.forEach(obj => {
            const distSq = obj.position.distanceToSquared(camera.position);
            obj.visible = distSq < 800 * 800;
        });

        animals.forEach(a => {
            a.timer--;
            if (a.state === 'idle') {
                if (a.timer <= 0) {
                    a.state = 'moving'; a.timer = 400 + Math.random()*800;
                    a.targetPos.set(a.mesh.position.x+(Math.random()-0.5)*45, 0.15, a.mesh.position.z+(Math.random()-0.5)*45);
                    a.mesh.lookAt(a.targetPos);
                }
            } else {
                a.mesh.position.lerp(a.targetPos, 0.004);
                if (a.mesh.position.distanceTo(a.targetPos) < 1.5) a.state = 'idle';
            }
        });

        velocity.x -= velocity.x * 10 * delta; velocity.z -= velocity.z * 10 * delta;
        verticalVelocity -= 15 * delta; camera.position.y += verticalVelocity * delta;
        if(camera.position.y < 1.8) { verticalVelocity = 0; camera.position.y = 1.8; }
        if(keys.space && camera.position.y <= 1.81 && controls.isLocked) verticalVelocity = 6.2;

        const moving = keys.w || keys.s || keys.a || keys.d; const sprinting = keys.shift;
        if(moving && controls.isLocked) {
            direction.z = Number(keys.w) - Number(keys.s); direction.x = Number(keys.d) - Number(keys.a); direction.normalize();
            const s = sprinting ? 420 : 210;
            velocity.z -= direction.z * s * delta; velocity.x -= direction.x * s * delta;
            if(propsRef.current.sfxEnabled && camera.position.y <= 1.81 && now - lastFootstep > (sprinting ? 280 : 500)) {
                const stepSfx = new Audio(SFX_URLS.footstep_grass);
                stepSfx.volume = 0.2;
                stepSfx.play().catch(()=>{}); 
                lastFootstep = now;
            }
        }
        
        if(controls.isLocked) {
            controls.moveRight(-velocity.x * delta); controls.moveForward(-velocity.z * delta);
            obstacles.forEach(o => {
                const dx = camera.position.x - o.position.x; const dz = camera.position.z - o.position.z;
                const distSq = dx*dx + dz*dz; const min = (o.userData.radius || 1) + 0.65;
                if (distSq < min * min) {
                    const d = Math.sqrt(distSq); if(d > 0.01) { const f = min/d; camera.position.x = o.position.x + dx*f; camera.position.z = o.position.z + dz*f; }
                }
            });
            propsRef.current.onMovementChange({ moving, sprinting: moving && sprinting });
            propsRef.current.onPositionUpdate({ x: camera.position.x, z: camera.position.z });
            
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
        birdAudio.pause(); controls.dispose(); renderer.dispose(); mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full" />;
});

export default GameScene;
