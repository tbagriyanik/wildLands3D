
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { Sky } from 'three/examples/jsm/objects/Sky';
import { InteractionTarget, CampfireData, ShelterData, MobileInput } from '../types';
import { TEXTURES, SFX_URLS } from '../constants';

interface GameSceneProps {
  day: number;
  time: number;
  campfires: CampfireData[];
  shelters: ShelterData[];
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
  onClean: () => void;
}

export interface GameSceneHandle {
  requestLock: () => void;
  requestUnlock: () => void;
  interact: () => void;
}

const GameScene = forwardRef<GameSceneHandle, GameSceneProps>((props, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const objectsRef = useRef<THREE.Object3D[]>([]);
  const waterRef = useRef<THREE.Object3D[]>([]);
  const animalsRef = useRef<THREE.Object3D[]>([]);
  const persistentArrowsRef = useRef<THREE.Object3D[]>([]);
  const cloudsRef = useRef<THREE.Group | null>(null);
  const arrowsRef = useRef<Array<{ mesh: THREE.Group, velocity: THREE.Vector3, active: boolean }>>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const skyRef = useRef<Sky | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const moonLightRef = useRef<THREE.DirectionalLight | null>(null);
  const torchLightRef = useRef<THREE.PointLight | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);
  const lastSpawnedDay = useRef(props.day);
  
  const internalTime = useRef(props.time);
  const propsRef = useRef(props);
  useEffect(() => { propsRef.current = props; }, [props]);

  const velocityY = useRef(0);
  const canJump = useRef(true);
  const currentFov = useRef(75);
  const GRAVITY = 30.0;
  const JUMP_FORCE = 12.0;

  const campfireMeshes = useRef<Map<string, THREE.Group>>(new Map());
  const shelterMeshes = useRef<Map<string, THREE.Group>>(new Map());
  const lookRotation = useRef({ yaw: 0, pitch: 0 });

  const performInteraction = () => {
    if (!cameraRef.current || !sceneRef.current) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), cameraRef.current);
    const waterHits = ray.intersectObjects(waterRef.current, true);
    if (waterHits.length > 0 && waterHits[0].distance < 6) { propsRef.current.onCollect('Water'); return; }
    const interactables = [...objectsRef.current, ...animalsRef.current, ...Array.from(campfireMeshes.current.values()), ...Array.from(shelterMeshes.current.values()), ...persistentArrowsRef.current];
    const hits = ray.intersectObjects(interactables, true);
    if (hits.length > 0 && hits[0].distance < 6.0) {
      let obj = hits[0].object; while(obj.parent && !obj.userData.type && obj.type !== 'Scene') obj = obj.parent;
      if (obj.userData.type === 'arrow') { propsRef.current.onCollect('Arrow'); sceneRef.current.remove(obj); persistentArrowsRef.current = persistentArrowsRef.current.filter(a => a !== obj); return; }
      if (obj.userData.type === 'shelter') { propsRef.current.onCollect('Sleep'); return; }
      if (obj.userData.type === 'rabbit' || obj.userData.type === 'partridge') { propsRef.current.onCollect('Meat'); sceneRef.current.remove(obj); animalsRef.current = animalsRef.current.filter(a => a !== obj); return; }
      if (obj.userData.type && obj.userData.type !== 'campfire') {
        obj.userData.hitIntensity = 1.0; let type = 'Wood';
        if (obj.userData.type === 'bush') type = 'Berries'; else if (obj.userData.type === 'rock') type = 'Stone'; else if (obj.userData.type === 'appleTree') type = 'Apple'; else if (obj.userData.type === 'pearTree') type = 'Pear';
        propsRef.current.onCollect(type); obj.userData.hp -= 1;
        if (obj.userData.hp <= 0) { sceneRef.current.remove(obj); objectsRef.current = objectsRef.current.filter(o => o !== obj); }
      }
    }
  };

  useImperativeHandle(ref, () => ({
    requestLock: () => { if (propsRef.current.isMobile) return; if (controlsRef.current && !controlsRef.current.isLocked) controlsRef.current.lock(); },
    requestUnlock: () => { if (controlsRef.current && controlsRef.current.isLocked) controlsRef.current.unlock(); },
    interact: () => performInteraction()
  }));

  const shootArrow = () => {
    const { activeBow, hasArrows, onShoot } = propsRef.current;
    if (!activeBow || !hasArrows || !cameraRef.current || !sceneRef.current) return;
    onShoot();
    
    const arrowGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a2c1d });
    const matHead = new THREE.MeshStandardMaterial({ color: 0x555555 });
    
    // Shaft - Center on Z so the tip is at local (0,0,0)
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9), mat);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -0.45; // Backwards 0.45 units
    arrowGroup.add(shaft);
    
    // Head - At local (0,0,0) pointing forward (+Z)
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4), matHead);
    head.rotation.x = Math.PI / 2; // Point cone tip along +Z
    head.position.z = 0; // Exactly at the tip position
    arrowGroup.add(head);
    
    const dir = new THREE.Vector3(); cameraRef.current.getWorldDirection(dir);
    arrowGroup.position.copy(cameraRef.current.position).add(dir.clone().multiplyScalar(0.7)); 
    arrowGroup.lookAt(arrowGroup.position.clone().add(dir)); // Point +Z towards travel direction
    
    arrowGroup.userData = { type: 'arrow' }; sceneRef.current.add(arrowGroup);
    arrowsRef.current.push({ mesh: arrowGroup, velocity: dir.clone().multiplyScalar(85), active: true });
  };

  const createCampfireModel = (id: string, x: number, z: number) => {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    for (let i = 0; i < 6; i++) { const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), stoneMat); const angle = (i / 6) * Math.PI * 2; stone.position.set(Math.cos(angle) * 0.45, 0.05, Math.sin(angle) * 0.45); group.add(stone); }
    const logMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
    for (let i = 0; i < 3; i++) { const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7), logMat); log.rotation.z = Math.PI / 2; log.rotation.y = (i / 3) * Math.PI * 2; group.add(log); }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 8), new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.8 })); flame.position.y = 0.3; group.add(flame);
    const light = new THREE.PointLight(0xffaa33, 2.5, 10); light.position.y = 0.6; group.add(light);
    group.userData = { id, type: 'campfire' }; return group;
  };

  const createShelterModel = (id: string, x: number, z: number, rotation: number, tier: number) => {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = rotation;
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x2d1b0d }); const roofMat = new THREE.MeshStandardMaterial({ color: 0x552211 });
    if (tier === 1) { 
      const tentMat = new THREE.MeshStandardMaterial({ color: 0xef4444, side: THREE.DoubleSide }); const tentGeom = new THREE.CylinderGeometry(0.01, 2.5, 3.5, 4, 1, true); const tent = new THREE.Mesh(tentGeom, tentMat); tent.rotation.y = Math.PI / 4; tent.position.y = 1.75; group.add(tent);
      const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.8), woodMat); pole1.position.set(0, 1.9, 1.2); pole1.rotation.z = Math.PI/10; group.add(pole1);
      const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.8), woodMat); pole2.position.set(0, 1.9, 1.2); pole2.rotation.z = -Math.PI/10; group.add(pole2);
    } else if (tier === 2) { 
      const walls = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), woodMat); walls.position.y = 1.5; group.add(walls);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 2, 4), roofMat); roof.position.y = 4; roof.rotation.y = Math.PI / 4; group.add(roof);
    } else if (tier === 3) { 
      const walls = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), new THREE.MeshStandardMaterial({ color: 0x777777 })); walls.position.y = 2; group.add(walls);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.5, 6.5), roofMat); roof.position.y = 4.25; group.add(roof);
      const roofTop = new THREE.Mesh(new THREE.ConeGeometry(5, 3, 4), roofMat); roofTop.position.y = 5.5; roofTop.rotation.y = Math.PI / 4; group.add(roofTop);
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.5, 0.8), new THREE.MeshStandardMaterial({ color: 0x444444 })); chimney.position.set(1.5, 5, 1.5); group.add(chimney);
    }
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 2.2), new THREE.MeshStandardMaterial({ color: 0x3d3d3d })); bed.position.set(0, 0.1, -0.5); group.add(bed);
    group.userData = { id, type: 'shelter', tier }; return group;
  };

  const createAnimalModel = (type: string, x?: number, z?: number) => {
    const group = new THREE.Group(); 
    const spawnX = x ?? (50 + Math.random() * 400); 
    const spawnZ = z ?? (50 + Math.random() * 400); 
    group.position.set(spawnX, 0, spawnZ);
    if (type === 'rabbit') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: 0xeeeeee })); body.position.y = 0.175; group.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshStandardMaterial({ color: 0xeeeeee })); head.position.set(0, 0.4, 0.2); group.add(head);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x884422 })); body.position.y = 0.3; group.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x884422 })); head.position.set(0, 0.65, 0.3); group.add(head);
    }
    group.userData = { type, nextMove: 0, velocity: new THREE.Vector3() }; sceneRef.current?.add(group); animalsRef.current.push(group); return group;
  };

  const createCloudSystem = (scene: THREE.Scene) => {
    const group = new THREE.Group(); const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 30; i++) {
      const cloud = new THREE.Group(); const parts = 3 + Math.floor(Math.random() * 5);
      for (let j = 0; j < parts; j++) { const part = new THREE.Mesh(new THREE.SphereGeometry(8 + Math.random() * 10, 8, 8), cloudMat); part.position.set(j * 10 - (parts * 5), Math.random() * 5, Math.random() * 5); cloud.add(part); }
      cloud.position.set((Math.random() - 0.5) * 3000, 200 + Math.random() * 150, (Math.random() - 0.5) * 3000); cloud.userData = { speed: 0.05 + Math.random() * 0.15 }; group.add(cloud);
    }
    scene.add(group); cloudsRef.current = group;
  };

  const createObject = (type: string, x: number, z: number, scene: THREE.Scene) => {
    const woodTex = new THREE.TextureLoader().load(TEXTURES.wood); const stoneTex = new THREE.TextureLoader().load(TEXTURES.stone);
    const g = new THREE.Group(); g.position.set(x, 0, z); const baseScale = 0.8 + Math.random() * 1.5;
    if (type.includes('Tree')) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 6), new THREE.MeshStandardMaterial({ map: woodTex })); trunk.position.y = 3; g.add(trunk);
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5, 1), new THREE.MeshStandardMaterial({ color: type === 'tree' ? 0x0a3a04 : 0x1a4a14, flatShading: true })); leaves.position.y = 6; g.add(leaves);
      trunk.castShadow = true; trunk.receiveShadow = true; leaves.castShadow = true;
    } else if (type === 'rock') {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7), new THREE.MeshStandardMaterial({ map: stoneTex })); rock.position.y = 0.3; rock.rotation.set(Math.random(), Math.random(), Math.random()); g.add(rock);
      rock.castShadow = true; rock.receiveShadow = true;
    } else {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 8), new THREE.MeshStandardMaterial({ color: 0x225511 })); bush.position.y = 0.5; g.add(bush); bush.castShadow = true;
    }
    g.scale.setScalar(baseScale); g.userData = { type, hp: 5, baseScale, hitIntensity: 0, swayOffset: Math.random() * Math.PI * 2, swaySpeed: 0.0015 + Math.random() * 0.0015, isFoliage: type !== 'rock' };
    scene.add(g); objectsRef.current.push(g);
  };

  useEffect(() => {
    if (sceneRef.current && props.day > lastSpawnedDay.current) {
       for(let i=0; i<10; i++) { 
         const r = Math.random() * 200; const theta = Math.random() * 2 * Math.PI; 
         createObject('tree', 160 + r * Math.cos(theta), 120 + r * Math.sin(theta), sceneRef.current);
         createObject('bush', 160 + (r+20) * Math.cos(theta), 120 + (r+20) * Math.sin(theta), sceneRef.current);
         createObject('rock', 160 + (r-20) * Math.cos(theta), 120 + (r-20) * Math.sin(theta), sceneRef.current);
       }
       lastSpawnedDay.current = props.day;
    }
  }, [props.day]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const campfireIds = new Set(props.campfires.map(f => f.id));
    campfireMeshes.current.forEach((mesh, id) => { if (!campfireIds.has(id)) { scene.remove(mesh); campfireMeshes.current.delete(id); } });
    props.campfires.forEach(cf => { if (!campfireMeshes.current.has(cf.id)) { const mesh = createCampfireModel(cf.id, cf.x, cf.z); scene.add(mesh); campfireMeshes.current.set(cf.id, mesh); } });
    const shelterIds = new Set(props.shelters.map(s => s.id));
    shelterMeshes.current.forEach((mesh, id) => { const data = props.shelters.find(s => s.id === id); if (!shelterIds.has(id) || (data && data.tier !== mesh.userData.tier)) { scene.remove(mesh); shelterMeshes.current.delete(id); } });
    props.shelters.forEach(sh => { if (!shelterMeshes.current.has(sh.id)) { const mesh = createShelterModel(sh.id, sh.x, sh.z, sh.rotation, sh.tier); scene.add(mesh); shelterMeshes.current.set(sh.id, mesh); } });
  }, [props.campfires, props.shelters]);

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 4000); camera.position.set(propsRef.current.initialPosition?.x || 160, 1.8, propsRef.current.initialPosition?.z || 120); cameraRef.current = camera;
    scene.fog = new THREE.FogExp2(0xcccccc, 0.0025);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(window.innerWidth, window.innerHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.setClearColor(0xcccccc); mountRef.current.appendChild(renderer.domElement);
    const starGeometry = new THREE.BufferGeometry(); const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: 0 }); const starVertices = [];
    for (let i = 0; i < 4000; i++) { const x = (Math.random() - 0.5) * 3000; const y = Math.random() * 1500 + 200; const z = (Math.random() - 0.5) * 3000; starVertices.push(x, y, z); }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3)); const stars = new THREE.Points(starGeometry, starMaterial); scene.add(stars); starsRef.current = stars;

    const sunGeom = new THREE.CircleGeometry(25, 32); const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 }); const sunMesh = new THREE.Mesh(sunGeom, sunMat); scene.add(sunMesh); sunMeshRef.current = sunMesh;
    const moonGeom = new THREE.CircleGeometry(20, 32); const moonMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }); const moonMesh = new THREE.Mesh(moonGeom, moonMat); scene.add(moonMesh); moonMeshRef.current = moonMesh;
    createCloudSystem(scene);
    const texLoader = new THREE.TextureLoader(); const grassTex = texLoader.load(TEXTURES.grass); grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(150, 150);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2); sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048); sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -300; sunLight.shadow.camera.right = sunLight.shadow.camera.top = 300; sunLight.shadow.bias = -0.001; scene.add(sunLight); sunLightRef.current = sunLight;
    const moonLight = new THREE.DirectionalLight(0x5555ff, 0.5); scene.add(moonLight); moonLightRef.current = moonLight;
    scene.add(new THREE.HemisphereLight(0xeeeeff, 0x444444, 0.4));
    const torchLight = new THREE.PointLight(0xffeebb, 0, 15); torchLight.castShadow = true; camera.add(torchLight); torchLightRef.current = torchLight;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.8 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const lakeGeom = new THREE.CircleGeometry(55, 64); const lakeMat = new THREE.MeshStandardMaterial({ color: 0x004488, transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.4 }); const lake = new THREE.Mesh(lakeGeom, lakeMat); lake.rotation.x = -Math.PI / 2; lake.position.set(220, 0.05, 180); scene.add(lake); waterRef.current.push(lake);
    const sky = new Sky(); sky.scale.setScalar(4000); scene.add(sky); skyRef.current = sky;
    sky.material.uniforms['turbidity'].value = 10; sky.material.uniforms['rayleigh'].value = 3; sky.material.uniforms['mieCoefficient'].value = 0.005; sky.material.uniforms['mieDirectionalG'].value = 0.7;

    for(let i=0; i<500; i++) { 
      const u = Math.random(); const v = Math.random(); const r = Math.sqrt(-2 * Math.log(u)) * 40; const theta = 2 * Math.PI * v; const x = 160 + r * Math.cos(theta); const z = 120 + r * Math.sin(theta);
      if (x < 0 || x > 1000 || z < 0 || z > 1000 || Math.sqrt(Math.pow(x-220,2) + Math.pow(z-180,2)) < 60) continue;
      createObject(['tree', 'tree', 'appleTree', 'rock', 'bush', 'tree'][Math.floor(Math.random() * 6)], x, z, scene);
    }
    for(let i=0; i<40; i++) createAnimalModel('rabbit');

    const controls = new PointerLockControls(camera, renderer.domElement); controlsRef.current = controls;
    controls.addEventListener('lock', () => propsRef.current.onLockChange(true)); controls.addEventListener('unlock', () => propsRef.current.onLockChange(false));
    const onMouseDown = (e: MouseEvent) => {
      if (!controls.isLocked && !propsRef.current.isMobile) { controls.lock(); } 
      else if (e.button === 0) {
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
        const interactables = [...objectsRef.current, ...animalsRef.current, ...Array.from(campfireMeshes.current.values()), ...Array.from(shelterMeshes.current.values()), ...persistentArrowsRef.current];
        const hits = ray.intersectObjects(interactables, true);
        if (hits.length > 0 && hits[0].distance < 6.0) { performInteraction(); } else if (propsRef.current.activeBow) { shootArrow(); }
      } else if (e.button === 2) { currentFov.current = 35; }
    };
    const onMouseUp = (e: MouseEvent) => { if (e.button === 2) currentFov.current = 75; };
    renderer.domElement.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp);

    const animate = () => {
      requestAnimationFrame(animate); const delta = 0.016; const now = Date.now(); if (!cameraRef.current) return; const cam = cameraRef.current;
      cam.fov = THREE.MathUtils.lerp(cam.fov, currentFov.current, 0.1); cam.updateProjectionMatrix();
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), cam);
      const interactables = [...objectsRef.current, ...animalsRef.current, ...Array.from(campfireMeshes.current.values()), ...Array.from(shelterMeshes.current.values()), ...waterRef.current, ...persistentArrowsRef.current];
      const hits = ray.intersectObjects(interactables, true);
      if (hits.length > 0 && hits[0].distance < 6.0) { let obj = hits[0].object; while(obj.parent && !obj.userData.type && obj.type !== 'Scene') obj = obj.parent; propsRef.current.onInteract({ type: obj.userData.type || 'none', id: obj.userData.id }); } else { propsRef.current.onInteract({ type: 'none' }); }
      if (cloudsRef.current) { cloudsRef.current.children.forEach((cloud: any) => { cloud.position.x += cloud.userData.speed; if (cloud.position.x > 1500) cloud.position.x = -1500; }); }
      persistentArrowsRef.current.forEach((arrow, index) => { if (arrow.position.distanceTo(cam.position) < 3.5) { propsRef.current.onCollect('Arrow'); scene.remove(arrow); persistentArrowsRef.current.splice(index, 1); } });
      internalTime.current = THREE.MathUtils.lerp(internalTime.current, propsRef.current.time, 0.05); const sunAngle = (internalTime.current / 2400) * Math.PI * 2 - Math.PI / 2; const sunPos = new THREE.Vector3(Math.cos(sunAngle), Math.sin(sunAngle), -0.5).normalize();
      const isNight = sunPos.y < 0; const isDay = sunPos.y > 0;
      if (skyRef.current) { skyRef.current.material.uniforms['sunPosition'].value.copy(sunPos); const dayFactor = Math.max(0, sunPos.y); skyRef.current.material.uniforms['rayleigh'].value = 1 + (1 - dayFactor) * 4; skyRef.current.material.uniforms['turbidity'].value = 2 + (1 - dayFactor) * 8; }
      if (sunMeshRef.current) { sunMeshRef.current.position.copy(sunPos.clone().multiplyScalar(1500)); sunMeshRef.current.lookAt(cam.position); sunMeshRef.current.material.opacity = isDay ? 1 : 0; }
      if (moonMeshRef.current) { const moonPos = sunPos.clone().multiplyScalar(-1500); moonMeshRef.current.position.copy(moonPos); moonMeshRef.current.lookAt(cam.position); moonMeshRef.current.material.opacity = isNight ? 1 : 0; }
      if (sunLightRef.current) { sunLightRef.current.position.copy(sunPos).multiplyScalar(100); sunLightRef.current.intensity = Math.max(0, sunPos.y * 1.8); if (isDay) { const colorFactor = Math.max(0, Math.min(1, sunPos.y * 3)); sunLightRef.current.color.setHSL(0.1, 0.8, 0.5 + colorFactor * 0.5); } }
      if (moonLightRef.current) { moonLightRef.current.position.copy(sunPos).multiplyScalar(-100); moonLightRef.current.intensity = Math.max(0, -sunPos.y * 0.6); }
      if (starsRef.current) { starsRef.current.material.opacity = THREE.MathUtils.lerp(starsRef.current.material.opacity, isNight ? 1 : 0, 0.02); }
      if (torchLightRef.current) torchLightRef.current.intensity = propsRef.current.activeTorch ? 5.0 : 0;
      scene.fog.color.lerp(new THREE.Color(isNight ? 0x000000 : 0x88ccff), 0.05); renderer.setClearColor(scene.fog.color);
      arrowsRef.current.forEach((arrow, index) => { if (!arrow.active) return; const oldPos = arrow.mesh.position.clone(); arrow.mesh.position.add(arrow.velocity.clone().multiplyScalar(delta)); arrow.velocity.y -= 9.8 * 1.4 * delta; arrow.mesh.lookAt(arrow.mesh.position.clone().add(arrow.velocity)); const arrowRay = new THREE.Raycaster(oldPos, arrow.velocity.clone().normalize(), 0, arrow.velocity.length() * delta + 0.2); const arrowHits = arrowRay.intersectObjects([...objectsRef.current, ground], true); if (arrowHits.length > 0) { const hit = arrowHits[0]; arrow.mesh.position.copy(hit.point); arrow.active = false; persistentArrowsRef.current.push(arrow.mesh); arrowsRef.current.splice(index, 1); return; } const arrowBox = new THREE.Box3().setFromObject(arrow.mesh); for(let animal of animalsRef.current) { const animalBox = new THREE.Box3().setFromObject(animal); if (arrowBox.intersectsBox(animalBox)) { propsRef.current.onCollect('Meat'); sceneRef.current?.remove(animal); animalsRef.current = animalsRef.current.filter(a => a !== animal); arrow.active = false; sceneRef.current?.remove(arrow.mesh); arrowsRef.current.splice(index, 1); return; } } });
      objectsRef.current.forEach(obj => { if (obj.userData.hitIntensity > 0) { const shake = Math.sin(now * 0.05) * obj.userData.hitIntensity * 0.15; obj.scale.setScalar(obj.userData.baseScale * (1 + shake)); obj.userData.hitIntensity -= delta * 2.5; } else if (obj.userData.isFoliage) { obj.rotation.z = Math.sin(now * obj.userData.swaySpeed + obj.userData.swayOffset) * 0.04; } });
      animalsRef.current.forEach(animal => { const dist = animal.position.distanceTo(cam.position); if (dist < 12) { const fleeDir = new THREE.Vector3().subVectors(animal.position, cam.position); fleeDir.y = 0; fleeDir.normalize(); animal.position.add(fleeDir.multiplyScalar(0.25)); animal.lookAt(animal.position.clone().add(fleeDir)); animal.position.y = 0; } });
      if (propsRef.current.isMobile) { const mInput = propsRef.current.mobileInput; if (mInput.lookX !== 0 || mInput.lookY !== 0) { lookRotation.current.yaw -= mInput.lookX * 0.003; lookRotation.current.pitch -= mInput.lookY * 0.003; lookRotation.current.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, lookRotation.current.pitch)); cam.rotation.set(lookRotation.current.pitch, lookRotation.current.yaw, 0, 'YXZ'); mInput.lookX = mInput.lookY = 0; } if (mInput.moveX !== 0 || mInput.moveY !== 0) { const moveSpeed = mInput.sprint ? 16 : 9; const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); forward.y = 0; forward.normalize(); const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion); right.y = 0; right.normalize(); cam.position.add(forward.multiplyScalar(mInput.moveY * moveSpeed * delta)); cam.position.add(right.multiplyScalar(mInput.moveX * moveSpeed * delta)); } velocityY.current -= GRAVITY * delta; cam.position.y += velocityY.current * delta; if (cam.position.y < 1.8) { cam.position.y = 1.8; velocityY.current = 0; } if (mInput.interact) { performInteraction(); mInput.interact = false; } } 
      else if (controls.isLocked) { const moveSpeed = keysRef.current['shiftleft'] ? 16 : 9; velocityY.current -= GRAVITY * delta; cam.position.y += velocityY.current * delta; if (cam.position.y < 1.8) { cam.position.y = 1.8; velocityY.current = 0; canJump.current = true; } if (keysRef.current['space'] && canJump.current) { velocityY.current = JUMP_FORCE; canJump.current = false; } if (keysRef.current['keyw']) controls.moveForward(moveSpeed * delta); if (keysRef.current['keys']) controls.moveForward(-moveSpeed * delta); if (keysRef.current['keya']) controls.moveRight(-moveSpeed * delta); if (keysRef.current['keyd']) controls.moveRight(moveSpeed * delta); }
      const dir = new THREE.Vector3(); cam.getWorldDirection(dir); propsRef.current.onPositionUpdate({ x: cam.position.x, y: cam.position.y, z: cam.position.z, dirX: dir.x, dirZ: dir.z, rot: Math.atan2(dir.x, dir.z) }); renderer.render(scene, camera);
    }; animate();
    const kd = (e: KeyboardEvent) => { keysRef.current[e.code.toLowerCase()] = true; }; const ku = (e: KeyboardEvent) => { keysRef.current[e.code.toLowerCase()] = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { renderer.dispose(); if (mountRef.current) mountRef.current.removeChild(renderer.domElement); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); renderer.domElement.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp); controls.dispose(); };
  }, []);
  return <div ref={mountRef} className="w-full h-full cursor-crosshair outline-none" />;
});
export default GameScene;
