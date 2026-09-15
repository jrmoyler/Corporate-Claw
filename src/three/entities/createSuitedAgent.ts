import * as T from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Adult proportions in world units. Stature 3.23 with the hip joint pinned at
 * 1.55 so the rig still meets the office seat and desk heights, which puts the
 * head at 1/7.5 of stature, the shoulder at 0.80 and the knee at 0.26.
 */
const STATURE = 3.23, HIP = 1.55, SPINE_Y = 1.81, SHOULDER = 2.64, HEAD_Y = 2.79;
const SEAT_THIGH = 1.0, TORSO_DEPTH = .68, SKULL: [number, number, number] = [.137, .215, .185], SKULL_AT: [number, number, number] = [0, .212, -.012];

/** Sip anchors shared by the Coffee clip and its regression test, local to the named bone. */
export const CUP_ON_FOREARM: [number, number, number] = [0, -.55, .075];
export const MOUTH_ON_HEAD: [number, number, number] = [0, .076, .142];

/** Lathe half-section of the jacket, as [height above the spine bone, radius]. */
const JACKET: [number, number][] = [[-.41,.33],[-.34,.365],[-.14,.355],[.02,.325],[.20,.355],[.38,.375],[.62,.374],[.74,.368],[.80,.352],[.83,.30],[.86,.20],[.88,.105]];
const NECK = .098;

function sample(curve: [number, number][], y: number) {
  if (y <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) if (y <= curve[i][0]) {
    const [y0,r0] = curve[i-1], [y1,r1] = curve[i];
    return r0 + (r1 - r0) * (y - y0) / (y1 - y0);
  }
  return curve[curve.length-1][1];
}
// Every garment rides the one jacket shell, so no panel can sink inside it.
const jacketRadius = (y: number) => sample(JACKET, y - SPINE_Y);
const neckRadius = () => NECK;

/** A point on the torso (or neck) surface, lifted along its outward normal. */
function onBody(y: number, phi: number, lift: number, radius = jacketRadius, depth = TORSO_DEPTH): [number, number, number] {
  const r = radius(y), s = Math.sin(phi), c = Math.cos(phi), n = Math.hypot(s, c / depth);
  return [r * s + (s / n) * lift, y, r * c * depth + (c / depth / n) * lift];
}

interface PanelOptions {
  y0: number; y1: number;
  /** Azimuth of the panel's two edges, in radians from the front, over its height. */
  a0: (t: number) => number; a1: (t: number) => number;
  lift: number; thick?: number; rows?: number; cols?: number;
  radius?: (y: number) => number; depth?: number;
}

/**
 * A garment panel wrapped onto the torso: shirt fronts, lapels, collars and
 * straps sit on the body instead of floating as flat slabs in front of it.
 */
function panel({ y0, y1, a0, a1, lift, thick = .018, rows = 6, cols = 5, radius = jacketRadius, depth = TORSO_DEPTH }: PanelOptions) {
  const position: number[] = [], uv: number[] = [], index: number[] = [];
  const layer = (offset: number) => {
    const base = position.length / 3;
    for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
      const t = i / rows, u = j / cols, y = y0 + (y1 - y0) * t;
      position.push(...onBody(y, a0(t) + (a1(t) - a0(t)) * u, offset, radius, depth));
      uv.push(u, t);
    }
    return base;
  };
  return stitch(position, uv, index, layer(lift), layer(lift - thick), rows, cols);
}

