import * as THREE from 'three';

// Parallel architectural projection: distant desks and people retain their scale.
export const OFFICE_CAMERA = {
  position: [28, 32, 40] as const,
  target: [0, 1, -2] as const,
};
export function resizeOfficeCamera(camera: THREE.OrthographicCamera, width: number, height: number) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  // Portrait deliberately shows a closer, pannable portion of the same room,
  // rather than shrinking the entire floor plan into a strip of tiny figures.
  const span = aspect < 1 ? 40 : 48;
  camera.left = -span * aspect / 2;
  camera.right = span * aspect / 2;
  camera.top = span / 2;
  camera.bottom = -span / 2;
  camera.updateProjectionMatrix();
}
