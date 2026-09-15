import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Coffee, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';
import { mcpService } from '../services/mcpService';
import { mcpActivity } from '../services/mcpActivity';

type Tool={name:string;title:string;description:string;inputSchema:{properties?:Record<string,any>;required?:string[]}};
export default function ToolRunner({agentIndex,onClose}:{agentIndex:number;onClose:()=>void}){
  const available=useStore(state=>state.instanceCount)>agentIndex;
  const [key,setKey]=useState(''),[servers,setServers]=useState<{id:string;label:string}[]>([]),[server,setServer]=useState('');
  const [tools,setTools]=useState<Tool[]>([]),[toolName,setToolName]=useState(''),[values,setValues]=useState<Record<string,string>>({});
  const [rawArguments,setRawArguments]=useState('{}');
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[result,setResult]=useState('');
  const controller=useRef<AbortController|null>(null);
  const phases=useSyncExternalStore(mcpActivity.subscribePhases,mcpActivity.snapshot);
  const tool=tools.find(t=>t.name===toolName),agent=AGENTS[agentIndex];
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function connect(){
    mcpService.setAccessKey(key);setError('');setLoading(true);setServers([]);setServer('');setTools([]);setToolName('');
    try{const data=await mcpService.request({action:'servers',agentIndex});setServers(data.servers);if(!data.servers.length)setError('No tools are assigned to this department.');}
    catch(e){setError((e as Error).message);}finally{setLoading(false);}
  }
  async function chooseServer(id:string){
    setServer(id);setTools([]);setToolName('');setValues({});setError('');if(!id)return;setLoading(true);
    try{const data=await mcpService.request({action:'list',agentIndex,serverId:id});setTools(data.tools);if(!data.tools.length)setError('This connection has no available tools.');}
    catch(e){setError((e as Error).message);}finally{setLoading(false);}
  }
  async function run(event:{preventDefault():void}){
    event.preventDefault();if(!tool||busy||!available)return;setError('');setResult('');
    let args:Record<string,unknown>={};
    try{if(!Object.keys(tool.inputSchema.properties??{}).length){args=JSON.parse(rawArguments);if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Inputs must be a JSON object.');}
    for(const [name,schema]of Object.entries<any>(tool.inputSchema.properties??{})){
      const value=values[name];if(value===undefined||value===''){if(tool.inputSchema.required?.includes(name))throw new Error(`${name} is required.`);continue;}
      args[name]=['object','array'].includes(schema.type)?JSON.parse(value):['number','integer'].includes(schema.type)?Number(value):schema.type==='boolean'?value==='true':value;
    }}catch(e){setError((e as Error).message);return;}
    setBusy(true);controller.current=new AbortController();
    try{const output=await mcpService.callTool(agentIndex,server,tool.name,args,controller.current.signal);
      setResult(output.content?.filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('\n')||JSON.stringify(output.structuredContent??output,null,2));
    }catch(e){setError(controller.current.signal.aborted?'Stopped waiting. The tool may still be running remotely; check before retrying.':(e as Error).message);}
    finally{setBusy(false);controller.current=null;}
  }
  return <section className="tool-runner" role="dialog" aria-modal="false" aria-label="Agent tools">
    <header><div><small>{agent.department}</small><h2>{agent.role}</h2></div><button disabled={busy||loading} onClick={onClose} aria-label="Close tools"><X size={20}/></button></header>
    <p>Choose a connected tool for this colleague. They’ll get coffee while it runs.</p>
    <div className="tool-connect"><label>Office tool access key<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} disabled={busy||loading}/></label><button onClick={connect} disabled={busy||loading}>Connect</button></div>
    {servers.length>0&&<label>Connection<select value={server} onChange={e=>chooseServer(e.target.value)} disabled={busy||loading}><option value="">Choose connection</option>{servers.map(s=><option value={s.id} key={s.id}>{s.label}</option>)}</select></label>}
    {tools.length>0&&<label>Task<select value={toolName} disabled={busy||loading} onChange={e=>{setToolName(e.target.value);setValues({});setResult('');}}><option value="">Choose task</option>{tools.map(t=><option key={t.name} value={t.name}>{t.title}</option>)}</select></label>}
    {tool&&<form onSubmit={run}><p>{tool.description}</p>{!Object.keys(tool.inputSchema.properties??{}).length&&<label>Inputs (JSON)<textarea disabled={busy} value={rawArguments} onChange={e=>setRawArguments(e.target.value)}/></label>}{Object.entries<any>(tool.inputSchema.properties??{}).map(([name,schema])=><label key={name}>{schema.title??name}{tool.inputSchema.required?.includes(name)?' *':''}
      {schema.enum?<select required={tool.inputSchema.required?.includes(name)} disabled={busy} value={values[name]??''} onChange={e=>setValues({...values,[name]:e.target.value})}><option value="">Choose value</option>{schema.enum.map((v:unknown)=><option key={String(v)} value={String(v)}>{String(v)}</option>)}</select>
      :schema.type==='boolean'?<select disabled={busy} value={values[name]??''} onChange={e=>setValues({...values,[name]:e.target.value})}><option value="">Choose value</option><option value="true">Yes</option><option value="false">No</option></select>
      :['object','array'].includes(schema.type)?<textarea aria-label={name} placeholder={schema.type==='array'?'[]':'{}'} required={tool.inputSchema.required?.includes(name)} disabled={busy} value={values[name]??''} onChange={e=>setValues({...values,[name]:e.target.value})}/>
      :<input type={['number','integer'].includes(schema.type)?'number':'text'} step={schema.type==='integer'?'1':'any'} required={tool.inputSchema.required?.includes(name)} disabled={busy} value={values[name]??''} onChange={e=>setValues({...values,[name]:e.target.value})}/>}
      {schema.description&&<small>{schema.description}</small>}</label>)}<button className="primary-button" disabled={busy||loading||!available} type="submit">{busy?'Running task…':'Run task'}</button></form>}
    {(busy||phases[agentIndex])&&<p className="coffee-status" role="status"><Coffee size={16}/>{phases[agentIndex]==='queued'?'Waiting for the coffee station':phases[agentIndex]==='outbound'?'Walking to get coffee':phases[agentIndex]==='drinking'?'Coffee break':phases[agentIndex]==='returning'?'Returning to work':'Running task…'}</p>}
    {!available&&<p role="status">This colleague is outside the active office population.</p>}
    {loading&&<p role="status">Loading available tools…</p>}{busy&&<button className="tool-cancel" onClick={()=>controller.current?.abort()}>Stop waiting</button>}
    {error&&<p className="tool-error" role="alert">{error}</p>}{result&&<pre className="tool-result" aria-label="Tool result">{result}</pre>}
  </section>;
}
