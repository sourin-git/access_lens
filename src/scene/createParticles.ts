import * as THREE from 'three';

/** One draw call, deterministic positions, no external sprite texture. */
export function createParticles() {
  const count = 64;
  const positions = new Float32Array(count * 3);
  let seed = 41;
  function random() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (random() - 0.5) * 14;
    positions[i * 3 + 1] = (random() - 0.5) * 8;
    positions[i * 3 + 2] = -1.5 - random() * 4;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0x6395ee, size: 0.027, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geometry, material);
  return {
    points,
    update(time: number, motion: boolean) { points.rotation.z = motion ? Math.sin(time * 0.065) * 0.075 : 0; },
  };
}
