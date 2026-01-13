
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
      const logMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.8 });
      for(let i=0; i<4; i++) {
        const log = new THREE.Mesh(logGeo, logMat);
        log.rotation.x = Math.PI/2; log.rotation.z = (i * Math.PI) / 2;
        log.position.y = 0.1; log.castShadow = true; group.add(log);
      }

      const fireInner = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 8), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
      fireInner.position.y = 0.7; group.add(fireInner);
      
      const fireMid = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8), new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.9 }));
      fireMid.position.y = 0.55; group.add(fireMid);

      const fireOuter = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.7 }));
      fireOuter.position.y = 0.4; group.add(fireOuter);
      
      const light = new THREE.PointLight(0xffaa00, 15, 50); 
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
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
    group.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    tip.position.y = 0.46; group.add(tip);
    const fletchingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
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
      
    const velocity = tempCamDir.clone().multiplyScalar(90);
    arrow.lookAt(arrow.position.clone().add(velocity)); arrow.rotateX(Math.PI/2);
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
    
    const hits = r.intersectObjects(interactables, true);
    if(hits.length > 0 && hits[0].distance < 8) {
        let o = hits[0].object; while(o.parent && !o.userData.type) o = o.parent;
        const t = o.userData.type;
        if(t === 'water') propsRef.current.onDrink();
        else if(t === 'campfire') propsRef.current.onCook();
        else if (t === 'tree' || t === 'appleTree') { propsRef.current.onCollect(t === 'appleTree' ? 'Apple' : 'Wood'); o.visible = false; o.userData.isObstacle = false; }
        else if (t === 'rock' || t === 'bush') { propsRef.current.onCollect(t === 'rock' ? 'Stone' : 'Berries'); o.visible = false; o.userData.isObstacle = false; }
    }
  };

  const requestLock = () => { if (controlsRef.current && !controlsRef.current.isLocked && !isMobile) controlsRef.current.lock(); };
  useImperativeHandle(ref, () => ({ triggerAction, requestLock }));

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0x1a1a1a, 0.002);
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1500);
    camera.position.set(120, 1.8, 120); cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight); renderer.setPixelRatio(1); 
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    const sky = new Sky(); sky.scale.setScalar(450000); scene.add(sky); skyRef.current = sky;
    
    // Create Stars
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

    const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.2); sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(512, 512); scene.add(sunLight); sunLightRef.current = sunLight;

    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const bowGroup = new THREE.Group();
    const bowCurve = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 4, 8, Math.PI), new THREE.MeshStandardMaterial({ color: 0x3d2b1f }));
    bowCurve.rotation.y = Math.PI/2; bowCurve.rotation.x = Math.PI/2; bowGroup.add(bowCurve);
    bowGroup.position.set(0.4, -0.3, -0.6); bowGroup.scale.setScalar(1.5); camera.add(bowGroup);
    bowModelRef.current = bowGroup; bowGroup.visible = false;

    const arrowGrp = createArrowMesh();
    arrowGrp.position.set(0.38, -0.28, -0.5); arrowGrp.scale.setScalar(0.8);
    arrowGrp.rotation.x = Math.PI/2;
    camera.add(arrowGrp); arrowModelRef.current = arrowGrp; arrowGrp.visible = false;

    const torchGroup = new THREE.Group();
    const torchHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x4a3728 }));
    torchHandle.rotation.x = -Math.PI/4; torchGroup.add(torchHandle);
    
    torchLightRef.current = new THREE.PointLight(0xffbb33, 120, 100);
    torchLightRef.current.position.set(0, 0.4, -0.4); 
    torchLightRef.current.castShadow = true;
    torchGroup.add(torchLightRef.current);
    
    torchGroup.position.set(0.5, -0.4, -0.7); camera.add(torchGroup);
    torchModelRef.current = torchGroup; torchGroup.visible = false;

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), new THREE.MeshStandardMaterial({ color: 0x1a331a, roughness: 1.0 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    const water = new Water(new THREE.CircleGeometry(50, 8), {
        textureWidth: 128, textureHeight: 128,
        waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }),
        waterColor: 0x002e40, distortionScale: 1.0, fog: true
    });
    water.rotation.x = -Math.PI/2; water.position.set(0, 0.21, 0); water.userData = { type: 'water' };
    scene.add(water); waterRef.current = water;

    const barkTex = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
    const stoneTex = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const obstacles: THREE.Object3D[] = [];

    const createFoliageLOD = (x: number, z: number, type: string) => {
        const lod = new THREE.LOD();
        lod.position.set(x, 0, z);
        if (type === 'tree' || type === 'appleTree') {
            const h = 5 + Math.random() * 3;
            const g0 = new THREE.Group();
            const t0 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, h, 4), barkTex); t0.position.y = h/2; t0.castShadow = true; g0.add(t0);
            const l0 = new THREE.Mesh(new THREE.ConeGeometry(3, 6, 4), new THREE.MeshStandardMaterial({ color: type === 'appleTree' ? 0x2e5c26 : 0x163821 })); l0.position.y = h+2; l0.castShadow = true; g0.add(l0);
            lod.addLevel(g0, 0);
            lod.addLevel(new THREE.Group(), 120);
            lod.userData = { type, isObstacle: true, radius: 0.9 };
        } else if (type === 'rock') {
            const s = 1 + Math.random();
            const r0 = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stoneTex); r0.position.y = s*0.4; r0.castShadow = true;
            lod.addLevel(r0, 0);
            lod.addLevel(new THREE.Group(), 100);
            lod.userData = { type, isObstacle: true, radius: s*0.8 };
        } else if (type === 'bush') {
          const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), new THREE.MeshStandardMaterial({ color: 0x2a601a }));
          b.position.y = 0.6; lod.addLevel(b, 0); lod.addLevel(new THREE.Group(), 60);
          lod.userData = { type };
        }
        lod.updateMatrix(); lod.matrixAutoUpdate = false;
        scene.add(lod); worldObjectsRef.current.push(lod); if(lod.userData.isObstacle) obstacles.push(lod);
    };

    for(let i=0; i<4500; i++) {
        const x = (Math.random()-0.5)*1400, z = (Math.random()-0.5)*1400; 
        if(Math.sqrt(x*x+z*z) < 20) continue;
        createFoliageLOD(x, z, ['tree', 'appleTree', 'bush', 'rock'][Math.floor(Math.random()*4)]);
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
        const eveningFactor = Math.max(0, Math.min(1, 1.0 - Math.abs(sunAltitude)));

        if (skyRef.current) {
            const uniforms = skyRef.current.material.uniforms;
            uniforms['sunPosition'].value.copy(tempVec);
            uniforms['turbidity'].value = 10 * (1 - lFactor) + 2;
            uniforms['rayleigh'].value = 3 * lFactor + 0.5;
            uniforms['mieCoefficient'].value = 0.005;
            uniforms['mieDirectionalG'].value = 0.8;
        }

        if (starsRef.current) {
          (starsRef.current.material as THREE.PointsMaterial).opacity = Math.max(0, -sunAltitude * 1.5);
          starsRef.current.position.set(camera.position.x, 0, camera.position.z);
        }
        
        if (sunLightRef.current) {
            sunLightRef.current.position.copy(tempVec).multiplyScalar(100);
            sunLightRef.current.intensity = Math.max(0, sunAltitude) * 1.5;
            
            // Dawn/Dusk coloring
            if (sunAltitude < 0.2 && sunAltitude > -0.2) {
              sunLightRef.current.color.setHSL(0.05, 0.8, 0.6);
            } else {
              sunLightRef.current.color.setHSL(0.1, 0.2, 1.0);
            }

            sunLightRef.current.shadow.camera.position.set(camera.position.x, 50, camera.position.z);
            sunLightRef.current.target.position.set(camera.position.x, 0, camera.position.z);
            sunLightRef.current.target.updateMatrixWorld();
        }

        if (ambientLightRef.current) {
          const intensity = Math.max(0.05, lFactor * 0.6);
          ambientLightRef.current.intensity = intensity;
          
          if (!isDay) {
            ambientLightRef.current.color.setHex(0x202040); // Deep Night Blue
          } else if (sunAltitude < 0.2) {
            ambientLightRef.current.color.setHex(0xffaa88); // Dawn/Dusk Orange
          } else {
            ambientLightRef.current.color.setHex(0xffffff);
          }
        }

        if (sceneRef.current && sceneRef.current.fog) {
          const fog = sceneRef.current.fog as THREE.FogExp2;
          if (isDay) {
            fog.color.setHSL(0.6, 0.2, Math.max(0.1, sunAltitude * 0.5));
          } else {
            fog.color.setHex(0x050510);
          }
        }

        // Ambient wildlife sounds logic
        if (now > nextAmbientTimeRef.current) {
            const isDayLight = time > 500 && time < 1900;
            if (isDayLight && propsRef.current.sfxEnabled) {
                const sfx = Math.random() > 0.5 ? SFX_URLS.bird_ambient : SFX_URLS.squirrel_ambient;
                playSFX(sfx, 0.15, true);
            }
            nextAmbientTimeRef.current = now + 10000 + Math.random() * 20000;
        }

        if (torchLightRef.current && isTorchActive) torchLightRef.current.intensity = 110 + Math.random() * 20;

        campfireGroupRef.current.children.forEach(group => {
            const fireMeshes = group.userData.fireMeshes;
            const light = group.children.find(c => c instanceof THREE.PointLight) as THREE.PointLight;
            if (fireMeshes && light) {
                const flicker = 0.85 + Math.random() * 0.3;
                fireMeshes.forEach((mesh: THREE.Mesh, i: number) => { 
                  mesh.scale.y = flicker * (1.1 + Math.sin(now * 0.012 + i) * 0.2); 
                  mesh.scale.x = mesh.scale.z = 1.0 + Math.cos(now * 0.01) * 0.1;
                });
                light.intensity = 15 + Math.random() * 8;
            }
        });

        const currentProjectiles = (window as any).projectiles || [];
        (window as any).projectiles = currentProjectiles.filter((p: any) => {
          if (p.isStuck) return true;
          p.velocity.y -= 9.8 * delta;
          p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
          p.mesh.lookAt(p.mesh.position.clone().add(p.velocity)); p.mesh.rotateX(Math.PI/2);
          if (p.mesh.position.y < 0.2) { 
            p.isStuck = true; 
            p.mesh.position.y = 0.2; 
            groundedArrowsRef.current.push(p.mesh); 
          }
          return true;
        });

        for (let i = groundedArrowsRef.current.length - 1; i >= 0; i--) {
            const arrow = groundedArrowsRef.current[i];
            if (camera.position.distanceTo(arrow.position) < 3.5) {
                propsRef.current.onCollect('Arrow');
                scene.remove(arrow);
                groundedArrowsRef.current.splice(i, 1);
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
                playSFX(SFX_URLS.footstep_grass, 0.1); lastFootstep = now;
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
              const hits = r.intersectObjects(interactables, true);
              const target = hits.find(h => h.object.userData && h.object.userData.type && h.object.userData.type !== 'none');
              propsRef.current.onInteract({ type: target ? target.object.userData.type : 'none' });
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
