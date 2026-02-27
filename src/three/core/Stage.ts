
import * as THREE from 'three/webgpu';
import { uv, sin, vec2, vec3, vec4 } from 'three/tsl';
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

  private fans: THREE.Group[] = [];
  private screens: THREE.Mesh[] = [];

  constructor(rendererElement: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a); // Darker background for better contrast
    this.environmentGroup = new THREE.Group();
    this.scene.add(this.environmentGroup);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(40, 35, 50);

    this.controls = new OrbitControls(this.camera, rendererElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.04;
    this.controls.rotateSpeed = 0.6;
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 150;
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
    // Global soft ambient - Warmer
    const ambientLight = new THREE.AmbientLight(0xfff4e0, 0.5 * Math.PI);
    this.scene.add(ambientLight);

    // Main directional light (Sun/Sky) - Warmer
    const dirLight = new THREE.DirectionalLight(0xfff8e1, 1.0 * Math.PI);
    dirLight.position.set(50, 60, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 300;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Warm interior accent lights (Grid of ceiling lights)
    const gridSpacing = 15;
    for (let x = -22.5; x <= 22.5; x += gridSpacing) {
      for (let z = -22.5; z <= 22.5; z += gridSpacing) {
        const pLight = new THREE.PointLight(0xfff4e0, 120, 40);
        pLight.position.set(x, 11, z);
        pLight.decay = 2;
        this.scene.add(pLight);
        
        // Visual light fixture
        const fixtureGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.15, 32);
        const fixtureMat = new THREE.MeshStandardNodeMaterial({ 
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: 2
        });
        const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
        fixture.position.set(x, 11.9, z);
        this.environmentGroup.add(fixture);
      }
    }

    // Reception accent light
    const recLight = new THREE.PointLight(0x7EACEA, 150, 20);
    recLight.position.set(-15, 5, 20); // Sync with officeLayout.ts
    this.scene.add(recLight);
  }

  private createOfficeEnvironment() {
    this.environmentGroup.clear();

    // 1. Walls & Floor refinement
    this.createWalls();
    this.createFloors();

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
      } else if (slot.type === 'RECEPTION') {
        this.createReceptionDesk(slot.position.x, slot.position.z, slot.rotation);
      } else if (slot.type === 'SOFA') {
        this.createSofa(slot.position.x, slot.position.z, slot.rotation);
      }
    });

    // Extra decor
    this.createKitchenCounters();
    this.createCoffeeTable(4, 15);
    this.createDumbbellRack(22, 22);
    this.createCeilingFans();
    this.createDustParticles();
    
    // More plants for ambience
    this.createPlant(-28, 0, -28);
    this.createPlant(28, 0, -28);
    this.createPlant(28, 0, 28);
    this.createPlant(-28, 0, 28);
    this.createPlant(-10, 0, 10);
    this.createPlant(10, 0, 10);
    this.createPlant(0, 0, -20);
    this.createPlant(0, 0, -28);
    this.createPlant(0, 0, 28);

    // Trash cans
    this.createTrashCan(-22, -22);
    this.createTrashCan(-6, -22);
    this.createTrashCan(-22, -6);
    this.createTrashCan(-6, -6);
    this.createTrashCan(10, -22);

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

  private createSofa(x: number, z: number, rotation: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    const mat = new THREE.MeshStandardNodeMaterial({ color: 0x8B5A2B, roughness: 0.9 }); // Brown sofa
    
    // Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 1.5), mat);
    base.position.y = 0.25;
    group.add(base);

    // Backrest
    const back = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 0.4), mat);
    back.position.set(0, 1.1, -0.55);
    group.add(back);

    // Armrests
    const armGeo = new THREE.BoxGeometry(0.4, 0.8, 1.5);
    const armL = new THREE.Mesh(armGeo, mat);
    armL.position.set(-1.8, 0.9, 0);
    group.add(armL);
    
    const armR = new THREE.Mesh(armGeo, mat);
    armR.position.set(1.8, 0.9, 0);
    group.add(armR);

    // Cushions
    const cushionGeo = new THREE.BoxGeometry(1.5, 0.2, 1.1);
    const cushionL = new THREE.Mesh(cushionGeo, mat);
    cushionL.position.set(-0.8, 0.6, 0.2);
    group.add(cushionL);

    const cushionR = new THREE.Mesh(cushionGeo, mat);
    cushionR.position.set(0.8, 0.6, 0.2);
    group.add(cushionR);

    this.environmentGroup.add(group);
  }

  private createCoffeeTable(x: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const mat = new THREE.MeshStandardNodeMaterial({ color: 0x8B4513, roughness: 0.6 }); // Wood
    const top = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 2), mat);
    top.position.y = 0.6;
    group.add(top);

    const legGeo = new THREE.BoxGeometry(0.1, 0.6, 0.1);
    const legMat = new THREE.MeshStandardNodeMaterial({ color: 0x222222 });
    
    const positions = [
      [-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]
    ];
    positions.forEach(pos => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(pos[0], 0.3, pos[1]);
      group.add(leg);
    });

    // Books on table
    const bookMat1 = new THREE.MeshStandardNodeMaterial({ color: 0x3b82f6 });
    const book1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.6), bookMat1);
    book1.position.set(0.5, 0.675, 0.2);
    book1.rotation.y = 0.2;
    group.add(book1);

    const bookMat2 = new THREE.MeshStandardNodeMaterial({ color: 0xef4444 });
    const book2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.6), bookMat2);
    book2.position.set(0.5, 0.725, 0.2);
    book2.rotation.y = 0.1;
    group.add(book2);

    const bookMat3 = new THREE.MeshStandardNodeMaterial({ color: 0x10b981 });
    const book3 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.6), bookMat3);
    book3.position.set(-0.5, 0.675, -0.2);
    book3.rotation.y = -0.3;
    group.add(book3);

    this.environmentGroup.add(group);
  }

  private createKitchenCounters() {
    const group = new THREE.Group();
    // Kitchen is top right (X: 10 to 25, Z: -25 to -15)
    
    // Main counter along back wall
    const counterGeo = new THREE.BoxGeometry(15, 1.2, 2);
    const cabinetMat = new THREE.MeshStandardNodeMaterial({ color: 0x966F33, roughness: 0.8 }); // Light wood cabinets
    const counter = new THREE.Mesh(counterGeo, cabinetMat);
    counter.position.set(17.5, 0.6, -24);
    group.add(counter);

    // Countertop
    const topGeo = new THREE.BoxGeometry(15.2, 0.1, 2.2);
    const topMat = new THREE.MeshStandardNodeMaterial({ color: 0x1a1a1a, roughness: 0.3 }); // Dark stone
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(17.5, 1.25, -24);
    group.add(top);

    // Sink
    const sinkGeo = new THREE.BoxGeometry(1.5, 0.05, 1);
    const sinkMat = new THREE.MeshStandardNodeMaterial({ color: 0x888888, metalness: 0.5, roughness: 0.2 });
    const sink = new THREE.Mesh(sinkGeo, sinkMat);
    sink.position.set(20, 1.3, -24);
    group.add(sink);

    // Upper cabinets
    const upperGeo = new THREE.BoxGeometry(15, 1.5, 1);
    const upper = new THREE.Mesh(upperGeo, cabinetMat);
    upper.position.set(17.5, 4, -24.5);
    group.add(upper);

    // Water cooler
    const coolerGeo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
    const coolerMat = new THREE.MeshStandardNodeMaterial({ color: 0xdddddd }); // Off-white/Light grey base
    const cooler = new THREE.Mesh(coolerGeo, coolerMat);
    cooler.position.set(9, 0.6, -24);
    group.add(cooler);

    const bottleGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16);
    const bottleMat = new THREE.MeshStandardNodeMaterial({ color: 0x00aaff, transparent: true, opacity: 0.4 }); // Blue bottle
    const bottle = new THREE.Mesh(bottleGeo, bottleMat);
    bottle.position.set(9, 1.6, -24);
    group.add(bottle);

    // Mugs on counter
    const mugGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 12);
    const mugColors = [0xffffff, 0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b];
    for (let i = 0; i < 5; i++) {
      const mugMat = new THREE.MeshStandardNodeMaterial({ color: mugColors[i % mugColors.length] });
      const mug = new THREE.Mesh(mugGeo, mugMat);
      mug.position.set(12 + i * 0.4, 1.35, -23.5);
      group.add(mug);
    }

    this.environmentGroup.add(group);
  }

  private createReceptionDesk(x: number, z: number, rotation: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    // Main desk body - Dark Grey/Black
    const bodyGeo = new THREE.BoxGeometry(6, 1.1, 1.5);
    const bodyMat = new THREE.MeshStandardNodeMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.55;
    group.add(body);

    // Dark base
    const baseGeo = new THREE.BoxGeometry(6.1, 0.2, 1.6);
    const baseMat = new THREE.MeshStandardNodeMaterial({ color: 0x000000 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.1;
    group.add(base);

    // Top surface - Light Oak
    const topGeo = new THREE.BoxGeometry(6.2, 0.1, 1.7);
    const topMat = new THREE.MeshStandardNodeMaterial({ color: 0xd2b48c, roughness: 0.6 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 1.15;
    group.add(top);

    // White partition wall behind desk
    const wallGeo = new THREE.BoxGeometry(8, 4, 0.5);
    const wallMat = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.9 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 2, -1.5);
    group.add(wall);

    // Corporate Logo on wall (matching reference)
    const logoGroup = new THREE.Group();
    logoGroup.position.set(0, 2.5, -1.24);
    
    // The "C" icon
    const logoIconGeo = new THREE.TorusGeometry(0.35, 0.1, 16, 32, Math.PI * 1.5);
    const logoIconMat = new THREE.MeshStandardNodeMaterial({ color: 0x7EACEA, emissive: 0x7EACEA, emissiveIntensity: 0.5 });
    const logoIcon = new THREE.Mesh(logoIconGeo, logoIconMat);
    logoIcon.position.x = -1.2;
    logoIcon.rotation.z = Math.PI / 4;
    logoGroup.add(logoIcon);

    // Inner dot of the "C"
    const dotGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const dot = new THREE.Mesh(dotGeo, logoIconMat);
    dot.position.set(-1.2, 0, 0);
    logoGroup.add(dot);

    // "Corporate Claw" text placeholder
    const logoTextGeo = new THREE.PlaneGeometry(2.5, 0.8);
    const logoTextMat = new THREE.MeshStandardNodeMaterial({ color: 0x222222, transparent: true, opacity: 0.9 });
    const logoText = new THREE.Mesh(logoTextGeo, logoTextMat);
    logoText.position.x = 0.6;
    logoGroup.add(logoText);
    
    group.add(logoGroup);

    // Floor Decal for Reception Zone
    const decalGeo = new THREE.PlaneGeometry(8, 4);
    decalGeo.rotateX(-Math.PI / 2);
    const decalMat = new THREE.MeshStandardNodeMaterial({ 
      color: 0x7EACEA, 
      transparent: true, 
      opacity: 0.1,
      roughness: 1
    });
    const decal = new THREE.Mesh(decalGeo, decalMat);
    decal.position.set(0, 0.01, 2); // In front of desk
    group.add(decal);

    this.environmentGroup.add(group);
  }

  private createWalls() {
    const wallMat = new THREE.MeshStandardNodeMaterial({ color: 0xf5f2ed, roughness: 0.9 }); // Warm cream
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

    // Entrance wall (with opening for reception)
    const entWallGeo = new THREE.BoxGeometry(28, 12, 1);
    const entWallL = new THREE.Mesh(entWallGeo, wallMat);
    entWallL.position.set(-17, 6, 31);
    this.environmentGroup.add(entWallL);

    const entWallR = new THREE.Mesh(entWallGeo, wallMat);
    entWallR.position.set(17, 6, 31);
    this.environmentGroup.add(entWallR);

    // Windows on the side walls
    const windowGeo = new THREE.PlaneGeometry(8, 6);
    const windowMat = new THREE.MeshStandardNodeMaterial({ 
      color: 0x87ceeb, 
      emissive: 0x87ceeb, 
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.8
    });
    
    for (let z = -20; z <= 20; z += 20) {
      const winL = new THREE.Mesh(windowGeo, windowMat);
      winL.position.set(-30.45, 6, z);
      winL.rotation.y = Math.PI / 2;
      this.environmentGroup.add(winL);

      const winR = new THREE.Mesh(windowGeo, windowMat);
      winR.position.set(30.45, 6, z);
      winR.rotation.y = -Math.PI / 2;
      this.environmentGroup.add(winR);
    }

    // Glass entrance
    const glassGeo = new THREE.BoxGeometry(6, 12, 0.1);
    const glassMat = new THREE.MeshStandardNodeMaterial({ 
      color: 0x7EACEA, 
      transparent: true, 
      opacity: 0.1,
      metalness: 0.9,
      roughness: 0
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 6, 31);
    this.environmentGroup.add(glass);

    // Baseboards
    const bbMat = new THREE.MeshStandardNodeMaterial({ color: 0x212529 });
    const bbGeo = new THREE.BoxGeometry(62, 0.4, 1.1);
    const bb1 = new THREE.Mesh(bbGeo, bbMat);
    bb1.position.set(0, 0.2, -30.9);
    this.environmentGroup.add(bb1);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(62, 62);
    ceilGeo.rotateX(Math.PI / 2);
    const ceilMat = new THREE.MeshStandardNodeMaterial({ color: 0xf5f2ed, roughness: 1 }); // Warm cream
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.position.y = 12;
    this.environmentGroup.add(ceil);
  }

  private createFloors() {
    // Desk Area Carpet (Top Left)
    const carpetGeo = new THREE.PlaneGeometry(30, 30);
    carpetGeo.rotateX(-Math.PI / 2);
    
    const carpetUV = uv().mul(100.0);
    const carpetNoise = sin(carpetUV.x).mul(sin(carpetUV.y)).mul(0.02);
    const carpetBase = vec3(0.92, 0.9, 0.88); // Light Beige (matching reference)
    const carpetColor = carpetBase.add(carpetNoise);
    
    const carpetMat = new THREE.MeshStandardNodeMaterial({
      colorNode: vec4(carpetColor, 1.0),
      roughness: 0.9,
      metalness: 0.0
    });
    const deskCarpet = new THREE.Mesh(carpetGeo, carpetMat);
    deskCarpet.receiveShadow = true;
    deskCarpet.position.set(-15, 0.01, -15);
    this.environmentGroup.add(deskCarpet);

    // Gym Area Mat (Bottom Right)
    const gymGeo = new THREE.PlaneGeometry(20, 25);
    gymGeo.rotateX(-Math.PI / 2);
    const gymMat = new THREE.MeshStandardNodeMaterial({ color: 0x6d4c41, roughness: 0.8 }); // Muted brown-red
    const gymFloor = new THREE.Mesh(gymGeo, gymMat);
    gymFloor.receiveShadow = true;
    gymFloor.position.set(20, 0.01, 17.5);
    this.environmentGroup.add(gymFloor);

    // Lounge Rug (Bottom Middle)
    const rugGeo = new THREE.PlaneGeometry(12, 10);
    rugGeo.rotateX(-Math.PI / 2);
    const rugMat = new THREE.MeshStandardNodeMaterial({ color: 0xeeeeee, roughness: 0.9 });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.receiveShadow = true;
    rug.position.set(4, 0.02, 15);
    this.environmentGroup.add(rug);
  }

  private createDesk(x: number, z: number) {
    const deskGroup = new THREE.Group();
    deskGroup.position.set(x, 0, z);

    // Table top - Light Oak (matching reference)
    const topGeo = new THREE.BoxGeometry(1.6, 0.1, 0.8);
    const topMat = new THREE.MeshStandardNodeMaterial({ color: 0xd2b48c, roughness: 0.6 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 0.75;
    top.castShadow = true;
    top.receiveShadow = true;
    deskGroup.add(top);

    // Modern frame - Dark Grey
    const frameMat = new THREE.MeshStandardNodeMaterial({ color: 0x2c2c2c, metalness: 0.2, roughness: 0.8 });
    const legGeo = new THREE.BoxGeometry(0.05, 0.75, 0.05);
    [[0.75, 0.375, 0.35], [-0.75, 0.375, 0.35], [0.75, 0.375, -0.35], [-0.75, 0.375, -0.35]].forEach(p => {
      const leg = new THREE.Mesh(legGeo, frameMat);
      leg.position.set(p[0], p[1], p[2]);
      deskGroup.add(leg);
    });

    // Dual Monitors
    const standGeo = new THREE.BoxGeometry(0.15, 0.3, 0.15);
    const stand = new THREE.Mesh(standGeo, frameMat);
    stand.position.set(0, 0.9, -0.2);
    deskGroup.add(stand);

    const screenGeo = new THREE.BoxGeometry(0.6, 0.4, 0.03);
    const screenMat = new THREE.MeshStandardNodeMaterial({ 
      color: 0x111111, 
      emissive: 0x111111, 
      emissiveIntensity: 0.5 
    });
    
    // Triple Monitor Setup
    const screenL = new THREE.Mesh(screenGeo, screenMat);
    screenL.position.set(-0.55, 1.15, -0.15);
    screenL.rotation.y = Math.PI / 6;
    deskGroup.add(screenL);
    this.screens.push(screenL);

    const screenC = new THREE.Mesh(screenGeo, screenMat);
    screenC.position.set(0, 1.15, -0.2);
    deskGroup.add(screenC);
    this.screens.push(screenC);

    const screenR = new THREE.Mesh(screenGeo, screenMat);
    screenR.position.set(0.55, 1.15, -0.15);
    screenR.rotation.y = -Math.PI / 6;
    deskGroup.add(screenR);
    this.screens.push(screenR);

    // Keyboard
    const kbGeo = new THREE.BoxGeometry(0.4, 0.02, 0.15);
    const kb = new THREE.Mesh(kbGeo, frameMat);
    kb.position.set(0, 0.81, 0.15);
    deskGroup.add(kb);

    // Desk Mug
    const mugGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 12);
    const mugMat = new THREE.MeshStandardNodeMaterial({ color: 0x3b82f6 });
    const mug = new THREE.Mesh(mugGeo, mugMat);
    mug.position.set(0.6, 0.85, 0.1);
    deskGroup.add(mug);

    // Chair
    this.createChair(0, 0.5, Math.PI, deskGroup);

    this.environmentGroup.add(deskGroup);
  }

  private createChair(x: number, z: number, rotation: number, parent: THREE.Group | THREE.Scene = this.environmentGroup) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    const mat = new THREE.MeshStandardNodeMaterial({ color: 0x343a40, roughness: 0.5 });
    
    // Seat
    const seatGeo = new THREE.BoxGeometry(0.5, 0.08, 0.5);
    const seat = new THREE.Mesh(seatGeo, mat);
    seat.position.y = 0.45;
    group.add(seat);

    // Back
    const backGeo = new THREE.BoxGeometry(0.5, 0.6, 0.08);
    const back = new THREE.Mesh(backGeo, mat);
    back.position.set(0, 0.75, -0.21);
    group.add(back);

    // Stem
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8);
    const stem = new THREE.Mesh(stemGeo, mat);
    stem.position.y = 0.2;
    group.add(stem);

    // Base
    const baseGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16);
    const base = new THREE.Mesh(baseGeo, mat);
    base.position.y = 0.025;
    group.add(base);

    if (parent instanceof THREE.Group) {
      parent.add(group);
    } else {
      this.environmentGroup.add(group);
    }
  }

  private createDumbbellRack(x: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const metalMat = new THREE.MeshStandardNodeMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 });
    const weightMat = new THREE.MeshStandardNodeMaterial({ color: 0x111111, roughness: 0.8 });

    // Rack frame
    const frameGeo = new THREE.BoxGeometry(0.1, 1.2, 0.4);
    const frameL = new THREE.Mesh(frameGeo, metalMat);
    frameL.position.set(-1.5, 0.6, 0);
    group.add(frameL);
    
    const frameR = new THREE.Mesh(frameGeo, metalMat);
    frameR.position.set(1.5, 0.6, 0);
    group.add(frameR);

    // Shelves
    const shelfGeo = new THREE.BoxGeometry(3.1, 0.05, 0.3);
    for (let y = 0.3; y <= 1.1; y += 0.4) {
      const shelf = new THREE.Mesh(shelfGeo, metalMat);
      shelf.position.set(0, y, 0);
      shelf.rotation.x = Math.PI / 12; // Slanted shelf
      group.add(shelf);

      // Dumbbells on shelf
      for (let dx = -1.2; dx <= 1.2; dx += 0.6) {
        const dbGroup = new THREE.Group();
        dbGroup.position.set(dx, y + 0.1, 0);
        
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2), metalMat);
        handle.rotation.z = Math.PI / 2;
        dbGroup.add(handle);

        const weightGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.05);
        const w1 = new THREE.Mesh(weightGeo, weightMat);
        w1.position.x = -0.1;
        w1.rotation.z = Math.PI / 2;
        dbGroup.add(w1);

        const w2 = new THREE.Mesh(weightGeo, weightMat);
        w2.position.x = 0.1;
        w2.rotation.z = Math.PI / 2;
        dbGroup.add(w2);

        group.add(dbGroup);
      }
    }

    this.environmentGroup.add(group);
  }

  private createTrashCan(x: number, z: number) {
    const geo = new THREE.CylinderGeometry(0.25, 0.2, 0.5, 16);
    const mat = new THREE.MeshStandardNodeMaterial({ color: 0x444444, roughness: 0.8 });
    const can = new THREE.Mesh(geo, mat);
    can.position.set(x, 0.25, z);
    this.environmentGroup.add(can);
  }

  private createTreadmill(x: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const mat = new THREE.MeshStandardNodeMaterial({ color: 0x212529, roughness: 0.4 });
    
    // Belt
    const beltGeo = new THREE.BoxGeometry(0.9, 0.15, 2.2);
    const belt = new THREE.Mesh(beltGeo, mat);
    belt.position.y = 0.075;
    group.add(belt);

    // Side rails
    const railGeo = new THREE.BoxGeometry(0.1, 0.2, 2.2);
    const railMat = new THREE.MeshStandardNodeMaterial({ color: 0x495057 });
    const railL = new THREE.Mesh(railGeo, railMat);
    railL.position.set(-0.5, 0.15, 0);
    group.add(railL);
    const railR = new THREE.Mesh(railGeo, railMat);
    railR.position.set(0.5, 0.15, 0);
    group.add(railR);

    // Console posts
    const postGeo = new THREE.BoxGeometry(0.08, 1.2, 0.08);
    const postL = new THREE.Mesh(postGeo, mat);
    postL.position.set(-0.45, 0.6, 1.0);
    group.add(postL);
    const postR = new THREE.Mesh(postGeo, mat);
    postR.position.set(0.45, 0.6, 1.0);
    group.add(postR);

    // Console
    const consoleGeo = new THREE.BoxGeometry(1.1, 0.3, 0.4);
    const console = new THREE.Mesh(consoleGeo, mat);
    console.position.set(0, 1.2, 1.0);
    group.add(console);

    this.environmentGroup.add(group);
  }

  private createCafeTable(x: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Table top - White marble look
    const topGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.08, 32);
    const topMat = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.1 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 0.75;
    group.add(top);

    // Chrome leg
    const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.75, 16);
    const legMat = new THREE.MeshStandardNodeMaterial({ color: 0xadb5bd, metalness: 0.9, roughness: 0.1 });
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.y = 0.375;
    group.add(leg);

    const baseGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.03, 32);
    const base = new THREE.Mesh(baseGeo, legMat);
    base.position.y = 0.015;
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

    const topGeo = new THREE.BoxGeometry(5, 0.1, 2.5);
    const topMat = new THREE.MeshStandardNodeMaterial({ color: 0x343a40, roughness: 0.2 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 0.75;
    group.add(top);

    const legGeo = new THREE.BoxGeometry(0.1, 0.75, 0.1);
    const legMat = new THREE.MeshStandardNodeMaterial({ color: 0x212529 });
    [[2.2, 0.375, 1], [-2.2, 0.375, 1], [2.2, 0.375, -1], [-2.2, 0.375, -1]].forEach(p => {
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
    
    // Create a realistic wood texture using TSL
    const uvNode = uv().mul(vec2(10.0, 50.0));
    const woodNoise = sin(uvNode.x.add(sin(uvNode.y).mul(0.5))).mul(0.05);
    const woodBase = vec3(0.95, 0.85, 0.65); // Light Oak (matching reference)
    const woodColor = woodBase.add(woodNoise);

    const planeMaterial = new THREE.MeshStandardNodeMaterial({
      colorNode: vec4(woodColor, 1.0),
      roughness: 0.4,
      metalness: 0.1,
    });
    this.plane = new THREE.Mesh(planeGeometry, planeMaterial);
    this.plane.receiveShadow = true;
    this.plane.position.y = -0.012;
    this.scene.add(this.plane);

    this.gridHelper = new THREE.GridHelper(diameter, gridDivisions, 0x8B6508, 0x8B6508);
    this.gridHelper.position.y = 0.001;
    this.gridHelper.material.transparent = true;
    this.gridHelper.material.opacity = 0.1;
    this.scene.add(this.gridHelper);
  }

  private createCeilingFans() {
    const fanGeo = new THREE.BoxGeometry(3, 0.05, 0.2);
    const fanMat = new THREE.MeshStandardNodeMaterial({ color: 0x333333 });
    
    for (let x = -20; x <= 20; x += 20) {
      for (let z = -20; z <= 20; z += 20) {
        const fanGroup = new THREE.Group();
        fanGroup.position.set(x, 11.8, z);
        
        for (let i = 0; i < 3; i++) {
          const blade = new THREE.Mesh(fanGeo, fanMat);
          blade.rotation.y = (i / 3) * Math.PI * 2;
          fanGroup.add(blade);
        }
        
        this.environmentGroup.add(fanGroup);
        this.fans.push(fanGroup);
      }
    }
  }

  private createDustParticles() {
    const count = 1000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = Math.random() * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ 
      color: 0xffffff, 
      size: 0.05, 
      transparent: true, 
      opacity: 0.2 
    });
    const points = new THREE.Points(geo, mat);
    this.environmentGroup.add(points);
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

    // Animations
    const time = Date.now() * 0.001;
    this.fans.forEach(fan => {
      fan.rotation.y += 0.1;
    });

    this.screens.forEach((screen, i) => {
      const intensity = 0.4 + Math.sin(time * 2 + i) * 0.1;
      (screen.material as any).emissiveIntensity = intensity;
    });
  }
}
