import * as THREE from 'three';

export function createScanEffect() {
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv;
      void main() {
        float glow = 1.0 - smoothstep(0.1, 0.63, length((vUv - 0.5) * vec2(1.0, 1.12)));
        gl_FragColor = vec4(0.12, 0.32, 0.95, glow * 0.16);
      }`,
  }));
  halo.position.z = -0.25;
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uProgress: { value: 0.5 }, uColor: { value: new THREE.Color(0x87c8ff) } },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv;
      uniform float uProgress; uniform vec3 uColor;
      void main() {
        float distanceToBand = abs(vUv.y - (1.0 - uProgress));
        float band = 1.0 - smoothstep(0.0, 0.085, distanceToBand);
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(0.0, 0.08, 1.0 - vUv.x);
        gl_FragColor = vec4(uColor, band * edge * 0.32);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4.55), material);
  mesh.position.z = 0.14;
  mesh.visible = false;
  return {
    mesh, halo,
    update(active: boolean, progress: number, reducedMotion: boolean) {
      mesh.visible = active;
      material.uniforms.uProgress.value = reducedMotion ? 0.5 : progress;
    },
  };
}
