import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { EffectComposer } from "https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js";

const canvas = document.getElementById("bg");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// adaptive DPR for perf
function setDPR() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
}
setDPR();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x03040a, 6, 18);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.2, 9);

// composer (postprocessing)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.25,  // strength
  0.6,   // radius
  0.12   // threshold
);
composer.addPass(bloom);

// lights
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

const key = new THREE.DirectionalLight(0xffffff, 0.9);
key.position.set(4, 6, 6);
scene.add(key);

const magenta = new THREE.PointLight(0x7c5cff, 2.0, 40);
magenta.position.set(-3, 0, 6);
scene.add(magenta);

const cyan = new THREE.PointLight(0x00dcff, 1.5, 40);
cyan.position.set(3, -1, 6);
scene.add(cyan);

// ===== PORTAL RINGS =====
const portal = new THREE.Group();
scene.add(portal);

// ring 1: emissive torus
const ringGeo = new THREE.TorusGeometry(2.0, 0.13, 24, 220);
const ringMat = new THREE.MeshStandardMaterial({
  color: 0x12162a,
  metalness: 0.25,
  roughness: 0.25,
  emissive: 0x6f4cff,
  emissiveIntensity: 2.0,
});
const ring = new THREE.Mesh(ringGeo, ringMat);
portal.add(ring);

// ring 2: thin outer ring
const ring2Geo = new THREE.TorusGeometry(2.25, 0.03, 18, 260);
const ring2Mat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  metalness: 0.1,
  roughness: 0.2,
  emissive: 0x00dcff,
  emissiveIntensity: 1.4,
});
const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
portal.add(ring2);

// inner disk glow (fake portal surface)
const diskGeo = new THREE.CircleGeometry(1.75, 128);
const diskMat = new THREE.MeshBasicMaterial({
  color: 0x0b1026,
  transparent: true,
  opacity: 0.9,
});
const disk = new THREE.Mesh(diskGeo, diskMat);
disk.position.z = -0.02;
portal.add(disk);

// ===== PARTICLES =====
const count = 9000;
const pos = new Float32Array(count * 3);
const col = new Float32Array(count * 3);

for (let i = 0; i < count; i++) {
  // spread in a cylinder-ish volume
  const r = 6.5 * Math.pow(Math.random(), 0.7);
  const a = Math.random() * Math.PI * 2;
  const y = (Math.random() - 0.5) * 8.0;

  pos[i * 3 + 0] = Math.cos(a) * r;
  pos[i * 3 + 1] = y;
  pos[i * 3 + 2] = (Math.random() - 0.5) * 10.0;

  // gradient-ish color between magenta & cyan
  const t = Math.random();
  col[i * 3 + 0] = (1 - t) * 0.55 + t * 0.05;
  col[i * 3 + 1] = (1 - t) * 0.30 + t * 0.85;
  col[i * 3 + 2] = (1 - t) * 1.00 + t * 1.00;
}

const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
pGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));

const pMat = new THREE.PointsMaterial({
  size: 0.018,
  vertexColors: true,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
});

const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

// ===== INTERACTION (mouse + scroll “charge”) =====
let mx = 0, my = 0;
window.addEventListener("mousemove", (e) => {
  mx = (e.clientX / window.innerWidth) * 2 - 1;
  my = (e.clientY / window.innerHeight) * 2 - 1;
});

// scroll intensity 0..1
let charge = 0;
function updateCharge() {
  const maxScroll = document.body.scrollHeight - window.innerHeight;
  const s = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  charge = THREE.MathUtils.clamp(s, 0, 1);
}
updateCharge();
window.addEventListener("scroll", updateCharge);

// ===== ANIMATE =====
const clock = new THREE.Clock();
const baseCamZ = 9;

function animate() {
  const t = clock.getElapsedTime();

  // camera subtle parallax
  camera.position.x += (mx * 0.9 - camera.position.x) * 0.03;
  camera.position.y += (-my * 0.45 - camera.position.y) * 0.03;
  camera.position.z = baseCamZ - charge * 1.2;
  camera.lookAt(0, 0, 0);

  // portal animation (charge controls intensity)
  portal.rotation.z = t * (0.15 + charge * 0.8);
  ring.rotation.x = Math.sin(t * 0.6) * 0.08;
  ring2.rotation.y = Math.cos(t * 0.55) * 0.10;

  ringMat.emissiveIntensity = 1.7 + charge * 2.2 + Math.sin(t * 2.0) * 0.25;
  ring2Mat.emissiveIntensity = 1.2 + charge * 1.8 + Math.cos(t * 1.7) * 0.18;

  // bloom stronger when charged
  bloom.strength = 1.05 + charge * 1.35;
  bloom.radius = 0.55 + charge * 0.25;

  // particle drift + slight swirl
  particles.rotation.y = t * 0.03 + charge * 0.18;
  particles.rotation.x = Math.sin(t * 0.15) * 0.03;

  // animate positions a bit (cheap wave)
  const arr = pGeo.attributes.position.array;
  for (let i = 0; i < count; i += 25) {
    const idx = i * 3;
    arr[idx + 1] += Math.sin(t * 0.9 + arr[idx] * 0.12) * 0.002;
  }
  pGeo.attributes.position.needsUpdate = true;

  // light breathing
  magenta.intensity = 1.6 + Math.sin(t * 1.1) * 0.25 + charge * 0.6;
  cyan.intensity = 1.2 + Math.cos(t * 1.0) * 0.18 + charge * 0.45;

  composer.render();
  requestAnimationFrame(animate);
}
animate();

// resize
window.addEventListener("resize", () => {
  setDPR();
  renderer.setSize(window.innerWidth, window.innerHeight);

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
});
