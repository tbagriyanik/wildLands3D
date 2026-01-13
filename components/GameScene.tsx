
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { Water } from 'three/examples/jsm/objects/Water';
import { Sky } from 'three/examples/jsm/objects/Sky';
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
  isBowActive: boolean;
  isTorchActive: boolean;
  arrowCount: number;
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

const tempVec = new THREE.Vector3();
const tempCamDir = new THREE.Vector3();
const tempCamSide = new THREE.Vector3();

const GameScene = forwardRef<GameSceneHandle, GameSceneProps>(({ 
  onInteract, onCollect, onDrink, onMovementChange, onPositionUpdate, onLockChange, onCook, onShoot, isBowActive, isTorchActive, arrowCount, time, weather, isLocked, isMobile, mobileInput, sfxEnabled, campfires
}, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const campfireGroupRef = useRef<THREE.Group>(new THREE.Group());
  const critterGroupRef = useRef<THREE.Group>(new THREE.Group());
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const skyRef = useRef<Sky | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  const bowModelRef = useRef<THREE.Group | null>(null);
  const arrowModelRef = useRef<THREE.Group | null>(null);
  const torchModelRef = useRef<THREE.Group | null>(null);
  const torchLightRef = useRef<THREE.PointLight | null>(null);
  const worldObjectsRef = useRef<THREE.Object3D[]>([]);
  const groundedArrowsRef = useRef<THREE.Object3D[]>([]);
  const waterRef = useRef<Water | null>(null);
  
  const propsRef = useRef({ onInteract, onCollect, onDrink, onCook, onShoot, onMovementChange, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, weather, sfxEnabled, isMobile });
  
  const nextAmbientTimeRef = useRef<number>(Date.now() + 5000 + Math.random() * 10000);

  const playSFX = (url: string, volume = 0.4, randomizePitch = true) => {
    if (propsRef.current.sfxEnabled) {
      const sfx = new Audio(url);
      sfx.volume = volume;
      if (randomizePitch) sfx.playbackRate = 0.9 + Math.random() * 0.2;
      sfx.play().catch(() => {});
    }
  };

  useEffect(() => {
    propsRef.current = { onInteract, onCollect, onDrink, onCook, onShoot, onMovementChange, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, weather, sfxEnabled, isMobile };
    if (bowModelRef.current) bowModelRef.current.visible = isBowActive;
    if (arrowModelRef.current) arrowModelRef.current.visible = isBowActive && arrowCount > 0;
    if (torchModelRef.current) torchModelRef.current.visible = isTorchActive;
  }, [onInteract, onCollect, onDrink, onCook, onShoot, onMovementChange, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, weather, isLocked, isMobile, sfxEnabled]);

  useEffect(() => {
    if (!sceneRef.current) return;
    campfireGroupRef.current.clear();
    campfires.forEach(cf => {
      const group = new THREE.Group();
      group.position.set(cf.x, 0, cf.z);
      group.userData = { type: 'campfire', id: cf.id, isObstacle: true, radius: 0.8 };
      
      const logGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.2, 6); 
      const logMat = new THREE.MeshStandardMaterial({ color: 0x5a3e2b, roughness: 0.8 });
      for(let i=0; i<4; i++) {
        const log = new THREE.Mesh(logGeo, logMat);
        log.rotation.x = Math.PI/2; log.rotation.z = (i * Math.PI) / 2;
        log.position.y = 0.1; log.castShadow = true; group.add(log);
      }

      const fireInner = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      fireInner.position.y = 0.7; group.add(fireInner);
      
      const fireMid = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8), new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.9 }));
      fireMid.position.y = 0.55; group.add(fireMid);

      const fireOuter = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.7 }));
      fireOuter.position.y = 0.4; group.add(fireOuter);
      
      const light = new THREE.PointLight(0xff7700, 25, 60); 
      light.position.y = 1.3; 
      light.castShadow = true; 
      group.add(light);
      
      group.userData.fireMeshes = [fireInner, fireMid, fireOuter];
      campfireGroupRef.current.add(group);
      sceneRef.current?.add(group);
    });
  }, [campfires]);

  const createArrowMesh = () => {
    const group = new THREE.Group();
    // Shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
    group.add(shaft);
    // Metallic Tip
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0x555555 }));
    tip.position.y = 0.46; group.add(tip);
    // Feathers
    const fletchingMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, side: THREE.DoubleSide });
    for(let i=0; i<3; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.18), fletchingMat);
      f.position.y = -0.3; f.rotation.y = (i * Math.PI * 2) / 3;
      f.position.x = 0.03 * Math.cos(f.rotation.y);
      f.position.z = 0.03 * Math.sin(f.rotation.y);
      group.add(f);
    }
    group.userData = { type: 'arrow' };
    return group;
  };

  const spawnArrow = () => {
    if (!cameraRef.current || !sceneRef.current || !propsRef.current.isBowActive || propsRef.current.arrowCount <= 0) return;
    const arrow = createArrowMesh();
    cameraRef.current.getWorldDirection(tempCamDir);
    tempCamSide.crossVectors(tempCamDir, new THREE.Vector3(0,1,0)).normalize();
    arrow.position.copy(cameraRef.current.position).add(tempCamDir.clone().multiplyScalar(0.7)).add(tempCamSide.clone().multiplyScalar(0.2));
      
    // Initial velocity from camera direction
    const velocity = tempCamDir.clone().multiplyScalar(90);
    arrow.lookAt(arrow.position.clone().add(velocity)); 
    arrow.rotateX(Math.PI/2); // Align cylinder axis with direction
    
    sceneRef.current.add(arrow);
    (window as any).projectiles = (window as any).projectiles || [];
    (window as any).projectiles.push({ mesh: arrow, velocity, isStuck: false, creationTime: Date.now() });
    propsRef.current.onShoot();
    playSFX(SFX_URLS.arrow_shoot, 0.5);
  };

  const triggerAction = () => {
    if (!cameraRef.current || !sceneRef.current) return;
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2(0,0), cameraRef.current);
    
    const interactables = worldObjectsRef.current.filter(o => o.visible && o.position.distanceTo(cameraRef.current!.position) < 12);
    if (waterRef.current && waterRef.current.position.distanceTo(cameraRef.current.position) < 15) interactables.push(waterRef.current);
    campfireGroupRef.current.children.forEach(c => { if (c.position.distanceTo(cameraRef.current!.position) < 10) interactables.push(c); });
    critterGroupRef.current.children.forEach(c => { if (c.visible && c.position.distanceTo(cameraRef.current!.position) < 10) interactables.push(c); });
    
    const hits = r.intersectObjects(interactables, true);
    if(hits.length > 0 && hits[0].distance < 8) {
        let o = hits[0].object; while(o.parent && !o.userData.type) o = o.parent;
        const t = o.userData.type;
        if(t === 'water') propsRef.current.onDrink();
        else if(t === 'campfire') propsRef.current.onCook();
        else if (t === 'tree' || t === 'appleTree') { propsRef.current.onCollect(t === 'appleTree' ? 'Apple' : 'Wood'); o.visible = false; o.userData.isObstacle = false; }
        else if (t === 'rock' || t === 'bush') { propsRef.current.onCollect(t === 'rock' ? 'Stone' : 'Berries'); o.visible = false; o.userData.isObstacle = false; }
        else if (t === 'rabbit' || t === 'partridge' || t === 'critter') { propsRef.current.onCollect('Raw Meat'); o.visible = false; }
    }
  };

  const requestLock = () => { if (controlsRef.current && !controlsRef.current.isLocked && !isMobile) controlsRef.current.lock(); };
  useImperativeHandle(ref, () => ({ triggerAction, requestLock }));

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    scene.add(critterGroupRef.current);
    scene.fog = new THREE.FogExp2(0x1a1a1a, 0.002);
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1500);
    camera.position.set(120, 1.8, 120); cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35; // Bright and vivid
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    mountRef.current.appendChild(renderer.domElement);

    const sky = new Sky(); sky.scale.setScalar(450000); scene.add(sky); skyRef.current = sky;
    
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0 });
    const starVertices = [];
    for (let i = 0; i < 5000; i++) {
      const x = THREE.MathUtils.randFloatSpread(2000);
      const y = THREE.MathUtils.randFloat(100, 1000);
      const z = THREE.MathUtils.randFloatSpread(2000);
      starVertices.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    starsRef.current = stars;

    const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.6); sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight); sunLightRef.current = sunLight;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9); // High ambient light for softer shadows
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const bowGroup = new THREE.Group();
    const bowCurve = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 4, 8, Math.PI), new THREE.MeshStandardMaterial({ color: 0x4d3b2f }));
    bowCurve.rotation.y = Math.PI/2; bowCurve.rotation.x = Math.PI/2; bowGroup.add(bowCurve);
    bowGroup.position.set(0.4, -0.3, -0.6); bowGroup.scale.setScalar(1.5); camera.add(bowGroup);
    bowModelRef.current = bowGroup; bowGroup.visible = false;

    const arrowGrp = createArrowMesh();
    arrowGrp.position.set(0.38, -0.28, -0.5); arrowGrp.scale.setScalar(0.8);
    arrowGrp.rotation.x = Math.PI/2;
    camera.add(arrowGrp); arrowModelRef.current = arrowGrp; arrowGrp.visible = false;

    const torchGroup = new THREE.Group();
    const torchHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0x5a4738 }));
    torchHandle.rotation.x = -Math.PI/6; 
    torchGroup.add(torchHandle);
    
    const torchFire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
    torchFire.position.set(0, 0.45, -0.25);
    torchGroup.add(torchFire);
    
    torchLightRef.current = new THREE.PointLight(0xffaa22, 140, 120);
    torchLightRef.current.position.copy(torchFire.position); 
    torchLightRef.current.castShadow = true;
    torchGroup.add(torchLightRef.current);
    
    torchGroup.position.set(0.6, -0.3, -0.8); 
    camera.add(torchGroup);
    torchModelRef.current = torchGroup; torchGroup.visible = false;

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), new THREE.MeshStandardMaterial({ color: 0x224422, roughness: 1.0 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    const water = new Water(new THREE.CircleGeometry(50, 8), {
        textureWidth: 256, textureHeight: 256,
        waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }),
        waterColor: 0x004466, distortionScale: 1.5, fog: true
    });
    water.rotation.x = -Math.PI/2; water.position.set(0, 0.21, 0); water.userData = { type: 'water' };
    scene.add(water); waterRef.current = water;

    const barkTex = new THREE.MeshStandardMaterial({ color: 0x5a3e2b });
    const stoneTex = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const obstacles: THREE.Object3D[] = [];

    const createFoliageLOD = (x: number, z: number, type: string) => {
        const lod = new THREE.LOD();
        lod.position.set(x, 0, z);
        if (type === 'tree' || type === 'appleTree') {
            const h = 5 + Math.random() * 3;
            const g0 = new THREE.Group();
            const t0 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, h, 4), barkTex); t0.position.y = h/2; t0.castShadow = true; g0.add(t0);
            const foliageColor = type === 'appleTree' ? 0x3d7c36 : 0x1e4a2d;
            const l0 = new THREE.Mesh(new THREE.ConeGeometry(3, 6, 4), new THREE.MeshStandardMaterial({ color: foliageColor })); l0.position.y = h+2; l0.castShadow = true; g0.add(l0);
            lod.addLevel(g0, 0);
            lod.addLevel(new THREE.Group(), 150);
            lod.userData = { type, isObstacle: true, radius: 0.9 };
        } else if (type === 'rock') {
            const s = 1 + Math.random();
            const r0 = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stoneTex); r0.position.y = s*0.4; r0.castShadow = true;
            lod.addLevel(r0, 0);
            lod.addLevel(new THREE.Group(), 120);
            lod.userData = { type, isObstacle: true, radius: s*0.8 };
        } else if (type === 'bush') {
          const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), new THREE.MeshStandardMaterial({ color: 0x3a7c2a }));
          b.position.y = 0.6; lod.addLevel(b, 0); lod.addLevel(new THREE.Group(), 80);
          lod.userData = { type };
        }
        lod.updateMatrix(); lod.matrixAutoUpdate = false;
        scene.add(lod); worldObjectsRef.current.push(lod); if(lod.userData.isObstacle) obstacles.push(lod);
    };

    const createCritter = (x: number, z: number, type: 'rabbit' | 'partridge' | 'critter') => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      
      let body;
      if (type === 'rabbit') {
        body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.3, 2, 4), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
        const earL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), body.material); earL.position.set(0.08, 0.3, 0); group.add(earL);
        const earR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), body.material); earR.position.set(-0.08, 0.3, 0); group.add(earR);
      } else if (type === 'partridge') {
        body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 4, 4), new THREE.MeshStandardMaterial({ color: 0x9c5c2d }));
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), body.material); head.position.set(0, 0.15, 0.1); group.add(head);
      } else {
        body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x9c5c2d }));
      }
      
      body.position.y = 0.15;
      body.castShadow = true;
      group.add(body);
      group.userData = { type, targetX: x, targetZ: z, speed: 0.02 + Math.random() * 0.04 };
      critterGroupRef.current.add(group);
    };

    for(let i=0; i<4500; i++) {
        const x = (Math.random()-0.5)*1400, z = (Math.random()-0.5)*1400; 
        if(Math.sqrt(x*x+z*z) < 20) continue;
        createFoliageLOD(x, z, ['tree', 'appleTree', 'bush', 'rock'][Math.floor(Math.random()*4)]);
    }

    for(let i=0; i<150; i++) {
      const x = (Math.random()-0.5)*800, z = (Math.random()-0.5)*800;
      if(Math.sqrt(x*x+z*z) < 15) continue;
      createCritter(x, z, ['rabbit', 'partridge', 'critter'][Math.floor(Math.random()*3)] as any);
    }

    const controls = new PointerLockControls(camera, renderer.domElement); controlsRef.current = controls;
    controls.addEventListener('lock', () => propsRef.current.onLockChange(true));
    controls.addEventListener('unlock', () => propsRef.current.onLockChange(false));

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
        if((controls.isLocked || isMobile) && e.button === 0) { if (propsRef.current.isBowActive && propsRef.current.arrowCount > 0) spawnArrow(); else triggerAction(); } 
    });

    let verticalVelocity = 0; let lastFootstep = 0;

    const animate = () => {
        requestAnimationFrame(animate);
        const now = Date.now();
        const delta = 0.016; 
        const { time, isMobile: mobileActive } = propsRef.current;
        
        const phi = (time / 2400) * Math.PI * 2 - Math.PI / 2;
        tempVec.setFromSphericalCoords(1, Math.PI / 2 - phi, 0);
        
        const sunAltitude = Math.sin(phi);
        const isDay = sunAltitude > 0;
        const lFactor = Math.max(0, Math.min(1, sunAltitude + 0.3));

        if (skyRef.current) {
            const uniforms = skyRef.current.material.uniforms;
            uniforms['sunPosition'].value.copy(tempVec);
            uniforms['turbidity'].value = 10 * (1 - lFactor) + 2;
            uniforms['rayleigh'].value = 5 * lFactor + 0.5; // Vivid sky
            uniforms['mieCoefficient'].value = 0.005;
            uniforms['mieDirectionalG'].value = 0.8;
        }

        if (starsRef.current) {
          (starsRef.current.material as THREE.PointsMaterial).opacity = Math.max(0, -sunAltitude * 1.5);
          starsRef.current.position.set(camera.position.x, 0, camera.position.z);
        }
        
        if (sunLightRef.current) {
            sunLightRef.current.position.copy(tempVec).multiplyScalar(100);
            sunLightRef.current.intensity = Math.max(0.1, sunAltitude * 2.0); // Never zifiri karanlık
            if (sunAltitude < 0.2 && sunAltitude > -0.2) sunLightRef.current.color.setHSL(0.05, 1.0, 0.65); // Warm Sunset
            else sunLightRef.current.color.setHSL(0.1, 0.3, 1.0);
            sunLightRef.current.shadow.camera.position.set(camera.position.x, 50, camera.position.z);
            sunLightRef.current.target.position.set(camera.position.x, 0, camera.position.z);
            sunLightRef.current.target.updateMatrixWorld();
        }

        if (ambientLightRef.current) {
          const baseIntensity = isDay ? 0.85 : 0.35; // Lighter shadows
          ambientLightRef.current.intensity = baseIntensity + (lFactor * 0.3);
          
          if (!isDay) ambientLightRef.current.color.setHex(0x303055); // Vivid Night
          else if (sunAltitude < 0.2) ambientLightRef.current.color.setHex(0xffccaa); // Sunset Warmth
          else ambientLightRef.current.color.setHex(0xffffff);
        }

        if (sceneRef.current && sceneRef.current.fog) {
          const fog = sceneRef.current.fog as THREE.FogExp2;
          if (isDay) fog.color.setHSL(0.6, 0.4, Math.max(0.2, sunAltitude * 0.7));
          else fog.color.setHex(0x0c0c2a);
        }

        if (now > nextAmbientTimeRef.current) {
            const isDayLight = time > 500 && time < 1900;
            if (isDayLight && propsRef.current.sfxEnabled) {
                const sfx = Math.random() > 0.5 ? SFX_URLS.bird_ambient : SFX_URLS.squirrel_ambient;
                playSFX(sfx, 0.1);
            }
            nextAmbientTimeRef.current = now + 10000 + Math.random() * 20000;
        }

        if (torchModelRef.current && isTorchActive) {
          const flicker = 0.9 + Math.random() * 0.2;
          torchLightRef.current!.intensity = 150 * flicker;
          torchModelRef.current.position.y = -0.3 + Math.sin(now * 0.004) * 0.025; 
          torchModelRef.current.rotation.z = Math.sin(now * 0.002) * 0.04;
        }

        critterGroupRef.current.children.forEach(c => {
          if (!c.visible) return;
          const dist = new THREE.Vector2(c.position.x, c.position.z).distanceTo(new THREE.Vector2(c.userData.targetX, c.userData.targetZ));
          if (dist < 0.5 || Math.random() < 0.005) {
            c.userData.targetX = c.position.x + (Math.random() - 0.5) * 15;
            c.userData.targetZ = c.position.z + (Math.random() - 0.5) * 15;
            c.lookAt(c.userData.targetX, 0.1, c.userData.targetZ);
          }
          const dx = c.userData.targetX - c.position.x;
          const dz = c.userData.targetZ - c.position.z;
          const len = Math.sqrt(dx*dx + dz*dz);
          if (len > 0.01) {
            c.position.x += (dx/len) * c.userData.speed;
            c.position.z += (dz/len) * c.userData.speed;
            if (c.userData.type === 'rabbit') c.position.y = 0.15 + Math.abs(Math.sin(now * 0.012)) * 0.25; 
          }
        });

        campfireGroupRef.current.children.forEach(group => {
            const fireMeshes = group.userData.fireMeshes;
            const light = group.children.find(c => c instanceof THREE.PointLight) as THREE.PointLight;
            if (fireMeshes && light) {
                const flicker = 0.85 + Math.random() * 0.3;
                fireMeshes.forEach((mesh: THREE.Mesh, i: number) => { 
                  mesh.scale.y = flicker * (1.1 + Math.sin(now * 0.015 + i) * 0.25); 
                  mesh.scale.x = mesh.scale.z = 1.0 + Math.cos(now * 0.012) * 0.1;
                });
                light.intensity = 25 + Math.random() * 10;
            }
        });

        const currentProjectiles = (window as any).projectiles || [];
        (window as any).projectiles = currentProjectiles.filter((p: any) => {
          if (p.isStuck) return true;
          
          // Apply gravity
          p.velocity.y -= 12.0 * delta; 
          p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
          
          // Update rotation to match trajectory during flight
          p.mesh.lookAt(p.mesh.position.clone().add(p.velocity)); 
          p.mesh.rotateX(Math.PI/2);
          
          // Check for animal hits
          critterGroupRef.current.children.forEach(c => {
            if (c.visible && c.position.distanceTo(p.mesh.position) < 1.5) {
              c.visible = false;
              p.isStuck = true;
              playSFX(SFX_URLS.collect_meat, 0.8);
            }
          });

          // Ground landing logic: "Yere yatay olarak düşer"
          if (p.mesh.position.y < 0.1) { 
            p.isStuck = true; 
            p.mesh.position.y = 0.1; 
            // Once grounded, it lies flat horizontally
            p.mesh.rotation.x = Math.PI / 2;
            p.mesh.rotation.z = Math.random() * Math.PI * 2; // Random flat rotation
            groundedArrowsRef.current.push(p.mesh); 
          }
          return true;
        });

        // Automatic Proximity Pickup: "Yakınlaşınca ok geri alınır"
        for (let i = groundedArrowsRef.current.length - 1; i >= 0; i--) {
            const arrow = groundedArrowsRef.current[i];
            const dist = camera.position.distanceTo(arrow.position);
            if (dist < 4.0) { // Intuitive pickup range
                propsRef.current.onCollect('Arrow');
                scene.remove(arrow);
                groundedArrowsRef.current.splice(i, 1);
                // Also remove from global projectiles to be clean
                (window as any).projectiles = (window as any).projectiles.filter((p: any) => p.mesh !== arrow);
            }
        }

        verticalVelocity -= 15 * delta; camera.position.y += verticalVelocity * delta;
        if(camera.position.y < 1.8) { verticalVelocity = 0; camera.position.y = 1.8; }

        const moveX = mobileActive ? mobileInput.moveX : (Number(keys.d) - Number(keys.a));
        const moveY = mobileActive ? mobileInput.moveY : (Number(keys.w) - Number(keys.s));
        const moving = Math.abs(moveX) > 0.1 || Math.abs(moveY) > 0.1;
        const sprinting = mobileActive ? mobileInput.sprint : keys.shift;
        const jumping = mobileActive ? mobileInput.jump : keys.space;

        if(jumping && camera.position.y <= 1.81 && (controls.isLocked || mobileActive)) verticalVelocity = 5.8;

        if(moving && (controls.isLocked || mobileActive)) {
            const s = sprinting ? 30.0 : 13.5;
            camera.getWorldDirection(tempCamDir);
            tempCamSide.crossVectors(tempCamDir, new THREE.Vector3(0,1,0)).normalize();
            const forward = tempVec.set(tempCamDir.x, 0, tempCamDir.z).normalize();
            camera.position.add(forward.multiplyScalar(moveY * s * delta));
            camera.position.add(tempCamSide.multiplyScalar(moveX * s * delta));
            if(propsRef.current.sfxEnabled && camera.position.y <= 1.81 && now - lastFootstep > (sprinting ? 160 : 320)) {
                playSFX(SFX_URLS.footstep_grass, 0.08); lastFootstep = now;
            }
        }
        
        if(controls.isLocked || mobileActive) {
            obstacles.forEach(o => {
                if (!o.visible || o.position.distanceTo(camera.position) > 6) return;
                const dx = camera.position.x - o.position.x; const dz = camera.position.z - o.position.z;
                const distSq = dx*dx + dz*dz; const min = (o.userData.radius || 1) + 0.6;
                if (distSq < min * min) { const d = Math.sqrt(distSq); if(d > 0.01) { const f = min/d; camera.position.x = o.position.x + dx*f; camera.position.z = o.position.z + dz*f; } }
            });
            camera.getWorldDirection(tempCamDir);
            propsRef.current.onMovementChange({ moving, sprinting: moving && sprinting });
            propsRef.current.onPositionUpdate({ x: camera.position.x, z: camera.position.z, dirX: tempCamDir.x, dirZ: tempCamDir.z });
            if (now % 8 === 0) {
              const r = new THREE.Raycaster(); r.setFromCamera(new THREE.Vector2(0,0), camera);
              const interactables = worldObjectsRef.current.filter(o => o.visible && o.position.distanceTo(camera.position) < 12);
              if (waterRef.current) interactables.push(waterRef.current);
              campfireGroupRef.current.children.forEach(c => interactables.push(c));
              critterGroupRef.current.children.forEach(c => { if(c.visible) interactables.push(c); });
              const hits = r.intersectObjects(interactables, true);
              const target = hits.find(h => {
                let p = h.object; while(p.parent && !p.userData.type) p = p.parent;
                return p.userData.type;
              });
              let finalType = 'none';
              if (target) {
                let p = target.object; while(p.parent && !p.userData.type) p = p.parent;
                finalType = p.userData.type;
              }
              propsRef.current.onInteract({ type: finalType as any });
            }
        }
        renderer.render(scene, camera);
    };
    animate();

    const res = () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
    window.addEventListener('resize', res);
    return () => {
        window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU); window.removeEventListener('resize', res);
        controls.dispose(); renderer.dispose(); mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full" />;
});

export default GameScene;
