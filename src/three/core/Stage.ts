
import * as THREE from 'three/webgpu';
import { uv, sin, vec3, vec4 } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OFFICE_SLOTS, FurnitureSlot } from '../../data/officeLayout';

export class Stage {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public controls: OrbitControls;

  private plane: THREE.Mesh | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private environmentGroup: THREE.Group;

  private followTarget: THREE.Vector3 | null = null;
  private readonly defaultTarget = new THREE.Vector3(0, 0.8, 0);

  constructor(rendererElement: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf8f9fa);
    this.environmentGroup = new THREE.Group();
    this.scene.add(this.environmentGroup);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(30, 25, 40);

    this.controls = new OrbitControls(this.camera, rendererElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.8;
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.maxPolarAngle = Math.PI / 2.2;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 120;
    this.controls.target.set(0, 0, 0);

    this.controls.addEventListener('start', () => {
      rendererElement.style.cursor = 'grabbing';
    });
    this.controls.addEventListener('end', () => {
      rendererElement.style.cursor = 'auto';
    });

    this.setupLights();
    this.createOfficeEnvironment();
  }

  private setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6 * Math.PI);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0 * Math.PI);
    dirLight.position.set(30, 50, 30);
    dirLight.castShadow = true;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.mapSize.set(4096, 4096);
    dirLight.shadow.bias = -0.0001;
    this.scene.add(dirLight);

    // Warm ceiling lights
    const lightPositions = [
      [-15, 12, -15], [15, 12, -15], [15, 12, 15], [-15, 12, 15]
    ];
    lightPositions.forEach(pos => {
      const pLight = new THREE.PointLight(0xfff4e0, 80, 50);
      pLight.position.set(pos[0], pos[1], pos[2]);
      this.scene.add(pLight);
      
      // Visual light fixture
      const fixtureGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
      const fixtureMat = new THREE.MeshBasicNodeMaterial({ color: 0xffffff });
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.set(pos[0], 11.9, pos[2]);
      this.environmentGroup.add(fixture);
    });
  }

  private createOfficeEnvironment() {
    this.environmentGroup.clear();

    // 1. Walls & Floor refinement
    this.createWalls();

    // 2. Render furniture from layout data
    OFFICE_SLOTS.forEach(slot => {
      if (slot.type === 'DESK') {
        this.createDesk(slot.position.x, slot.position.z - 0.8);
      } else if (slot.type === 'TREADMILL') {
        this.createTreadmill(slot.position.x, slot.position.z);
      } else if (slot.type === 'CAFE_TABLE') {
        if (slot.id.endsWith('-0')) {
          const tableX = slot.position.x - 1.2;
          const tableZ = slot.position.z;
          this.createCafeTable(tableX, tableZ);
        }
        this.createChair(slot.position.x, slot.position.z, slot.rotation);
      } else if (slot.type === 'MEETING_CHAIR') {
        if (slot.id === 'meeting-0') {
          this.createLargeMeetingTable(-15, 15);
        }
        this.createChair(slot.position.x, slot.position.z, slot.rotation);
      } else if (slot.type === 'COFFEE_MACHINE') {
        this.createCoffeeMachine(slot.position.x, slot.position.z);
      }
    });

    // Extra decor
    this.createCoffeeCounter(22, 0, 22);
    this.createPlant(-28, 0, -28);
    this.createPlant(28, 0, -28);
    this.createPlant(28, 0, 28);
    this.createPlant(-28, 0, 28);
    this.createPlant(0, 0, -28);
    this.createPlant(0, 0, 28);

    // Wall Art
    this.createWallArt(-30.4, 6, -15, 'L'); // Left wall
    this.createWallArt(-30.4, 6, 15, 'L');
    this.createWallArt(30.4, 6, -15, 'R'); // Right wall
    this.createWallArt(30.4, 6, 15, 'R');
    this.createWallArt(-15, 6, -30.4, 'B'); // Back wall
    this.createWallArt(15, 6, -30.4, 'B');
  }

  private createWallArt(x: number, y: number, z: number, side: 'L' | 'R' | 'B') {
    const frameGeo = new THREE.BoxGeometry(4, 3, 0.1);
    const frameMat = new THREE.MeshStandardNodeMaterial({ color: 0x212529 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    
    const artGeo = new THREE.PlaneGeometry(3.8, 2.8);
    const artMat = new THREE.MeshStandardNodeMaterial({ 
      color: side === 'L' ? 0x7EACEA : (side === 'R' ? 0xF27D26 : 0x2d6a4f),
      emissive: side === 'L' ? 0x7EACEA : (side === 'R' ? 0xF27D26 : 0x2d6a4f),
      emissiveIntensity: 0.2
    });
    const art = new THREE.Mesh(artGeo, artMat);
    art.position.z = 0.06;
    frame.add(art);

    frame.position.set(x, y, z);
    if (side === 'L') frame.rotation.y = Math.PI / 2;
    if (side === 'R') frame.rotation.y = -Math.PI / 2;
    
    this.environmentGroup.add(frame);
  }

  private createCoffeeMachine(x: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, 1.25, z); // On top of counter

    const bodyGeo = new THREE.BoxGeometry(1.2, 0.8, 1);
    const bodyMat = new THREE.MeshStandardNodeMaterial({ color: 0xadb5bd, metalness: 0.8, roughness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    const screenGeo = new THREE.PlaneGeometry(0.4, 0.3);
    const screenMat = new THREE.MeshStandardNodeMaterial({ color: 0x111111, emissive: 0x00ff00, emissiveIntensity: 0.5 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 0.1, 0.51);
    group.add(screen);

    this.environmentGroup.add(group);
  }

  private createWalls() {
    const wallMat = new THREE.MeshStandardNodeMaterial({ color: 0xe9ecef, roughness: 0.8 });
    const wallGeo = new THREE.BoxGeometry(62, 12, 1);
    
    // Back wall
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 6, -31);
    this.environmentGroup.add(backWall);

    // Left wall
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-31, 6, 0);
    this.environmentGroup.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(31, 6, 0);
    this.environmentGroup.add(rightWall);

    // Baseboards
    const bbMat = new THREE.MeshStandardNodeMaterial({ color: 0x343a40 });
    const bbGeo = new THREE.BoxGeometry(62, 0.4, 1.1);
    const bb1 = new THREE.Mesh(bbGeo, bbMat);
    bb1.position.set(0, 0.2, -30.9);
    this.environmentGroup.add(bb1);
  }

  private createDesk(x: number, z: number) {
    const deskGroup = new THREE.Group();
    deskGroup.position.set(x, 0, z);

    // Table top - Sleek wood
    const topGeo = new THREE.BoxGeometry(3.5, 0.15, 1.8);
    const topMat = new THREE.MeshStandardNodeMaterial({ color: 0xdee2e6, roughness: 0.3 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 0.75;
    top.castShadow = true;
    top.receiveShadow = true;
    deskGroup.add(top);

    // Modern frame
    const frameMat = new THREE.MeshStandardNodeMaterial({ color: 0x212529, metalness: 0.8, roughness: 0.2 });
    const legGeo = new THREE.BoxGeometry(0.1, 0.75, 0.1);
    [[1.6, 0.375, 0.7], [-1.6, 0.375, 0.7], [1.6, 0.375, -0.7], [-1.6, 0.375, -0.7]].forEach(p => {
      const leg = new THREE.Mesh(legGeo, frameMat);
      leg.position.set(p[0], p[1], p[2]);
      deskGroup.add(leg);
    });

    // Computer Monitor
    const standGeo = new THREE.BoxGeometry(0.3, 0.4, 0.3);
    const stand = new THREE.Mesh(standGeo, frameMat);
    stand.position.set(0, 0.95, -0.4);
    deskGroup.add(stand);

    const screenGeo = new THREE.BoxGeometry(1.4, 0.8, 0.05);
    const screenMat = new THREE.MeshStandardNodeMaterial({ color: 0x111111, emissive: 0x111111, emissiveIntensity: 0.5 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 1.3, -0.4);
    deskGroup.add(screen);

    // Keyboard
    const kbGeo = new THREE.BoxGeometry(0.8, 0.02, 0.3);
    const kb = new THREE.Mesh(kbGeo, frameMat);
    kb.position.set(0, 0.83, 0.2);
    deskGroup.add(kb);

    // Chair
    this.createChair(0, 0.8, Math.PI, deskGroup);

    this.environmentGroup.add(deskGroup);
  }

  private createChair(x: number, z: number, rotation: number, parent: THREE.Group | THREE.Scene = this.environmentGroup) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    const mat = new THREE.MeshStandardNodeMaterial({ color: 0x343a40, roughness: 0.5 });
    
    // Seat
    const seatGeo = new THREE.BoxGeometry(0.8, 0.1, 0.8);
    const seat = new THREE.Mesh(seatGeo, mat);
    seat.position.y = 0.45;
    group.add(seat);

    // Back
    const backGeo = new THREE.BoxGeometry(0.8, 1.0, 0.1);
    const back = new THREE.Mesh(backGeo, mat);
    back.position.set(0, 0.9, -0.35);
    group.add(back);

    // Stem
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8);
    const stem = new THREE.Mesh(stemGeo, mat);
    stem.position.y = 0.2;
    group.add(stem);

    // Base
    const baseGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.05, 16);
    const base = new THREE.Mesh(baseGeo, mat);
    base.position.y = 0.025;
    group.add(base);

    if (parent instanceof THREE.Group) {
      parent.add(group);
    } else {
      this.environmentGroup.add(group);
    }
  }

  private createTreadmill(x: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const mat = new THREE.MeshStandardNodeMaterial({ color: 0x212529, roughness: 0.4 });
    
    // Belt
    const beltGeo = new THREE.BoxGeometry(2.2, 0.2, 4.5);
    const belt = new THREE.Mesh(beltGeo, mat);
    belt.position.y = 0.1;
    group.add(belt);

    // Side rails
    const railGeo = new THREE.BoxGeometry(0.2, 0.3, 4.5);
    const railMat = new THREE.MeshStandardNodeMaterial({ color: 0x495057 });
    const railL = new THREE.Mesh(railGeo, railMat);
    railL.position.set(-1.1, 0.2, 0);
    group.add(railL);
    const railR = new THREE.Mesh(railGeo, railMat);
    railR.position.set(1.1, 0.2, 0);
    group.add(railR);

    // Console posts
    const postGeo = new THREE.BoxGeometry(0.15, 1.4, 0.15);
    const postL = new THREE.Mesh(postGeo, mat);
    postL.position.set(-1.0, 0.7, 2.0);
    group.add(postL);
    const postR = new THREE.Mesh(postGeo, mat);
    postR.position.set(1.0, 0.7, 2.0);
    group.add(postR);

    // Console
    const consoleGeo = new THREE.BoxGeometry(2.4, 0.4, 0.8);
    const console = new THREE.Mesh(consoleGeo, mat);
    console.position.set(0, 1.4, 2.0);
    group.add(console);

    this.environmentGroup.add(group);
  }

  private createCafeTable(x: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Table top - White marble look
    const topGeo = new THREE.CylinderGeometry(1.8, 1.8, 0.1, 32);
    const topMat = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.1 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 1.05;
    group.add(top);

    // Chrome leg
    const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.05, 16);
    const legMat = new THREE.MeshStandardNodeMaterial({ color: 0xadb5bd, metalness: 0.9, roughness: 0.1 });
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.y = 0.525;
    group.add(leg);

    const baseGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.05, 32);
    const base = new THREE.Mesh(baseGeo, legMat);
    base.position.y = 0.025;
    group.add(base);

    this.environmentGroup.add(group);
  }

  private createCoffeeCounter(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const counterGeo = new THREE.BoxGeometry(10, 1.2, 2.5);
    const counterMat = new THREE.MeshStandardNodeMaterial({ color: 0x495057 });
    const counter = new THREE.Mesh(counterGeo, counterMat);
    counter.position.y = 0.6;
    group.add(counter);

    const topGeo = new THREE.BoxGeometry(10.2, 0.1, 2.7);
    const topMat = new THREE.MeshStandardNodeMaterial({ color: 0x212529 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 1.25;
    group.add(top);

    // Coffee machine
    const machineGeo = new THREE.BoxGeometry(1.5, 1.0, 1.2);
    const machine = new THREE.Mesh(machineGeo, new THREE.MeshStandardNodeMaterial({ color: 0xadb5bd, metalness: 0.8 }));
    machine.position.set(-2, 1.8, 0);
    group.add(machine);

    this.environmentGroup.add(group);
  }

  private createLargeMeetingTable(x: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const topGeo = new THREE.BoxGeometry(10, 0.15, 5);
    const topMat = new THREE.MeshStandardNodeMaterial({ color: 0x343a40, roughness: 0.2 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 1.0;
    group.add(top);

    const legGeo = new THREE.BoxGeometry(0.2, 1.0, 0.2);
    const legMat = new THREE.MeshStandardNodeMaterial({ color: 0x212529 });
    [[4.5, 0.5, 2], [-4.5, 0.5, 2], [4.5, 0.5, -2], [-4.5, 0.5, -2]].forEach(p => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(p[0], p[1], p[2]);
      group.add(leg);
    });

    this.environmentGroup.add(group);
  }

  private createPlant(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const potGeo = new THREE.CylinderGeometry(0.6, 0.4, 1.2, 16);
    const potMat = new THREE.MeshStandardNodeMaterial({ color: 0xadb5bd });
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.y = 0.6;
    group.add(pot);

    const leafGeo = new THREE.SphereGeometry(1.2, 8, 8);
    const leafMat = new THREE.MeshStandardNodeMaterial({ color: 0x2d6a4f });
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.y = 2.2;
    leaves.scale.set(1, 1.5, 1);
    group.add(leaves);

    this.environmentGroup.add(group);
  }

  private createZoneLabel(text: string, x: number, y: number, z: number) {
    // Visual marker for zones
    const markerGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.1, 32);
    const markerMat = new THREE.MeshBasicNodeMaterial({ color: 0x7EACEA, transparent: true, opacity: 0.3 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(x, 0.01, z);
    this.environmentGroup.add(marker);
  }

  public updateDimensions(radius: number) {
    const diameter = radius * 2;
    const gridDivisions = Math.round(diameter);

    if (this.plane) {
        this.scene.remove(this.plane);
        if (this.plane.geometry) this.plane.geometry.dispose();
        if (this.plane.material instanceof THREE.Material) this.plane.material.dispose();
    }
    if (this.gridHelper) {
        this.scene.remove(this.gridHelper);
        if (this.gridHelper.geometry) this.gridHelper.geometry.dispose();
        if (this.gridHelper.material instanceof THREE.Material) this.gridHelper.material.dispose();
    }

    const planeGeometry = new THREE.PlaneGeometry(diameter, diameter);
    planeGeometry.rotateX(-Math.PI / 2);
    
    // Create a tiled floor effect using TSL
    const uvNode = uv().mul(diameter / 4); // 4x4 units per tile
    const grid = sin(uvNode.x.mul(Math.PI)).mul(sin(uvNode.y.mul(Math.PI)));
    const tileColor = grid.smoothstep(0.9, 0.95).mix(vec3(0.95, 0.95, 0.95), vec3(0.9, 0.9, 0.9));

    const planeMaterial = new THREE.MeshStandardNodeMaterial({
      colorNode: vec4(tileColor, 1.0),
      roughness: 0.8,
      metalness: 0.1,
    });
    this.plane = new THREE.Mesh(planeGeometry, planeMaterial);
    this.plane.receiveShadow = true;
    this.plane.position.y = -0.012;
    this.scene.add(this.plane);

    this.gridHelper = new THREE.GridHelper(diameter, gridDivisions, 0xdee2e6, 0xf1f3f5);
    this.gridHelper.position.y = 0.001;
    this.scene.add(this.gridHelper);
  }

  public onResize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  public setFollowTarget(pos: THREE.Vector3 | null) {
    this.followTarget = pos ? pos.clone() : null;
  }

  public update() {
    const lerpTarget = this.followTarget
      ? new THREE.Vector3(this.followTarget.x, 0.8, this.followTarget.z)
      : this.defaultTarget;
    this.controls.target.lerp(lerpTarget, 0.06);
    this.controls.update();
  }
}
