import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chat.ts';
async function request(method='POST', body: unknown={ message:'Hello', systemInstruction:'You are an office assistant.', history:[] }, origin='https://office.example') {
  let code=200, data=''; const headers:Record<string,string>={};
  const req={method,body,headers:{origin,host:'office.example'}};
  const res={setHeader:(key:string,value:string)=>headers[key]=value,get statusCode(){return code;},set statusCode(value:number){code=value;},end:(value:string)=>data=value};
  await handler(req as any,res as any); return {code,data:JSON.parse(data),headers};
}
test('rejects non-POST requests',async()=>assert.equal((await request('GET')).code,405));
test('rejects cross-origin and malformed origins',async()=>{assert.equal((await request('POST',undefined,'https://other.example')).code,403);assert.equal((await request('POST',undefined,'bad url')).code,403);});
test('rejects missing, empty and oversized content',async()=>{for(const body of [null,{}, {message:' ',systemInstruction:'x',history:[]},{message:'a'.repeat(2001),systemInstruction:'x',history:[]}])assert.equal((await request('POST',body)).code,400);});
test('rejects invalid roles and excess history',async()=>{for(const history of [[{role:'system',text:'x'}],Array(21).fill({role:'user',text:'x'})])assert.equal((await request('POST',{message:'Hi',systemInstruction:'x',history})).code,400);});
test('missing credential returns actionable status, not a startup crash',async()=>{const previous=process.env.GEMINI_API_KEY;delete process.env.GEMINI_API_KEY;try{const r=await request();assert.equal(r.code,503);assert.match(r.data.error,/not configured/);assert.equal(r.headers['Cache-Control'],'no-store');}finally{if(previous)process.env.GEMINI_API_KEY=previous;}});
