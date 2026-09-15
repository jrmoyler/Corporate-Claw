import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AGENTS } from '../src/data/agents';

export type ServerConfig = { id: string; label: string; url: string; token?: string; tools: string[]; departments: string[] };
export type McpRequest = { action: 'list' | 'call'; agentIndex: number; serverId: string; tool?: string; arguments?: Record<string,unknown> };
export function configuredServers(raw=process.env.MCP_SERVERS ?? '[]'): ServerConfig[] {
  const entries=JSON.parse(raw);
  if(!Array.isArray(entries)||entries.length>12)throw new Error('Invalid configuration');
  const ids=new Set<string>();
  return entries.map(s=>{
    if(!s||typeof s.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(s.id)||ids.has(s.id)||typeof s.label!=='string'||s.label.length>80
      ||!Array.isArray(s.tools)||!s.tools.length||s.tools.some((t:unknown)=>typeof t!=='string'||t.length>128)
      ||!Array.isArray(s.departments)||!s.departments.length||s.departments.some((d:unknown)=>!['Executive','Production','Sales','Marketing','Finance','People'].includes(String(d)))
      ||(s.token!==undefined&&typeof s.token!=='string'))throw new Error('Invalid configuration');
    const url=new URL(s.url);if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new Error('Invalid endpoint');
    ids.add(s.id);return {...s,url:url.href};
  });
}
export function allowedServer(servers:ServerConfig[],request:McpRequest) {
  const server=servers.find(s=>s.id===request.serverId);
  return server && server.departments.includes(AGENTS[request.agentIndex]?.department) && (request.action==='list'||server.tools.includes(request.tool!)) ? server : undefined;
}
export async function runMcpSession(client:Client,config:ServerConfig,request:McpRequest,signal?:AbortSignal) {
  if(request.action==='call') {
    if(!config.tools.includes(request.tool!))throw new Error('Tool not allowed');
    return client.callTool({name:request.tool!,arguments:request.arguments??{}},undefined,{timeout:20000,signal});
  }
  let cursor:string|undefined;const tools:unknown[]=[];const seen=new Set<string>();
  for(let page=0;page<20;page++){
    const result=await client.listTools(cursor?{cursor}:undefined,{timeout:15000,signal});
    tools.push(...result.tools.filter(t=>config.tools.includes(t.name)).map(t=>({name:t.name,title:t.title??t.name,description:t.description??'',inputSchema:t.inputSchema})));
    if(!result.nextCursor)return {tools};
    if(seen.has(result.nextCursor))throw new Error('Repeated cursor');
    seen.add(result.nextCursor);cursor=result.nextCursor;
  }
  throw new Error('Tool catalog exceeds limit');
}
export async function runMcp(config:ServerConfig,request:McpRequest) {
  const signal=AbortSignal.timeout(23000);
  const client=new Client({name:'corporate-claw',version:'1.0.0'});
  const transport=new StreamableHTTPClientTransport(new URL(config.url),{
    requestInit:{headers:config.token?{Authorization:`Bearer ${config.token}`}:{},redirect:'error'},
    fetch:(url,init)=>fetch(url,{...init,redirect:'error',signal:AbortSignal.any([signal,...(init?.signal?[init.signal]:[])])}),
    reconnectionOptions:{maxRetries:0,maxReconnectionDelay:1000,initialReconnectionDelay:1000,reconnectionDelayGrowFactor:1},
  });
  try {await client.connect(transport,{timeout:10000,signal});return await runMcpSession(client,config,request,signal);}
  finally {await transport.terminateSession().catch(()=>{});await client.close().catch(()=>{});}
}
