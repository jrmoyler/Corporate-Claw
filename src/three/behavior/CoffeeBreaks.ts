import { AgentBehavior } from '../../types';
import { OFFICE_SLOTS } from '../../data/officeLayout';
import { AgentStateBuffer } from './AgentStateBuffer';
import { mcpActivity, type ToolEvent, type CoffeePhase } from '../../services/mcpActivity';

type Trip = { calls: Set<string>; phase: CoffeePhase; elapsed: number; sip: number; snapshot?: number[]; origin?: {x:number;z:number}; };
/** One barista station; other callers keep working until their turn. */
export class CoffeeBreaks {
  private trips = new Map<number,Trip>();
  private serving: number | null = null;
  private station = OFFICE_SLOTS.find(s=>s.type==='COFFEE_MACHINE')!;
  constructor(private buffer: AgentStateBuffer, private onReturn: (index:number,elapsed:number)=>void = ()=>{}) {}
  event = ({agentIndex:index,callId,phase}: ToolEvent) => {
    if(!Number.isInteger(index)||index<0||index>=this.buffer.array.length/4)return;
    let trip=this.trips.get(index);
    if(phase==='start') {
      if(!trip){trip={calls:new Set(),phase:'queued',elapsed:0,sip:0};this.trips.set(index,trip);mcpActivity.setPhase(index,'queued');}
      trip.calls.add(callId);
      // A fresh call during the return walk gets another completed trip.
    } else trip?.calls.delete(callId);
  };
  get hasTrips(){return this.trips.size>0;}
  controls(index:number) { return !!this.trips.get(index)?.snapshot; }
  queued(index:number) { return this.trips.has(index); }
  update(positions:Float32Array,delta:number) {
    if(this.serving===null) {
      const entry=[...this.trips].find(([,t])=>t.phase==='queued');
      if(entry){const [i,t]=entry,k=i*4;this.serving=i;t.snapshot=Array.from(this.buffer.array.slice(k,k+4));
        t.origin={x:positions[k],z:positions[k+2]};
        if(t.snapshot[3]===AgentBehavior.OFFLINE){t.origin={x:0,z:28};positions.set([0,0,28,1],k);}
        this.go(i,t,'outbound',this.station.position.x,this.station.position.z);
      }
    }
    for(const [i,t] of this.trips) {
      if(!t.snapshot)continue;
      t.elapsed+=Math.max(0,delta);
      const k=i*4;
      if(t.phase==='outbound' && Math.hypot(positions[k]-this.station.position.x,positions[k+2]-this.station.position.z)<.3){
        this.buffer.setState(i,AgentBehavior.COFFEE);this.buffer.setWaypoint(i,Math.sin(this.station.rotation),Math.cos(this.station.rotation));
        positions[k+1]=0;t.phase='drinking';mcpActivity.setPhase(i,t.phase);
      }
      if(t.phase==='drinking') {
        t.sip+=Math.max(0,delta);
        // Fast calls still get a real cup/sip; slow calls keep their colleague at coffee.
        if(t.sip>=2.4 && t.calls.size===0){this.serving=null;this.go(i,t,'returning',t.origin!.x,t.origin!.z);}
      }
      if(t.phase==='returning' && Math.hypot(positions[k]-t.origin!.x,positions[k+2]-t.origin!.z)<.3){
        positions[k]=t.origin!.x;positions[k+2]=t.origin!.z;
        this.restore(i,t);
        if(t.calls.size){t.phase='queued';t.snapshot=undefined;t.elapsed=0;t.sip=0;mcpActivity.setPhase(i,'queued');}
        else{this.trips.delete(i);mcpActivity.setPhase(i);}
      }
      // A changed world/layout must not strand the queue or hijack an agent forever.
      if(t.elapsed>90 && t.snapshot){positions[k]=t.origin!.x;positions[k+2]=t.origin!.z;positions[k+1]=t.snapshot[3]===AgentBehavior.SIT?-.45:0;this.restore(i,t);this.trips.delete(i);if(this.serving===i)this.serving=null;mcpActivity.setPhase(i);}
    }
  }
  private go(i:number,t:Trip,phase:CoffeePhase,x:number,z:number){t.phase=phase;this.buffer.setWaypoint(i,x,z);this.buffer.setState(i,AgentBehavior.GOTO);mcpActivity.setPhase(i,phase);}
  private restore(i:number,t:Trip){this.buffer.array.set(t.snapshot!,i*4);this.buffer.attribute.needsUpdate=true;this.onReturn(i,t.elapsed);}
  dispose(){for(const [i,t]of this.trips){if(t.snapshot)this.restore(i,t);mcpActivity.setPhase(i);}this.trips.clear();this.serving=null;}
}
