import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { configuredServers, runMcpSession } from '../server/mcp';
import { createMcpHandler } from '../api/mcp';
import { mcpService } from '../src/services/mcpService';
import { mcpActivity } from '../src/services/mcpActivity';

const config={id:'office',label:'Office tools',url:'https://tools.example/mcp',token:'upstream-secret',tools:['echo'],departments:['Production']};
async function request(handler:ReturnType<typeof createMcpHandler>,body:any,authorization='Bearer office-key',origin='https://office.example',method='POST'){
  let code=200,data='';const headers:Record<string,string>={};
  await handler({method,body,headers:{authorization,origin,host:'office.example'}} as any,{setHeader:(k:string,v:string)=>headers[k]=v,get statusCode(){return code;},set statusCode(v:number){code=v;},end:(v:string)=>data=v} as any);
  return {code,data:JSON.parse(data),headers};
}
test('tool API enforces access key, department and server/tool allowlists without exposing credentials',async()=>{
  const oldServers=process.env.MCP_SERVERS,oldKey=process.env.MCP_ACCESS_TOKEN;
  process.env.MCP_SERVERS=JSON.stringify([config]);process.env.MCP_ACCESS_TOKEN='office-key';
  const invocations:any[]=[];const handler=createMcpHandler(async(s,r)=>{invocations.push(r);return {content:[{type:'text',text:'done'}]};});
  const call={action:'call',agentIndex:2,serverId:'office',tool:'echo',arguments:{message:'Hi'}};
  try{
    assert.equal((await request(handler,call,'')).code,401);
    assert.equal((await request(handler,call,'Bearer wrong')).code,401);
    assert.equal((await request(handler,call,'Bearer office-key','https://evil.example')).code,403);
    assert.equal((await request(handler,call,undefined,undefined,'GET')).code,405);
    assert.equal((await request(handler,{...call,agentIndex:3})).code,403);
    assert.equal((await request(handler,{...call,serverId:'https://evil.example'})).code,403);
    assert.equal((await request(handler,{...call,tool:'delete_all'})).code,403);
    for(const body of [{...call,arguments:[]},{...call,agentIndex:-1},{...call,agentIndex:1.5},{...call,arguments:{text:'x'.repeat(20000)}}])assert.equal((await request(handler,body)).code,400);
    assert.equal(invocations.length,0);
    const listed=await request(handler,{action:'servers',agentIndex:2});assert.equal(listed.code,200);assert.deepEqual(listed.data,{servers:[{id:'office',label:'Office tools'}]});assert.ok(!JSON.stringify(listed).includes('upstream-secret'));
    assert.equal((await request(handler,call)).code,200);assert.equal(invocations.length,1);
  }finally{if(oldServers===undefined)delete process.env.MCP_SERVERS;else process.env.MCP_SERVERS=oldServers;if(oldKey===undefined)delete process.env.MCP_ACCESS_TOKEN;else process.env.MCP_ACCESS_TOKEN=oldKey;}
});
test('MCP SDK performs initialization, paginated tool discovery and a real protocol tool call',async()=>{
  const [ct,st]=InMemoryTransport.createLinkedPair(),client=new Client({name:'test',version:'1'}),server=new Server({name:'fixture',version:'1'},{capabilities:{tools:{}}});
  let called=0;
  server.setRequestHandler(ListToolsRequestSchema,async(req)=>req.params?.cursor?{tools:[{name:'echo',inputSchema:{type:'object',properties:{message:{type:'string'}}}}]}:{tools:[{name:'private',inputSchema:{type:'object'}}],nextCursor:'page2'});
  server.setRequestHandler(CallToolRequestSchema,async(req)=>{called++;return {content:[{type:'text',text:String(req.params.arguments?.message)}]};});
  await server.connect(st);await client.connect(ct);
  try{
    const list=await runMcpSession(client,config,{action:'list',agentIndex:2,serverId:'office'}) as any;assert.deepEqual(list.tools.map((t:any)=>t.name),['echo']);
    const result=await runMcpSession(client,config,{action:'call',agentIndex:2,serverId:'office',tool:'echo',arguments:{message:'Protocol works'}}) as any;
    assert.equal(result.content[0].text,'Protocol works');assert.equal(called,1);
    await assert.rejects(()=>runMcpSession(client,config,{action:'call',agentIndex:2,serverId:'office',tool:'private',arguments:{}}));assert.equal(called,1);
  }finally{await client.close();await server.close();}
});
test('MCP configuration rejects unbounded tools and non-HTTPS endpoints',()=>{
  for(const variant of [{url:'http://localhost/mcp'},{url:'https://name:secret@tools.example/mcp'},{tools:[]},{departments:[]},{departments:['Unknown']}])assert.throws(()=>configuredServers(JSON.stringify([{...config,...variant}])));
});
test('the actual browser tool service emits paired events on success, tool errors, network failure and abort',async()=>{
  const originalFetch=globalThis.fetch,events:any[]=[];const unsub=mcpActivity.subscribe(e=>events.push(e));
  try{
    for(const mode of ['success','tool-error','network','abort']){
      globalThis.fetch=async()=>{if(mode==='network'||mode==='abort')throw new Error(mode);return new Response(JSON.stringify({isError:mode==='tool-error',content:[{type:'text',text:mode}]}),{status:200});};
      const call=mcpService.callTool(2,'office','echo',{});
      if(mode==='success')await call;else await assert.rejects(()=>call);
    }
    assert.equal(events.length,8);for(let i=0;i<8;i+=2){assert.equal(events[i].phase,'start');assert.equal(events[i+1].phase,'settled');assert.equal(events[i].callId,events[i+1].callId);assert.equal(events[i].agentIndex,2);}
    const remaining:any[]=[];mcpActivity.replay(e=>remaining.push(e));assert.equal(remaining.length,0);
  }finally{globalThis.fetch=originalFetch;unsub();}
});
