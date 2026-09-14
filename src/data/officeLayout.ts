import * as THREE from 'three';
export interface FurnitureSlot {
  id: string;
  type: 'DESK' | 'TREADMILL' | 'CAFE_TABLE' | 'MEETING_CHAIR' | 'COFFEE_MACHINE' | 'RECEPTION' | 'SOFA';
  position: THREE.Vector3;
  rotation: number;
}
export interface ObstacleData { position: THREE.Vector3; radius: number }
export const OFFICE_SLOTS: FurnitureSlot[] = [];
export const PHYSICAL_OBSTACLES: ObstacleData[] = [];
export const DESK_ISLANDS = [{ x: -8, z: -6 }, { x: -8, z: 5 }];
export const LOUNGES = [{ x: -25, z: -8, color: 0x174237 }, { x: -10, z: 19, color: 0x142c45 }];
export const MEETING = { x: 13, z: -17 };
export const CAFE = { x: 25, z: -2 };
export const RECEPTION = { x: 18, z: 9 };
const slot = (id: string, type: FurnitureSlot['type'], x: number, z: number, rotation = 0) => OFFICE_SLOTS.push({ id, type, position: new THREE.Vector3(x, 0, z), rotation });
export function obstacle(x: number, z: number, radius: number) { PHYSICAL_OBSTACLES.push({ position: new THREE.Vector3(x, 0, z), radius }); }
DESK_ISLANDS.forEach(({x,z}, island) => {
  for (const dx of [-3, 0, 3]) {
    // Task positions are at chairs, outside the desk collision envelope.
    slot(`desk-${island}-${dx}-a`, 'DESK', x+dx, z-2.6, 0);
    slot(`desk-${island}-${dx}-b`, 'DESK', x+dx, z+2.6, Math.PI);
    obstacle(x+dx,z,1.25);
  }
});
LOUNGES.forEach(({x,z},i) => { slot(`sofa-${i}`, 'SOFA',x,z-2.9,0); obstacle(x,z-4.2,.45); obstacle(x,z+1,1.5); });
for (let i=0;i<4;i++) {
  const x=MEETING.x-4.5+i*3;
  slot(`meeting-${i}-a`,'MEETING_CHAIR',x,MEETING.z-3,0);
  slot(`meeting-${i}-b`,'MEETING_CHAIR',x,MEETING.z+3,Math.PI);
  obstacle(x,MEETING.z,1.5);
}
for(let i=0;i<4;i++) { const a=i*Math.PI/2; slot(`cafe-${i}`,'CAFE_TABLE',CAFE.x+Math.sin(a)*2.6,CAFE.z+Math.cos(a)*2.6,a+Math.PI); }
obstacle(CAFE.x,CAFE.z,1.5);
slot('coffee-1','COFFEE_MACHINE',24,-7,Math.PI);
slot('reception-1','RECEPTION',RECEPTION.x,RECEPTION.z+2.8,Math.PI);
for(let x=13;x<=23;x+=2) obstacle(x,RECEPTION.z,1);
// Ivory/glass partitions. Gaps remain open for circulation.
export const PARTITIONS = [
  {x:-20,z:27,w:16,d:.4,h:5.5,glass:false},
  {x:-8,z:27,w:5,d:.4,h:5.5,glass:false},
  {x:-12,z:24,w:.4,d:6,h:5.5,glass:false},
  {x:-6,z:-27,w:.4,d:6,h:5.5,glass:true},
  {x:2,z:-19,w:.35,d:13,h:5.8,glass:true},
  {x:14,z:-26,w:24,d:.35,h:5.8,glass:true},
  {x:26,z:-20,w:.35,d:12,h:5.8,glass:true},
  {x:19,z:-11,w:14,d:.35,h:5.8,glass:true},
  {x:12,z:4,w:.5,d:9,h:5.5,glass:false},
  {x:18,z:1,w:12,d:.5,h:5.5,glass:false},
  {x:-25,z:-15,w:10,d:.4,h:5.5,glass:false},
  {x:27,z:18,w:.4,d:17,h:5.5,glass:false},
];
for(const p of PARTITIONS) { const length=Math.max(p.w,p.d); for(let t=-length/2;t<=length/2;t+=.6) obstacle(p.x+(p.w>p.d?t:0),p.z+(p.d>p.w?t:0),.35); }

export const DIVIDERS = [[-15,-8],[-15,3],[-20,1],[2,-7]] as const;
for(const [x,z] of DIVIDERS)for(const dz of [-1.5,0,1.5])obstacle(x,z+dz,.7);
for(let x=20;x<=28;x+=1)obstacle(x,-6,.45);
for(let x=21;x<=27;x+=1)obstacle(x,-9,.85);
