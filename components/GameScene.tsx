
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
}

export interface GameSceneHandle {
  triggerAction: () => void;
  requestLock: () => void;
}

const textureLoader = new THREE.TextureLoader();

const GameScene = forwardRef<GameSceneHandle, GameSceneProps>(({ 
  onInteract, onCollect, onDrink, onPositionUpdate, onLockChange, onCook, onShoot, isBowActive, isTorchActive, arrowCount, time, weather, isLocked, isMobile, mobileInput, sfxEnabled, campfires, initialPosition, initialRotation, isCraftingOpen
}, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const campfireGroupRef = useRef<THREE.Group>(new THREE.Group());
  const critterGroupRef = useRef<THREE.Group>(new THREE.Group());
  const worldObjectsRef = useRef<THREE.Object3D[]>([]);
  const flyingArrowsRef = useRef<THREE.Object3D[]>([]);
  const skyRef = useRef<Sky | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  
  const propsRef = useRef({ onInteract, onCollect, onDrink, onCook, onShoot, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, sfxEnabled, isMobile, mobileInput, isLocked, isCraftingOpen });

  useEffect(() => {
    propsRef.current = { onInteract, onCollect, onDrink, onCook, onShoot, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, sfxEnabled, isMobile, mobileInput, isLocked, isCraftingOpen };
    
    if (isCraftingOpen && controlsRef.current?.isLocked) {
      controlsRef.current.unlock();
    }
  }, [onInteract, onCollect, onDrink, onCook, onShoot, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, sfxEnabled, isMobile, mobileInput, isLocked, isCraftingOpen]);

  const playSFX = (url: string, volume = 0.4) => {
    if (propsRef.current.sfxEnabled) {
      const sfx = new Audio(url); sfx.volume = volume; sfx.play().catch(() => {});
    }
  };

  const shootArrow = () => {
    if (!cameraRef.current || !sceneRef.current) return;
    propsRef.current.onShoot();
    playSFX(SFX_URLS.arrow_shoot);
    const arrow = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7), new THREE.MeshStandardMaterial({ color: 0x6e3b1c }));
    shaft.rotation.x = Math.PI/2; arrow.add(shaft);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    head.position.z = -0.35; head.rotation.x = -Math.PI/2; arrow.add(head);
    cameraRef.current.getWorldPosition(arrow.position);
    cameraRef.current.getWorldQuaternion(arrow.quaternion);
    const shootDir = new THREE.Vector3(0, 0.1, -1).applyQuaternion(cameraRef.current.quaternion).normalize();
    arrow.userData = { type: 'arrow_projectile', velocity: shootDir.multiplyScalar(60), life: 10.0 };
    sceneRef.current.add(arrow);
    flyingArrowsRef.current.push(arrow);
  };

  const triggerAction = () => {
    if (!cameraRef.current || !sceneRef.current) return;
    if (propsRef.current.isBowActive && propsRef.current.arrowCount > 0) { shootArrow(); return; }
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2(0,0), cameraRef.current);
    const interactables = [...worldObjectsRef.current, ...campfireGroupRef.current.children, ...critterGroupRef.current.children].filter(o => o.visible && o.position.distanceTo(cameraRef.current!.position) < 10);
    const hits = r.intersectObjects(interactables, true);
    if(hits.length > 0 && hits[0].distance < 6) {
        let o = hits[0].object; while(o.parent && !o.userData.type) o = o.parent;
        const t = o.userData.type;
        if (t) {
          if (t === 'water') propsRef.current.onDrink();
          else if (t === 'campfire') propsRef.current.onCook('campfire');
          else if (t === 'arrow') { propsRef.current.onCollect('Arrow'); o.removeFromParent(); }
          else if (['tree', 'appleTree', 'bush', 'rock'].includes(t)) { 
            propsRef.current.onCollect(t === 'appleTree' ? 'Apple' : t === 'tree' ? 'Wood' : t === 'rock' ? 'Stone' : 'Berries'); 
            o.visible = false; o.userData.isObstacle = false; 
          }
          else if (['rabbit', 'squirrel'].includes(t)) { propsRef.current.onCollect('Raw Meat'); o.visible = false; }
          playSFX(SFX_URLS.collect_item_generic);
        }
    }
  };

  const requestLock = () => {
    // Sadece etkileşim sırasında ve craft menüsü kapalıyken kilitle
    if (controlsRef.current && !controlsRef.current.isLocked && !propsRef.current.isCraftingOpen && !propsRef.current.isMobile) {
      try {
        controlsRef.current.lock();
      } catch (e) {
        // Hata durumunda sessizce yoksay (browser kilitlenmeyi reddetmiş olabilir)
      }
    }
  };
  useImperativeHandle(ref, () => ({ triggerAction, requestLock }));

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    scene.add(critterGroupRef.current); scene.add(campfireGroupRef.current);
    
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2500);
    camera.position.set(initialPosition?.x || 120, 1.8, initialPosition?.z || 120);
    if (initialRotation !== undefined) camera.rotation.y = initialRotation;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    const sky = new Sky(); sky.scale.setScalar(450000); scene.add(sky); skyRef.current = sky;
    const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.5); sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    scene.add(sunLight); sunLightRef.current = sunLight;
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); scene.add(ambientLight); ambientLightRef.current = ambientLight;
    
    const grassTex = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(200, 200);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.8 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    const createCritter = (type: 'rabbit' | 'squirrel', x: number, z: number) => {
      const group = new THREE.Group(); group.position.set(x, 0.2, z);
      const mat = new THREE.MeshStandardMaterial({ color: type === 'rabbit' ? 0xffffff : 0x8b4513, roughness: 1 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.4), mat); group.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), mat); head.position.set(0, 0.1, -0.2); group.add(head);
      if(type === 'rabbit') {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.08), mat);
        ear.position.set(0.04, 0.2, -0.2); group.add(ear);
        const ear2 = ear.clone(); ear2.position.x = -0.04; group.add(ear2);
      } else {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), mat);
        tail.position.set(0, 0.15, 0.2); tail.rotation.x = 0.5; group.add(tail);
      }
      group.userData = { type, nextJump: 0, vel: new THREE.Vector3() };
      critterGroupRef.current.add(group);
    };

    for(let i=0; i<40; i++) createCritter(Math.random() > 0.6 ? 'rabbit' : 'squirrel', (Math.random()-0.5)*800, (Math.random()-0.5)*800);

    const createFoliage = (x: number, z: number, type: string) => {
        const group = new THREE.Group(); group.position.set(x, 0, z);
        const barkMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 1 });
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a4a1a, roughness: 0.9 });
        if (type.includes('Tree')) {
            const h = 5 + Math.random() * 6;
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, h, 8), barkMat); trunk.position.y = h/2; trunk.castShadow = true; group.add(trunk);
            const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(2.5, 0), leafMat); leaves.position.y = h; leaves.castShadow = true; group.add(leaves);
            group.userData = { type, isObstacle: true, radius: 0.8 };
        } else if (type === 'rock') {
            const s = 0.8 + Math.random() * 1.5;
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.7, flatShading: true }));
            rock.position.y = s * 0.4; rock.castShadow = true; group.add(rock);
            group.userData = { type, isObstacle: true, radius: s * 0.9 };
        }
        scene.add(group); worldObjectsRef.current.push(group);
    };
    for(let i=0; i<1200; i++) {
      const x = (Math.random()-0.5)*1500, z = (Math.random()-0.5)*1500;
      if(Math.sqrt(x*x + z*z) > 15) createFoliage(x, z, ['tree', 'appleTree', 'rock'][Math.floor(Math.random()*3)]);
    }

    const controls = new PointerLockControls(camera, renderer.domElement); controlsRef.current = controls;
    controls.addEventListener('lock', () => propsRef.current.onLockChange(true));
    controls.addEventListener('unlock', () => propsRef.current.onLockChange(false));

    const keys = { w: false, a: false, s: false, d: false, shift: false };
    const onKD = (e: KeyboardEvent) => {
      const k = e.code.toLowerCase();
      if(k === 'keyw') keys.w = true; if(k === 'keya') keys.a = true; if(k === 'keys') keys.s = true; if(k === 'keyd') keys.d = true;
      if(k === 'shiftleft') keys.shift = true;
      if(k === 'keye') triggerAction();
    };
    const onKU = (e: KeyboardEvent) => {
      const k = e.code.toLowerCase();
      if(k === 'keyw') keys.w = false; if(k === 'keya') keys.a = false; if(k === 'keys') keys.s = false; if(k === 'keyd') keys.d = false;
      if(k === 'shiftleft') keys.shift = false;
    };
    window.addEventListener('keydown', onKD); window.addEventListener('keyup', onKU);
    
    // Güvenli kilitlenme çağrısı
    const onMouseDown = () => {
      if(!propsRef.current.isCraftingOpen && !propsRef.current.isMobile) {
        requestLock();
      }
    };
    renderer.domElement.addEventListener('mousedown', onMouseDown);

    const animate = () => {
        requestAnimationFrame(animate);
        const delta = 0.016;
        const { isMobile, mobileInput, isLocked, isCraftingOpen, time } = propsRef.current;
        
        if (isMobile && (Math.abs(mobileInput.lookX) > 0 || Math.abs(mobileInput.lookY) > 0)) {
          const e = new THREE.Euler(0, 0, 0, 'YXZ').setFromQuaternion(camera.quaternion);
          e.y -= mobileInput.lookX * 0.006; e.x -= mobileInput.lookY * 0.006;
          e.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, e.x));
          camera.quaternion.setFromEuler(e);
        }

        if((isLocked || isMobile) && !isCraftingOpen) {
            const moveX = isMobile ? mobileInput.moveX : (Number(keys.d) - Number(keys.a));
            const moveY = isMobile ? mobileInput.moveY : (Number(keys.w) - Number(keys.s));
            if(Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
              const sprint = (isMobile ? mobileInput.sprint : keys.shift) ? 12 : 6;
              const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
              const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();
              const nextPos = camera.position.clone().add(dir.multiplyScalar(moveY * sprint * delta)).add(side.multiplyScalar(moveX * sprint * delta));
              let collided = false;
              for(const o of worldObjectsRef.current) { if(o.userData.isObstacle && o.visible && nextPos.distanceTo(o.position) < (0.5 + (o.userData.radius || 0.8))) { collided = true; break; } }
              if(!collided) { camera.position.x = nextPos.x; camera.position.z = nextPos.z; }
            }
        }

        // Ballistic Arrow Updates
        const ray = new THREE.Raycaster();
        for (let i = flyingArrowsRef.current.length - 1; i >= 0; i--) {
          const a = flyingArrowsRef.current[i]; const v = a.userData.velocity as THREE.Vector3;
          const prev = a.position.clone(); 
          v.y -= 14 * delta; // Gravity
          a.position.add(v.clone().multiplyScalar(delta)); 
          a.lookAt(a.position.clone().add(v));
          
          ray.set(prev, v.clone().normalize()); 
          const hits = ray.intersectObjects([...worldObjectsRef.current, ground], true);
          if (hits.length > 0 && hits[0].distance < v.length() * delta + 0.15) { 
            a.position.copy(hits[0].point); 
            a.userData.type = 'arrow'; 
            flyingArrowsRef.current.splice(i, 1); 
            playSFX(SFX_URLS.arrow_impact); 
            continue; 
          }
          if (a.userData.life <= 0) { a.removeFromParent(); flyingArrowsRef.current.splice(i, 1); } else a.userData.life -= delta;
        }

        // Critter AI (Tavşan/Sincap)
        critterGroupRef.current.children.forEach(c => {
          if(!c.visible) return;
          const ud = c.userData;
          if(Date.now() > ud.nextJump) {
            const angle = Math.random() * Math.PI * 2;
            ud.vel.set(Math.cos(angle) * 3, 5, Math.sin(angle) * 3);
            ud.nextJump = Date.now() + 2000 + Math.random() * 4000;
          }
          if(c.position.y > 0.2 || ud.vel.y > 0) {
            c.position.add(ud.vel.clone().multiplyScalar(delta));
            ud.vel.y -= 15 * delta;
            if(c.position.y < 0.2) { c.position.y = 0.2; ud.vel.set(0,0,0); }
            c.lookAt(c.position.clone().add(new THREE.Vector3(ud.vel.x, 0, ud.vel.z)));
          }
        });

        // Sky / Sun Sync
        const phi = (time / 2400) * Math.PI * 2 - Math.PI / 2;
        const sunPos = new THREE.Vector3().setFromSphericalCoords(1, phi, Math.PI / 2.5);
        if(skyRef.current) {
          skyRef.current.material.uniforms['sunPosition'].value.copy(sunPos);
          const intensity = Math.max(0, Math.sin(phi));
          sunLightRef.current!.intensity = intensity * 1.5;
          ambientLightRef.current!.intensity = 0.1 + intensity * 0.4;
          scene.fog = new THREE.FogExp2(0x020617, 0.001 + (1-intensity) * 0.005);
        }
        
        camera.getWorldDirection(new THREE.Vector3()); // Just to keep ref updated
        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
        propsRef.current.onPositionUpdate({ x: camera.position.x, y: camera.position.y, z: camera.position.z, dirX: camDir.x, dirZ: camDir.z });
        renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        renderer.dispose(); mountRef.current?.removeChild(renderer.domElement);
        window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU);
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full" style={{ cursor: (isLocked && !isCraftingOpen) ? 'none' : 'auto' }} />;
});

export default GameScene;
