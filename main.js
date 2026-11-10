import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL = 'assets/zombie.glb';
const MAP = 30; // half size of the walkable area
const SPEED = 0.9; // m/s, zombie shuffle

// ---------------------------------------------------------------- scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2130);
scene.fog = new THREE.Fog(0x1a2130, 18, 70);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
camera.position.set(4, 3, 6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 2;
controls.maxDistance = 30;
controls.target.set(0, 1, 0);

scene.add(new THREE.HemisphereLight(0xaabbdd, 0x2a2420, 1.4));
const moon = new THREE.DirectionalLight(0xc8d6ff, 2.2);
moon.position.set(8, 14, 6);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
moon.shadow.bias = -0.0005;
scene.add(moon, moon.target);

// ---------------------------------------------------------------- map (foggy graveyard field)
function groundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3f2c';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = Math.random();
    g.fillStyle = v < 0.5 ? 'rgba(70,78,48,0.5)' : v < 0.8 ? 'rgba(45,40,30,0.5)' : 'rgba(95,100,70,0.4)';
    const s = 1 + Math.random() * 4;
    g.fillRect(Math.random() * 512, Math.random() * 512, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(16, 16);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 })
);
ground.receiveShadow = true;
scene.add(ground);

const stone = new THREE.MeshStandardMaterial({ color: 0x7a7a78, roughness: 0.95 });
const wood = new THREE.MeshStandardMaterial({ color: 0x3b2d22, roughness: 1 });
const rand = (a, b) => a + Math.random() * (b - a);
const obstacles = [];
function place(obj, x, z, r) {
  obj.position.x = x;
  obj.position.z = z;
  obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(obj);
  obstacles.push({ x, z, r });
}
function freeSpot(minDist = 3) {
  for (let i = 0; i < 100; i++) {
    const x = rand(-MAP, MAP), z = rand(-MAP, MAP);
    if (Math.hypot(x, z) < 4) continue;
    if (obstacles.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + minDist)) return [x, z];
  }
  return [rand(-MAP, MAP), rand(-MAP, MAP)];
}
// tombstones
for (let i = 0; i < 28; i++) {
  const g = new THREE.Group();
  const w = rand(0.5, 0.8), h = rand(0.7, 1.2);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.18), stone);
  slab.position.y = h / 2;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.18, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), stone);
  top.position.y = h;
  g.add(slab, top);
  g.rotation.set(rand(-0.12, 0.12), rand(0, Math.PI * 2), rand(-0.12, 0.12));
  place(g, ...freeSpot(), 0.6);
}
// dead trees
for (let i = 0; i < 10; i++) {
  const g = new THREE.Group();
  const trunkH = rand(2.5, 4);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, trunkH, 6), wood);
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  for (let b = 0; b < 4; b++) {
    const len = rand(0.8, 1.6);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, len, 5), wood);
    br.position.y = trunkH * rand(0.55, 0.95);
    br.rotation.set(rand(0.6, 1.1), rand(0, Math.PI * 2), 0, 'YXZ');
    br.translateY(len / 2);
    g.add(br);
  }
  place(g, ...freeSpot(), 0.5);
}
// rocks
for (let i = 0; i < 18; i++) {
  const s = rand(0.3, 0.9);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stone);
  rock.position.y = s * 0.4;
  rock.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  place(rock, ...freeSpot(), s);
}
// low ground mist
const mist = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x8090a8, transparent: true, opacity: 0.07, depthWrite: false })
);
mist.position.y = 0.35;
scene.add(mist);

// target marker
const marker = new THREE.Mesh(
  new THREE.RingGeometry(0.25, 0.32, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x9ccc65, transparent: true, opacity: 0.9 })
);
marker.position.y = 0.02;
marker.visible = false;
scene.add(marker);

// ---------------------------------------------------------------- zombie
const zombie = new THREE.Group();
scene.add(zombie);
let mixer = null, walkAction = null;
let heading = 0;
const target = new THREE.Vector3();
let hasTarget = false, mode = 'wander', idleT = 0;

function pickWander() {
  const [x, z] = freeSpot(1.5);
  // stay reasonably close so the camera keeps up
  const p = new THREE.Vector3(x, 0, z).sub(zombie.position).clampLength(0, 12).add(zombie.position);
  p.x = THREE.MathUtils.clamp(p.x, -MAP, MAP);
  p.z = THREE.MathUtils.clamp(p.z, -MAP, MAP);
  target.copy(p);
  hasTarget = true;
}

