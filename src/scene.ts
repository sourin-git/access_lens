/**
 * scene.ts — Part 1: 3D Canvas Module
 * Creates and manages the Three.js accessibility audit scene.
 * Exports: createAccessLensScene()
 */

import * as THREE from 'three';

export interface SceneElement {
  id: string;
  mesh: THREE.Mesh;
  issueId?: string;
  label: string;
  type: 'button' | 'input' | 'image' | 'heading' | 'link' | 'form' | 'nav';
}

export interface SceneHighlightOptions {
  issueId: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
}

export interface AccessLensScene {
  mount: (container: HTMLElement) => void;
  unmount: () => void;
  setProfile: (profileId: string, reducedMotion: boolean) => void;
  highlightElement: (issueId: string | null) => void;
  onElementClick: (cb: (issueId: string) => void) => void;
  resize: () => void;
  getRenderer: () => THREE.WebGLRenderer;
  linkElementsToIssues: (issues: Array<{ id: string; elementId: string; severity: string }>) => void;
}

// ── Colour palettes per profile ────────────────────────────────────────────────
const PROFILE_PALETTES: Record<string, {
  bg: number; grid: number; normal: number; accent: number;
}> = {
  default:     { bg: 0x0b0d12, grid: 0x1c2130, normal: 0x6366f1, accent: 0xa855f7 },
  colorblind:  { bg: 0x0d1117, grid: 0x1c2333, normal: 0x3b82f6, accent: 0xfbbf24 },
  lowvision:   { bg: 0x000000, grid: 0x111111, normal: 0xffffff, accent: 0xffdd00 },
  motor:       { bg: 0x0b0d12, grid: 0x1c2130, normal: 0x22d3ee, accent: 0x06b6d4 },
  cognitive:   { bg: 0x0d1020, grid: 0x181d2e, normal: 0x818cf8, accent: 0xc4b5fd },
};

const SEVERITY_COLORS: Record<string, number> = {
  critical: 0xf43f5e,
  serious:  0xf97316,
  moderate: 0xeab308,
  minor:    0x22d3ee,
};

// ── Element geometry definitions ────────────────────────────────────────────────
const ELEMENT_CONFIGS: Array<{
  id: string; label: string; type: SceneElement['type'];
  pos: [number, number, number]; size: [number, number, number];
}> = [
  { id: 'nav-bar',       label: '<nav>',           type: 'nav',     pos: [0,    2.8,  0],   size: [6, 0.35, 0.15] },
  { id: 'hero-heading',  label: '<h1>',             type: 'heading', pos: [-1.2, 1.8,  0],   size: [2.2, 0.45, 0.15] },
  { id: 'sub-heading',   label: '<h2>',             type: 'heading', pos: [-1.2, 1.2,  0],   size: [1.8, 0.3,  0.15] },
  { id: 'cta-button',    label: '<button>',         type: 'button',  pos: [-1.2, 0.6,  0],   size: [1.0, 0.38, 0.15] },
  { id: 'form-email',    label: '<input type=email>',type: 'input',  pos: [1.6,  0.6,  0],   size: [1.4, 0.38, 0.15] },
  { id: 'form-submit',   label: '<button type=submit>',type: 'button',pos:[1.6,  0.1,  0],   size: [1.0, 0.38, 0.15] },
  { id: 'hero-image',    label: '<img>',            type: 'image',   pos: [2.2,  1.8,  0],   size: [1.6, 1.1,  0.12] },
  { id: 'link-1',        label: '<a> (nav)',        type: 'link',    pos: [-2.0, -0.5, 0],   size: [0.9, 0.3,  0.12] },
  { id: 'link-2',        label: '<a> (footer)',     type: 'link',    pos: [-0.8, -0.5, 0],   size: [0.9, 0.3,  0.12] },
  { id: 'form-label',    label: '<label>',          type: 'form',    pos: [1.6,  1.1,  0],   size: [1.4, 0.25, 0.12] },
  { id: 'skip-link',     label: '<a> (skip)',       type: 'link',    pos: [-2.0, 2.8,  0.1], size: [0.7, 0.25, 0.12] },
];

