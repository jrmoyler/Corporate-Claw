type Point = { x:number; z:number };
type Obstacle = { position:Point; radius:number };
const grids=new WeakMap<Obstacle[],Map<number,Uint8Array>>();
/** Deterministic grid route around room partitions, simplified to visible waypoints. */
export function findOfficeRoute(start:Point,goal:Point,obstacles:Obstacle[],limit:number):Point[] {
  const clear=(a:Point,b:Point)=>obstacles.every(o=>{const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;const t=l?Math.max(0,Math.min(1,((o.position.x-a.x)*dx+(o.position.z-a.z)*dz)/l)):0;return Math.hypot(a.x+dx*t-o.position.x,a.z+dz*t-o.position.z)>o.radius+.5;});
  if(clear(start,goal))return [goal];
  const step=.75,side=Math.floor(limit*2/step)+1;
  const point=(i:number):Point=>({x:i%side*step-limit,z:Math.floor(i/side)*step-limit});
  const index=(p:Point)=>Math.max(0,Math.min(side-1,Math.round((p.z+limit)/step)))*side+Math.max(0,Math.min(side-1,Math.round((p.x+limit)/step)));
  let cache=grids.get(obstacles);if(!cache){cache=new Map();grids.set(obstacles,cache);}
  let blocked=cache.get(limit);
  if(!blocked){blocked=new Uint8Array(side*side);for(let i=0;i<blocked.length;i++){const p=point(i);blocked[i]=obstacles.some(o=>Math.hypot(p.x-o.position.x,p.z-o.position.z)<o.radius+.65)?1:0;}cache.set(limit,blocked);}
  function nearest(p:Point){let best=index(p),distance=Infinity;for(let i=0;i<blocked.length;i++){if(blocked[i])continue;const q=point(i),d=Math.hypot(p.x-q.x,p.z-q.z);if(d<distance){distance=d;best=i;}}return best;}
  const from=nearest(start),to=nearest(goal),cost=new Float64Array(side*side).fill(Infinity),parent=new Int32Array(side*side).fill(-1),open=new Set<number>([from]);cost[from]=0;
  while(open.size){let at=-1,best=Infinity;for(const i of open){const p=point(i),q=point(to),score=cost[i]+Math.hypot(p.x-q.x,p.z-q.z)/step;if(score<best){best=score;at=i;}}if(at===to)break;open.delete(at);const x=at%side,z=Math.floor(at/side);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=side||nz>=side)continue;const n=nz*side+nx;if(blocked[n]||(dx&&dz&&(blocked[z*side+nx]||blocked[nz*side+x])))continue;const next=cost[at]+Math.hypot(dx,dz);if(next<cost[n]){cost[n]=next;parent[n]=at;open.add(n);}}}
  if(!Number.isFinite(cost[to]))return []; // An unreachable floor click must not send agents through walls.
  const raw:Point[]=[];for(let i=to;i!==from;i=parent[i]){if(i<0)return [];raw.unshift(point(i));}if(clear(point(to),goal))raw.push(goal);
  const result:Point[]=[];let anchor=start;
  for(let i=0;i<raw.length;){let j=i;while(j+1<raw.length&&clear(anchor,raw[j+1]))j++;result.push(raw[j]);anchor=raw[j];i=j+1;}return result;
}
