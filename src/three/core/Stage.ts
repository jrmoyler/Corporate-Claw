import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createReferenceOffice } from '../architecture/ReferenceOffice';
import { OFFICE_CAMERA, resizeOfficeCamera } from './officeCamera';
export { OFFICE_CAMERA } from './officeCamera';
export class Stage {
  public scene = new THREE.Scene();
  public camera: THREE.OrthographicCamera;
  public controls: OrbitControls;
  private followTarget: THREE.Vector3 | null = null;
  private waypointIndicator: THREE.Mesh;
  constructor(rendererElement: HTMLElement) {
    this.scene.background=new THREE.Color(0xd8cfbd);
    this.camera=new THREE.OrthographicCamera(-24,24,24,-24,.1,250);
    this.camera.position.set(...OFFICE_CAMERA.position);
    this.controls=new OrbitControls(this.camera,rendererElement);
    this.controls.target.set(...OFFICE_CAMERA.target);
    this.controls.enableDamping=true;this.controls.dampingFactor=.06;
    this.controls.minZoom=.55;this.controls.maxZoom=3.5;
    this.controls.mouseButtons.LEFT=THREE.MOUSE.PAN;
    this.controls.touches.ONE=THREE.TOUCH.PAN;
    this.controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
    this.controls.minPolarAngle=Math.PI/7;this.controls.maxPolarAngle=Math.PI/2.2;
    this.scene.add(new THREE.HemisphereLight(0xfff6df,0x8b7e68,2));
    const sun=new THREE.DirectionalLight(0xfff1d5,3);
    sun.position.set(-18,42,26);sun.castShadow=true;
    Object.assign(sun.shadow.camera,{left:-43,right:43,top:43,bottom:-43,near:1,far:120});
    sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0002;sun.shadow.normalBias=.035;
    this.scene.add(sun,createReferenceOffice());
    const ring=new THREE.RingGeometry(.3,.42,32);ring.rotateX(-Math.PI/2);
    this.waypointIndicator=new THREE.Mesh(ring,new THREE.MeshBasicMaterial({color:0xb99b63,transparent:true,opacity:.8}));
    this.waypointIndicator.visible=false;this.scene.add(this.waypointIndicator);
    this.controls.update();
  }
  // The office has fixed architecture; worldSize controls simulation boundaries only.
  public updateDimensions(_radius:number) {}
  public updateWaypoint(pos:THREE.Vector3|null) {this.waypointIndicator.visible=!!pos;if(pos){this.waypointIndicator.position.copy(pos);this.waypointIndicator.position.y=.05;}}
  public onResize(width:number,height:number){resizeOfficeCamera(this.camera,width,height);}
  public setFollowTarget(pos:THREE.Vector3|null){this.followTarget=pos?.clone()??null;}
  public resetView(){this.followTarget=null;this.camera.zoom=1;this.camera.updateProjectionMatrix();this.camera.position.set(...OFFICE_CAMERA.position);this.controls.target.set(...OFFICE_CAMERA.target);this.controls.update();}
  public update(){if(this.followTarget)this.controls.target.lerp(this.followTarget.clone().setY(1.5),.06);this.controls.update();}
  public dispose(){this.controls.dispose();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();this.scene.traverse((o:any)=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);}});textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());this.scene.clear();}
}
