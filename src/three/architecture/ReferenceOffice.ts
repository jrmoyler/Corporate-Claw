import * as T from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DESK_ISLANDS, LOUNGES, MEETING, CAFE, RECEPTION, PARTITIONS, DIVIDERS } from '../../data/officeLayout';

/** The reference is an art-direction input; every furnishing is actual geometry. */
export function createReferenceOffice() {
  const root = new T.Group(); root.name = 'Reference office';
  const mat = (color: number, roughness=.65, metalness=0) => new T.MeshStandardMaterial({color,roughness,metalness});
  const ivory=mat(0xeae4d7), black=mat(0x202421,.4,.35), oak=mat(0x98704b), brass=mat(0xa89058,.3,.7), stone=mat(0xe4dfd3,.35), soil=mat(0x292820);
  let seed=193;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  function mesh(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,parent:T.Object3D=root) {
    const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material,parent:T.Object3D=root,r=.035) {
    return mesh(r ? new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)) : new T.BoxGeometry(w,h,d),m,x,y,z,parent);
  }
  function cyl(x:number,y:number,z:number,r:number,h:number,m:T.Material,parent:T.Object3D=root) {return mesh(new T.CylinderGeometry(r,r,h,24),m,x,y,z,parent);}
  function texture(kind:'wood'|'rug'|'marble'|'screen') {
    const c=document.createElement('canvas'); c.width=512;c.height=512;const ctx=c.getContext('2d')!;
    ctx.fillStyle=kind==='wood'?'#a78660':kind==='rug'?'#d7cbb5':kind==='marble'?'#272a29':'#bacad0';ctx.fillRect(0,0,512,512);
    if(kind==='wood') for(let i=0;i<2000;i++){ctx.strokeStyle=`rgba(45,28,10,${rand()*.13})`;ctx.lineWidth=rand()*1.5;ctx.beginPath();const y=rand()*512;ctx.moveTo(0,y);ctx.bezierCurveTo(170,y+rand()*9,330,y-4,512,y+2);ctx.stroke();}
    if(kind==='rug') for(let i=0;i<24000;i++){ctx.fillStyle=rand()>.5?'#e8dec9':'#b9ae98';ctx.globalAlpha=.2+rand()*.3;ctx.fillRect(rand()*512,rand()*512,1,3);}ctx.globalAlpha=1;
    if(kind==='marble') for(let i=0;i<15;i++){ctx.strokeStyle=`rgba(230,224,205,${.15+rand()*.35})`;ctx.lineWidth=.4+rand()*1.5;ctx.beginPath();let y=rand()*512;ctx.moveTo(0,y);for(let x=0;x<530;x+=20){y+=(rand()-.4)*70;ctx.lineTo(x,y);}ctx.stroke();}
    if(kind==='screen') {ctx.fillStyle='#173345';ctx.fillRect(0,0,512,52);ctx.fillStyle='#f4f2e9';ctx.fillRect(25,78,130,400);for(let i=0;i<7;i++){ctx.fillStyle=i%2?'#658b87':'#8ba1b0';ctx.fillRect(180,92+i*51,100+rand()*150,15);} }
    const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t;
  }
  const woodTexture=texture('wood');oak.map=woodTexture;
  // Herringbone parquet: shared geometry with per-plank color, two interlocking orientations.
  const plankGeo=new T.BoxGeometry(1.58,.045,.38);
  const plankMat=mat(0xffffff,.52);plankMat.map=woodTexture;
  const transforms:T.Matrix4[]=[];const colors:T.Color[]=[];const dummy=new T.Object3D();
  for(let row=-110;row<111;row++)for(let col=-40;col<41;col++)for(let flip=0;flip<2;flip++){
    // Exact interlocking 4:1 herringbone lattice before the 45-degree rotation.
    const u=col*1.6-row*.4+(flip?1.4:.8),v=col*1.6+row*.4+(flip?1.2:.2);
    const x=(u-v)*Math.SQRT1_2,z=(u+v)*Math.SQRT1_2;
    if(Math.abs(x)>45||Math.abs(z)>45)continue;
    dummy.position.set(x,-.035,z);dummy.rotation.y=-Math.PI/4-flip*Math.PI/2;dummy.updateMatrix();transforms.push(dummy.matrix.clone());colors.push(new T.Color().setHSL(.075+rand()*.02,.25+rand()*.12,.42+rand()*.2));
  }
  const floor=new T.InstancedMesh(plankGeo,plankMat,transforms.length);transforms.forEach((m,i)=>{floor.setMatrixAt(i,m);floor.setColorAt(i,colors[i]);});floor.receiveShadow=true;floor.name='Individual oak parquet';root.add(floor);
  box(0,-.13,0,200,.15,200,oak,root,0);
  const rugMat=mat(0xffffff,.98);rugMat.map=texture('rug');
  function rug(x:number,z:number,w:number,d:number){box(x,.018,z,w,.035,d,rugMat,root,.02);}
  // Each leaf is a curved surface, batched into a single mesh per plant.
  const leafMat=mat(0x31502b,.72);leafMat.side=T.DoubleSide;
  function plant(x:number,z:number,size=1,parent:T.Object3D=root,base=0) {
    const g=new T.Group();g.name='Broadleaf planter';g.position.set(x,base,z);g.scale.setScalar(size);parent.add(g);
    mesh(new T.CylinderGeometry(.52,.38,.85,20),stone,0,.425,0,g);cyl(0,.84,0,.46,.03,soil,g);
    const geo=new T.SphereGeometry(1,8,6);geo.scale(.16,.035,.58);
    const leaves=new T.InstancedMesh(geo,leafMat,28);const d=new T.Object3D();
    for(let i=0;i<28;i++){const a=i*2.399,h=.95+(i%7)*.22,r=.22+(i%4)*.16;d.position.set(Math.sin(a)*r,h,Math.cos(a)*r);d.rotation.set(.2+(i%3)*.3,a,.2);d.scale.setScalar(.6+rand()*.5);d.updateMatrix();leaves.setMatrixAt(i,d.matrix);}
    leaves.castShadow=true;g.add(leaves);cyl(0,1.25,0,.045,.85,oak,g);
  }
  function sign(text:string,x:number,y:number,z:number,w:number,h:number,bg='#e9e3d6',fg='#262a27',rotation=0){
    const c=document.createElement('canvas');c.width=768;c.height=768;const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,768,768);ctx.fillStyle=fg;ctx.textAlign='center';ctx.font='64px Georgia';const lines=text.split('|');lines.forEach((l,i)=>ctx.fillText(l,384,310+i*64-lines.length*20));
    const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;const m=mat(0xffffff);m.map=t;const g=new T.Group();g.position.set(x,y,z);g.rotation.y=rotation;root.add(g);box(0,0,-.03,w+.12,h+.12,.1,black,g);mesh(new T.PlaneGeometry(w,h),m,0,0,.035,g);return g;
  }
  for(const p of PARTITIONS){
    const group=new T.Group();group.name=p.glass?'Black framed glazing':'Ivory cutaway wall';root.add(group);
    if(!p.glass){box(p.x,p.h/2,p.z,p.w,p.h,p.d,ivory,group);box(p.x,.14,p.z,p.w+.08,.28,p.d+.08,stone,group);}
    else {const glass=new T.MeshPhysicalMaterial({color:0xcad4cd,transparent:true,opacity:.13,roughness:.12,metalness:.05,depthWrite:false});box(p.x,p.h/2,p.z,p.w,p.h,p.d,glass,group,0);const alongX=p.w>p.d,length=Math.max(p.w,p.d);for(let t=-length/2;t<=length/2+.01;t+=length/Math.ceil(length/3)){box(p.x+(alongX?t:0),p.h/2,p.z+(alongX?0:t),.09,p.h,.09,black,group,0);}for(const y of [.1,p.h])box(p.x,y,p.z,alongX?p.w:.1,.1,alongX?.1:p.d,black,group,0);}
  }
  function chair(x:number,z:number,rotation:number,color=0x183a32,office=false,parent:T.Object3D=root){const g=new T.Group();g.name=office?'Task chair':'Upholstered chair';g.position.set(x,0,z);g.rotation.y=rotation;parent.add(g);const cloth=mat(color,.96);box(0,.98,0,1.25,.25,1.25,cloth,g,.12);box(0,1.58,-.54,1.28,1.16,.23,cloth,g,.1);for(const s of [-1,1]){box(s*.64,1.3,0,.14,.16,.9,cloth,g);if(!office)for(const z of [-.45,.45])box(s*.5,.45,z,.08,.9,.08,black,g);}if(office){cyl(0,.5,0,.09,.9,black,g);for(let i=0;i<5;i++){const a=i*2*Math.PI/5;const leg=box(Math.sin(a)*.32,.15,Math.cos(a)*.32,.09,.1,.75,black,g);leg.rotation.y=a;cyl(Math.sin(a)*.65,.1,Math.cos(a)*.65,.1,.12,black,g);}}}
  function sofa(x:number,z:number,rotation:number,color:number){const g=new T.Group();g.name='Tailored three cushion sofa';g.position.set(x,0,z);g.rotation.y=rotation;root.add(g);const cloth=mat(color,.93);box(0,.56,0,7,.52,2.4,cloth,g,.15);box(0,1.5,-.95,7,1.65,.45,cloth,g,.16);for(let i=-1;i<=1;i++){box(i*2.02,.97,.05,1.95,.35,1.9,cloth,g,.13);box(i*2.02,1.63,-.65,1.95,1.25,.38,cloth,g,.16);}for(const s of [-1,1]){box(s*3.36,1.15,0,.4,1.3,2.4,cloth,g,.13);for(const zz of [-.8,.8])cyl(s*2.9,.22,zz,.07,.44,brass,g);}}
  function clubChair(x:number,z:number,rotation:number,color:number){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;root.add(g);const cloth=mat(color,.94);box(0,.65,0,2.3,.65,2.3,cloth,g,.22);box(0,1.05,.1,1.72,.35,1.75,cloth,g,.17);box(0,1.65,-.9,2.3,1.4,.5,cloth,g,.22);for(const side of [-1,1]){box(side*.98,1.25,0,.42,.85,2.3,cloth,g,.18);for(const zz of [-.7,.7])cyl(side*.8,.23,zz,.065,.4,brass,g);}}
  for(const l of LOUNGES){rug(l.x,l.z,12,12);sofa(l.x,l.z-3,0,l.color);clubChair(l.x-3,l.z+3,Math.PI+.3,l.color===0x174237?0x142c45:0x174237);clubChair(l.x+3,l.z+3,Math.PI-.3,l.color===0x174237?0x142c45:0x174237);const marble=mat(l.color===0x174237?0xe5dfd1:0x333839,.3);if(l.color!==0x174237)marble.map=texture('marble');cyl(l.x,.97,l.z+1,1.8,.18,marble);cyl(l.x,.45,l.z+1,.95,.85,black);plant(l.x,l.z+1,.28,root,1.08);plant(l.x-5,l.z-4,1.3);}
  const screenMat=mat(0xffffff,.4);screenMat.map=texture('screen');screenMat.emissive=new T.Color(0x263840);screenMat.emissiveIntensity=.18;
  DESK_ISLANDS.forEach(({x,z})=>{rug(x,z,12,8.5);box(x,1.65,z,9.8,.18,3.2,oak);for(const side of [-1,1])for(const dx of [-3,0,3]){const px=x+dx,pz=z+side*.7;box(px,1.25,z+side*.2,2.75,.72,.22,stone);box(px,1.1,z+side*.45,2.4,.8,.08,black);chair(px,z+side*2.6,side===-1?0:Math.PI,0x292d2d,true);const g=new T.Group();g.position.set(px,1.75,pz);g.rotation.y=side===1?0:Math.PI;root.add(g);box(0,.62,0,1.7,1.05,.1,black,g);mesh(new T.PlaneGeometry(1.58,.91),screenMat,0,.62,.056,g);box(0,.13,0,.1,.25,.1,black,g);box(0,.025,.05,.62,.045,.4,black,g);box(0,.015,.7,1.05,.04,.38,black,g);cyl(.85,.13,.65,.1,.23,stone,g);}for(const dx of [-4.4,4.4]){box(x+dx,.83,z,.25,1.6,3,black);plant(x+dx,z,.45,root,1.75);}});
  // Planted workstation dividers and perimeter offices continue beyond the cutaway.
  for(const [x,z] of DIVIDERS){
    box(x,.6,z,1.35,1.2,4.8,ivory);for(const dz of [-1.5,0,1.5])plant(x,z+dz,.65,root,.8);
  }
  for(const x of [-22,-7,8]){
    box(x,2.8,-36,12,5.6,.4,ivory);
    box(x-6,2.8,-32,.4,5.6,8,ivory);
    for(const dx of [-5,0,5])box(x+dx,2.8,-28,.08,5.6,.08,black);
    box(x,5.55,-28,10,.1,.1,black);
    box(x,1.6,-32,5,.18,2.3,oak);chair(x,-30,Math.PI,0x292d2d,true);
    box(x,2.15,-32,1.5,1,.1,black);plant(x+4,-34,1.2);
    sign('GOOD WORK|BUILDS GREAT|COMPANIES',x,3.5,-35.7,4,3.2);
  }
  box(-31,2.8,-6,.4,5.6,14,ivory);
  box(-23,2.8,29,13,5.6,.4,ivory);
  for(const [x,z] of [[-29,-17],[-30,4],[-18,26],[-1,25],[28,8],[-2,-23]])plant(x,z,1.35);
  // Conference table with eight chairs, visible through the glazed enclosure.
  rug(MEETING.x,MEETING.z,15,9);box(MEETING.x,1.55,MEETING.z,12,.2,3.8,oak);for(const dx of [-4.5,4.5])box(MEETING.x+dx,.75,MEETING.z,.2,1.5,3,black);
  for(let i=0;i<4;i++)for(const s of [-1,1])chair(MEETING.x-4.5+i*3,MEETING.z+s*3,s===-1?0:Math.PI,0x183a32,true);
  plant(MEETING.x-2,MEETING.z,.3,root,1.7);plant(MEETING.x+2,MEETING.z,.3,root,1.7);
  sign('BETTER|PEOPLE|BIGGER|TOMORROWS',14,3.7,-25.7,5.6,3.5,'#172d3e','#e7e5dd');
  sign('GOOD WORK|BUILDS GREAT|COMPANIES',26.72,3.4,17,4,3.7,'#e9e3d6','#262a27',-Math.PI/2);
  sign('A KINDER|MORE PRODUCTIVE|TOMORROW',-8,3.4,26.7,4.5,3.6,'#e9e3d6','#262a27',Math.PI);
  sign('A BRIGHTER|WORKPLACE|TOGETHER',-25,3.4,-14.7,6,3.6);
  // Living wall with layered foliage and a black stone welcome desk.
  box(18,2.85,1.35,10.8,4.7,.18,soil);
  const foliage=new T.InstancedMesh(new T.SphereGeometry(1,8,6),leafMat,650);
  for(let i=0;i<650;i++){const x=12.8+rand()*10.4,y=.65+rand()*4.35;dummy.position.set(x,y,1.55+rand()*.22);dummy.rotation.set(rand()*2,rand()*6,rand()*6);dummy.scale.set(.10+rand()*.12,.16+rand()*.23,.10);dummy.updateMatrix();foliage.setMatrixAt(i,dummy.matrix);foliage.setColorAt(i,new T.Color().setHSL(.23+rand()*.1,.35,.25+rand()*.18));}
  foliage.castShadow=true;root.add(foliage);
  sign('PEOPLE|IDEAS|PROGRESS',18,3.1,2.4,4.2,2.8,'#25392c','#d6bd85');
  const marble=mat(0xffffff,.3);marble.map=texture('marble');box(RECEPTION.x,1.15,RECEPTION.z,10,2.3,2,marble);box(RECEPTION.x,.12,RECEPTION.z+.98,10,.16,.08,brass);box(RECEPTION.x,2.35,RECEPTION.z,10.2,.15,2.1,marble);plant(11,9,1.1);
  box(17,2.6,8.8,1.5,.8,.1,black);chair(18,7,0,0x292d2d,true);
  // Bookshelf separates the cafe from circulation.
  box(24,2.2,-6,8,4.4,.65,oak);for(let row=0;row<3;row++){box(24,.65+row*1.35,-5.55,8,.12,1,oak);for(let j=0;j<21;j++){const bm=mat([0xd4c6ad,0x2d3e3e,0x7b6b53,0x383a3e][j%4]);box(20.3+j*.36,1.1+row*1.35,-5.55,.23,.7+rand()*.3,.58,bm);}}for(const x of [20,22.65,25.3,28])box(x,2.2,-5.55,.13,4.4,1,oak);
  rug(CAFE.x,CAFE.z,8,8);cyl(CAFE.x,1.45,CAFE.z,1.65,.14,stone);cyl(CAFE.x,.7,CAFE.z,.13,1.4,black);for(let i=0;i<4;i++){const a=i*Math.PI/2;chair(CAFE.x+Math.sin(a)*2.6,CAFE.z+Math.cos(a)*2.6,a+Math.PI);}
  box(24,1,-9,7,2,2,black);box(24,2.05,-9,7.2,.13,2.2,stone);box(24,2.65,-9,1,1.15,.7,black);box(24,2.8,-8.62,.6,.3,.04,stone);cyl(24,2.23,-8.5,.12,.25,stone);
  for(const [x,z] of [[0,-24],[25,-25],[27,-10],[16,6],[26,26],[-28,25],[-14,-13],[-15,0],[1,4]])plant(x,z,1.15);
  // Warm sconces and reception table lamp.
  for(const [x,z] of [[-27,-25.6],[13,1.6],[26.7,15]]){const bulb=new T.MeshStandardMaterial({color:0xffedc7,emissive:0xffdc92,emissiveIntensity:2});mesh(new T.SphereGeometry(.24,12,8),bulb,x,3.5,z);const light=new T.PointLight(0xffdfab,7,7,2);light.position.set(x,3.5,z+.5);root.add(light);}
  cyl(21.8,2.7,9,.06,.6,brass);mesh(new T.ConeGeometry(.38,.48,24),mat(0xffe8bd),21.8,3.1,9);
  // Batch opaque static surfaces by material values; leaves and parquet are already instanced.
  root.updateMatrixWorld(true);
  const batches=new Map<string,{material:T.Material;geometries:T.BufferGeometry[]}>();
  const originals:T.Mesh[]=[];
  root.traverse((o:any)=>{
    if(!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.transparent) return;
    const m=o.material, key=[m.color?.getHex(),m.roughness,m.metalness,m.map?.uuid,m.emissive?.getHex(),m.emissiveIntensity,m.side].join('/');
    const batch=batches.get(key)??{material:m,geometries:[]};
    batch.geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld));batches.set(key,batch);originals.push(o);
  });
  root.userData.parts=originals.length;
  originals.forEach(o=>{o.removeFromParent();o.geometry.dispose();});
  for(const {material,geometries} of batches.values()){
    // Primitive generators all provide position/normal/UV. Normalize indexing for merging.
    const normalized=geometries.map(g=>g.index?g.toNonIndexed():g);
    const g=mergeGeometries(normalized)!;const m=new T.Mesh(g,material);m.castShadow=m.receiveShadow=true;root.add(m);
    new Set([...geometries,...normalized]).forEach(g=>g.dispose());
  }
  const retained=new Set([...batches.values()].map(b=>b.material));
  originals.forEach(o=>{if(!retained.has(o.material as T.Material))(o.material as T.Material).dispose();});
  root.userData.reference='docs/visuals/user-office-reference.png';
  return root;
}