/** Closes two vertex layers of the same (rows x cols) grid into a solid with rim faces. */
function stitch(position: number[], uv: number[], index: number[], outer: number, inner: number, rows: number, cols: number) {
  const w = cols + 1, quad = (a: number, b: number, c: number, d: number) => index.push(a, b, c, a, c, d);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const o = outer + i * w + j, n = inner + i * w + j;
    quad(o, o + w, o + w + 1, o + 1); quad(n, n + 1, n + w + 1, n + w);
  }
  for (let i = 0; i < rows; i++) {
    quad(outer + i * w, inner + i * w, inner + (i + 1) * w, outer + (i + 1) * w);
    quad(inner + i * w + cols, outer + i * w + cols, outer + (i + 1) * w + cols, inner + (i + 1) * w + cols);
  }
  for (let j = 0; j < cols; j++) {
    quad(outer + j, outer + j + 1, inner + j + 1, inner + j);
    quad(inner + rows * w + j, inner + rows * w + j + 1, outer + rows * w + j + 1, outer + rows * w + j);
  }
  // Mirrored panels sweep their azimuth the other way round the body, so settle
  // winding from the built geometry rather than assuming a sweep direction.
  const v = (i: number) => new T.Vector3(position[i*3], position[i*3+1], position[i*3+2]);
  const a = v(index[0]);
  const face = v(index[1]).sub(a).cross(v(index[2]).sub(a));
  if (face.dot(a.clone().sub(v(index[0] + inner - outer))) < 0)
    for (let i = 0; i < index.length; i += 3) { const t = index[i+1]; index[i+1] = index[i+2]; index[i+2] = t; }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index); geometry.computeVertexNormals();
  return geometry;
}

/** Tapered jaw, flattened face plane and forward chin, on the unit sphere. */
function skullPoint(x: number, y: number, z: number): [number, number, number] {
  const jaw = y < 0 ? 1 - .3 * Math.pow(-y, 1.6) : 1, back = y < 0 ? 1 - .18 * Math.pow(-y, 1.7) : 1;
  return [x * jaw, y, z * (z > 0 ? .9 * back : back) + (y < -.55 ? .1 * (-y - .55) : 0)];
}

/**
 * Hair lying on the skull, with a high front hairline that drops away at the
 * temples and nape, so the cut never reads as a bowl pulled over the brows.
 */
function hairShell(front: number, back: number, rows = 6, cols = 18) {
  const position: number[] = [], uv: number[] = [], index: number[] = [];
  const layer = (k: number) => {
    const base = position.length / 3;
    for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
      const phi = (j / cols) * Math.PI * 2, theta = (i / rows) * (front + (back - front) * (1 - Math.cos(phi)) / 2);
      const p = skullPoint(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
      position.push(p[0] * k, p[1] * k, p[2] * k); uv.push(j / cols, i / rows);
    }
    return base;
  };
  return stitch(position, uv, index, layer(1.05), layer(.99), rows, cols);
}

