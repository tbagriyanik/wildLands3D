
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { Sky } from 'three/examples/jsm/objects/Sky';
import { InteractionTarget, CampfireData, ShelterData, MobileInput } from '../types';
import { TEXTURES, SFX_URLS } from '../constants';

interface GameSceneProps {
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
  const arrowsRef = useRef<Array<{ mesh: THREE.Group, velocity: THREE.Vector3, active: boolean }>>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const skyRef = useRef<Sky | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const moonLightRef = useRef<THREE.DirectionalLight | null>(null);
  const torchLightRef = useRef<THREE.PointLight | null>(null);
  
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
    
    // Su kontrolü
    const waterHits = ray.intersectObjects(waterRef.current, true);
    if (waterHits.length > 0 && waterHits[0].distance < 6) {
       propsRef.current.onCollect('Water');
       return;
    }

    // Ok toplama kontrolü
    const arrowHits = ray.intersectObjects(persistentArrowsRef.current, true);
    if (arrowHits.length > 0 && arrowHits[0].distance < 5.0) {
       let arrowObj = arrowHits[0].object;
       while(arrowObj.parent && arrowObj.userData.type !== 'arrow') arrowObj = arrowObj.parent;
       if (arrowObj.userData.type === 'arrow') {
          propsRef.current.onCollect('Arrow');
          sceneRef.current.remove(arrowObj);
          persistentArrowsRef.current = persistentArrowsRef.current.filter(a => a !== arrowObj);
          return;
       }
    }

