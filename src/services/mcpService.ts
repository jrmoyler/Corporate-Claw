import { mcpActivity } from './mcpActivity';
let accessKey='';
export const mcpService={
  setAccessKey(key:string){accessKey=key;},
  async request(body:Record<string,unknown>,signal?:AbortSignal){
    const response=await fetch('/api/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accessKey}`},body:JSON.stringify(body),signal:AbortSignal.any([AbortSignal.timeout(28000),...(signal?[signal]:[])])});
    const result=await response.json().catch(()=>({error:'The tool service returned an invalid response.'}));
    if(!response.ok)throw new Error(result.error??'Tool request failed.');return result;
  },
  async callTool(agentIndex:number,serverId:string,tool:string,args:Record<string,unknown>,signal?:AbortSignal){
    const callId=crypto.randomUUID();
    try{
      mcpActivity.start(agentIndex,callId);
      const result=await this.request({action:'call',agentIndex,serverId,tool,arguments:args},signal);
      if(result.isError)throw new Error(result.content?.filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('\n')||'The tool reported an error.');
      return result;
    }finally{mcpActivity.settle(agentIndex,callId);}
  },
};
