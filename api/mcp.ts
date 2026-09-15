import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { AGENTS } from '../src/data/agents';
import { allowedServer, configuredServers, runMcp } from '../server/mcp';

type Request=IncomingMessage & {body?:unknown};
export function createMcpHandler(execute=runMcp) {
  return async (req:Request,res:ServerResponse)=>{
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const reply=(code:number,value:unknown)=>{res.statusCode=code;res.end(JSON.stringify(value));};
    if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,{error:'Method not allowed'});}
    try {if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return reply(403,{error:'Origin not allowed'});}catch{return reply(403,{error:'Invalid origin'});}
    let servers;try{servers=configuredServers();}catch{return reply(503,{error:'Tool connections need administrator setup.'});}
    const key=process.env.MCP_ACCESS_TOKEN;
    if(!key||servers.length===0)return reply(503,{error:'No tool servers are connected yet. Ask your office administrator to configure them.'});
    const provided=req.headers.authorization??'';
    const hash=(s:string)=>createHash('sha256').update(s).digest();
    if(!timingSafeEqual(hash(provided),hash(`Bearer ${key}`)))return reply(401,{error:'Enter a valid office tool access key.'});
    let body:any;
    try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return reply(400,{error:'Invalid JSON'});}
    if(!body||JSON.stringify(body).length>20000||!Number.isInteger(body.agentIndex)||!AGENTS[body.agentIndex]||!['servers','list','call'].includes(body.action))return reply(400,{error:'Invalid tool request'});
    if(body.action==='servers')return reply(200,{servers:servers.filter(s=>s.departments.includes(AGENTS[body.agentIndex].department)).map(s=>({id:s.id,label:s.label}))});
    if(typeof body.serverId!=='string'||(body.action==='call'&&(typeof body.tool!=='string'||!body.arguments||typeof body.arguments!=='object'||Array.isArray(body.arguments))))return reply(400,{error:'Invalid tool inputs'});
    const server=allowedServer(servers,body);
    if(!server)return reply(403,{error:'This tool is not available to this department.'});
    try{
      const result=await execute(server,body);
      if(JSON.stringify(result).length>100000)return reply(502,{error:'The tool returned more data than this view can display.'});
      return reply(200,result);
    }catch{return reply(502,{error:'The tool did not finish successfully. It may have run remotely; check its result before retrying.'});}
  };
}
export default createMcpHandler();
