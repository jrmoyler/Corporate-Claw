import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { requestedRenderer } from './rendererPolicy';

export class Engine {
  public renderer: THREE.WebGLRenderer | WebGPURenderer;
  public timer = new THREE.Timer();
  public useGPU = false;
  private shaderFailure = false;
  private disposed = false;

  constructor(container: HTMLElement) {
    // Do not send the default office's shadow receivers through the TSL backend.
    // Retain WebGPU for explicit comparison until it has device-level evidence.
    const gpu = requestedRenderer(window.location.search) === 'webgpu';
    this.renderer = gpu
      ? new WebGPURenderer({ antialias: true })
      : new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.dataset.renderer = gpu ? 'webgpu' : 'webgl';
    if (!gpu) this.renderer.debug.onShaderError = (gl, program) => {
      this.shaderFailure = true;
      console.error('Office shader failed:', gl.getProgramInfoLog(program));
    };
    container.appendChild(this.renderer.domElement);
  }

  public async init() {
    if (this.renderer instanceof WebGPURenderer) {
      await this.renderer.init();
      this.useGPU = this.renderer.backend.isWebGPUBackend === true;
      // Never silently re-enter the fallback that produced the partial office.
      if (!this.useGPU) throw new Error('WebGPU is unavailable. Open the standard office view without ?renderer=webgpu.');
    }
  }

  public async renderFirstFrame(scene: THREE.Scene, camera: THREE.Camera) {
    await this.renderer.compileAsync(scene, camera);
    if (this.disposed) return;
    this.renderer.render(scene, camera);
    if (this.shaderFailure) throw new Error('The office could not be rendered completely. Please reload the office.');
  }

  public onResize(width: number, height: number) {
    this.renderer.setSize(Math.max(1, width), Math.max(1, height));
  }

  public render(scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer.render(scene, camera);
  }

  public dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