    const interactables = [...objectsRef.current, ...animalsRef.current, ...Array.from(campfireMeshes.current.values()), ...Array.from(shelterMeshes.current.values())];
    const hits = ray.intersectObjects(interactables, true);
    if (hits.length > 0 && hits[0].distance < 5.5) {
      let obj = hits[0].object; 
      while(obj.parent && !obj.userData.type && obj.type !== 'Scene') obj = obj.parent;
      if (obj.userData.type === 'shelter') { propsRef.current.onCollect('Sleep'); return; }
      if (obj.userData.type === 'rabbit' || obj.userData.type === 'partridge') {
        propsRef.current.onCollect('Meat'); sceneRef.current.remove(obj);
        animalsRef.current = animalsRef.current.filter(a => a !== obj);
        return;
      }
      if (obj.userData.type && obj.userData.type !== 'campfire') {
        obj.userData.hitIntensity = 1.0;
        let type = 'Wood';
        if (obj.userData.type === 'bush') type = 'Berries';
        else if (obj.userData.type === 'rock') type = 'Stone';
        else if (obj.userData.type === 'appleTree') type = 'Apple';
        else if (obj.userData.type === 'pearTree') type = 'Pear';
        propsRef.current.onCollect(type); obj.userData.hp -= 1;
        if (obj.userData.hp <= 0) { sceneRef.current.remove(obj); objectsRef.current = objectsRef.current.filter(o => o !== obj); }
      }
    } else if (propsRef.current.activeBow) { shootArrow(); }
  };

  useImperativeHandle(ref, () => ({
    requestLock: () => {
      if (propsRef.current.isMobile) return;
      if (controlsRef.current && !controlsRef.current.isLocked) controlsRef.current.lock();
    },
    requestUnlock: () => {
      if (controlsRef.current && controlsRef.current.isLocked) controlsRef.current.unlock();
    },
    interact: () => performInteraction()
  }));

  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const campfireIds = new Set(props.campfires.map(f => f.id));
    campfireMeshes.current.forEach((mesh, id) => {
      if (!campfireIds.has(id)) { scene.remove(mesh); campfireMeshes.current.delete(id); }
    });
    props.campfires.forEach(cf => {
      if (!campfireMeshes.current.has(cf.id)) {
        const mesh = createCampfireModel(cf.id, cf.x, cf.z);
        scene.add(mesh); campfireMeshes.current.set(cf.id, mesh);
      }
    });
    const shelterIds = new Set(props.shelters.map(s => s.id));
    shelterMeshes.current.forEach((mesh, id) => {
      if (!shelterIds.has(id)) { scene.remove(mesh); shelterMeshes.current.delete(id); }
    });
    props.shelters.forEach(sh => {
      if (!shelterMeshes.current.has(sh.id)) {
        const mesh = createShelterModel(sh.id, sh.x, sh.z, sh.rotation);
        scene.add(mesh); shelterMeshes.current.set(sh.id, mesh);
      }
    });
  }, [props.campfires, props.shelters]);

  const shootArrow = () => {
    const { activeBow, hasArrows, onShoot } = propsRef.current;
    if (!activeBow || !hasArrows || !cameraRef.current || !sceneRef.current) return;
    onShoot();
    const arrowGroup = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9), new THREE.MeshStandardMaterial({ color: 0x4a2c1d }));
    shaft.rotation.x = Math.PI / 2; arrowGroup.add(shaft);
    
    // Ok Ucu (Arrow Head)
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), new THREE.MeshStandardMaterial({ color: 0x555555 }));
    head.rotation.x = -Math.PI / 2; head.position.z = 0.5; arrowGroup.add(head);

    const dir = new THREE.Vector3(); cameraRef.current.getWorldDirection(dir);
    arrowGroup.position.copy(cameraRef.current.position).add(dir.clone().multiplyScalar(0.7));
    arrowGroup.lookAt(arrowGroup.position.clone().add(dir));
    arrowGroup.userData = { type: 'arrow' };
    sceneRef.current.add(arrowGroup);
    arrowsRef.current.push({ mesh: arrowGroup, velocity: dir.clone().multiplyScalar(85), active: true });
  };

  const createCampfireModel = (id: string, x: number, z: number) => {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    for (let i = 0; i < 6; i++) {
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), stoneMat);
      const angle = (i / 6) * Math.PI * 2; stone.position.set(Math.cos(angle) * 0.45, 0.05, Math.sin(angle) * 0.45);
      group.add(stone);
    }
    const logMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7), logMat);
      log.rotation.z = Math.PI / 2; log.rotation.y = (i / 3) * Math.PI * 2;
      group.add(log);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 8), new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.8 }));
    flame.position.y = 0.3; group.add(flame);
    const light = new THREE.PointLight(0xffaa33, 2.5, 10); light.position.y = 0.6; group.add(light);
    group.userData = { id, type: 'campfire' };
    return group;
  };

  const createShelterModel = (id: string, x: number, z: number, rotation: number) => {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = rotation;
    const tentMat = new THREE.MeshStandardMaterial({ color: 0x4a5d23, side: THREE.DoubleSide });
    const tentGeom = new THREE.CylinderGeometry(0.01, 2.5, 3.5, 4, 1, true);
    const tent = new THREE.Mesh(tentGeom, tentMat);
    tent.rotation.y = Math.PI / 4; tent.position.y = 1.75; group.add(tent);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x2d1b0d });
    const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.8), woodMat);
    pole1.position.set(0, 1.9, 1.2); pole1.rotation.z = Math.PI/10; group.add(pole1);
    const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.8), woodMat);
    pole2.position.set(0, 1.9, 1.2); pole2.rotation.z = -Math.PI/10; group.add(pole2);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 2.2), new THREE.MeshStandardMaterial({ color: 0x3d3d3d }));
    bed.position.set(0, 0.1, -0.5); group.add(bed);
    const extFire = createCampfireModel('sh_fire_' + id, 0, 2.8);
    group.add(extFire);
    group.userData = { id, type: 'shelter' };
    return group;
  };

  const createAnimalModel = (type: string) => {
    const group = new THREE.Group();
    const x = 100 + Math.random() * 200;
    const z = 100 + Math.random() * 200;
    group.position.set(x, 0, z);

    if (type === 'rabbit') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
      body.position.y = 0.175; group.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
      head.position.set(0, 0.4, 0.2); group.add(head);
      const ear1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.1), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
      ear1.position.set(-0.08, 0.65, 0.15); group.add(ear1);
      const ear2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.1), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
      ear2.position.set(0.08, 0.65, 0.15); group.add(ear2);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x884422 }));
      body.position.y = 0.3; group.add(body);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), new THREE.MeshStandardMaterial({ color: 0x884422 }));
      neck.position.set(0, 0.55, 0.2); group.add(neck);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x884422 }));
      head.position.set(0, 0.65, 0.3); group.add(head);
      const beak = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), new THREE.MeshStandardMaterial({ color: 0xffcc00 }));
      beak.position.set(0, 0.63, 0.45); group.add(beak);
    }

    group.userData = { type, nextMove: 0, velocity: new THREE.Vector3() };
    sceneRef.current?.add(group);
    animalsRef.current.push(group);
    return group;
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(propsRef.current.initialPosition?.x || 160, 1.8, propsRef.current.initialPosition?.z || 120);
    cameraRef.current = camera;
    scene.fog = new THREE.FogExp2(0xcccccc, 0.0035);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0xcccccc);
    mountRef.current.appendChild(renderer.domElement);
    const texLoader = new THREE.TextureLoader();
    const grassTex = texLoader.load(TEXTURES.grass); grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(100, 100);
    const woodTex = texLoader.load(TEXTURES.wood); woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
    const stoneTex = texLoader.load(TEXTURES.stone); stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -150;
    sunLight.shadow.camera.right = sunLight.shadow.camera.top = 150;
    scene.add(sunLight); sunLightRef.current = sunLight;
    const moonLight = new THREE.DirectionalLight(0x4444ff, 0.3);
    scene.add(moonLight); moonLightRef.current = moonLight;
    scene.add(new THREE.HemisphereLight(0xeeeeff, 0x444444, 0.5));
    const torchLight = new THREE.PointLight(0xffeebb, 0, 35);
    torchLight.castShadow = true; camera.add(torchLight); torchLightRef.current = torchLight;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ map: grassTex }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const lakeGeom = new THREE.CircleGeometry(45, 32);
    const lakeMat = new THREE.MeshStandardMaterial({ color: 0x004488, transparent: true, opacity: 0.7, roughness: 0.1, metalness: 0.2 });
    const lake = new THREE.Mesh(lakeGeom, lakeMat);
    lake.rotation.x = -Math.PI / 2; lake.position.set(220, 0.05, 180); scene.add(lake);
    waterRef.current.push(lake);
    const sky = new Sky(); sky.scale.setScalar(2000); scene.add(sky); skyRef.current = sky;

    const createObject = (type: string, x: number, z: number) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const baseScale = 0.8 + Math.random() * 1.0;
      if (type.includes('Tree')) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 6), new THREE.MeshStandardMaterial({ map: woodTex })); trunk.position.y = 3; g.add(trunk);
        const leaves = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), new THREE.MeshStandardMaterial({ color: type === 'tree' ? 0x1a4a14 : 0x2a5a14 })); leaves.position.y = 6; g.add(leaves);
      } else if (type === 'rock') {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), new THREE.MeshStandardMaterial({ map: stoneTex })); rock.position.y = 0.3; rock.rotation.set(Math.random(), Math.random(), Math.random()); g.add(rock);
      } else {
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 8), new THREE.MeshStandardMaterial({ color: 0x225511 })); bush.position.y = 0.45; g.add(bush);
      }
      g.scale.setScalar(baseScale);
      g.userData = { type, hp: 5, baseScale, hitIntensity: 0, swayOffset: Math.random() * Math.PI * 2, swaySpeed: 0.001 + Math.random() * 0.001, isFoliage: type !== 'rock' };
      scene.add(g); objectsRef.current.push(g);
    };

    for(let i=0; i<180; i++) {
      const x = 50 + Math.random() * 300; const z = 50 + Math.random() * 300;
      if (Math.sqrt(Math.pow(x-220,2) + Math.pow(z-180,2)) < 50) continue;
      const types = ['tree', 'appleTree', 'rock', 'bush']; createObject(types[Math.floor(Math.random() * types.length)], x, z);
    }

    for(let i=0; i<15; i++) createAnimalModel('rabbit');
    for(let i=0; i<10; i++) createAnimalModel('partridge');

    const controls = new PointerLockControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.addEventListener('lock', () => propsRef.current.onLockChange(true));
    controls.addEventListener('unlock', () => propsRef.current.onLockChange(false));

    const onMouseDown = (e: MouseEvent) => {
      if (!controls.isLocked && !propsRef.current.isMobile) controls.lock();
      else if (e.button === 0) performInteraction();
      else if (e.button === 2) currentFov.current = 35;
    };
    const onMouseUp = (e: MouseEvent) => { if (e.button === 2) currentFov.current = 75; };
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    const animate = () => {
      requestAnimationFrame(animate); 
      const delta = 0.016;
      const now = Date.now();
      if (!cameraRef.current) return;
      const cam = cameraRef.current;
      cam.fov = THREE.MathUtils.lerp(cam.fov, currentFov.current, 0.1);
      cam.updateProjectionMatrix();
      internalTime.current = THREE.MathUtils.lerp(internalTime.current, propsRef.current.time, 0.05);
      const sunAngle = (internalTime.current / 2400) * Math.PI * 2 - Math.PI / 2;
      const sunPos = new THREE.Vector3(Math.cos(sunAngle), Math.sin(sunAngle), -0.5).normalize();
      if (skyRef.current) skyRef.current.material.uniforms['sunPosition'].value.copy(sunPos);
      if (sunLightRef.current) { sunLightRef.current.position.copy(sunPos).multiplyScalar(100); sunLightRef.current.intensity = Math.max(0, sunPos.y * 1.5); }
      if (moonLightRef.current) { moonLightRef.current.position.copy(sunPos).multiplyScalar(-100); moonLightRef.current.intensity = Math.max(0, -sunPos.y * 0.5); }
      if (torchLightRef.current) torchLightRef.current.intensity = propsRef.current.activeTorch ? 2.5 : 0;
      const isNight = sunPos.y < 0;
      scene.fog.color.lerp(new THREE.Color(isNight ? 0x020617 : 0xcccccc), 0.05);
      renderer.setClearColor(scene.fog.color);

      // Ok Fiziği Güncelleme
      arrowsRef.current.forEach((arrow, index) => {
        if (!arrow.active) return;
        arrow.mesh.position.add(arrow.velocity.clone().multiplyScalar(delta));
        arrow.velocity.y -= 9.8 * 2 * delta; 
        arrow.mesh.lookAt(arrow.mesh.position.clone().add(arrow.velocity));

        const arrowBox = new THREE.Box3().setFromObject(arrow.mesh);
        for(let animal of animalsRef.current) {
          const animalBox = new THREE.Box3().setFromObject(animal);
          if (arrowBox.intersectsBox(animalBox)) {
            propsRef.current.onCollect('Meat');
            sceneRef.current?.remove(animal);
            animalsRef.current = animalsRef.current.filter(a => a !== animal);
            arrow.active = false;
            sceneRef.current?.remove(arrow.mesh);
            arrowsRef.current.splice(index, 1);
            return;
          }
        }

        if (arrow.mesh.position.y <= 0.05) {
          arrow.mesh.position.y = 0.05;
          arrow.active = false;
          persistentArrowsRef.current.push(arrow.mesh);
        }
      });

      objectsRef.current.forEach(obj => {
        if (obj.userData.hitIntensity > 0) {
          const shake = Math.sin(now * 0.05) * obj.userData.hitIntensity * 0.15;
          obj.scale.setScalar(obj.userData.baseScale * (1 + shake));
          obj.userData.hitIntensity -= delta * 2.5;
        } else if (obj.userData.isFoliage) { obj.rotation.z = Math.sin(now * obj.userData.swaySpeed + obj.userData.swayOffset) * 0.03; }
      });

      animalsRef.current.forEach(animal => {
        const dist = animal.position.distanceTo(cam.position);
        if (dist < 10) {
          const fleeDir = new THREE.Vector3().subVectors(animal.position, cam.position).normalize();
          animal.position.add(fleeDir.multiplyScalar(0.2));
          animal.lookAt(animal.position.clone().add(fleeDir));
        }
      });

      if (propsRef.current.isMobile) {
        const mInput = propsRef.current.mobileInput;
        if (mInput.lookX !== 0 || mInput.lookY !== 0) {
          lookRotation.current.yaw -= mInput.lookX * 0.003;
          lookRotation.current.pitch -= mInput.lookY * 0.003;
          lookRotation.current.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, lookRotation.current.pitch));
          cam.rotation.set(lookRotation.current.pitch, lookRotation.current.yaw, 0, 'YXZ');
          mInput.lookX = mInput.lookY = 0;
        }
        if (mInput.moveX !== 0 || mInput.moveY !== 0) {
          const moveSpeed = mInput.sprint ? 15 : 8.5;
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); forward.y = 0; forward.normalize();
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion); right.y = 0; right.normalize();
          cam.position.add(forward.multiplyScalar(mInput.moveY * moveSpeed * delta));
          cam.position.add(right.multiplyScalar(mInput.moveX * moveSpeed * delta));
        }
        velocityY.current -= GRAVITY * delta; cam.position.y += velocityY.current * delta;
        if (cam.position.y < 1.8) { cam.position.y = 1.8; velocityY.current = 0; }
        if (mInput.interact) { performInteraction(); mInput.interact = false; }
      } else if (controls.isLocked) {
        const moveSpeed = keysRef.current['shiftleft'] ? 15 : 8.5;
        velocityY.current -= GRAVITY * delta; cam.position.y += velocityY.current * delta;
        if (cam.position.y < 1.8) { cam.position.y = 1.8; velocityY.current = 0; canJump.current = true; }
        if (keysRef.current['space'] && canJump.current) { velocityY.current = JUMP_FORCE; canJump.current = false; }
        if (keysRef.current['keyw']) controls.moveForward(moveSpeed * delta);
        if (keysRef.current['keys']) controls.moveForward(-moveSpeed * delta);
        if (keysRef.current['keya']) controls.moveRight(-moveSpeed * delta);
        if (keysRef.current['keyd']) controls.moveRight(moveSpeed * delta);
      }

      const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
      propsRef.current.onPositionUpdate({ x: cam.position.x, y: cam.position.y, z: cam.position.z, dirX: dir.x, dirZ: dir.z, rot: Math.atan2(dir.x, dir.z) });
      renderer.render(scene, camera);
    };
    animate();

    const kd = (e: KeyboardEvent) => { keysRef.current[e.code.toLowerCase()] = true; };
    const ku = (e: KeyboardEvent) => { keysRef.current[e.code.toLowerCase()] = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    
    return () => { 
      renderer.dispose(); 
      if (mountRef.current) mountRef.current.removeChild(renderer.domElement); 
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      controls.dispose();
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full cursor-crosshair outline-none" />;
});
export default GameScene;
