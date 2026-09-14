import * as T from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Shared skeletal adult figure, in world units. Each surface keeps its own material. */
export function createSuitedAgent() {
  const scene=new T.Group();scene.name='Tailored office colleague';
  const bones:T.Bone[]=[];
  function bone(name:string,x:number,y:number,z:number,parent?:T.Bone){const b=new T.Bone();b.name=name;b.position.set(x,y,z);(parent??scene).add(b);bones.push(b);return b;}
  const pelvis=bone('Pelvis',0,1.55,0),spine=bone('Spine',0,.3,0,pelvis),chest=bone('Chest',0,.5,0,spine),head=bone('Head',0,.48,0,chest);
  const leftArm=bone('LeftArm',-.4,-.04,0,chest),leftFore=bone('LeftForearm',0,-.48,0,leftArm);
  const rightArm=bone('RightArm',.4,-.04,0,chest),rightFore=bone('RightForearm',0,-.48,0,rightArm);
  const leftLeg=bone('LeftLeg',-.17,0,0,pelvis),leftShin=bone('LeftShin',0,-.72,0,leftLeg);
  const rightLeg=bone('RightLeg',.17,0,0,pelvis),rightShin=bone('RightShin',0,-.72,0,rightLeg);
  scene.updateMatrixWorld(true);
  const groups=new Map<string,T.BufferGeometry[]>();
  function part(name:string,b:T.Bone,shape:T.BufferGeometry,scale:[number,number,number],offset:[number,number,number]){
    shape.scale(...scale);const p=b.getWorldPosition(new T.Vector3());shape.translate(p.x+offset[0],p.y+offset[1],p.z+offset[2]);
    const g=shape.index?shape.toNonIndexed():shape;const n=g.getAttribute('position').count;
    const indices=new Uint16Array(n*4),weights=new Float32Array(n*4);for(let i=0;i<n;i++){indices[i*4]=bones.indexOf(b);weights[i*4]=1;}
    g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    const list=groups.get(name)??[];list.push(g);groups.set(name,list);
  }
  const sphere=()=>new T.SphereGeometry(1,12,10);
  const taper=(top:number,bottom:number,height:number)=>new T.CylinderGeometry(top,bottom,height,12);
  part('Suit',spine,taper(.36,.3,.78),[1,1,.56],[0,.16,0]);
  part('Suit',pelvis,sphere(),[.32,.22,.19],[0,0,0]);
  part('Shirt',chest,taper(.18,.10,.45),[1,1,.4],[0,-.13,.16]);
  // Separate lapels follow the torso, without tinting the shirt or skin.
  for(const s of [-1,1]){const shape=new T.Shape();shape.moveTo(s*.04,-.2);shape.lineTo(s*.28,.22);shape.lineTo(s*.15,.27);shape.lineTo(s*.06,.02);shape.closePath();part('Lapel',chest,new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false}),[1,1,1],[0,-.05,.205]);}
  part('Tie',chest,taper(.045,.025,.36),[1,1,.4],[0,-.16,.235]);
  for(const [arm,fore,s] of [[leftArm,leftFore,-1],[rightArm,rightFore,1]] as const){part('Suit',arm,sphere(),[.155,.18,.16],[0,-.03,0]);part('Suit',arm,taper(.135,.105,.47),[1,1,1],[0,-.235,0]);part('Suit',fore,taper(.105,.075,.44),[1,1,1],[0,-.22,0]);part('Shirt',fore,taper(.078,.078,.065),[1,1,1],[0,-.45,0]);part('Skin',fore,sphere(),[.075,.14,.07],[0,-.56,.015]);}
  for(const [leg,shin] of [[leftLeg,leftShin],[rightLeg,rightShin]]){part('Suit',leg,taper(.15,.11,.72),[1,1,1],[0,-.36,0]);part('Suit',shin,taper(.115,.085,.68),[1,1,1],[0,-.34,0]);part('Shoes',shin,sphere(),[.115,.105,.235],[0,-.72,.09]);}
  part('Skin',head,taper(.105,.11,.2),[1,1,1],[0,-.10,0]);
  part('Skin',head,sphere(),[.19,.265,.19],[0,.16,.005]);
  part('Skin',head,sphere(),[.045,.065,.07],[0,.15,.18]);
  for(const s of [-1,1]) {part('Skin',head,sphere(),[.036,.065,.04],[s*.185,.15,0]);part('Eyes',head,sphere(),[.023,.013,.012],[s*.073,.205,.178]);}
  part('Hair',head,new T.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI*.57),[.199,.275,.2],[0,.19,-.025]);
  const palette:Record<string,[number,number]>={Suit:[0x26343f,.9],Lapel:[0x1b2832,.8],Shirt:[0xf0ede5,.9],Tie:[0x243b4e,.65],Skin:[0xbf8e6b,.82],Shoes:[0x171b1b,.35],Hair:[0x29231e,.95],Eyes:[0x292728,.6]};
  const skeleton=new T.Skeleton(bones);
  for(const [name,list] of groups){const geometry=mergeGeometries(list)!;list.forEach(g=>g.dispose());const [color,roughness]=palette[name];const m=new T.MeshStandardMaterial({color,roughness});const mesh=new T.SkinnedMesh(geometry,m);mesh.name=name;mesh.castShadow=true;mesh.frustumCulled=false;scene.add(mesh);mesh.bind(skeleton);}
  function track(b:T.Bone,axis:string,values:number[],times=[0,.3,.6,.9,1.2]) {return new T.NumberKeyframeTrack(`${b.name}.rotation[${axis}]`,times,values);}
  const idle=new T.AnimationClip('Idle',2.4,[track(chest,'x',[0,.015,0,-.015,0],[0,.6,1.2,1.8,2.4])]);
  const walk=new T.AnimationClip('Walk',1.2,[track(leftLeg,'x',[.4,0,-.4,0,.4]),track(rightLeg,'x',[-.4,0,.4,0,-.4]),track(leftShin,'x',[0,.5,.12,0,0]),track(rightShin,'x',[.12,0,0,.5,.12]),track(leftArm,'x',[-.3,0,.3,0,-.3]),track(rightArm,'x',[.3,0,-.3,0,.3]),track(leftFore,'x',[-.15,-.25,-.15,-.1,-.15]),track(rightFore,'x',[-.15,-.1,-.15,-.25,-.15])]);
  const talk=new T.AnimationClip('Talk',1.2,[track(rightArm,'x',[-.25,-.4,-.25,-.3,-.25]),track(rightFore,'x',[-.8,-1,-.8,-.7,-.8]),track(head,'y',[0,.06,0,-.06,0])]);
  const sit=new T.AnimationClip('Sit',1.2,[track(leftLeg,'x',[-Math.PI/2,-Math.PI/2,-Math.PI/2,-Math.PI/2,-Math.PI/2]),track(rightLeg,'x',[-Math.PI/2,-Math.PI/2,-Math.PI/2,-Math.PI/2,-Math.PI/2]),track(leftShin,'x',[Math.PI/2,Math.PI/2,Math.PI/2,Math.PI/2,Math.PI/2]),track(rightShin,'x',[Math.PI/2,Math.PI/2,Math.PI/2,Math.PI/2,Math.PI/2]),track(leftArm,'x',[-.5,-.5,-.5,-.5,-.5]),track(rightArm,'x',[-.5,-.5,-.5,-.5,-.5]),track(leftFore,'x',[-.9,-.85,-.9,-.85,-.9]),track(rightFore,'x',[-.85,-.9,-.85,-.9,-.85])]);
  return {scene,animations:[idle,talk,walk,sit]};
}
