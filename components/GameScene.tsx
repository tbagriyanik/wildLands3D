
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { Sky } from 'three/examples/jsm/objects/Sky';
import { InteractionTarget, WeatherType, CampfireData, MobileInput } from '../types';
import { SFX_URLS } from '../constants';

interface GameSceneProps {
  onInteract: (target: InteractionTarget) => void;
  onCollect: (type: string) => void;
  onDrink: () => void;
  onPositionUpdate: (info: { x: number, y: number, z: number, dirX: number, dirZ: number }) => void;
  onLockChange: (locked: boolean) => void;
  onCook: (id: string) => void;
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
  initialPosition?: { x: number, y: number, z: number };
  initialRotation?: number;
  isCraftingOpen: boolean;
  onToggleCrafting: () => void;
}

export interface GameSceneHandle {
  triggerAction: () => void;
  handleShootAction: () => void;
  requestLock: () => void;
}

const VIEW_DISTANCE = 300;
const textureLoader = new THREE.TextureLoader();

const GameScene = forwardRef<GameSceneHandle, GameSceneProps>(({ 
  onInteract, onCollect, onDrink, onPositionUpdate, onLockChange, onCook, onShoot, isBowActive, isTorchActive, arrowCount, time, weather, isLocked, isMobile, mobileInput, sfxEnabled, campfires, initialPosition, initialRotation, isCraftingOpen, onToggleCrafting
}, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const campfireGroupRef = useRef<THREE.Group>(new THREE.Group());
  const critterGroupRef = useRef<THREE.Group>(new THREE.Group());
  const foliageGroupRef = useRef<THREE.Group>(new THREE.Group());
  const worldObjectsRef = useRef<THREE.Object3D[]>([]);
  const skyRef = useRef<Sky | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const playerModelRef = useRef<THREE.Group | null>(null);
  
  const propsRef = useRef({ onInteract, onCollect, onDrink, onCook, onShoot, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, sfxEnabled, isMobile, mobileInput, isLocked, isCraftingOpen, onToggleCrafting });

  const velocity = useRef(new THREE.Vector3());
  const isGrounded = useRef(true);

  useEffect(() => {
    propsRef.current = { onInteract, onCollect, onDrink, onCook, onShoot, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, sfxEnabled, isMobile, mobileInput, isLocked, isCraftingOpen, onToggleCrafting };
    if (isCraftingOpen && controlsRef.current?.isLocked) controlsRef.current.unlock();
  }, [onInteract, onCollect, onDrink, onCook, onShoot, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, sfxEnabled, isMobile, mobileInput, isLocked, isCraftingOpen, onToggleCrafting]);

  useEffect(() => {
    if(!sceneRef.current) return;
    campfireGroupRef.current.clear();
    campfires.forEach(cf => {
      const group = new THREE.Group(); group.position.set(cf.x, 0, cf.z);
      const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1), new THREE.MeshStandardMaterial({ color: 0x4a2c1d })); wood.rotation.z = Math.PI / 4; wood.castShadow = true; group.add(wood);
      const wood2 = wood.clone(); wood2.rotation.z = -Math.PI / 4; group.add(wood2);
      const light = new THREE.PointLight(0xff4500, 15, 12); light.position.y = 0.6; light.castShadow = true; group.add(light);
      const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: 0xff4500 })); fire.position.y = 0.3; group.add(fire);
      group.userData = { type: 'campfire', id: cf.id, baseIntensity: 15 }; campfireGroupRef.current.add(group);
    });
  }, [campfires]);

  const playSFX = (url: string, volume = 0.4) => { if (propsRef.current.sfxEnabled) { const sfx = new Audio(url); sfx.volume = volume; sfx.play().catch(() => {}); } };

  const triggerAction = () => {
    if (!cameraRef.current || !sceneRef.current) return;
    const r = new THREE.Raycaster(); r.setFromCamera(new THREE.Vector2(0,0), cameraRef.current);
    const interactables = [...worldObjectsRef.current, ...campfireGroupRef.current.children, ...critterGroupRef.current.children].filter(o => o.visible && o.position.distanceTo(cameraRef.current!.position) < 8);
    const hits = r.intersectObjects(interactables, true);
    if(hits.length > 0 && hits[0].distance < 6) {
        let o = hits[0].object; while(o.parent && !o.userData.type) o = o.parent;
        const t = o.userData.type;
        if (t) {
          if (t === 'water') propsRef.current.onDrink();
          else if (t === 'campfire') propsRef.current.onCook('campfire');
          else if (['tree', 'appleTree', 'bush', 'rock'].includes(t)) { 
            propsRef.current.onCollect(t === 'appleTree' ? 'Apple' : t === 'tree' ? 'Wood' : t === 'rock' ? 'Stone' : 'Berries'); 
            o.visible = false; o.userData.isObstacle = false; 
            playSFX(t === 'tree' ? SFX_URLS.collect_wood : t === 'rock' ? SFX_URLS.collect_stone : SFX_URLS.collect_item_generic);
          } else if (['rabbit', 'squirrel', 'deer'].includes(t)) {
            propsRef.current.onCollect('Raw Meat'); o.visible = false; playSFX(SFX_URLS.collect_meat);
          }
        }
    }
  };

  const requestLock = () => { if (controlsRef.current && !controlsRef.current.isLocked && !propsRef.current.isCraftingOpen && !propsRef.current.isMobile) { controlsRef.current.lock(); } };
  useImperativeHandle(ref, () => ({ triggerAction, handleShootAction: () => {}, requestLock }));

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    scene.fog = new THREE.Fog(0x020617, 20, 250); 
    scene.add(campfireGroupRef.current); scene.add(foliageGroupRef.current); scene.add(critterGroupRef.current);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(initialPosition?.x || 120, 1.8, initialPosition?.z || 120);
    cameraRef.current = camera;
    scene.add(camera);
    
    // Player Character Model
    const playerGroup = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2), new THREE.MeshStandardMaterial({ color: 0x3b82f6 })); body.position.y = 0.6; body.castShadow = true; playerGroup.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshStandardMaterial({ color: 0xffdbac })); head.position.y = 1.35; head.castShadow = true; playerGroup.add(head);
    scene.add(playerGroup);
    playerModelRef.current = playerGroup;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); renderer.setSize(window.innerWidth, window.innerHeight); renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    const sky = new Sky(); sky.scale.setScalar(450000); scene.add(sky); skyRef.current = sky;
    const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.2); sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(512, 512); scene.add(sunLight); sunLightRef.current = sunLight;
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); scene.add(ambientLight); ambientLightRef.current = ambientLight;

    const grassTex = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg'); grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(250, 250);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ map: grassTex })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    // Lakes
    for(let i=0; i<15; i++) {
      const lakeSize = 15 + Math.random() * 20;
      const lx = (Math.random()-0.5)*1500;
      const lz = (Math.random()-0.5)*1500;
      const lake = new THREE.Mesh(new THREE.CircleGeometry(lakeSize, 32), new THREE.MeshStandardMaterial({ color: 0x0077be, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.8 }));
      lake.position.set(lx, 0.05, lz); lake.rotation.x = -Math.PI/2; lake.userData = { type: 'water' };
      scene.add(lake); worldObjectsRef.current.push(lake);
    }

    const createFoliage = (x: number, z: number, type: string) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      if (type === 'tree') {
        const h = 7 + Math.random() * 5; g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, h), new THREE.MeshStandardMaterial({ color: 0x4a2c1d })));
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.5, 7, 8), new THREE.MeshStandardMaterial({ color: 0x0a3d0a })); leaves.position.y = h/2 + 2; leaves.castShadow = true; g.add(leaves);
        g.userData = { type, isObstacle: true, radius: 1.2, swaySpeed: 0.5 + Math.random() };
      } else if (type === 'bush') {
        const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), new THREE.MeshStandardMaterial({ color: 0x2d5a27 })); canopy.position.y = 0.6; canopy.castShadow = true; g.add(canopy);
        g.userData = { type, isObstacle: true, radius: 0.8, swaySpeed: 1.2 + Math.random() };
      } else if (type === 'rock') {
        const s = 1 + Math.random()*3; const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s), new THREE.MeshStandardMaterial({ color: 0x555555 })); r.position.y = s*0.4; r.castShadow = true; g.add(r); g.userData = { type, isObstacle: true, radius: s*0.8 };
      }
      foliageGroupRef.current.add(g); worldObjectsRef.current.push(g);
    };

    // Yogun çevre: 3000 nesne
    for(let i=0; i<3000; i++) {
      const x = (Math.random()-0.5)*2000, z = (Math.random()-0.5)*2000;
      if (Math.sqrt(x*x+z*z) > 40) createFoliage(x, z, Math.random() < 0.25 ? 'rock' : Math.random() < 0.45 ? 'bush' : 'tree');
    }

    // Animals
    for(let i=0; i<50; i++) {
      const type = Math.random() > 0.3 ? 'rabbit' : 'deer';
      const animal = new THREE.Group();
      if(type === 'rabbit') {
        animal.add(new THREE.Mesh(new THREE.SphereGeometry(0.3), new THREE.MeshStandardMaterial({ color: 0xffffff })));
        animal.userData = { type: 'rabbit', speed: 0.05, angle: Math.random()*Math.PI*2 };
      } else {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 1.2), new THREE.MeshStandardMaterial({ color: 0x8b4513 })); body.position.y = 0.8; animal.add(body);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8), new THREE.MeshStandardMaterial({ color: 0x8b4513 })); neck.position.set(0, 1.5, 0.5); neck.rotation.x = -Math.PI/4; animal.add(neck);
        animal.userData = { type: 'deer', speed: 0.08, angle: Math.random()*Math.PI*2 };
      }
      animal.position.set((Math.random()-0.5)*1800, 0, (Math.random()-0.5)*1800);
      critterGroupRef.current.add(animal); worldObjectsRef.current.push(animal);
    }

    const controls = new PointerLockControls(camera, renderer.domElement); controlsRef.current = controls;
    controls.addEventListener('lock', () => propsRef.current.onLockChange(true));
    controls.addEventListener('unlock', () => propsRef.current.onLockChange(false));

    const keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
    const onKD = (e: KeyboardEvent) => {
      const k = e.code.toLowerCase(); 
      if(k === 'keyw') keys.w = true; if(k === 'keya') keys.a = true; if(k === 'keys') keys.s = true; if(k === 'keyd') keys.d = true;
      if(k === 'shiftleft') keys.shift = true; if(k === 'space') keys.space = true; 
      if(k === 'keye') triggerAction();
      if(k === 'keyc') propsRef.current.onToggleCrafting();
    };
    const onKU = (e: KeyboardEvent) => {
      const k = e.code.toLowerCase(); 
      if(k === 'keyw') keys.w = false; if(k === 'keya') keys.a = false; if(k === 'keys') keys.s = false; if(k === 'keyd') keys.d = false;
      if(k === 'shiftleft') keys.shift = false; if(k === 'space') keys.space = false;
    };
    window.addEventListener('keydown', onKD); window.addEventListener('keyup', onKU);

    let lastCullTime = 0;
    const animate = () => {
        requestAnimationFrame(animate);
        const delta = 0.016;
        const now = Date.now();
        const { isMobile, mobileInput, isLocked, isCraftingOpen, time } = propsRef.current;

        // LOD / Performance: Distance Culling
        if (now - lastCullTime > 500 && cameraRef.current) {
          const camPos = cameraRef.current.position;
          foliageGroupRef.current.children.forEach(f => {
            f.visible = camPos.distanceTo(f.position) < VIEW_DISTANCE;
          });
          critterGroupRef.current.children.forEach(c => {
            c.visible = camPos.distanceTo(c.position) < VIEW_DISTANCE;
          });
          lastCullTime = now;
        }

        // Animal Movement
        critterGroupRef.current.children.forEach(c => {
          if(!c.visible) return;
          c.position.x += Math.cos(c.userData.angle) * c.userData.speed;
          c.position.z += Math.sin(c.userData.angle) * c.userData.speed;
          c.rotation.y = -c.userData.angle + Math.PI/2;
          if(Math.random() < 0.01) c.userData.angle += (Math.random()-0.5)*1.5;
        });

        // Day/Night Cycle (Fix: 12:00 = Noon)
        const phi = (time / 2400) * Math.PI * 2 - Math.PI / 2;
        const sunPos = new THREE.Vector3().setFromSphericalCoords(1, phi, Math.PI / 2.5);
        if(skyRef.current) {
          skyRef.current.material.uniforms['sunPosition'].value.copy(sunPos);
          const intensity = Math.max(0, Math.sin(phi));
          sunLightRef.current!.intensity = intensity * 1.5;
          ambientLightRef.current!.intensity = 0.1 + intensity * 0.4;
          const fogColor = new THREE.Color().setHSL(0.6, 0.2, 0.02 + intensity * 0.15);
          if(scene.fog instanceof THREE.Fog) scene.fog.color.copy(fogColor);
          renderer.setClearColor(fogColor);
          sunLightRef.current?.position.copy(sunPos).multiplyScalar(100);
        }

        if((isLocked || isMobile) && !isCraftingOpen) {
            const moveX = isMobile ? mobileInput.moveX : (Number(keys.d) - Number(keys.a));
            const moveY = isMobile ? mobileInput.moveY : (Number(keys.w) - Number(keys.s));
            if(Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
              const sprint = (isMobile ? mobileInput.sprint : keys.shift) ? 14 : 7;
              const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
              const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();
              const moveDir = dir.multiplyScalar(moveY).add(side.multiplyScalar(moveX)).normalize();
              const nextPos = camera.position.clone().add(moveDir.multiplyScalar(sprint * delta));
              let collided = false; 
              for(const o of worldObjectsRef.current) { 
                if(o.visible && o.userData.isObstacle && nextPos.distanceTo(o.position) < (0.8 + (o.userData.radius || 0.8))) { 
                  collided = true; break; 
                } 
              }
              if(!collided) { camera.position.x = nextPos.x; camera.position.z = nextPos.z; }
            }
            if ((keys.space || mobileInput.jump) && isGrounded.current) { velocity.current.y = 9; isGrounded.current = false; }
        }
        if (!isGrounded.current) { velocity.current.y -= 25 * delta; camera.position.y += velocity.current.y * delta; if (camera.position.y <= 1.8) { camera.position.y = 1.8; velocity.current.y = 0; isGrounded.current = true; } }
        
        // Player Model sync
        if(playerModelRef.current && cameraRef.current) {
          playerModelRef.current.position.set(cameraRef.current.position.x, 0, cameraRef.current.position.z);
          const dir = new THREE.Vector3(); cameraRef.current.getWorldDirection(dir);
          playerModelRef.current.rotation.y = Math.atan2(dir.x, dir.z);
        }

        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
        propsRef.current.onPositionUpdate({ x: camera.position.x, y: camera.position.y, z: camera.position.z, dirX: camDir.x, dirZ: camDir.z });
        renderer.render(scene, camera);
    };
    animate();
    const handleResize = () => { if(cameraRef.current) { cameraRef.current.aspect = window.innerWidth / window.innerHeight; cameraRef.current.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); } };
    window.addEventListener('resize', handleResize);
    mountRef.current.addEventListener('mousedown', requestLock);
    return () => { renderer.dispose(); mountRef.current?.removeEventListener('mousedown', requestLock); mountRef.current?.removeChild(renderer.domElement); window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU); window.removeEventListener('resize', handleResize); };
  }, []);
  return <div ref={mountRef} className="w-full h-full" style={{ cursor: (isLocked && !isCraftingOpen) ? 'none' : 'crosshair' }} />;
});
export default GameScene;