/** Shared skeletal adult figure, in world units. Each surface keeps its own material. */
export function createSuitedAgent() {
  const scene=new T.Group();scene.name='Tailored office colleague';
  const bones:T.Bone[]=[];
  function bone(name:string,x:number,y:number,z:number,parent?:T.Bone){const b=new T.Bone();b.name=name;b.position.set(x,y,z);(parent??scene).add(b);bones.push(b);return b;}
  const pelvis=bone('Pelvis',0,HIP,0),spine=bone('Spine',0,SPINE_Y-HIP,0,pelvis),chest=bone('Chest',0,.42,0,spine),head=bone('Head',0,HEAD_Y-SPINE_Y-.42,0,chest);
  // Shoulders sit at 0.80 of stature; the upper arm carries a slight outward
  // cant so hands clear the hips, and the elbow bone follows that cant.
  const leftArm=bone('LeftArm',-.345,SHOULDER-SPINE_Y-.42,0,chest),leftFore=bone('LeftForearm',-.052,-.578,0,leftArm);
  const rightArm=bone('RightArm',.345,SHOULDER-SPINE_Y-.42,0,chest),rightFore=bone('RightForearm',.052,-.578,0,rightArm);
  const leftLeg=bone('LeftLeg',-.16,0,0,pelvis),leftShin=bone('LeftShin',0,-.70,0,leftLeg);
  const rightLeg=bone('RightLeg',.16,0,0,pelvis),rightShin=bone('RightShin',0,-.70,0,rightLeg);
  scene.updateMatrixWorld(true);
  const groups=new Map<string,T.BufferGeometry[]>();
  /** Binds world-space geometry rigidly to one bone. */
  function bind(name:string,b:T.Bone,shape:T.BufferGeometry){
    const g=shape.index?shape.toNonIndexed():shape;if(g!==shape)shape.dispose();const n=g.getAttribute('position').count;
    const indices=new Uint16Array(n*4),weights=new Float32Array(n*4);for(let i=0;i<n;i++){indices[i*4]=bones.indexOf(b);weights[i*4]=1;}
    g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    const list=groups.get(name)??[];list.push(g);groups.set(name,list);
  }
  /** Scales a primitive, then offsets it from its bone's rest position. */
  function part(name:string,b:T.Bone,shape:T.BufferGeometry,scale:[number,number,number],offset:[number,number,number]){
    shape.scale(...scale);const p=b.getWorldPosition(new T.Vector3());shape.translate(p.x+offset[0],p.y+offset[1],p.z+offset[2]);bind(name,b,shape);
  }
  /** Scales a primitive, then places it at an absolute point in the rest pose. */
  function place(name:string,b:T.Bone,shape:T.BufferGeometry,scale:[number,number,number],at:[number,number,number]){
    shape.scale(...scale);shape.translate(...at);bind(name,b,shape);
  }
  const sphere=(w=14,h=10)=>new T.SphereGeometry(1,w,h);
  const taper=(top:number,bottom:number,height:number)=>new T.CylinderGeometry(top,bottom,height,14);
  const mirror=(o:PanelOptions):PanelOptions=>({...o,a0:t=>-o.a1(t),a1:t=>-o.a0(t)});
  const collar=(y0:number,y1:number,lift:number,thick:number,gap=0):PanelOptions=>
    ({y0,y1,a0:()=>gap,a1:()=>Math.PI*2-gap,lift,thick,cols:14,rows:2,radius:neckRadius,depth:1});

  // ---- Torso -------------------------------------------------------------
  part('Suit',spine,new T.LatheGeometry([new T.Vector2(0,JACKET[0][0]),...JACKET.map(([y,r])=>new T.Vector2(r,y))],24),[1,1,TORSO_DEPTH],[0,0,0]);
  part('Suit',pelvis,sphere(),[.30,.215,.19],[0,-.02,0]);
  bind('Suit',spine,panel(collar(2.69,2.755,.030,.030,.36)));
  // Shirt front climbing the collar roll, plus the collar band around the neck.
  bind('Shirt',spine,panel({y0:2.18,y1:2.685,a0:t=>-(.12+.42*t),a1:t=>.12+.42*t,lift:.010,thick:.012,cols:4,rows:10}));
  bind('Shirt',spine,panel(collar(2.685,2.762,.016,.018)));
  // Notched lapel of roughly constant width, rolling out toward the collar.
  const lapelY=(t:number)=>2.20+.46*t, lapelIn=(t:number)=>.13+.40*t;
  const lapel:PanelOptions={y0:2.20,y1:2.66,a0:lapelIn,a1:t=>lapelIn(t)+.15/jacketRadius(lapelY(t)),lift:.030,thick:.016,cols:4,rows:10};
  bind('Lapel',spine,panel(lapel));bind('Lapel',spine,panel(mirror(lapel)));
  bind('Tie',spine,panel({y0:2.26,y1:2.665,a0:t=>-(.155+.06*t),a1:t=>.155+.06*t,lift:.042,thick:.014,cols:3,rows:7}));
  bind('Tie',spine,panel({y0:2.655,y1:2.735,a0:()=>-.16,a1:()=>.16,lift:.034,thick:.042,rows:2,cols:4,radius:neckRadius,depth:1}));
  // Department accessories, layered over the shirt and inside the lapel edges.
  bind('Waistcoat',spine,panel({y0:2.14,y1:2.675,a0:t=>-(.11+.40*t),a1:t=>.11+.40*t,lift:.026,thick:.012,cols:4,rows:10}));
  place('Hardware',spine,sphere(10,8),[.019,.019,.012],onBody(2.13,0,.026));
  bind('PocketSquare',spine,panel({y0:2.43,y1:2.505,a0:()=>.58,a1:()=>.76,lift:.040,thick:.012,rows:2,cols:2}));
  const strap:PanelOptions={y0:2.30,y1:2.62,a0:t=>.06+.76*t,a1:t=>.105+.78*t,lift:.048,thick:.010,cols:2};
  bind('Lanyard',spine,panel(strap));bind('Lanyard',spine,panel(mirror(strap)));
  bind('Lanyard',spine,panel({y0:2.14,y1:2.32,a0:()=>-.13,a1:()=>.13,lift:.052,thick:.012,rows:2,cols:3}));
  bind('Scarf',spine,panel(collar(2.675,2.79,.046,.055)));
  bind('Scarf',spine,panel({y0:2.12,y1:2.675,a0:()=>.12,a1:()=>.34,lift:.058,thick:.03,cols:3}));

  // ---- Arms --------------------------------------------------------------
  for(const [arm,fore,s] of [[leftArm,leftFore,-1],[rightArm,rightFore,1]] as const){
    part('Suit',arm,sphere(),[.111,.132,.124],[0,-.086,0]);
    const upper=taper(.108,.088,.58);upper.rotateZ(-s*.09);part('Suit',arm,upper,[1,1,1],[s*.026,-.289,0]);
    part('Suit',fore,sphere(),[.086,.088,.086],[0,0,0]);
    part('Suit',fore,taper(.085,.070,.44),[1,1,1],[0,-.22,0]);
    part('Shirt',fore,taper(.068,.066,.05),[1,1,1],[0,-.452,0]);
    for(const b of [0,1,2])place('Hardware',fore,sphere(6,4),[.011,.011,.008],[fore.getWorldPosition(new T.Vector3()).x+s*.078,2.062-.36-b*.03,.012]);
    part('Skin',fore,new RoundedBoxGeometry(.125,.245,.066,1,.031),[1,1,1],[0,-.595,.006]);
  }

  // ---- Legs --------------------------------------------------------------
  for(const [leg,shin] of [[leftLeg,leftShin],[rightLeg,rightShin]]){
    part('Suit',leg,taper(.162,.136,.71),[1,1,1],[0,-.352,0]);
    part('Suit',shin,sphere(),[.136,.124,.136],[0,0,0]);
    part('Suit',shin,taper(.134,.112,.70),[1,1,1],[0,-.35,0]);
    part('Shoes',shin,new RoundedBoxGeometry(.152,.108,.39,1,.05),[1,1,1],[0,-.786,.076]);
    part('Shoes',shin,new T.BoxGeometry(.164,.034,.42),[1,1,1],[0,-.831,.076]);
  }

  // ---- Head and neck -----------------------------------------------------
  part('Skin',chest,taper(.076,.098,.31),[1,1,1],[0,.50,.006]);
  const skull=sphere(18,12);const p=skull.getAttribute('position');
  for(let i=0;i<p.count;i++)p.setXYZ(i,...skullPoint(p.getX(i),p.getY(i),p.getZ(i)));
  skull.computeVertexNormals();part('Skin',head,skull,SKULL,SKULL_AT);
  part('Skin',head,new RoundedBoxGeometry(.15,.02,.028,1,.009),[1,1,1],[0,.243,.142]);   // brow
  part('Skin',head,sphere(8,6),[.027,.044,.034],[0,.15,.147]);                            // nose
  part('Skin',head,sphere(6,4),[.016,.05,.019],[0,.207,.144]);                            // bridge
  part('Lips',head,new RoundedBoxGeometry(.058,.02,.024,1,.01),[1,1,1],[0,.076,.132]);
  for(const s of [-1,1]){
    part('Skin',head,sphere(8,6),[.014,.042,.028],[s*.136,.185,-.022]);                    // ear
    part('Eyes',head,sphere(8,6),[.021,.012,.012],[s*.06,.212,.143]);
    part('Skin',head,new RoundedBoxGeometry(.055,.014,.02,1,.006),[1,1,1],[s*.06,.226,.145]); // lid
    part('Hair',head,new T.BoxGeometry(.052,.009,.017),[1,1,1],[s*.06,.256,.147]);         // brow hair
    part('Hair',head,new T.BoxGeometry(.02,.062,.046),[1,1,1],[s*.126,.185,.006]);         // sideburn
    part('Glasses',head,new T.TorusGeometry(.042,.005,4,14),[1,.85,1],[s*.06,.212,.157]);
    part('Glasses',head,new T.BoxGeometry(.007,.006,.1),[1,1,1],[s*.103,.212,.1]);
  }
  part('Glasses',head,new T.BoxGeometry(.042,.006,.007),[1,1,1],[0,.212,.16]);
  part('Hair',head,hairShell(Math.PI*.34,Math.PI*.73,6,18),SKULL,SKULL_AT);
  part('HairBun',head,sphere(10,8),[.092,.096,.092],[0,.318,-.152]);
  // Cup and handle share the forearm skin binding, so sipping is articulated.
  part('CoffeeCup',rightFore,new T.CylinderGeometry(.068,.055,.145,18,1,true),[1,1,1],CUP_ON_FOREARM);
  part('CoffeeCup',rightFore,new T.TorusGeometry(.044,.011,6,14),[1,1,1],[CUP_ON_FOREARM[0]+.068,CUP_ON_FOREARM[1],CUP_ON_FOREARM[2]]);

  const palette:Record<string,[number,number,number?]>={Suit:[0x2b3542,.88],Lapel:[0x222c38,.78],Shirt:[0xf1eee7,.78],Tie:[0x2c4459,.56],
    Skin:[0xbf8e6b,.68],Lips:[0x9c6753,.6],Shoes:[0x1b1e20,.32],Hair:[0x29231e,.84],Eyes:[0x2a2725,.35],Waistcoat:[0x8d9aa8,.9],
    PocketSquare:[0xc6a56c,.58],Lanyard:[0x62bab0,.7],Scarf:[0xd8b8d9,.62],Hardware:[0xc6a56c,.26,.85],Glasses:[0x2b2f34,.3,.7],
    HairBun:[0x29231e,.84],CoffeeCup:[0xeee6d6,.3]};
  const skeleton=new T.Skeleton(bones);
  for(const [name,list] of groups){
    const geometry=mergeGeometries(list)!;list.forEach(g=>g.dispose());const [color,roughness,metalness]=palette[name];
    const m=new T.MeshStandardMaterial({color,roughness,metalness:metalness??0});
    const mesh=new T.SkinnedMesh(geometry,m);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;scene.add(mesh);mesh.bind(skeleton);
  }

  function track(b:T.Bone,axis:string,values:number[],times:number[]) {return new T.NumberKeyframeTrack(`${b.name}.rotation[${axis}]`,times,values);}
  function lift(b:T.Bone,offsets:number[],times:number[]) {
    const base=b.position;return new T.VectorKeyframeTrack(`${b.name}.position`,times,offsets.flatMap(dy=>[base.x,base.y+dy,base.z]));
  }
  // Idle: breathing, a slow weight shift and small head drift over four seconds,
  // long enough that neighbouring agents never read as one looping puppet.
  const it=[0,1,2,3,4];
  const idle=new T.AnimationClip('Idle',4,[
    track(chest,'x',[0,.02,.028,.012,0],it),track(spine,'z',[0,.008,0,-.008,0],it),
    track(pelvis,'z',[0,-.012,0,.012,0],it),lift(pelvis,[0,-.006,-.01,-.004,0],it),
    track(head,'y',[0,.045,-.02,.035,0],it),track(head,'x',[.015,.005,.03,.01,.015],it),
    track(leftArm,'x',[-.03,-.05,-.02,-.05,-.03],it),track(rightArm,'x',[-.03,-.02,-.05,-.02,-.03],it),
    track(leftFore,'x',[-.12,-.16,-.1,-.14,-.12],it),track(rightFore,'x',[-.12,-.1,-.16,-.12,-.12],it)]);
  // Walk: a full two-step cycle with pelvis bob and list, counter-rotating
  // shoulders, knee flexion through swing and opposed arm swing.
  const wt=[0,.275,.55,.825,1.1];
  const walk=new T.AnimationClip('Walk',1.1,[
    lift(pelvis,[-.022,.012,-.022,.012,-.022],wt),
    track(pelvis,'y',[.09,0,-.09,0,.09],wt),track(pelvis,'z',[.03,0,-.03,0,.03],wt),
    track(chest,'y',[-.07,0,.07,0,-.07],wt),track(chest,'x',[.05,.04,.05,.04,.05],wt),
    track(leftLeg,'x',[.42,.04,-.36,-.06,.42],wt),track(rightLeg,'x',[-.36,-.06,.42,.04,-.36],wt),
    track(leftShin,'x',[.04,.30,.16,.62,.04],wt),track(rightShin,'x',[.16,.62,.04,.30,.16],wt),
    track(leftArm,'x',[-.34,-.02,.30,.02,-.34],wt),track(rightArm,'x',[.30,.02,-.34,-.02,.30],wt),
    track(leftFore,'x',[-.30,-.20,-.44,-.24,-.30],wt),track(rightFore,'x',[-.44,-.24,-.30,-.20,-.44],wt),
    track(head,'x',[.02,-.01,.02,-.01,.02],wt)]);
  // Talk: an uneven two-beat gesture, so a room of speakers stays unsynchronised.
  const tt=[0,.5,1,1.55,2.1,2.6];
  const talk=new T.AnimationClip('Talk',2.6,[
    track(rightArm,'x',[-.22,-.52,-.34,-.58,-.28,-.22],tt),track(rightArm,'z',[-.05,-.36,-.18,-.42,-.12,-.05],tt),
    track(rightFore,'x',[-.85,-1.18,-.92,-1.26,-.88,-.85],tt),
    track(leftArm,'x',[-.08,-.14,-.3,-.12,-.2,-.08],tt),track(leftFore,'x',[-.28,-.42,-.58,-.32,-.38,-.28],tt),
    track(head,'y',[0,.07,-.05,.06,-.03,0],tt),track(head,'x',[.02,-.03,.05,-.02,.03,.02],tt),
    track(chest,'y',[0,-.03,.02,-.03,.01,0],tt),track(chest,'x',[.01,.03,.01,.03,.01,.01],tt)]);
  // Sit: thighs forward, shins down, forearms level with the 1.65 desk surface.
  // Sit: thighs slope to the office seat height so the hips meet the cushion and
  // the shoes still reach the floor; forearms land on the 1.65 desk surface.
  const st=[0,.9,1.8,2.7,3.6],hold=(v:number)=>[v,v,v,v,v];
  const sit=new T.AnimationClip('Sit',3.6,[
    track(leftLeg,'x',hold(-SEAT_THIGH),st),track(rightLeg,'x',hold(-SEAT_THIGH),st),
    track(leftShin,'x',hold(SEAT_THIGH),st),track(rightShin,'x',hold(SEAT_THIGH),st),
    track(leftLeg,'z',hold(.06),st),track(rightLeg,'z',hold(-.06),st),
    track(leftArm,'x',[-.60,-.57,-.61,-.57,-.60],st),track(rightArm,'x',[-.61,-.57,-.60,-.57,-.61],st),
    track(leftArm,'z',hold(.16),st),track(rightArm,'z',hold(-.16),st),
    track(leftFore,'x',[-.61,-.66,-.59,-.64,-.61],st),track(rightFore,'x',[-.59,-.64,-.61,-.66,-.59],st),
    track(leftFore,'y',hold(-.22),st),track(rightFore,'y',hold(.22),st),
    track(chest,'x',[.06,.08,.09,.07,.06],st),track(head,'x',[.08,.06,.09,.06,.08],st),
    track(head,'y',[0,.03,-.02,.02,0],st)]);
  // Coffee: raise across the body, hold at the mouth for the sip, then lower.
  // SIP is solved so the cup rim meets the mouth anchor; the sip is held from
  // 1.5s to 2.3s and the ease-in/out frames are the same pose partly applied.
  const ct=[0,.7,1.5,2.3,3],SIP={ax:-1.669,ay:-.775,az:-.793,fx:-2.222,fy:-.066};
  const raise=(v:number,rest=0)=>[rest,rest+(v-rest)*.82,v,v,rest];
  const coffee=new T.AnimationClip('Coffee',3,[
    track(rightArm,'x',raise(SIP.ax,-.2),ct),track(rightArm,'y',raise(SIP.ay),ct),track(rightArm,'z',raise(SIP.az),ct),
    track(rightFore,'x',raise(SIP.fx,-.5),ct),track(rightFore,'y',raise(SIP.fy),ct),
    track(leftArm,'x',[-.05,-.12,-.14,-.12,-.05],ct),track(leftFore,'x',[-.15,-.3,-.34,-.3,-.15],ct),
    track(head,'x',[.02,.06,.09,.09,.02],ct),track(chest,'x',[.01,.04,.05,.05,.01],ct)]);
  scene.userData.wardrobe='department-tailoring-v3';
  scene.userData.stature=STATURE;
  return {scene,animations:[idle,talk,walk,sit,coffee]};
}
