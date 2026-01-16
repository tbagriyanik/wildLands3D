
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { Sky } from 'three/examples/jsm/objects/Sky';
import { InteractionTarget, CampfireData, MobileInput } from '../types';
import { TEXTURES, SFX_URLS } from '../constants';

interface GameSceneProps {
  time: number;
  campfires: CampfireData[];
  isLocked: boolean;
  isMobile: boolean;
  mobileInput: MobileInput;
  activeTorch: boolean;
  activeBow: boolean;
  hasArrows: boolean;
  onLockChange: (locked: boolean) => void;
  onInteract: (target: InteractionTarget) => void;
  onPositionUpdate: (info: { x: number, y: number, z: number, dirX: number, dirZ: number, rot: number }) => void;
  onCollect: (type: string) => void;
  onShoot: () => void;
  initialPosition?: { x: number, y: number, z: number };
}

export interface GameSceneHandle {
  requestLock: () => void;
  requestUnlock: () => void;
}

const GameScene = forwardRef<GameSceneHandle, GameSceneProps>((props, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const objectsRef = useRef<THREE.Object3D[]>([]);
  const waterRef = useRef<THREE.Object3D[]>([]);
  const animalsRef = useRef<THREE.Object3D[]>([]);
  const arrowsRef = useRef<Array<{ mesh: THREE.Group, velocity: THREE.Vector3, active: boolean, stuckIn?: THREE.Object3D }>>([]);
  const collectablesRef = useRef<THREE.Object3D[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const torchLightRef = useRef<THREE.PointLight | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const skyRef = useRef<Sky | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const isZooming = useRef(false);
  
  const propsRef = useRef(props);
  useEffect(() => { propsRef.current = props; }, [props]);

  const velocityY = useRef(0);
  const canJump = useRef(true);
  const GRAVITY = 30.0;
  const JUMP_FORCE = 12.0;
  const ARROW_SPEED = 85.0;

  const DEFAULT_FOV = 75;
  const ZOOM_FOV = 35;

  const campfireMeshes = useRef<Map<string, THREE.Group>>(new Map());

  useImperativeHandle(ref, () => ({
    requestLock: () => {
      if (!controlsRef.current) return;
      if (mountRef.current) {
        const canvas = mountRef.current.querySelector('canvas');
        canvas?.focus();
      }
      controlsRef.current.lock();
    },
    requestUnlock: () => {
      if (!controlsRef.current) return;
      controlsRef.current.unlock();
    }
  }));

  const createCampfireModel = (id: string, x: number, z: number) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    for (let i = 0; i < 6; i++) {
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15), stoneMat);
      const angle = (i / 6) * Math.PI * 2;
      stone.position.set(Math.cos(angle) * 0.4, 0.05, Math.sin(angle) * 0.4);
      group.add(stone);
    }
    const logMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6), logMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i / 3) * Math.PI * 2;
      group.add(log);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.8 }));
    flame.position.y = 0.25; flame.name = "flame";
    group.add(flame);
    const light = new THREE.PointLight(0xffaa33, 2, 8);
    light.position.y = 0.5; group.add(light);
    group.userData = { id, type: 'campfire' };
    return group;
  };

  const handleHarvest = () => {
    if (!cameraRef.current || !controlsRef.current || !controlsRef.current.isLocked) return;
    if (propsRef.current.activeBow) { shootArrow(); return; }

    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), cameraRef.current);
    
    // Su içme kontrolü
    const waterHits = ray.intersectObjects(waterRef.current, true);
    if (waterHits.length > 0 && waterHits[0].distance < 6.5) {
      propsRef.current.onCollect('Water');
      return;
    }

    const hits = ray.intersectObjects(objectsRef.current, true);
    if (hits.length > 0 && hits[0].distance < 4.5) {
      let obj = hits[0].object;
      while(obj.parent && !obj.userData.type) obj = obj.parent;
      if (['tree', 'rock', 'bush'].includes(obj.userData.type)) {
        obj.userData.hp -= 1;
        const type = obj.userData.type === 'tree' ? 'Wood' : obj.userData.type === 'bush' ? 'Berries' : 'Stone';
        propsRef.current.onCollect(type);
        obj.userData.targetScale = obj.userData.originalScale * (obj.userData.hp / obj.userData.maxHp);
        obj.position.y += 0.06; setTimeout(() => { if(obj) obj.position.y -= 0.06; }, 60);
        
        if (obj.userData.hp <= 0) {
          sceneRef.current?.remove(obj);
          objectsRef.current = objectsRef.current.filter(o => o !== obj);
          // Bu objeye saplanmış okları serbest bırak ve yerçekimi ver
          arrowsRef.current.forEach(arrow => {
            if (arrow.stuckIn === obj) {
              arrow.stuckIn = undefined;
              arrow.active = true;
              arrow.velocity.set(0, -2, 0); 
            }
          });
        }
      }
    }
  };

  const shootArrow = () => {
    const { activeBow, hasArrows, onShoot } = propsRef.current;
    if (!activeBow || !hasArrows || !cameraRef.current || !sceneRef.current) return;
    onShoot();
    
    const arrowGroup = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.85), new THREE.MeshStandardMaterial({ color: 0x4a2c1d }));
    shaft.rotation.x = Math.PI / 2; arrowGroup.add(shaft);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    head.position.z = 0.42; head.rotation.x = Math.PI / 2; arrowGroup.add(head);

    const dir = new THREE.Vector3();
    cameraRef.current.getWorldDirection(dir);
    
    arrowGroup.position.copy(cameraRef.current.position).add(dir.clone().multiplyScalar(0.7));
    arrowGroup.lookAt(arrowGroup.position.clone().add(dir));
    
    sceneRef.current.add(arrowGroup);
    arrowsRef.current.push({ 
      mesh: arrowGroup, 
      velocity: dir.clone().multiplyScalar(ARROW_SPEED), 
      active: true 
    });
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, window.innerWidth / window.innerHeight, 0.1, 1500);
    camera.position.set(propsRef.current.initialPosition?.x || 160, 1.8, propsRef.current.initialPosition?.z || 120);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; renderer.setClearColor(0x020617);
    mountRef.current.appendChild(renderer.domElement);

    const texLoader = new THREE.TextureLoader();
    const grassTex = texLoader.load(TEXTURES.grass);
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(100, 100);
    const stoneTex = texLoader.load(TEXTURES.stone);
    stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.35); scene.add(hemiLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.25);
    sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048);
    scene.add(sunLight); sunLightRef.current = sunLight;

    const sky = new Sky(); sky.scale.setScalar(1000); scene.add(sky); skyRef.current = sky;
    const sunOrb = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffffee }));
    scene.add(sunOrb); sunMeshRef.current = sunOrb;

    const torchLight = new THREE.PointLight(0xffcc66, 0, 16);
    torchLight.position.set(0.6, -0.4, -0.6); camera.add(torchLight); scene.add(camera);
    torchLightRef.current = torchLight;

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2500, 2500), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    const createLake = (x: number, z: number, r: number) => {
      const lakeGroup = new THREE.Group();
      const lake = new THREE.Mesh(
        new THREE.CircleGeometry(r, 32),
        new THREE.MeshStandardMaterial({ color: 0x0055ff, transparent: true, opacity: 0.7, roughness: 0.1, metalness: 0.4 })
      );
      lake.rotation.x = -Math.PI / 2;
      lake.position.set(0, 0.03, 0);
      lakeGroup.add(lake);
      
      const reeds = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2), new THREE.MeshStandardMaterial({ color: 0x224411 }));
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = r + 0.5 + Math.random();
        const rClone = reeds.clone();
        rClone.position.set(Math.cos(angle) * dist, 0.6, Math.sin(angle) * dist);
        lakeGroup.add(rClone);
      }

      lakeGroup.position.set(x, 0, z);
      lakeGroup.userData = { type: 'water' };
      scene.add(lakeGroup);
      waterRef.current.push(lakeGroup);
    };

    createLake(100, 100, 18);
    createLake(220, 140, 24);
    createLake(85, 200, 14);
    createLake(160, 80, 12);

    const createAnimal = (type: string, x: number, z: number) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      
      if (type === 'rabbit') {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshStandardMaterial({ color: 0xefefef }));
        body.position.y = 0.3; body.castShadow = true; g.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshStandardMaterial({ color: 0xefefef }));
        head.position.set(0, 0.5, 0.2); head.castShadow = true; g.add(head);
        const earL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.1), new THREE.MeshStandardMaterial({ color: 0xffaaaa }));
        earL.position.set(-0.08, 0.7, 0.2); earL.rotation.z = 0.1; g.add(earL);
        const earR = earL.clone(); earR.position.x = 0.08; earR.rotation.z = -0.1; g.add(earR);
      } else if (type === 'deer') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 1.2), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
        body.position.y = 0.9; body.castShadow = true; g.add(body);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.8), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
        neck.position.set(0, 1.4, 0.5); neck.rotation.x = 0.4; g.add(neck);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.45), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
        head.position.set(0, 1.7, 0.7); g.add(head);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.6), new THREE.MeshStandardMaterial({ color: 0x3d2b1f }));
        for(let i=0; i<4; i++) {
          const l = leg.clone();
          l.position.set(i<2 ? 0.22 : -0.22, 0.3, i%2 === 0 ? 0.4 : -0.4);
          g.add(l);
        }
      } else if (type === 'bird') {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: 0x111111 }));
        body.castShadow = true; g.add(body);
        const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.15), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        wingL.position.x = -0.15; g.add(wingL);
        const wingR = wingL.clone(); wingR.position.x = 0.15; g.add(wingR);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1), new THREE.MeshStandardMaterial({ color: 0xffaa00 }));
        beak.rotation.x = Math.PI/2; beak.position.z = 0.15; g.add(beak);
        g.position.y = 10 + Math.random() * 8;
      }

      g.userData = { type, fleeing: false, velocity: new THREE.Vector3(), isAnimal: true, speed: type === 'deer' ? 16 : 11 };
      scene.add(g); animalsRef.current.push(g);
    };

    const createObject = (type: string, x: number, z: number) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const baseScale = 0.85 + Math.random() * 0.9;
      if (type === 'tree') {
        const treeType = Math.random();
        if (treeType < 0.35) {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 5.5), new THREE.MeshStandardMaterial({ color: 0x2b1d0e }));
          trunk.position.y = 2.75; g.add(trunk);
          for(let i=0; i<3; i++) {
            const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.8 - i*0.5, 3, 8), new THREE.MeshStandardMaterial({ color: 0x0a2f0a }));
            leaves.position.y = 4 + i*1.6; g.add(leaves);
          }
        } else if (treeType < 0.7) {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 4), new THREE.MeshStandardMaterial({ color: 0x4a2c1d }));
          trunk.position.y = 2; g.add(trunk);
          const leaves = new THREE.Mesh(new THREE.SphereGeometry(2.2), new THREE.MeshStandardMaterial({ color: 0x1e5631 }));
          leaves.position.y = 5; g.add(leaves);
        } else {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 6.5), new THREE.MeshStandardMaterial({ color: 0xfafafa }));
          trunk.position.y = 3.25; g.add(trunk);
          const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4), new THREE.MeshStandardMaterial({ color: 0x8dfc00 }));
          leaves.position.y = 7; g.add(leaves);
        }
      } else if (type === 'bush') {
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), new THREE.MeshStandardMaterial({ color: 0x1a4a14 }));
        bush.position.y = 0.45; g.add(bush);
        for(let i=0; i<10; i++) {
          const berry = new THREE.Mesh(new THREE.SphereGeometry(0.07), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
          berry.position.set(Math.random()-0.6, 0.5+Math.random()*0.6, Math.random()-0.6); g.add(berry);
        }
      } else {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55), new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8, metalness: 0.1 }));
        rock.position.y = 0.3; g.add(rock);
      }
      g.scale.setScalar(baseScale);
      g.userData = { type, hp: 5, maxHp: 5, originalScale: baseScale, targetScale: baseScale };
      scene.add(g); objectsRef.current.push(g);
    };

    for(let i=0; i<60; i++) { createObject('tree', 20+Math.random()*260, 20+Math.random()*260); createObject('rock', 20+Math.random()*260, 20+Math.random()*260); createObject('bush', 20+Math.random()*260, 20+Math.random()*260); }
    for(let i=0; i<18; i++) { createAnimal('rabbit', 50+Math.random()*200, 50+Math.random()*200); createAnimal('deer', 50+Math.random()*200, 50+Math.random()*200); createAnimal('bird', 50+Math.random()*200, 50+Math.random()*200); }

    const controls = new PointerLockControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.addEventListener('lock', () => propsRef.current.onLockChange(true));
    controls.addEventListener('unlock', () => propsRef.current.onLockChange(false));

    const handleDown = (e: MouseEvent) => { 
      if (!controls.isLocked) controls.lock(); 
      else if (e.button === 0) handleHarvest(); 
    };
    renderer.domElement.addEventListener('mousedown', handleDown);

    const onKeyDown = (e: KeyboardEvent) => { 
      const code = e.code.toLowerCase();
      keysRef.current[code] = true;
      if (code === 'keye' && controls.isLocked) handleHarvest();
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code.toLowerCase()] = false; };
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', (e) => { if(e.button === 2) isZooming.current = true; });
    window.addEventListener('mouseup', (e) => { if(e.button === 2) isZooming.current = false; });

    const animate = () => {
      requestAnimationFrame(animate); 
      const delta = 0.016; 
      const time = performance.now() * 0.001;
      if (!controlsRef.current || !cameraRef.current) return;

      const gameTime = propsRef.current.time;
      const sunAngle = (gameTime / 2400) * Math.PI * 2 - Math.PI / 2;
      const sunPos = new THREE.Vector3(Math.cos(sunAngle), Math.sin(sunAngle), -0.5).normalize();
      if (skyRef.current) skyRef.current.material.uniforms['sunPosition'].value.copy(sunPos);
      if (sunMeshRef.current) sunMeshRef.current.position.copy(sunPos).multiplyScalar(500);
      if (sunLightRef.current) { sunLightRef.current.position.copy(sunPos).multiplyScalar(100); sunLightRef.current.intensity = Math.max(0, sunPos.y * 1.5); }

      objectsRef.current.forEach(obj => {
        const target = obj.userData.targetScale;
        if (Math.abs(obj.scale.x - target) > 0.001) obj.scale.setScalar(THREE.MathUtils.lerp(obj.scale.x, target, 0.2));
      });

      animalsRef.current.forEach(animal => {
        const dist = camera.position.distanceTo(animal.position);
        if (dist < 12) {
          animal.userData.fleeing = true;
          const fleeDir = animal.position.clone().sub(camera.position).normalize();
          if (animal.userData.type === 'bird') fleeDir.y = 0.7; else fleeDir.y = 0;
          animal.userData.velocity.copy(fleeDir).multiplyScalar(animal.userData.speed * delta);
        }
        if (animal.userData.fleeing) {
          animal.position.add(animal.userData.velocity);
          animal.lookAt(animal.position.clone().add(animal.userData.velocity));
          if (animal.userData.type === 'bird') { animal.position.y += 0.25; if (animal.position.y > 80) animal.userData.fleeing = false; }
          if (animal.position.distanceTo(camera.position) > 45 && animal.userData.type !== 'bird') animal.userData.fleeing = false;
        }
      });

      const currentCampfires = propsRef.current.campfires;
      campfireMeshes.current.forEach((mesh, id) => { if (!currentCampfires.find(cf => cf.id === id)) { scene.remove(mesh); campfireMeshes.current.delete(id); } });
      currentCampfires.forEach(cf => {
        let mesh = campfireMeshes.current.get(cf.id);
        if (!mesh) { mesh = createCampfireModel(cf.id, cf.x, cf.z); scene.add(mesh); campfireMeshes.current.set(cf.id, mesh); }
        const light = mesh.children.find(c => c instanceof THREE.PointLight) as THREE.PointLight;
        if (light) light.intensity = 1.8 + Math.sin(time * 14) * 0.5 + Math.random() * 0.15;
      });

      if (torchLightRef.current) {
        if (propsRef.current.activeTorch) { torchLightRef.current.intensity = 2.4 + Math.sin(time * 22) * 0.6; torchLightRef.current.visible = true; }
        else torchLightRef.current.visible = false;
      }

      if (controlsRef.current.isLocked) {
        const camera = cameraRef.current; const ctrls = controlsRef.current;
        camera.fov = THREE.MathUtils.lerp(camera.fov, isZooming.current ? ZOOM_FOV : DEFAULT_FOV, 0.15); camera.updateProjectionMatrix();
        velocityY.current -= GRAVITY * delta; camera.position.y += velocityY.current * delta;
        if (camera.position.y < 1.8) { camera.position.y = 1.8; velocityY.current = 0; canJump.current = true; }
        if (keysRef.current['space'] && canJump.current) { velocityY.current = JUMP_FORCE; canJump.current = false; }
        const speed = (keysRef.current['shiftleft'] || keysRef.current['shiftright']) ? 16 : 8.5;
        if (keysRef.current['keyw'] || keysRef.current['arrowup']) ctrls.moveForward(speed * delta);
        if (keysRef.current['keys'] || keysRef.current['arrowdown']) ctrls.moveForward(-speed * delta);
        if (keysRef.current['keya'] || keysRef.current['arrowleft']) ctrls.moveRight(-speed * delta);
        if (keysRef.current['keyd'] || keysRef.current['arrowright']) ctrls.moveRight(speed * delta);

        for (let i = arrowsRef.current.length - 1; i >= 0; i--) {
          const arrow = arrowsRef.current[i];
          if (!arrow.active) { 
            if (camera.position.distanceTo(arrow.mesh.position) < 3) { scene.remove(arrow.mesh); arrowsRef.current.splice(i, 1); propsRef.current.onCollect('Arrow'); } 
            continue; 
          }
          
          arrow.velocity.y -= GRAVITY * 0.7 * delta; 
          arrow.mesh.position.add(arrow.velocity.clone().multiplyScalar(delta));
          arrow.mesh.lookAt(arrow.mesh.position.clone().add(arrow.velocity));
          
          const ray = new THREE.Raycaster(arrow.mesh.position, arrow.velocity.clone().normalize(), 0, 1.5);
          const hits = ray.intersectObjects([...objectsRef.current, ...animalsRef.current, ground], true);
          if (hits.length > 0) {
            let obj = hits[0].object; while(obj.parent && !obj.userData.type && obj.type !== 'Scene') obj = obj.parent;
            if (obj.userData.isAnimal) {
              const pos = obj.position.clone(); scene.remove(obj); animalsRef.current = animalsRef.current.filter(a => a !== obj);
              const meat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.48), new THREE.MeshStandardMaterial({ color: 0xaa1111 }));
              meat.position.copy(pos).y = 0.25; meat.userData = { type: 'Meat' }; scene.add(meat); collectablesRef.current.push(meat);
              scene.remove(arrow.mesh); arrowsRef.current.splice(i, 1);
            } else { 
              arrow.active = false; 
              arrow.velocity.set(0, 0, 0); 
              arrow.mesh.position.copy(hits[0].point); 
              arrow.stuckIn = obj; 
            }
          } else if (arrow.mesh.position.y < 0) { arrow.active = false; arrow.velocity.set(0, 0, 0); arrow.mesh.position.y = 0.05; }
        }

        for (let i = collectablesRef.current.length - 1; i >= 0; i--) {
          const item = collectablesRef.current[i];
          if (camera.position.distanceTo(item.position) < 3.5) { propsRef.current.onCollect(item.userData.type); scene.remove(item); collectablesRef.current.splice(i, 1); }
        }

        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
        
        const waterHits = ray.intersectObjects(waterRef.current, true);
        if (waterHits.length > 0 && waterHits[0].distance < 6.5) {
           propsRef.current.onInteract({ type: 'water' });
        } else {
          const hits = ray.intersectObjects(objectsRef.current, true);
          if (hits.length > 0 && hits[0].distance < 6.5) {
            let o = hits[0].object; while(o.parent && !o.userData.type) o = o.parent;
            propsRef.current.onInteract({ type: o.userData.type });
          } else propsRef.current.onInteract({ type: 'none' });
        }

        const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
        propsRef.current.onPositionUpdate({ x: camera.position.x, y: camera.position.y, z: camera.position.z, dirX: dir.x, dirZ: dir.z, rot: Math.atan2(dir.x, dir.z) });
      }
      renderer.render(scene, cameraRef.current!);
    };
    animate();
    
    return () => { 
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('mousedown', handleDown); renderer.dispose(); mountRef.current?.removeChild(renderer.domElement); 
    };
  }, []);

  return <div ref={mountRef} tabIndex={0} className="w-full h-full pointer-events-auto cursor-crosshair relative outline-none ring-0" />;
});
export default GameScene;
