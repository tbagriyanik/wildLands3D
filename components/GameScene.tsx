
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
  const torchLightRef = useRef<THREE.PointLight | null>(null);
  const worldObjectsRef = useRef<THREE.Object3D[]>([]);
  const flyingArrowsRef = useRef<THREE.Object3D[]>([]);
  const skyRef = useRef<Sky | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  
  const propsRef = useRef({ onInteract, onCollect, onDrink, onCook, onShoot, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, sfxEnabled, isMobile, mobileInput, isLocked, isCraftingOpen });

  const velocity = useRef(new THREE.Vector3());
  const isGrounded = useRef(true);

  useEffect(() => {
    propsRef.current = { onInteract, onCollect, onDrink, onCook, onShoot, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, sfxEnabled, isMobile, mobileInput, isLocked, isCraftingOpen };
    if (isCraftingOpen && controlsRef.current?.isLocked) controlsRef.current.unlock();
    if (torchLightRef.current) torchLightRef.current.visible = isTorchActive;
  }, [onInteract, onCollect, onDrink, onCook, onShoot, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, sfxEnabled, isMobile, mobileInput, isLocked, isCraftingOpen]);

  useEffect(() => {
    if(!sceneRef.current) return;
    campfireGroupRef.current.clear();
    campfires.forEach(cf => {
      const group = new THREE.Group();
      group.position.set(cf.x, 0, cf.z);
      const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1), new THREE.MeshStandardMaterial({ color: 0x4a2c1d }));
      wood.rotation.z = Math.PI / 4; group.add(wood);
      const wood2 = wood.clone(); wood2.rotation.z = -Math.PI / 4; group.add(wood2);
      const light = new THREE.PointLight(0xff4500, 15, 12); light.position.y = 0.5; group.add(light);
      const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: 0xff4500 })); fire.position.y = 0.3; group.add(fire);
      group.userData = { type: 'campfire', id: cf.id };
      campfireGroupRef.current.add(group);
    });
  }, [campfires]);

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
    head.position.z = 0.35; 
    head.rotation.x = Math.PI/2; 
    arrow.add(head);
    cameraRef.current.getWorldPosition(arrow.position);
    arrow.quaternion.copy(cameraRef.current.quaternion);
    arrow.rotateY(Math.PI);
    const shootDir = new THREE.Vector3(0, 0.1, -1).applyQuaternion(cameraRef.current.quaternion).normalize();
    arrow.userData = { type: 'arrow_projectile', velocity: shootDir.multiplyScalar(75), life: 10.0 };
    sceneRef.current.add(arrow);
    flyingArrowsRef.current.push(arrow);
  };

  const triggerAction = () => {
    if (!cameraRef.current || !sceneRef.current) return;
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2(0,0), cameraRef.current);
    const interactables = [...worldObjectsRef.current, ...campfireGroupRef.current.children, ...critterGroupRef.current.children].filter(o => o.visible && o.position.distanceTo(cameraRef.current!.position) < 10);
    const hits = r.intersectObjects(interactables, true);
    if (propsRef.current.isBowActive && propsRef.current.arrowCount > 0) {
      if (hits.length > 0 && hits[0].distance < 4) { } else { shootArrow(); return; }
    }
    if(hits.length > 0 && hits[0].distance < 6) {
        let o = hits[0].object; while(o.parent && !o.userData.type) o = o.parent;
        const t = o.userData.type;
        if (t) {
          if (t === 'water') propsRef.current.onDrink();
          else if (t === 'campfire') propsRef.current.onCook('campfire');
          else if (t === 'arrow') { 
            propsRef.current.onCollect('Arrow'); 
            o.removeFromParent();
            const index = worldObjectsRef.current.indexOf(o);
            if (index > -1) worldObjectsRef.current.splice(index, 1);
          }
          else if (['tree', 'appleTree', 'bush', 'rock'].includes(t)) { 
            propsRef.current.onCollect(t === 'appleTree' ? 'Apple' : t === 'tree' ? 'Wood' : t === 'rock' ? 'Stone' : 'Berries'); 
            o.visible = false; o.userData.isObstacle = false; 
            playSFX(t === 'tree' ? SFX_URLS.collect_wood : t === 'rock' ? SFX_URLS.collect_stone : SFX_URLS.collect_item_generic);
          }
          else if (['rabbit', 'squirrel', 'partridge', 'deer'].includes(t)) { 
            const amount = t === 'deer' ? 3 : 1;
            for(let i=0; i<amount; i++) propsRef.current.onCollect('Raw Meat'); 
            o.visible = false; 
            playSFX(SFX_URLS.collect_meat); 
          }
        }
    }
  };

  const requestLock = () => {
    if (controlsRef.current && !controlsRef.current.isLocked && !propsRef.current.isCraftingOpen && !propsRef.current.isMobile) {
      try { controlsRef.current.lock(); } catch (e) {}
    }
  };
  useImperativeHandle(ref, () => ({ triggerAction, requestLock }));

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    // 100 Birim civarında sis başlar, 150'de tamamen kapanır
    scene.fog = new THREE.Fog(0x020617, 20, 150);
    scene.add(critterGroupRef.current); scene.add(campfireGroupRef.current);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.set(initialPosition?.x || 120, 1.8, initialPosition?.z || 120);
    if (initialRotation !== undefined) camera.rotation.y = initialRotation;
    cameraRef.current = camera;
    const torchLight = new THREE.PointLight(0xffaa55, 10, 25); torchLight.visible = false; camera.add(torchLight); scene.add(camera);
    torchLightRef.current = torchLight;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight); renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    const sky = new Sky(); sky.scale.setScalar(450000); scene.add(sky); skyRef.current = sky;
    const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.5); sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024); scene.add(sunLight); sunLightRef.current = sunLight;
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); scene.add(ambientLight); ambientLightRef.current = ambientLight;
    const grassTex = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(250, 250);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3500, 3500), new THREE.MeshStandardMaterial({ map: grassTex }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    const addWaterBody = (x: number, z: number, r: number) => {
      const lake = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ color: 0x00aaff, transparent: true, opacity: 0.7, metalness: 0.8 }));
      lake.rotation.x = -Math.PI/2; lake.position.set(x, 0.06, z); lake.userData = { type: 'water' };
      scene.add(lake); worldObjectsRef.current.push(lake);
    };
    addWaterBody(0, 0, 42); // Ana Göl
    addWaterBody(250, 300, 15); addWaterBody(-400, 200, 20); addWaterBody(100, -500, 12); // Küçük Göletler

    const createFoliage = (x: number, z: number, type: string) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      if (type === 'tree') {
        const variant = Math.floor(Math.random() * 3);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2c1d });
        if (variant === 0) {
          const h = 7 + Math.random() * 5; g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, h), trunkMat));
          const leaves = new THREE.Mesh(new THREE.ConeGeometry(2, 6, 8), new THREE.MeshStandardMaterial({ color: 0x0a3d0a }));
          leaves.position.y = h/2; g.add(leaves); g.userData = { type, isObstacle: true, radius: 1.2 };
        } else if (variant === 1) {
          const h = 4 + Math.random() * 3; g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, h), trunkMat));
          const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 1), new THREE.MeshStandardMaterial({ color: 0x1a5a1a }));
          leaves.position.y = h/2 + 1; g.add(leaves); g.userData = { type, isObstacle: true, radius: 2.0 };
        } else {
          const h = 8 + Math.random() * 4; g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, h), new THREE.MeshStandardMaterial({ color: 0xdddddd })));
          const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(2.5), new THREE.MeshStandardMaterial({ color: 0x2d5a27 }));
          leaves.position.y = h/2; g.add(leaves); g.userData = { type, isObstacle: true, radius: 1.0 };
        }
      } else if (type === 'rock') {
        const s = 1 + Math.random()*2;
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s), new THREE.MeshStandardMaterial({ color: 0x777777 }));
        r.position.y = s*0.4; g.add(r); g.userData = { type, isObstacle: true, radius: s*0.9 };
      }
      scene.add(g); worldObjectsRef.current.push(g);
    };

    const createCritter = (x: number, z: number) => {
      const typeRoll = Math.random();
      const g = new THREE.Group(); g.position.set(x, 0, z);
      let type = 'rabbit';
      if (typeRoll < 0.3) {
        type = 'rabbit';
        const color = Math.random() > 0.5 ? 0xeeeeee : 0x8b4513;
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.5), new THREE.MeshStandardMaterial({ color }));
        body.position.y = 0.1; g.add(body);
        const ears = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), new THREE.MeshStandardMaterial({ color }));
        ears.position.set(0.06, 0.3, -0.2); g.add(ears);
      } else if (typeRoll < 0.6) {
        type = 'squirrel'; const color = 0xd2691e;
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.4), new THREE.MeshStandardMaterial({ color }));
        body.position.y = 0.1; g.add(body);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), new THREE.MeshStandardMaterial({ color }));
        tail.position.set(0, 0.25, 0.2); tail.rotation.x = Math.PI/4; g.add(tail);
      } else if (typeRoll < 0.8) {
        type = 'partridge'; const color = 0x555555;
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshStandardMaterial({ color }));
        body.scale.set(1, 0.8, 1.2); body.position.y = 0.2; g.add(body);
      } else {
        type = 'deer'; const color = 0x8b4513;
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 1.5), new THREE.MeshStandardMaterial({ color }));
        body.position.y = 1.0; g.add(body);
        const neck = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, 0.4), new THREE.MeshStandardMaterial({ color }));
        neck.position.set(0, 1.8, -0.6); neck.rotation.x = -0.5; g.add(neck);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8), new THREE.MeshStandardMaterial({ color }));
        head.position.set(0, 2.3, -1); g.add(head);
      }
      g.userData = { type, velocity: new THREE.Vector3(), nextMove: 0 };
      critterGroupRef.current.add(g);
    };

    for(let i=0; i<1500; i++) {
      const x = (Math.random()-0.5)*2000, z = (Math.random()-0.5)*2000;
      if (Math.sqrt(x*x+z*z) > 55) createFoliage(x, z, Math.random() > 0.3 ? 'tree' : 'rock');
    }
    for(let i=0; i<150; i++) {
      const x = (Math.random()-0.5)*1800, z = (Math.random()-0.5)*1800;
      if (Math.sqrt(x*x+z*z) > 60) createCritter(x, z);
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
      if (e.button === 0) { if (controls.isLocked) triggerAction(); else if (!propsRef.current.isCraftingOpen && !propsRef.current.isMobile) requestLock(); }
    });

    const interactionRaycaster = new THREE.Raycaster();
    const animate = () => {
        requestAnimationFrame(animate);
        const delta = 0.016;
        const { isMobile, mobileInput, isLocked, isCraftingOpen, time } = propsRef.current;
        if (isLocked && cameraRef.current) {
          interactionRaycaster.setFromCamera(new THREE.Vector2(0,0), cameraRef.current);
          const iTs = [...worldObjectsRef.current, ...campfireGroupRef.current.children, ...critterGroupRef.current.children].filter(o => o.visible && o.position.distanceTo(cameraRef.current!.position) < 10);
          const hts = interactionRaycaster.intersectObjects(iTs, true);
          if (hts.length > 0 && hts[0].distance < 6) {
            let o = hts[0].object; while(o.parent && !o.userData.type) o = o.parent;
            propsRef.current.onInteract({ type: o.userData.type as any || 'none', id: o.userData.id });
          } else {
            propsRef.current.onInteract({ type: 'none' });
          }
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
              for(const o of worldObjectsRef.current) { if(o.userData.isObstacle && nextPos.distanceTo(o.position) < (0.5 + (o.userData.radius || 0.8))) { collided = true; break; } }
              if(!collided) { camera.position.x = nextPos.x; camera.position.z = nextPos.z; }
            }
            if ((keys.space || mobileInput.jump) && isGrounded.current) { velocity.current.y = 9; isGrounded.current = false; }
        }
        if (!isGrounded.current) {
          velocity.current.y -= 25 * delta; camera.position.y += velocity.current.y * delta;
          if (camera.position.y <= 1.8) { camera.position.y = 1.8; velocity.current.y = 0; isGrounded.current = true; }
        }
        critterGroupRef.current.children.forEach(c => {
          if (!c.visible) return;
          const ud = c.userData;
          if (time > ud.nextMove) {
            const angle = Math.random() * Math.PI * 2;
            const speed = ud.type === 'deer' ? 8 : ud.type === 'rabbit' ? 4 : 2;
            ud.velocity.set(Math.cos(angle) * speed, 0, Math.sin(angle) * speed);
            ud.nextMove = time + 100 + Math.random() * 200;
            c.lookAt(c.position.clone().add(ud.velocity));
          }
          if (ud.velocity.length() > 0.1) {
            c.position.add(ud.velocity.clone().multiplyScalar(delta));
            ud.velocity.multiplyScalar(0.98);
          }
        });
        for (let i = flyingArrowsRef.current.length - 1; i >= 0; i--) {
          const a = flyingArrowsRef.current[i]; const v = a.userData.velocity as THREE.Vector3;
          const p = a.position.clone(); v.y -= 12 * delta; a.position.add(v.clone().multiplyScalar(delta)); a.lookAt(a.position.clone().add(v)); 
          interactionRaycaster.set(p, v.clone().normalize()); const hits = interactionRaycaster.intersectObjects([...worldObjectsRef.current, ground, ...critterGroupRef.current.children], true);
          if (hits.length > 0 && hits[0].distance < v.length() * delta + 0.2) {
            let target = hits[0].object; while(target.parent && !target.userData.type) target = target.parent;
            if (['rabbit', 'squirrel', 'partridge', 'deer'].includes(target.userData.type)) { target.visible = false; playSFX(SFX_URLS.collect_meat); }
            a.position.copy(hits[0].point); a.userData.type = 'arrow'; flyingArrowsRef.current.splice(i, 1); playSFX(SFX_URLS.arrow_impact); worldObjectsRef.current.push(a); continue;
          }
          if (a.userData.life <= 0) { a.removeFromParent(); flyingArrowsRef.current.splice(i, 1); } else a.userData.life -= delta;
        }
        const phi = (time / 2400) * Math.PI * 2 - Math.PI / 2;
        const sunPos = new THREE.Vector3().setFromSphericalCoords(1, phi, Math.PI / 2.5);
        if(skyRef.current) {
          skyRef.current.material.uniforms['sunPosition'].value.copy(sunPos);
          const intensity = Math.max(0, Math.sin(phi));
          sunLightRef.current!.intensity = intensity * 1.5;
          ambientLightRef.current!.intensity = 0.1 + intensity * 0.4;
          const fogColor = new THREE.Color().setHSL(0.6, 0.2, 0.05 + intensity * 0.1);
          if(scene.fog instanceof THREE.Fog) scene.fog.color.copy(fogColor);
          renderer.setClearColor(fogColor);
        }
        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
        propsRef.current.onPositionUpdate({ x: camera.position.x, y: camera.position.y, z: camera.position.z, dirX: camDir.x, dirZ: camDir.z });
        renderer.render(scene, camera);
    };
    animate();
    const handleResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
    window.addEventListener('resize', handleResize);
    return () => { renderer.dispose(); mountRef.current?.removeChild(renderer.domElement); window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU); window.removeEventListener('resize', handleResize); };
  }, []);
  return <div ref={mountRef} className="w-full h-full" style={{ cursor: (isLocked && !isCraftingOpen) ? 'none' : 'auto' }} />;
});
export default GameScene;