export function createAccessLensScene(): AccessLensScene {
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let animationId: number;
  let container: HTMLElement | null = null;
  let palette = PROFILE_PALETTES.default;
  let reducedMotion = false;

  const elements: SceneElement[] = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let clickCallback: ((id: string) => void) | null = null;
  let hoveredMesh: THREE.Mesh | null = null;
  let highlightedId: string | null = null;

  // Floating particles
  let particleSystem: THREE.Points | null = null;

  // ── Build scene ─────────────────────────────────────────────────────────────
  function buildScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.bg);
    scene.fog = new THREE.FogExp2(palette.bg, 0.04);

    // Grid
    const gridHelper = new THREE.GridHelper(20, 30, palette.grid, palette.grid);
    (gridHelper.material as THREE.Material).opacity = 0.4;
    (gridHelper.material as THREE.Material).transparent = true;
    gridHelper.position.y = -1.8;
    scene.add(gridHelper);

    // Ambient + directional light
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(3, 5, 3);
    dir.castShadow = true;
    scene.add(dir);

    // Accent fill light
    const fill = new THREE.PointLight(palette.accent, 1.5, 8);
    fill.position.set(-2, 2, 2);
    scene.add(fill);

    // Elements
    buildElements();

    // Particles
    buildParticles();
  }

  function buildElements() {
    for (const el of elements) {
      scene.remove(el.mesh);
      el.mesh.geometry.dispose();
      (el.mesh.material as THREE.Material).dispose();
    }
    elements.length = 0;

    for (const cfg of ELEMENT_CONFIGS) {
      const geo = new THREE.BoxGeometry(...cfg.size, 4, 4, 1);
      const mat = new THREE.MeshStandardMaterial({
        color: palette.normal,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 0.82,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...cfg.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { id: cfg.id, label: cfg.label, type: cfg.type };

      // Wire frame overlay
      const edgesGeo = new THREE.EdgesGeometry(geo);
      const edgesMat = new THREE.LineBasicMaterial({
        color: palette.accent,
        transparent: true,
        opacity: 0.25,
      });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      mesh.add(edges);

      scene.add(mesh);
      elements.push({ id: cfg.id, label: cfg.label, type: cfg.type, mesh });
    }
  }

  function buildParticles() {
    if (particleSystem) {
      scene.remove(particleSystem);
      particleSystem.geometry.dispose();
      (particleSystem.material as THREE.Material).dispose();
    }

    const count = 200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: palette.accent,
      size: 0.025,
      transparent: true,
      opacity: 0.4,
    });
    particleSystem = new THREE.Points(geo, mat);
    scene.add(particleSystem);
  }

  // ── Render loop ─────────────────────────────────────────────────────────────
  let clock = new THREE.Clock();

  function animate() {
    animationId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (!reducedMotion) {
      // Gentle camera orbit
      camera.position.x = Math.sin(t * 0.08) * 0.6;
      camera.position.y = 1.0 + Math.sin(t * 0.05) * 0.15;
      camera.lookAt(0, 0.8, 0);

      // Float elements
      for (const el of elements) {
        el.mesh.position.z = cfg_z(el.id) + Math.sin(t * 0.4 + el.mesh.position.x) * 0.04;
        el.mesh.rotation.x = Math.sin(t * 0.15 + el.mesh.position.y * 0.5) * 0.015;
      }

      // Spin particles
      if (particleSystem) {
        particleSystem.rotation.y = t * 0.012;
      }
    }

    renderer.render(scene, camera);
  }

  function cfg_z(id: string): number {
    return ELEMENT_CONFIGS.find(c => c.id === id)?.pos[2] ?? 0;
  }

  // ── Interaction ─────────────────────────────────────────────────────────────
  function onPointerMove(e: PointerEvent) {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const meshes = elements.map(el => el.mesh);
    const hits = raycaster.intersectObjects(meshes, false);

    if (hoveredMesh && hoveredMesh !== getHighlightedMesh()) {
      resetMeshColor(hoveredMesh);
    }

    if (hits.length > 0) {
      const hit = hits[0].object as THREE.Mesh;
      if (hit !== getHighlightedMesh()) {
        (hit.material as THREE.MeshStandardMaterial).emissive.setHex(0x333366);
        (hit.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5;
      }
      hoveredMesh = hit;
      container.style.cursor = 'pointer';
    } else {
      hoveredMesh = null;
      container.style.cursor = 'default';
    }
  }

  function onPointerClick(e: PointerEvent) {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const meshes = elements.map(el => el.mesh);
    const hits = raycaster.intersectObjects(meshes, false);

    if (hits.length > 0) {
      const mesh = hits[0].object as THREE.Mesh;
      const el = elements.find(e => e.mesh === mesh);
      if (el?.issueId && clickCallback) {
        clickCallback(el.issueId);
      }
    }
  }

  function getHighlightedMesh(): THREE.Mesh | null {
    if (!highlightedId) return null;
    return elements.find(el => el.issueId === highlightedId)?.mesh ?? null;
  }

  function resetMeshColor(mesh: THREE.Mesh) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.emissive.setHex(0x000000);
    mat.emissiveIntensity = 0;
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  function mount(el: HTMLElement) {
    container = el;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    el.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.set(0, 1.0, 7);
    camera.lookAt(0, 0.8, 0);

    buildScene();
    animate();

    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('click', onPointerClick);
  }

  function unmount() {
    cancelAnimationFrame(animationId);
    renderer?.dispose();
    container?.removeEventListener('pointermove', onPointerMove);
    container?.removeEventListener('click', onPointerClick);
    if (renderer?.domElement && container) {
      container.removeChild(renderer.domElement);
    }
    container = null;
  }

  function setProfile(profileId: string, rm: boolean) {
    reducedMotion = rm || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    palette = PROFILE_PALETTES[profileId] ?? PROFILE_PALETTES.default;
    if (!scene) return;
    scene.background = new THREE.Color(palette.bg);
    (scene.fog as THREE.FogExp2).color.set(palette.bg);
    buildElements();
    buildParticles();
    // Re-link issues after rebuild
    if (lastLinkedIssues.length > 0) linkElementsToIssues(lastLinkedIssues);
    // Re-apply highlight
    if (highlightedId) highlightElement(highlightedId);
  }

  // Severity lookup — will be filled when issues are loaded
  const issueSeverityMap = new Map<string, string>();
  // Cache last linked issues so profile changes don't lose them
  let lastLinkedIssues: Array<{ id: string; elementId: string; severity: string }> = [];

  function getSeverityForIssue(id: string): string {
    return issueSeverityMap.get(id) ?? 'moderate';
  }

  // Expose a way to link elements to issues
  function linkElementsToIssues(issues: Array<{ id: string; elementId: string; severity: string }>) {
    lastLinkedIssues = issues;
    for (const el of elements) el.issueId = undefined;
    for (const issue of issues) {
      const el = elements.find(e => e.id === issue.elementId);
      if (el) {
        el.issueId = issue.id;
        issueSeverityMap.set(issue.id, issue.severity);
      }
    }
  }

  function highlightElement(issueId: string | null) {
    // Reset all
    for (const el of elements) resetMeshColor(el.mesh);
    highlightedId = issueId;
    if (!issueId) return;
    const el = elements.find(e => e.issueId === issueId);
    if (!el) return;
    const mat = el.mesh.material as THREE.MeshStandardMaterial;
    mat.emissive.setHex(SEVERITY_COLORS[getSeverityForIssue(issueId)] ?? 0x6366f1);
    mat.emissiveIntensity = 0.85;

    // Animate camera toward element if not reduced motion
    if (!reducedMotion) {
      const target = el.mesh.position.clone();
      const startPos = camera.position.clone();
      const endPos = new THREE.Vector3(target.x * 0.4, target.y * 0.5 + 0.5, 6.5);
      let progress = 0;
      const dur = 600;
      const start = performance.now();
      function animCam(now: number) {
        progress = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        camera.position.lerpVectors(startPos, endPos, ease);
        camera.lookAt(0, 0.8, 0);
        if (progress < 1) requestAnimationFrame(animCam);
      }
      requestAnimationFrame(animCam);
    }
  }

  function onElementClick(cb: (issueId: string) => void) {
    clickCallback = cb;
  }

  function resize() {
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function getRenderer() { return renderer; }

  return {
    mount, unmount, setProfile, highlightElement,
    onElementClick, resize, getRenderer,
    linkElementsToIssues,
  };
}
