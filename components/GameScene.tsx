
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
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

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
  
  // Hand Items
  const bowInHandRef = useRef<THREE.Group | null>(null);
  const torchInHandRef = useRef<THREE.Group | null>(null);
  
  const propsRef = useRef({ onInteract, onCollect, onDrink, onCook, onShoot, onMovementChange, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, weather, sfxEnabled, isMobile, mobileInput });

  const playSFX = (url: string, volume = 0.4, randomizePitch = true) => {
    if (propsRef.current.sfxEnabled) {
      const sfx = new Audio(url);
      sfx.volume = volume;
      if (randomizePitch) sfx.playbackRate = 0.9 + Math.random() * 0.2;
      sfx.play().catch(() => {});
    }
  };

  useEffect(() => {
    propsRef.current = { onInteract, onCollect, onDrink, onCook, onShoot, onMovementChange, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, weather, sfxEnabled, isMobile, mobileInput };
    if (torchLightRef.current) torchLightRef.current.visible = isTorchActive;
    if (bowInHandRef.current) bowInHandRef.current.visible = isBowActive;
    if (torchInHandRef.current) torchInHandRef.current.visible = isTorchActive;
  }, [onInteract, onCollect, onDrink, onCook, onShoot, onMovementChange, onPositionUpdate, onLockChange, isBowActive, isTorchActive, arrowCount, time, weather, isLocked, isMobile, sfxEnabled, mobileInput]);

  useEffect(() => {
    if (!sceneRef.current) return;
    campfireGroupRef.current.clear();
    campfires.forEach(cf => {
      const group = new THREE.Group();
      group.position.set(cf.x, 0, cf.z);
      group.userData = { type: 'campfire', id: cf.id, isObstacle: true, radius: 1.2 };
      
      const logGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.0, 6); 
      const logMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 0.9 });
      for(let i=0; i<5; i++) {
        const log = new THREE.Mesh(logGeo, logMat);
        log.rotation.x = Math.PI/2; 
        log.rotation.z = (i * Math.PI * 2) / 5;
        log.position.y = 0.05;
        log.castShadow = true; 
        group.add(log);
      }

      const fireInner = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      fireInner.position.y = 0.6; group.add(fireInner);
      
      const fireMid = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 8), new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.9 }));
      fireMid.position.y = 0.45; group.add(fireMid);

      const fireOuter = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 8), new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.7 }));
      fireOuter.position.y = 0.35; group.add(fireOuter);
      
      const light = new THREE.PointLight(0xff7700, 30, 15); 
      light.position.y = 1.0; 
      light.castShadow = true; 
      group.add(light);
      
      group.userData.fireMeshes = [fireInner, fireMid, fireOuter];
      campfireGroupRef.current.add(group);
      sceneRef.current?.add(group);
    });
  }, [campfires]);

  const createArrowMesh = () => {
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x6b3e1a }));
    group.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 }));
    tip.position.y = 0.45; group.add(tip);
    const fletchingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    for(let i=0; i<3; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.15), fletchingMat);
      f.position.y = -0.3; f.rotation.y = (i * Math.PI * 2) / 3;
      f.position.x = 0.02 * Math.cos(f.rotation.y);
      f.position.z = 0.02 * Math.sin(f.rotation.y);
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
      
    const velocity = tempCamDir.clone().multiplyScalar(100);
    arrow.lookAt(arrow.position.clone().add(velocity)); 
    arrow.rotateX(Math.PI/2); 
    
    sceneRef.current.add(arrow);
    (window as any).projectiles = (window as any).projectiles || [];
    (window as any).projectiles.push({ mesh: arrow, velocity, isStuck: false, stuckTo: null });
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
        if (t) {
          if(t === 'water') propsRef.current.onDrink();
          else if(t === 'campfire') propsRef.current.onCook();
          else if (t === 'tree' || t === 'appleTree') { propsRef.current.onCollect(t === 'appleTree' ? 'Apple' : 'Wood'); o.visible = false; o.userData.isObstacle = false; }
          else if (t === 'rock' || t === 'bush') { propsRef.current.onCollect(t === 'rock' ? 'Stone' : 'Berries'); o.visible = false; o.userData.isObstacle = false; }
          else if (t === 'rabbit' || t === 'partridge' || t === 'critter') { propsRef.current.onCollect('Raw Meat'); o.visible = false; }
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
    scene.add(campfireGroupRef.current);
    scene.fog = new THREE.FogExp2(0x1a1a1a, 0.002);
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 2000);
    camera.position.set(120, 1.8, 120); cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mountRef.current.appendChild(renderer.domElement);

    // Better Sky Setup
    const sky = new Sky(); sky.scale.setScalar(450000); scene.add(sky); skyRef.current = sky;
    const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.6); sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -500;
    sunLight.shadow.camera.right = sunLight.shadow.camera.top = 500;
    scene.add(sunLight); sunLightRef.current = sunLight;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
    scene.add(ambientLight); ambientLightRef.current = ambientLight;

    const torchLight = new THREE.PointLight(0xff9900, 0, 40); 
    torchLight.castShadow = true;
    scene.add(torchLight); torchLightRef.current = torchLight;

    // Hand Models (First Person View)
    const bowModel = new THREE.Group();
    const bowCurves = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.015, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x4a2e1b }));
    bowCurves.rotation.z = Math.PI / 2;
    bowModel.add(bowCurves);
    const bowString = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    bowModel.add(bowString);
    bowModel.position.set(0.35, -0.4, -0.6);
    bowModel.rotation.set(0.2, -0.2, 0);
    camera.add(bowModel);
    bowInHandRef.current = bowModel;

    const torchModel = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6), new THREE.MeshStandardMaterial({ color: 0x5a3e2b }));
    torchModel.add(handle);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.15), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    top.position.y = 0.3; torchModel.add(top);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff7700 }));
    flame.position.y = 0.42; torchModel.add(flame);
    torchModel.position.set(0.45, -0.4, -0.6);
    torchModel.rotation.set(-0.2, 0.2, 0);
    camera.add(torchModel);
    scene.add(camera); // Add camera to scene so child models follow
    torchInHandRef.current = torchModel;

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: 0x1a2e1a, roughness: 1.0 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    const createFoliageLOD = (x: number, z: number, type: string) => {
        const lod = new THREE.LOD();
        lod.position.set(x, 0, z);
        const barkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1b });
        if (type === 'tree' || type === 'appleTree') {
            const h = 6 + Math.random() * 4;
            const g0 = new THREE.Group();
            const t0 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, h, 6), barkMat); t0.position.y = h/2; t0.castShadow = true; g0.add(t0);
            const foliageCol = type === 'appleTree' ? 0x2d5a27 : 0x1e3a1a;
            const l0 = new THREE.Mesh(new THREE.ConeGeometry(3.5, 7, 6), new THREE.MeshStandardMaterial({ color: foliageCol })); l0.position.y = h+2; l0.castShadow = true; g0.add(l0);
            lod.addLevel(g0, 0); lod.addLevel(new THREE.Group(), 180);
            lod.userData = { type, isObstacle: true, radius: 0.8 };
        } else if (type === 'rock') {
            const s = 1.2 + Math.random() * 0.8;
            const r0 = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), new THREE.MeshStandardMaterial({ color: 0x777777 })); r0.position.y = s*0.4; r0.castShadow = true;
            lod.addLevel(r0, 0); lod.addLevel(new THREE.Group(), 150);
            lod.userData = { type, isObstacle: true, radius: s*0.7 };
        } else if (type === 'bush') {
          const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), new THREE.MeshStandardMaterial({ color: 0x2d5a27 }));
          b.position.y = 0.7; lod.addLevel(b, 0); lod.addLevel(new THREE.Group(), 100);
          lod.userData = { type };
        }
        lod.updateMatrix(); lod.matrixAutoUpdate = false;
        scene.add(lod); worldObjectsRef.current.push(lod);
    };

    const createCritter = (x: number, z: number, type: string) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), new THREE.MeshStandardMaterial({ color: 0xaaaaaa }));
      m.position.y = 0.2; m.castShadow = true; g.add(m);
      g.userData = { type, targetX: x, targetZ: z, speed: 0.03 + Math.random()*0.03 };
      critterGroupRef.current.add(g);
    };

    for(let i=0; i<3500; i++) {
        const x = (Math.random()-0.5)*1800, z = (Math.random()-0.5)*1800; 
        if(Math.sqrt(x*x+z*z) < 20) continue;
        createFoliageLOD(x, z, ['tree', 'appleTree', 'bush', 'rock'][Math.floor(Math.random()*4)]);
    }

    for(let i=0; i<150; i++) {
      createCritter((Math.random()-0.5)*1000, (Math.random()-0.5)*1000, 'rabbit');
    }

    const controls = new PointerLockControls(camera, renderer.domElement); controlsRef.current = controls;
    controls.addEventListener('lock', () => propsRef.current.onLockChange(true));
    controls.addEventListener('unlock', () => propsRef.current.onLockChange(false));

    const keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
    const onKD = (e: KeyboardEvent) => {
        const k = e.code.toLowerCase();
        if(k === 'keyw') keys.w = true; if(k === 'keya') keys.a = true; if(k === 'keys') keys.s = true; if(k === 'keyd') keys.d = true;
        if(k === 'shiftleft') keys.shift = true; if(k === 'keye') triggerAction();
    };
    const onKU = (e: KeyboardEvent) => {
        const k = e.code.toLowerCase();
        if(k === 'keyw') keys.w = false; if(k === 'keya') keys.a = false; if(k === 'keys') keys.s = false; if(k === 'keyd') keys.d = false;
        if(k === 'shiftleft') keys.shift = false;
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
        const { time, isTorchActive, isMobile, mobileInput } = propsRef.current;
        
        // Better Day/Night Cycle
        const phi = (time / 2400) * Math.PI * 2 - Math.PI / 2;
        const sunIntensity = Math.max(0, Math.sin(phi));
        const nightIntensity = 1.0 - sunIntensity;

        if (skyRef.current) {
          const uniforms = skyRef.current.material.uniforms;
          uniforms['turbidity'].value = 10;
          uniforms['rayleigh'].value = 3;
          uniforms['mieCoefficient'].value = 0.005;
          uniforms['mieDirectionalG'].value = 0.7;
          
          tempVec.setFromSphericalCoords(1, Math.PI / 2 - phi, 0);
          uniforms['sunPosition'].value.copy(tempVec);
        }

        if (sunLightRef.current) {
          sunLightRef.current.position.copy(tempVec).multiplyScalar(500);
          sunLightRef.current.intensity = sunIntensity * 2.0;
          sunLightRef.current.color.setHSL(0.1, 0.4, 0.5 + sunIntensity * 0.5);
        }

        if (ambientLightRef.current) {
          ambientLightRef.current.intensity = 0.1 + sunIntensity * 0.5;
          ambientLightRef.current.color.setHSL(0.6, 0.2, 0.4 + sunIntensity * 0.6);
        }

        if (scene.fog instanceof THREE.FogExp2) {
          const fogCol = new THREE.Color().setHSL(0.6, 0.2, 0.05 + sunIntensity * 0.15);
          scene.fog.color.copy(fogCol);
          renderer.setClearColor(fogCol);
        }

        // Torch and Animations
        if (torchLightRef.current) {
          if (isTorchActive) {
            torchLightRef.current.position.copy(camera.position).add(tempCamDir.clone().multiplyScalar(0.5));
            torchLightRef.current.intensity = 20 + Math.sin(now * 0.01) * 5;
          }
        }
        
        if (isBowActive && bowInHandRef.current) {
          bowInHandRef.current.position.y = -0.4 + Math.sin(now * 0.002) * 0.01;
        }
        if (isTorchActive && torchInHandRef.current) {
          torchInHandRef.current.position.y = -0.4 + Math.sin(now * 0.0025) * 0.015;
          const f = torchInHandRef.current.children[2] as THREE.Mesh;
          if (f) f.scale.setScalar(1 + Math.sin(now * 0.02) * 0.2);
        }

        // Projectiles
        const proj = (window as any).projectiles || [];
        (window as any).projectiles = proj.filter((p: any) => {
          if (p.isStuck) return true;
          p.velocity.y -= 15 * delta;
          p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
          p.mesh.lookAt(p.mesh.position.clone().add(p.velocity));
          p.mesh.rotateX(Math.PI/2);
          
          critterGroupRef.current.children.forEach(c => {
            if (c.visible && c.position.distanceTo(p.mesh.position) < 1.0) {
              c.visible = false; p.isStuck = true; playSFX(SFX_URLS.collect_meat, 0.8);
              propsRef.current.onCollect('Raw Meat');
            }
          });
          worldObjectsRef.current.forEach(o => {
            if (o.visible && o.position.distanceTo(p.mesh.position) < (o.userData.radius || 1.2)) {
              p.isStuck = true; playSFX(SFX_URLS.arrow_impact, 0.4);
            }
          });
          if (p.mesh.position.y < 0.1) {
            p.isStuck = true; p.mesh.position.y = 0.1;
            groundedArrowsRef.current.push(p.mesh);
          }
          return true;
        });

        // Picking up arrows
        for (let i = groundedArrowsRef.current.length - 1; i >= 0; i--) {
            if (camera.position.distanceTo(groundedArrowsRef.current[i].position) < 4.0) { 
                propsRef.current.onCollect('Arrow');
                scene.remove(groundedArrowsRef.current[i]);
                groundedArrowsRef.current.splice(i, 1);
            }
        }

        // Mobile Rotation (Look)
        if (isMobile && (Math.abs(mobileInput.lookX) > 0 || Math.abs(mobileInput.lookY) > 0)) {
          euler.setFromQuaternion(camera.quaternion);
          euler.y -= mobileInput.lookX * 0.006;
          euler.x -= mobileInput.lookY * 0.006;
          euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
          camera.quaternion.setFromEuler(euler);
        }

        // Movement
        verticalVelocity -= 18 * delta; camera.position.y += verticalVelocity * delta;
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

        camera.getWorldDirection(tempCamDir);
        propsRef.current.onPositionUpdate({ x: camera.position.x, z: camera.position.z, dirX: tempCamDir.x, dirZ: tempCamDir.z });
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
