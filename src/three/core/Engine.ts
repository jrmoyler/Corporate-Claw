
import * as THREE from 'three/webgpu';

export class Engine {
  public renderer: THREE.WebGPURenderer;
  public timer: THREE.Timer;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGPURenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    
    // Use default shadow map (PCF) as VSM support in WebGPU/NodeMaterial can be sensitive
    this.renderer.shadowMap.enabled = true;
    
    container.appendChild(this.renderer.domElement);
    this.timer = new THREE.Timer();
  }

  public async init() {
    try {
      await this.renderer.init();
    } catch (e) {
      console.error("Renderer initialization:", e);
      throw new Error("Your browser could not start the 3D renderer. Enable hardware acceleration and reload.");
    }
  }

  public onResize(width: number, height: number) {
    this.renderer.setSize(width, height);
  }

  public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer.render(scene, camera);
  }

  public dispose() {
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
