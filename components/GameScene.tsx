
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
  const torchLightRef = useRef<THREE.PointLight | null>(null);
  const worldObjectsRef = useRef<THREE.Object3D[]>([]);
  const groundedArrowsRef = useRef<THREE.Object3D[]>([]);
  const waterRef = useRef<Water | null>(null);
  
  const propsRef = useRef({ onInteract, onCollect, onDrink, onCook, onShoot, onMovementChange, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, weather, sfxEnabled, isMobile });

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
    if (torchLightRef.current) {
      torchLightRef.current.visible = isTorchActive;
    }
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
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
    group.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0x555555 }));
    tip.position.y = 0.46; group.add(tip);
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
      
    const velocity = tempCamDir.clone().multiplyScalar(90);
    arrow.lookAt(arrow.position.clone().add(velocity)); 
    arrow.rotateX(Math.PI/2); 
    
    sceneRef.current.add(arrow);
    (window as any).projectiles = (window as any).projectiles || [];
    (window as any).projectiles.push({ 
      mesh: arrow, 
      velocity, 
      isStuck: false, 
      stuckTo: null, 
      localOffset: null,
      creationTime: Date.now() 
    });
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
        let interacted = false;

        if(t === 'water') { propsRef.current.onDrink(); interacted = true; }
        else if(t === 'campfire') { propsRef.current.onCook(); interacted = true; }
        else if (t === 'tree' || t === 'appleTree') { propsRef.current.onCollect(t === 'appleTree' ? 'Apple' : 'Wood'); o.visible = false; o.userData.isObstacle = false; interacted = true; }
        else if (t === 'rock' || t === 'bush') { propsRef.current.onCollect(t === 'rock' ? 'Stone' : 'Berries'); o.visible = false; o.userData.isObstacle = false; interacted = true; }
        else if (t === 'rabbit' || t === 'partridge' || t === 'critter') { 
          propsRef.current.onCollect('Raw Meat'); 
          o.visible = false; 
          interacted = true; 
        }

        if (interacted) {
          propsRef.current.onInteract({ type: 'none' });
        }
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
    renderer.toneMappingExposure = 1.35; 
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mountRef.current.appendChild(renderer.domElement);

    const sky = new Sky(); sky.scale.setScalar(450000); scene.add(sky); skyRef.current = sky;
    const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.6); sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight); sunLightRef.current = sunLight;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9); 
    scene.add(ambientLight); ambientLightRef.current = ambientLight;

    // Torch Light initialization
    const torchLight = new THREE.PointLight(0xff9900, 0, 40); 
    torchLight.castShadow = true;
    torchLight.shadow.mapSize.set(512, 512);
    scene.add(torchLight);
    torchLightRef.current = torchLight;

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), new THREE.MeshStandardMaterial({ color: 0x224422, roughness: 1.0 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    const barkTex = new THREE.MeshStandardMaterial({ color: 0x5a3e2b });
    const stoneTex = new THREE.MeshStandardMaterial({ color: 0x888888 });

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
        scene.add(lod); worldObjectsRef.current.push(lod);
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
      body.position.y = 0.15; body.castShadow = true; group.add(body);
      group.userData = { type, targetX: x, targetZ: z, speed: 0.02 + Math.random() * 0.04 };
      critterGroupRef.current.add(group);
    };

    for(let i=0; i<3000; i++) {
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

    let verticalVelocity = 0;

    const animate = () => {
        requestAnimationFrame(animate);
        const now = Date.now();
        const delta = 0.016; 
        const { time, isTorchActive } = propsRef.current;
        
        // Sun cycle
        const phi = (time / 2400) * Math.PI * 2 - Math.PI / 2;
        tempVec.setFromSphericalCoords(1, Math.PI / 2 - phi, 0);
        if (sunLightRef.current) {
            sunLightRef.current.position.copy(tempVec).multiplyScalar(100);
            sunLightRef.current.intensity = Math.max(0.1, Math.sin(phi) * 2.0); 
        }

        // Torch Flicker and Position Update
        if (torchLightRef.current) {
          if (isTorchActive) {
            torchLightRef.current.visible = true;
            torchLightRef.current.position.copy(camera.position);
            // Simulate realistic flame flicker
            const flicker = Math.sin(now * 0.01) * 2 + Math.cos(now * 0.007) * 3 + 20;
            torchLightRef.current.intensity = flicker;
          } else {
            torchLightRef.current.visible = false;
          }
        }

        // Projectiles Update
        const currentProjectiles = (window as any).projectiles || [];
        (window as any).projectiles = currentProjectiles.filter((p: any) => {
          if (p.isStuck) {
            if (p.stuckTo && !p.stuckTo.visible) {
              p.isStuck = false;
              p.stuckTo = null;
              p.velocity.set(0, -2, 0);
            }
            return true;
          }
          
          p.velocity.y -= 12.0 * delta; 
          p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
          p.mesh.lookAt(p.mesh.position.clone().add(p.velocity)); 
          p.mesh.rotateX(Math.PI/2);
          
          critterGroupRef.current.children.forEach(c => {
            if (c.visible && c.position.distanceTo(p.mesh.position) < 1.2) {
              c.visible = false;
              p.isStuck = true;
              p.stuckTo = c; 
              playSFX(SFX_URLS.collect_meat, 0.8);
              propsRef.current.onCollect('Raw Meat'); 
            }
          });

          worldObjectsRef.current.forEach(o => {
            if (o.visible && o.position.distanceTo(p.mesh.position) < (o.userData.radius || 1.5)) {
              p.isStuck = true;
              p.stuckTo = o;
              playSFX(SFX_URLS.arrow_impact, 0.4);
            }
          });

          if (p.mesh.position.y < 0.1) { 
            p.isStuck = true; 
            p.stuckTo = null;
            p.mesh.position.y = 0.1; 
            p.mesh.rotation.x = Math.PI / 2;
            p.mesh.rotation.z = Math.random() * Math.PI * 2; 
            groundedArrowsRef.current.push(p.mesh); 
          }
          return true;
        });

        // Picking up grounded arrows
        for (let i = groundedArrowsRef.current.length - 1; i >= 0; i--) {
            const arrow = groundedArrowsRef.current[i];
            if (camera.position.distanceTo(arrow.position) < 4.0) { 
                propsRef.current.onCollect('Arrow');
                scene.remove(arrow);
                groundedArrowsRef.current.splice(i, 1);
                (window as any).projectiles = (window as any).projectiles.filter((p: any) => p.mesh !== arrow);
            }
        }

        // Movement
        verticalVelocity -= 15 * delta; camera.position.y += verticalVelocity * delta;
        if(camera.position.y < 1.8) { verticalVelocity = 0; camera.position.y = 1.8; }
        const moveX = isMobile ? mobileInput.moveX : (Number(keys.d) - Number(keys.a));
        const moveY = isMobile ? mobileInput.moveY : (Number(keys.w) - Number(keys.s));
        const moving = Math.abs(moveX) > 0.1 || Math.abs(moveY) > 0.1;
        if(moving && (controls.isLocked || isMobile)) {
            const s = (isMobile ? mobileInput.sprint : keys.shift) ? 30.0 : 13.5;
            camera.getWorldDirection(tempCamDir);
            tempCamSide.crossVectors(tempCamDir, new THREE.Vector3(0,1,0)).normalize();
            const forward = tempVec.set(tempCamDir.x, 0, tempCamDir.z).normalize();
            camera.position.add(forward.multiplyScalar(moveY * s * delta));
            camera.position.add(tempCamSide.multiplyScalar(moveX * s * delta));
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
