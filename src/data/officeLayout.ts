
import * as THREE from 'three';

export interface FurnitureSlot {
  id: string;
  type: 'DESK' | 'TREADMILL' | 'CAFE_TABLE' | 'MEETING_CHAIR' | 'COFFEE_MACHINE';
  position: THREE.Vector3;
  rotation: number; // Y-axis rotation in radians
}

export const OFFICE_SLOTS: FurnitureSlot[] = [];

// 1. Office Desks (-X, -Z quadrant)
for (let x = -25; x < -5; x += 4.5) {
  for (let z = -25; z < -5; z += 4.5) {
    OFFICE_SLOTS.push({
      id: `desk-${x}-${z}`,
      type: 'DESK',
      position: new THREE.Vector3(x, 0, z + 0.8), // Position where agent sits
      rotation: Math.PI // Facing the desk (which is at z)
    });
  }
}

// 2. Gym Treadmills (+X, -Z quadrant)
for (let x = 6; x < 24; x += 4.8) {
  OFFICE_SLOTS.push({
    id: `treadmill-${x}`,
    type: 'TREADMILL',
    position: new THREE.Vector3(x, 0, -10),
    rotation: 0 // Facing forward
  });
}

// 3. Cafe Tables (+X, +Z quadrant)
for (let x = 10; x < 25; x += 6.4) {
  for (let z = 10; z < 25; z += 6.4) {
    // 4 chairs per table
    const chairOffsets = [
      { dx: 0.95, dz: 0, rot: -Math.PI / 2 },
      { dx: -0.95, dz: 0, rot: Math.PI / 2 },
      { dx: 0, dz: 0.95, rot: 0 },
      { dx: 0, dz: -0.95, rot: Math.PI },
    ];
    chairOffsets.forEach((off, i) => {
      OFFICE_SLOTS.push({
        id: `cafe-${x}-${z}-${i}`,
        type: 'CAFE_TABLE',
        position: new THREE.Vector3(x + off.dx, 0, z + off.dz),
        rotation: off.rot
      });
    });
  }
}

// 4. Meeting Chairs (-X, +Z quadrant)
const meetingTablePos = { x: -15, z: 15 };
for (let i = 0; i < 8; i++) {
  const angle = (i / 8) * Math.PI * 2;
  const dx = Math.cos(angle) * 2.35;
  const dz = Math.sin(angle) * 1.55;
  OFFICE_SLOTS.push({
    id: `meeting-${i}`,
    type: 'MEETING_CHAIR',
    position: new THREE.Vector3(meetingTablePos.x + dx, 0, meetingTablePos.z + dz),
    rotation: -angle + Math.PI / 2
  });
}

// 5. Coffee Machines (near counter)
OFFICE_SLOTS.push({
  id: 'coffee-1',
  type: 'COFFEE_MACHINE',
  position: new THREE.Vector3(20, 0, 21),
  rotation: 0
});
OFFICE_SLOTS.push({
  id: 'coffee-2',
  type: 'COFFEE_MACHINE',
  position: new THREE.Vector3(24, 0, 21),
  rotation: 0
});
