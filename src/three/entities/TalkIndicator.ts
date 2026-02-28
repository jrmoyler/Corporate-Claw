
import * as THREE from 'three/webgpu';
import { instanceIndex, float, vec3, vec4, Fn, uniform, time, uv, vec2 } from 'three/tsl';

export class TalkIndicator {
  private mesh: THREE.InstancedMesh;
  private count: number;
  private uTime = uniform(0);

  constructor(private scene: THREE.Scene, count: number) {
    this.count = count;
    
    // Simple speech bubble shape (diamond/square)
    const geometry = new THREE.PlaneGeometry(0.4, 0.4);
    
    const material = new THREE.MeshBasicNodeMaterial({
      color: 0xffffff,
      transparent: true,
      side: THREE.DoubleSide
    });

    // Custom TSL for instancing and visibility
    material.positionNode = Fn(() => {
      const index = instanceIndex;
      const agentData = this.agentStorage!.element(index); // wpX, wpY, wpZ, state
      const agentState = agentData.w;
      const posData = this.positionStorage!.element(index);
      const pos = posData.xyz;

      // Only show if state is TALK (3)
      const isTalk = agentState.greaterThan(float(2.5)).and(agentState.lessThan(float(3.5)));
      
      // Floating animation
      const floatOffset = time.mul(3.0).sin().mul(0.1).add(2.5);
      
      const finalPos = pos.add(vec3(0, floatOffset, 0));
      
      // Scale to zero if not talking
      const scale = isTalk.select(float(1.0), float(0.0));
      
      return vec4(finalPos, scale); // We'll use the .w for scaling in the vertex shader if needed, 
                                   // but PlaneGeometry doesn't use .w by default for position.
                                   // Actually, let's just multiply the local position by scale.
    })();

    // Wait, the above positionNode replaces the entire position. 
    // We need to combine it with the local vertex position.
    
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.mesh);
  }

  private agentStorage: any;
  private positionStorage: any;

  public setBuffers(agentStorage: any, positionStorage: any) {
    this.agentStorage = agentStorage;
    this.positionStorage = positionStorage;
    
    // Update the material with the buffers
    const mat = this.mesh.material as THREE.MeshBasicNodeMaterial;
    
    mat.positionNode = Fn(() => {
      const index = instanceIndex;
      const agentData = this.agentStorage.element(index);
      const agentState = agentData.w;
      const posData = this.positionStorage.element(index);
      const pos = posData.xyz;

      const isTalk = agentState.greaterThan(float(2.5)).and(agentState.lessThan(float(3.5)));
      const floatOffset = time.mul(3.0).sin().mul(0.05).add(2.6);
      
      const localPos = uv().sub(0.5).toVar();
      const scale = isTalk.select(float(1.0), float(0.0));
      
      const worldPos = pos.add(vec3(0, floatOffset, 0));
      
      // Basic billboarding
      return vec4(worldPos.add(vec3(localPos.x.mul(scale), localPos.y.mul(scale), 0)), 1.0);
    })();

    mat.colorNode = Fn(() => {
      const u = uv().toVar();
      const dist = u.sub(0.5).length();
      
      // Circle shape
      const circle = dist.lessThan(0.4);
      
      // Tail of the speech bubble
      const tail = u.x.greaterThan(0.4).and(u.x.lessThan(0.6)).and(u.y.greaterThan(0.8));
      
      const mask = circle.or(tail);
      
      // Dots animation
      const dot1 = u.sub(vec2(0.35, 0.5)).length().lessThan(0.04);
      const dot2 = u.sub(vec2(0.5, 0.5)).length().lessThan(0.04);
      const dot3 = u.sub(vec2(0.65, 0.5)).length().lessThan(0.04);
      
      const dotTime = time.mul(5.0);
      const showDot1 = dot1.and(dotTime.sin().greaterThan(0));
      const showDot2 = dot2.and(dotTime.add(1.0).sin().greaterThan(0));
      const showDot3 = dot3.and(dotTime.add(2.0).sin().greaterThan(0));
      
      const isDot = showDot1.or(showDot2).or(showDot3);
      
      const color = isDot.select(vec3(0.2), vec3(1.0));
      
      return vec4(color, mask.select(float(0.9), float(0.0)));
    })();
  }

  public update() {
    // TSL handles the updates automatically via uniforms like 'time'
  }

  public dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    if (this.mesh.material instanceof THREE.Material) this.mesh.material.dispose();
  }
}
