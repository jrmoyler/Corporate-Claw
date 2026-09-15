import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createReferenceOffice } from '../src/three/architecture/ReferenceOffice';
import { createSuitedAgent } from '../src/three/entities/createSuitedAgent';
import { requestedRenderer } from '../src/three/core/rendererPolicy';
import { OFFICE_CAMERA, resizeOfficeCamera } from '../src/three/core/officeCamera';

test('the standard URL uses native WebGL, with WebGPU explicitly opt-in', () => {
  for (const query of ['', '?renderer=webgl', '?renderer=unknown', '?utm_source=mobile']) {
    assert.equal(requestedRenderer(query), 'webgl');
  }
  assert.equal(requestedRenderer('?renderer=webgpu'), 'webgpu');
});

test('every office surface and suited-agent surface supports native WebGL', () => {
  // Texture painting is outside this structural test; exercise the actual room
  // factory, batching, matrices and material types, not a duplicate fixture.
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const context = new Proxy({}, { get: () => () => {} });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  }});
  let office: THREE.Group;
  try { office = createReferenceOffice(); }
  finally {
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument);
    else delete (globalThis as any).document;
  }
  let shadowReceivers = 0, triangles = 0;
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  for (const root of [office!, createSuitedAgent().scene]) {
    root.updateMatrixWorld(true);
    root.traverse((o: any) => {
      if (!o.isMesh) return;
      geometries.add(o.geometry);
      const m = o.material;
      materials.add(m);
      assert.ok(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial, o.name);
      assert.ok(!m.isNodeMaterial, `${o.name}: incompatible default material`);
      assert.equal(m.visible, true);
      assert.ok(m.opacity > 0);
      if (o.receiveShadow) shadowReceivers++;
      for (const name of ['position', 'normal', 'uv']) {
        const attribute = o.geometry.getAttribute(name);
        assert.ok(attribute, `${o.name}: missing ${name}`);
        assert.ok(Array.from(attribute.array as Float32Array).every(Number.isFinite), `${o.name}: nonfinite ${name}`);
      }
      o.geometry.computeBoundingSphere();
      assert.ok(Number.isFinite(o.geometry.boundingSphere.radius));
      triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    });
  }
  assert.ok(office!.userData.parts > 500, 'complete furnishings must survive batching');
  assert.ok(shadowReceivers > 20, 'keep actual shadow-receiving surfaces');
  assert.ok(triangles > 10000, 'do not replace the room with a plane');
  geometries.forEach(g => g.dispose());
  materials.forEach((m: any) => { m.map?.dispose(); m.dispose(); });
});

test('reference camera preserves adult scale and floor picking across portrait and landscape', () => {
  const camera = new THREE.OrthographicCamera(-24,24,24,-24,.1,250);
  camera.position.set(...OFFICE_CAMERA.position);
  camera.lookAt(new THREE.Vector3(...OFFICE_CAMERA.target));
  camera.updateMatrixWorld(true);
  for (const [width,height] of [[390,560],[1262,874],[844,300],[0,0]]) {
    resizeOfficeCamera(camera,width,height);
    assert.ok(camera.projectionMatrix.elements.every(Number.isFinite));
    assert.ok(camera.left < camera.right && camera.bottom < camera.top);
    const center = new THREE.Vector3(...OFFICE_CAMERA.target).project(camera);
    assert.ok(Math.abs(center.x) < 1e-6 && Math.abs(center.y) < 1e-6);
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0,0),camera);
    const point = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
    assert.ok(point && point.toArray().every(Number.isFinite));
    const nearHeight = new THREE.Vector3(0,3,0).project(camera).y - new THREE.Vector3(0,0,0).project(camera).y;
    const farHeight = new THREE.Vector3(0,3,-20).project(camera).y - new THREE.Vector3(0,0,-20).project(camera).y;
    assert.ok(Math.abs(nearHeight - farHeight) < 1e-6);
  }
});