new GLTFLoader().load(
  MODEL_URL,
  (gltf) => {
    const model = gltf.scene;
    model.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
    // normalize to ~1.75m tall with feet on the ground
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = 1.75 / size.y;
    model.scale.setScalar(s);
    box.setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -box.min.y, -c.z);
    zombie.add(model);

    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      const clip = gltf.animations.find((a) => /walk/i.test(a.name)) || gltf.animations[0];
      walkAction = mixer.clipAction(clip);
      walkAction.play();
      console.log('animations:', gltf.animations.map((a) => a.name));
    }
    document.getElementById('loading').remove();
    pickWander();
  },
  undefined,
  (err) => {
    document.getElementById('loading').textContent = '모델을 불러오지 못했어요: assets/zombie.glb 확인';
    console.error(err);
  }
);

// ---------------------------------------------------------------- input
const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
// window lost focus mid-press -> keyup never arrives; don't leave keys stuck
addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => keys.clear());

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(ground)[0];
  if (!hit) return;
  target.set(THREE.MathUtils.clamp(hit.point.x, -MAP, MAP), 0, THREE.MathUtils.clamp(hit.point.z, -MAP, MAP));
  hasTarget = true;
  mode = 'goto';
  marker.position.set(target.x, 0.02, target.z);
  marker.visible = true;
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- loop
const stateEl = document.getElementById('state');
const clock = new THREE.Clock();
const prev = new THREE.Vector3();
let speedNow = 0;

function collide(p) {
  for (const o of obstacles) {
    const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), r = o.r + 0.35;
    if (d < r && d > 1e-4) { p.x = o.x + (dx / d) * r; p.z = o.z + (dz / d) * r; }
  }
  p.x = THREE.MathUtils.clamp(p.x, -MAP, MAP);
  p.z = THREE.MathUtils.clamp(p.z, -MAP, MAP);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  prev.copy(zombie.position);

  // desired direction
  let dx = 0, dz = 0;
  const kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const kz = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  if (kx || kz) {
    // camera-relative WASD
    const f = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize();
    const r = new THREE.Vector3(-f.z, 0, f.x);
    dx = f.x * -kz + r.x * kx;
    dz = f.z * -kz + r.z * kx;
    mode = 'manual';
    idleT = 3; // after releasing keys, stand for 3s before wandering again
    hasTarget = false;
    marker.visible = false;
  } else if (hasTarget) {
    const vx = target.x - zombie.position.x, vz = target.z - zombie.position.z;
    const d = Math.hypot(vx, vz);
    if (d < 0.3) {
      hasTarget = false;
      marker.visible = false;
      mode = 'idle';
      idleT = rand(1.5, 4);
    } else { dx = vx / d; dz = vz / d; }
  } else if (mode === 'idle' || mode === 'manual') {
    idleT -= dt;
    if (idleT <= 0) { mode = 'wander'; pickWander(); }
  }

  const moving = dx !== 0 || dz !== 0;
  speedNow = THREE.MathUtils.damp(speedNow, moving ? SPEED : 0, 5, dt);
  if (moving) {
    const want = Math.atan2(dx, dz);
    let diff = want - heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    heading += diff * Math.min(1, dt * 3);
  }
  zombie.rotation.y = heading;
  zombie.position.x += Math.sin(heading) * speedNow * dt;
  zombie.position.z += Math.cos(heading) * speedNow * dt;
  collide(zombie.position);

  if (walkAction) walkAction.timeScale = speedNow / SPEED;
  if (mixer) mixer.update(dt);

  // camera follows
  const delta = zombie.position.clone().sub(prev);
  camera.position.add(delta);
  controls.target.add(delta);
  controls.target.y = THREE.MathUtils.damp(controls.target.y, 1.1, 4, dt);
  moon.position.set(zombie.position.x + 8, 14, zombie.position.z + 6);
  moon.target.position.copy(zombie.position);
  controls.update();

  stateEl.textContent = { wander: '배회', goto: '목표로 이동', idle: '멈춤', manual: '직접 조종' }[mode];
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// debug handle (devtools)
window.zw = { scene, camera, controls, zombie, get mixer() { return mixer; }, get action() { return walkAction; }, get mode() { return mode; } };
