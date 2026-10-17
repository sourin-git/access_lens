import * as THREE from 'three';

export function createInteraction(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  pickables: THREE.Object3D[],
  onSelect: (id: string) => void,
) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const down = new THREE.Vector2();
  const hits: THREE.Intersection[] = [];
  const originalCursor = canvas.style.cursor;
  let pointerId: number | null = null;
  function pick(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    camera.updateMatrixWorld();
    for (const object of pickables) object.updateWorldMatrix(true, false);
    raycaster.setFromCamera(pointer, camera);
    hits.length = 0;
    raycaster.intersectObjects(pickables, false, hits);
    return hits.length ? hits[0].object.userData.elementId as string : null;
  }
  function onMove(event: PointerEvent) { canvas.style.cursor = pick(event) ? 'pointer' : originalCursor; }
  function onDown(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) return;
    pointerId = event.pointerId;
    down.set(event.clientX, event.clientY);
  }
  function onUp(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) return;
    const id = pick(event);
    if (id) onSelect(id);
  }
  function onLeave() { pointerId = null; canvas.style.cursor = originalCursor; }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointercancel', onLeave);
  return {
    dispose() {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointercancel', onLeave);
      canvas.style.cursor = originalCursor;
      hits.length = 0;
    },
  };
}
