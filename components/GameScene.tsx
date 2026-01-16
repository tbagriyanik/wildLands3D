
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
  onClean: () => void;
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
  const arrowsRef = useRef<Array<{ mesh: THREE.Group, velocity: THREE.Vector3, active: boolean }>>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const skyRef = useRef<Sky | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  
  const propsRef = useRef(props);
  useEffect(() => { propsRef.current = props; }, [props]);

  const velocityY = useRef(0);
  const canJump = useRef(true);
  const targetFov = useRef(75);
  const currentFov = useRef(75);
  const GRAVITY = 30.0;
  const JUMP_FORCE = 12.0;

  const campfireMeshes = useRef<Map<string, THREE.Group>>(new Map());

  useImperativeHandle(ref, () => ({
    requestLock: () => controlsRef.current?.lock(),
    requestUnlock: () => controlsRef.current?.unlock()
  }));

  const performInteraction = () => {
    if (!cameraRef.current || !sceneRef.current) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), cameraRef.current);
    
    // Su kontrolü
    const waterHits = ray.intersectObjects(waterRef.current, true);
    if (waterHits.length > 0 && waterHits[0].distance < 4.5) {
      propsRef.current.onCollect('Water');
      return;
    }

    // Nesne ve Ateş kontrolü
    const hits = ray.intersectObjects([...objectsRef.current, ...Array.from(campfireMeshes.current.values())], true);
    if (hits.length > 0 && hits[0].distance < 4.5) {
      let obj = hits[0].object; 
      while(obj.parent && !obj.userData.type && obj.type !== 'Scene') obj = obj.parent;
      
      if (obj.userData.type && obj.userData.type !== 'campfire') {
        // Impact Shake Animation
        const originalScale = obj.scale.x;
        obj.scale.setScalar(originalScale * 1.15);
        setTimeout(() => obj.scale.setScalar(originalScale), 80);

        obj.userData.hp -= 1;
        const type = obj.userData.type === 'tree' ? 'Wood' : obj.userData.type === 'bush' ? 'Berries' : 'Stone';
        propsRef.current.onCollect(type);
        if (obj.userData.hp <= 0) {
          sceneRef.current.remove(obj);
          objectsRef.current = objectsRef.current.filter(o => o !== obj);
        }
      }
    } else if (propsRef.current.activeBow) {
      shootArrow();
    }
  };

  const shootArrow = () => {
    const { activeBow, hasArrows, onShoot } = propsRef.current;
    if (!activeBow || !hasArrows || !cameraRef.current || !sceneRef.current) return;
    onShoot();
    const arrowGroup = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9), new THREE.MeshStandardMaterial({ color: 0x4a2c1d }));
    shaft.rotation.x = Math.PI / 2; arrowGroup.add(shaft);
    const dir = new THREE.Vector3(); cameraRef.current.getWorldDirection(dir);
    arrowGroup.position.copy(cameraRef.current.position).add(dir.clone().multiplyScalar(0.7));
    arrowGroup.lookAt(arrowGroup.position.clone().add(dir));
    sceneRef.current.add(arrowGroup);
    arrowsRef.current.push({ mesh: arrowGroup, velocity: dir.clone().multiplyScalar(85), active: true });
  };

  const createCampfireModel = (id: string, x: number, z: number) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    for (let i = 0; i < 6; i++) {
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), stoneMat);
      const angle = (i / 6) * Math.PI * 2;
      stone.position.set(Math.cos(angle) * 0.45, 0.05, Math.sin(angle) * 0.45);
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
    const light = new THREE.PointLight(0xffaa33, 2.5, 10);
    light.position.y = 0.6; group.add(light);
    group.userData = { id, type: 'campfire', collisionRadius: 0.75 };
    return group;
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(propsRef.current.initialPosition?.x || 160, 1.8, propsRef.current.initialPosition?.z || 120);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    const texLoader = new THREE.TextureLoader();
    const grassTex = texLoader.load(TEXTURES.grass); grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(100, 100);
    const woodTex = texLoader.load(TEXTURES.wood); woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
    const stoneTex = texLoader.load(TEXTURES.stone); stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048);
    scene.add(sunLight); sunLightRef.current = sunLight;
    scene.add(new THREE.HemisphereLight(0xeeeeff, 0x444444, 0.5));

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ map: grassTex }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    const sky = new Sky(); sky.scale.setScalar(2000); scene.add(sky); skyRef.current = sky;

    const lakesData = [{ x: 100, z: 100, r: 20 }, { x: 220, z: 180, r: 15 }];
    lakesData.forEach(l => {
      const lake = new THREE.Mesh(new THREE.CircleGeometry(l.r, 32), new THREE.MeshStandardMaterial({ color: 0x0088ff, transparent: true, opacity: 0.7, roughness: 0.1 }));
      lake.rotation.x = -Math.PI / 2; lake.position.set(l.x, 0.05, l.z); lake.userData = { type: 'water', r: l.r };
      scene.add(lake); waterRef.current.push(lake);
    });

    const isInWater = (x: number, z: number) => lakesData.some(l => Math.sqrt(Math.pow(x-l.x,2) + Math.pow(z-l.z,2)) < l.r + 2);

    const createObject = (type: string, x: number, z: number) => {
      if (isInWater(x, z)) return;
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const baseScale = 0.8 + Math.random() * 1.0;
      if (type === 'tree') {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 6), new THREE.MeshStandardMaterial({ map: woodTex }));
        trunk.position.y = 3; g.add(trunk);
        const leaves = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), new THREE.MeshStandardMaterial({ color: 0x1a4a14 }));
        leaves.position.y = 6; g.add(leaves);
      } else if (type === 'rock') {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), new THREE.MeshStandardMaterial({ map: stoneTex }));
        rock.position.y = 0.3; rock.rotation.set(Math.random(), Math.random(), Math.random()); g.add(rock);
      } else {
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 8), new THREE.MeshStandardMaterial({ color: 0x225511 }));
        bush.position.y = 0.45; g.add(bush);
      }
      g.scale.setScalar(baseScale);
      g.userData = { type, hp: 5, collisionRadius: type === 'tree' ? 0.8 : 0.5 };
      scene.add(g); objectsRef.current.push(g);
    };

    for(let i=0; i<100; i++) { 
      createObject('tree', 50 + Math.random() * 200, 50 + Math.random() * 200); 
      createObject('rock', 50 + Math.random() * 200, 50 + Math.random() * 200); 
    }

    const createAnimal = (type: string, x: number, z: number) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(type === 'deer' ? 0.6 : 0.3, 8, 8), 
        new THREE.MeshStandardMaterial({ color: type === 'deer' ? 0x8b4513 : 0xefefef })
      );
      body.position.y = type === 'deer' ? 0.6 : 0.3; g.add(body);
      
      g.userData = { 
        type, 
        isAnimal: true, 
        state: 'idle', 
        timer: Math.random() * 3, 
        targetPos: new THREE.Vector3(x, 0, z),
        baseSpeed: type === 'deer' ? 2.5 : 1.8,
        runSpeed: type === 'deer' ? 7.5 : 5.5,
        alertDist: type === 'deer' ? 18 : 10,
        fleeDist: type === 'deer' ? 10 : 6
      };
      scene.add(g); animalsRef.current.push(g);
    };
    for(let i=0; i<15; i++) { 
      createAnimal('rabbit', 40+Math.random()*220, 40+Math.random()*220); 
      createAnimal('deer', 40+Math.random()*220, 40+Math.random()*220); 
    }

    const controls = new PointerLockControls(camera, renderer.domElement);
    controlsRef.current = controls;

    renderer.domElement.addEventListener('mousedown', (e) => {
      if (!controls.isLocked) controls.lock();
      else if (e.button === 0) performInteraction();
    });

    const animate = () => {
      requestAnimationFrame(animate); 
      const delta = 0.016;
      if (!cameraRef.current) return;
      const cam = cameraRef.current;

      // Smooth Zoom
      currentFov.current = THREE.MathUtils.lerp(currentFov.current, targetFov.current, 0.1);
      if (Math.abs(currentFov.current - cam.fov) > 0.05) {
        cam.fov = currentFov.current;
        cam.updateProjectionMatrix();
      }

      const gameTime = propsRef.current.time;
      const sunAngle = (gameTime / 2400) * Math.PI * 2 - Math.PI / 2;
      const sunPos = new THREE.Vector3(Math.cos(sunAngle), Math.sin(sunAngle), -0.5).normalize();
      if (skyRef.current) skyRef.current.material.uniforms['sunPosition'].value.copy(sunPos);
      if (sunLightRef.current) { sunLightRef.current.position.copy(sunPos).multiplyScalar(100); sunLightRef.current.intensity = Math.max(0, sunPos.y * 1.5); }

      animalsRef.current.forEach(a => {
        const playerDist = a.position.distanceTo(cam.position);
        a.userData.timer -= delta;

        if (playerDist < a.userData.fleeDist) {
          if (a.userData.state !== 'flee') {
            a.userData.state = 'flee';
            const escapeDir = a.position.clone().sub(cam.position).normalize();
            a.userData.targetPos.copy(a.position).add(escapeDir.multiplyScalar(20));
          }
        } else if (playerDist < a.userData.alertDist) {
          if (a.userData.state !== 'flee') {
            a.userData.state = 'alert';
            a.userData.timer = 0.5;
          }
        }

        if (a.userData.state === 'idle' && a.userData.timer <= 0) {
          a.userData.state = 'walk';
          a.userData.timer = 3 + Math.random() * 5;
          a.userData.targetPos.set(
            THREE.MathUtils.clamp(a.position.x + (Math.random() - 0.5) * 20, 10, 290),
            0,
            THREE.MathUtils.clamp(a.position.z + (Math.random() - 0.5) * 20, 10, 290)
          );
        } else if (a.userData.state === 'walk' && a.position.distanceTo(a.userData.targetPos) < 1) {
          a.userData.state = 'idle';
          a.userData.timer = 2 + Math.random() * 4;
        } else if (a.userData.state === 'flee' && playerDist > a.userData.alertDist * 1.5) {
          a.userData.state = 'idle';
          a.userData.timer = 2;
        }

        if (a.userData.state === 'walk' || a.userData.state === 'flee') {
          const moveSpeed = a.userData.state === 'flee' ? a.userData.runSpeed : a.userData.baseSpeed;
          const dir = a.userData.targetPos.clone().sub(a.position).normalize();
          const targetRot = Math.atan2(dir.x, dir.z);
          a.rotation.y = THREE.MathUtils.lerp(a.rotation.y, targetRot, 0.1);
          a.position.add(dir.multiplyScalar(delta * moveSpeed));
          if (a.userData.type === 'rabbit') {
            a.position.y = Math.abs(Math.sin(Date.now() * 0.01 * moveSpeed)) * 0.3;
          }
        }
      });

      for(let i = arrowsRef.current.length - 1; i >= 0; i--) {
        const arrow = arrowsRef.current[i];
        if (arrow.active) {
          arrow.velocity.y -= GRAVITY * 0.4 * delta;
          arrow.mesh.position.add(arrow.velocity.clone().multiplyScalar(delta));
          arrow.mesh.lookAt(arrow.mesh.position.clone().add(arrow.velocity));
          const ray = new THREE.Raycaster(arrow.mesh.position, arrow.velocity.clone().normalize(), 0, 1.2);
          const hits = ray.intersectObjects([...objectsRef.current, ...animalsRef.current, ground], true);
          if (hits.length > 0) {
             let hitObj = hits[0].object; while(hitObj.parent && !hitObj.userData.isAnimal && hitObj.type !== 'Scene') hitObj = hitObj.parent;
             if (hitObj.userData.isAnimal) {
                scene.remove(hitObj); animalsRef.current = animalsRef.current.filter(a => a !== hitObj);
                propsRef.current.onCollect('Meat'); scene.remove(arrow.mesh); arrowsRef.current.splice(i, 1);
             } else { arrow.active = false; arrow.mesh.position.copy(hits[0].point); }
          }
        } else if (cam.position.distanceTo(arrow.mesh.position) < 2.5) {
          propsRef.current.onInteract({ type: 'arrow' });
          if (keysRef.current['keye']) {
            propsRef.current.onCollect('Arrow'); scene.remove(arrow.mesh); arrowsRef.current.splice(i, 1);
            keysRef.current['keye'] = false;
          }
        }
      }

      const interactRay = new THREE.Raycaster();
      interactRay.setFromCamera(new THREE.Vector2(0, 0), cam);
      const interactHits = interactRay.intersectObjects([...objectsRef.current, ...Array.from(campfireMeshes.current.values()), ...waterRef.current], true);
      if (interactHits.length > 0 && interactHits[0].distance < 4.5) {
        let obj = interactHits[0].object; while(obj.parent && !obj.userData.type) obj = obj.parent;
        propsRef.current.onInteract({ type: obj.userData.type as any || 'none', id: obj.userData.id });
        if (keysRef.current['keye']) { performInteraction(); keysRef.current['keye'] = false; }
      } else {
        propsRef.current.onInteract({ type: 'none' });
      }

      if (controls.isLocked) {
        velocityY.current -= GRAVITY * delta; cam.position.y += velocityY.current * delta;
        if (cam.position.y < 1.8) { cam.position.y = 1.8; velocityY.current = 0; canJump.current = true; }
        if (keysRef.current['space'] && canJump.current) { velocityY.current = JUMP_FORCE; canJump.current = false; }
        const speed = (keysRef.current['shiftleft'] || keysRef.current['shiftright']) ? 15 : 8.5;
        if (keysRef.current['keyw']) controls.moveForward(speed * delta);
        if (keysRef.current['keys']) controls.moveForward(-speed * delta);
        if (keysRef.current['keya']) controls.moveRight(-speed * delta);
        if (keysRef.current['keyd']) controls.moveRight(speed * delta);

        waterRef.current.forEach(l => { if (cam.position.distanceTo(l.position) < l.userData.r) propsRef.current.onClean(); });

        const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
        propsRef.current.onPositionUpdate({ x: cam.position.x, y: cam.position.y, z: cam.position.z, dirX: dir.x, dirZ: dir.z, rot: Math.atan2(dir.x, dir.z) });
      }

      const existingIds = new Set(propsRef.current.campfires.map(f => f.id));
      campfireMeshes.current.forEach((m, id) => { if (!existingIds.has(id)) { scene.remove(m); campfireMeshes.current.delete(id); } });
      propsRef.current.campfires.forEach(cf => {
        let mesh = campfireMeshes.current.get(cf.id);
        if (!mesh) { mesh = createCampfireModel(cf.id, cf.x, cf.z); scene.add(mesh); campfireMeshes.current.set(cf.id, mesh); }
        const flame = mesh.children.find(c => c.type === 'Mesh' && (c as THREE.Mesh).geometry.type === 'ConeGeometry');
        if (flame) { flame.scale.setScalar(0.9 + Math.sin(Date.now() * 0.01) * 0.1); }
      });

      renderer.render(scene, camera);
    };
    animate();

    const handleMouseDown = (e: MouseEvent) => { if (e.button === 2) targetFov.current = 35; };
    const handleMouseUp = (e: MouseEvent) => { if (e.button === 2) targetFov.current = 75; };
    window.addEventListener('mousedown', handleMouseDown); window.addEventListener('mouseup', handleMouseUp);
    const kd = (e: KeyboardEvent) => { keysRef.current[e.code.toLowerCase()] = true; };
    const ku = (e: KeyboardEvent) => { keysRef.current[e.code.toLowerCase()] = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { 
      renderer.dispose(); mountRef.current?.removeChild(renderer.domElement); 
      window.removeEventListener('mousedown', handleMouseDown); window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full cursor-crosshair outline-none" />;
});
export default GameScene;
