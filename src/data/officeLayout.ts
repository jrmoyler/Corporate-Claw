
import * as THREE from 'three';

export interface FurnitureSlot {
  id: string;
  type: 'DESK' | 'TREADMILL' | 'CAFE_TABLE' | 'MEETING_CHAIR' | 'COFFEE_MACHINE' | 'RECEPTION' | 'SOFA';
  position: THREE.Vector3;
  rotation: number; // Y-axis rotation in radians
}

export const OFFICE_SLOTS: FurnitureSlot[] = [];
export interface ObstacleData {
  position: THREE.Vector3;
  radius: number;
}
export const PHYSICAL_OBSTACLES: ObstacleData[] = [];

// 1. Office Desks (Top Left quadrant)
for (let x = -20; x <= -5; x += 8) {
  for (let z = -20; z <= -5; z += 8) {
    // Two desks facing each other
    OFFICE_SLOTS.push({ id: `desk-${x}-${z}-1`, type: 'DESK', position: new THREE.Vector3(x, 0, z - 1), rotation: 0 });
    OFFICE_SLOTS.push({ id: `desk-${x}-${z}-2`, type: 'DESK', position: new THREE.Vector3(x, 0, z + 1), rotation: Math.PI });
    PHYSICAL_OBSTACLES.push({ position: new THREE.Vector3(x, 0, z), radius: 2.5 });
  }
}

// 2. Gym Area (Bottom Right quadrant)
for (let x = 15; x <= 25; x += 5) {
  OFFICE_SLOTS.push({ id: `treadmill-${x}`, type: 'TREADMILL', position: new THREE.Vector3(x, 0, 15), rotation: -Math.PI / 2 });
  PHYSICAL_OBSTACLES.push({ position: new THREE.Vector3(x, 0, 15), radius: 1.5 });
}

// 3. Kitchen Area (Top Right quadrant)
OFFICE_SLOTS.push({ id: 'coffee-1', type: 'COFFEE_MACHINE', position: new THREE.Vector3(15, 0, -20), rotation: Math.PI });
PHYSICAL_OBSTACLES.push({ position: new THREE.Vector3(17.5, 0, -24), radius: 8.0 }); // Kitchen counter
PHYSICAL_OBSTACLES.push({ position: new THREE.Vector3(9, 0, -24), radius: 1.5 }); // Water cooler

// 4. Lounge Area (Bottom Middle)
OFFICE_SLOTS.push({ id: 'sofa-1', type: 'SOFA', position: new THREE.Vector3(0, 0, 15), rotation: Math.PI / 2 });
OFFICE_SLOTS.push({ id: 'sofa-2', type: 'SOFA', position: new THREE.Vector3(8, 0, 15), rotation: -Math.PI / 2 });
PHYSICAL_OBSTACLES.push({ position: new THREE.Vector3(4, 0, 15), radius: 4.0 }); // Coffee table area
PHYSICAL_OBSTACLES.push({ position: new THREE.Vector3(0, 0, 15), radius: 2.5 }); // Sofa 1
PHYSICAL_OBSTACLES.push({ position: new THREE.Vector3(8, 0, 15), radius: 2.5 }); // Sofa 2

// 5. Reception Area (Bottom Left)
// Move it to z=20 so the queue (extending +Z) fits within the room (wall at z=31)
OFFICE_SLOTS.push({ id: 'reception-1', type: 'RECEPTION', position: new THREE.Vector3(-15, 0, 20), rotation: 0 });
PHYSICAL_OBSTACLES.push({ position: new THREE.Vector3(-15, 0, 20), radius: 4.0 }); // Reception desk
PHYSICAL_OBSTACLES.push({ position: new THREE.Vector3(-15, 0, 18.5), radius: 4.0 }); // Reception wall

// 6. Gym Extras
PHYSICAL_OBSTACLES.push({ position: new THREE.Vector3(22, 0, 22), radius: 2.5 }); // Dumbbell rack

