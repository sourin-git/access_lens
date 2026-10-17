import * as THREE from 'three';
import type { AccessibilityProfile } from '../types';

export const SELECTABLE_ELEMENTS = [
  { id: 'navigation', label: 'Navigation' },
  { id: 'hero', label: 'Hero heading' },
  { id: 'body-text', label: 'Body text' },
  { id: 'hero-image', label: 'Hero image' },
  { id: 'primary-button', label: 'Primary button' },
] as const;

export function createWebsiteModel(group = new THREE.Group()) {
  const plane = new THREE.PlaneGeometry(1, 1);
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x102344, transparent: true, opacity: 0.72,
    roughness: 0.35, metalness: 0.4, side: THREE.DoubleSide,
  });
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0x426dba, transparent: true, opacity: 0.55 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(6.5, 4.65, 0.09), panelMaterial);
  panel.position.z = -0.12;
  group.add(panel);
  const panelEdges = new THREE.LineSegments(new THREE.EdgesGeometry(panel.geometry), new THREE.LineBasicMaterial({ color: 0x3b7ddd, transparent: true, opacity: 0.6 }));
  panelEdges.position.copy(panel.position);
  group.add(panelEdges);

  type Element = {
    id: string; mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    frame: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    hit: THREE.Mesh; marker: THREE.Mesh; context: CanvasRenderingContext2D;
    texture: THREE.CanvasTexture; width: number; height: number;
  };
  const elements: Element[] = [];
  const pickables: THREE.Object3D[] = [];
  const markerGeometry = new THREE.CircleGeometry(0.095, 4);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xd5ff54, side: THREE.DoubleSide });
  const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });

  function addElement(id: string, x: number, y: number, width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.round(1024 * height / width);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The scene needs a 2D canvas to generate its labels.');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    mesh.position.set(x, y, 0.02);
    mesh.scale.set(width, height, 1);
    const frame = new THREE.Mesh(plane, edgeMaterial.clone());
    frame.position.set(x, y, 0);
    frame.scale.set(width + 0.035, height + 0.035, 1);
    const hit = new THREE.Mesh(plane, hitMaterial);
    hit.position.set(x, y, 0.045);
    hit.scale.set(width, height, 1);
    hit.userData.elementId = id;
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(x + width / 2 - 0.07, y + height / 2 - 0.04, 0.095);
    marker.visible = false;
    group.add(frame, mesh, hit, marker);
    elements.push({ id, mesh, frame, hit, marker, context, texture, width, height });
    pickables.push(hit);
  }
  addElement('navigation', 0, 1.82, 5.96, 0.48);
  addElement('hero', -1.18, 0.72, 3.6, 1.35);
  addElement('body-text', -1.18, -0.65, 3.6, 0.88);
  addElement('hero-image', 1.94, 0.04, 1.96, 2.72);
  addElement('primary-button', -1.92, -1.6, 2.12, 0.52);

  // Two small satellites share their geometry and materials with the website.
  const satellites: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const satellite = new THREE.Mesh(plane, panelMaterial);
    satellite.position.set(i === 0 ? -4.25 : 4.1, i === 0 ? 0.95 : -0.8, -0.45);
    satellite.scale.set(1.1, 1.65, 1);
    satellite.rotation.y = i === 0 ? 0.24 : -0.24;
    group.add(satellite);
    satellites.push(satellite);
    for (let j = 0; j < 4; j++) {
      const bar = new THREE.Mesh(plane, j === 0 ? markerMaterial : edgeMaterial);
      bar.scale.set(j === 0 ? 0.24 : 0.7, j === 0 ? 0.13 : 0.035, 1);
      bar.position.set(satellite.position.x - 0.12, satellite.position.y + 0.46 - j * 0.24, -0.40);
      group.add(bar);
    }
  }
  const connections = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-3.25, 0.95, -0.3), new THREE.Vector3(-4.25, 0.95, -0.3),
    new THREE.Vector3(3.25, -0.8, -0.3), new THREE.Vector3(4.1, -0.8, -0.3),
  ]);
  group.add(new THREE.LineSegments(connections, new THREE.LineBasicMaterial({ color: 0x4f86da, transparent: true, opacity: 0.4 })));

  let profile: AccessibilityProfile = 'default';
  const issueIds = new Set(['body-text', 'hero-image', 'primary-button']);
  let selected: string | null = null;
  let issues = false;
  function paint(element: Element) {
    const { context: ctx, texture, id } = element;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const dyslexia = profile === 'dyslexia';
    const large = profile === 'low-vision';
    const ink = dyslexia ? '#fff0ce' : '#eaf3ff';
    ctx.fillStyle = dyslexia ? '#2b2836' : large ? '#070e20' : '#10203a';
    ctx.fillRect(0, 0, w, h);
    ctx.textBaseline = 'top';
    ctx.fillStyle = ink;
    const text = (value: string, x: number, y: number, size: number, color = ink) => {
      ctx.fillStyle = color;
      ctx.font = `${id === 'hero' ? 600 : 500} ${size}px ${dyslexia ? 'Verdana' : 'Arial'}, sans-serif`;
      ctx.fillText(value, x, y);
    };
    if (id === 'navigation') {
      text('◈  ACCESSLENS', 26, 22, 30, '#d5ff54');
      text(large ? 'Explore    About' : 'Explore     Our mission     About', large ? 610 : 535, 25, large ? 31 : 26);
    } else if (id === 'hero') {
      text('A WEB FOR', 36, 38, large ? 78 : 69);
      text('EVERYONE.', 36, large ? 135 : 124, large ? 86 : 78, dyslexia ? '#fff0ce' : '#d5ff54');
      text('Different perspectives. Better experiences.', 38, 270, large ? 38 : 32, '#a7c7ff');
    } else if (id === 'body-text') {
      text('Small changes.', 36, 27, large ? 48 : 40);
      text('More possibilities.', 36, dyslexia ? 105 : 88, large ? 48 : 40);
      if (!large) text('Build an internet that includes us all.', 36, 171, 30, dyslexia ? '#eadab9' : '#afc1de');
    } else if (id === 'primary-button') {
      ctx.fillStyle = profile === 'motor' ? '#d5ff54' : '#2866ef';
      ctx.fillRect(0, 0, w, h);
      text('Explore access   →', 70, 75, large ? 77 : 69, profile === 'motor' ? '#101c31' : '#ffffff');
    } else {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, '#152c66'); gradient.addColorStop(1, '#060e21');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#4f89ff'; ctx.lineWidth = large ? 15 : 8;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.ellipse(510, 530, 200 + i * 43, 340 - i * 27, -0.5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#d5ff54'; ctx.beginPath(); ctx.arc(620, 400, 95, 0, Math.PI * 2); ctx.fill();
      text('NEW PERSPECTIVES', 56, h - 150, 52);
      text('Illustrative image', 56, h - 78, 38, '#afc1de');
    }
    texture.needsUpdate = true;
  }
  function refresh() {
    for (const element of elements) {
      const isSelected = selected === element.id;
      const isIssue = issues && issueIds.has(element.id);
      element.frame.material.color.set(isSelected ? 0xd5ff54 : profile === 'low-vision' ? 0xf1f6ff : profile === 'dyslexia' ? 0xd5b88b : profile === 'motor' ? 0x5ca3ff : 0x426dba);
      element.frame.material.opacity = isSelected ? 1 : profile === 'default' || profile === 'reduced-motion' ? 0.55 : 0.9;
      const padding = isSelected ? 0.12 : profile === 'motor' ? 0.085 : 0.035;
      element.frame.scale.set(element.width + padding, element.height + padding, 1);
      element.hit.scale.set(element.width + (profile === 'motor' ? 0.2 : 0), element.height + (profile === 'motor' ? 0.18 : 0), 1);
      element.marker.visible = isIssue;
    }
  }
  function setProfile(next: AccessibilityProfile) {
    profile = next;
    for (const element of elements) paint(element);
    panelMaterial.opacity = profile === 'low-vision' ? 0.95 : 0.72;
    refresh();
  }
  setProfile('default');
  return {
    group, pickables,
    setProfile,
    setSelected(id: string | null) { selected = id; refresh(); },
    setIssues(value: boolean) { issues = value; refresh(); },
    update(time: number, motion: boolean) {
      group.position.y = motion ? Math.sin(time * 0.36) * 0.09 : 0;
      group.rotation.set(-0.045, motion ? -0.11 + Math.sin(time * 0.18) * 0.035 : -0.11, 0);
    },
  };
}
