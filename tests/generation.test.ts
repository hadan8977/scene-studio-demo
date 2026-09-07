import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, inputFrom, understandingFromPartial, type GenerationEvent } from '../lib/generation.ts';
import { exampleScene } from '../lib/examples.ts';
const context={driving:false,profile:'none' as const};
function modelStream(text:string){const encoder=new TextEncoder();const fragments=text.match(/.{1,11}/gs)||[];const wire=fragments.map(content=>'data: '+JSON.stringify({choices:[{delta:{content}}]})+'\n\n').join('')+'data: [DONE]\n\n';const bytes=encoder.encode(wire);return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=7)c.enqueue(bytes.slice(i,i+7));c.close();}}));}
const payload={input:'做一个雨夜回家的场景',context,model:'qwen/qwen3.8-flash'};
function harness(responses:Response[]){let calls=0;const bodies:Record<string,unknown>[]=[];const fetcher=(async(url:RequestInfo|URL,options?:RequestInit)=>{
 if(String(url).endsWith('/models'))return Response.json({data:[{id:payload.model,name:'Qwen test fixture',supported_parameters:['temperature','response_format','reasoning']}]});
 calls++;bodies.push(JSON.parse(String(options?.body)));const r=responses.shift();if(!r)throw new Error('Unexpected request');return r;
 }) as typeof fetch;return {fetcher,get calls(){return calls;},bodies};}
test('stream handles split UTF-8 and SSE chunks, reports real timings and valid scene',async()=>{
 const h=harness([modelStream(JSON.stringify(exampleScene('rain',context)))]),events:GenerationEvent[]=[];
 await generate(payload,'test-secret',e=>events.push(e),new AbortController().signal,h.fetcher);
 const result=events.find(e=>e.type==='result');assert.ok(result&&result.type==='result');assert.equal(result.result.savable,true);assert.ok(events.some(e=>e.type==='understanding'));assert.ok(result.timing.understanding!==null);assert.ok(result.timing.understandingStart!=null);assert.ok(result.timing.understandingStart!>=result.timing.ttft!);assert.ok(result.timing.understanding!>=result.timing.understandingStart!);assert.ok(!JSON.stringify(events).includes('test-secret'));assert.equal(h.calls,1);
});
test('invalid JSON retries exactly once and surfaces retry event',async()=>{
 const h=harness([modelStream('not JSON'),modelStream(JSON.stringify(exampleScene('wait',context)))]),events:GenerationEvent[]=[];
 await generate(payload,'secret',e=>events.push(e),new AbortController().signal,h.fetcher);assert.equal(h.calls,2);assert.equal(events.filter(e=>e.type==='retry').length,1);assert.equal(events.filter(e=>e.type==='result').length,1);
});
test('second malformed response ends with error, no false result',async()=>{
 const h=harness([modelStream('wrong'),modelStream('{}')]),events:GenerationEvent[]=[];
 await assert.rejects(generate(payload,'secret',e=>events.push(e),new AbortController().signal,h.fetcher),/格式仍不完整/);assert.equal(h.calls,2);assert.equal(events.filter(e=>e.type==='result').length,0);
});
test('provider error is actionable and does not retry into replay',async()=>{
 const h=harness([new Response('private upstream details',{status:401})]);await assert.rejects(generate(payload,'secret',()=>{},new AbortController().signal,h.fetcher),/密钥无效/);assert.equal(h.calls,1);
});
test('provider disconnect is surfaced, no partial actions emitted',async()=>{
 const encoder=new TextEncoder();const r=new Response(new ReadableStream({start(c){c.enqueue(encoder.encode('data: {"error":{"message":"failed"}}\n\n'));c.close();}}));
 const h=harness([r]),events:GenerationEvent[]=[];await assert.rejects(generate(payload,'secret',e=>events.push(e),new AbortController().signal,h.fetcher),/中断/);assert.ok(!events.some(e=>e.type==='result'));
});
test('abort signal is forwarded to provider and ends generation',async()=>{
 const a=new AbortController();a.abort();const fetcher=(async(_url:RequestInfo|URL,opts?:RequestInit)=>{opts?.signal?.throwIfAborted();throw new Error('not aborted');}) as typeof fetch;
 await assert.rejects(generate(payload,'secret',()=>{},a.signal,fetcher),/abort/i);
});
test('input validation rejects invalid context and malformed draft',()=>{
 assert.throws(()=>inputFrom({...payload,context:{driving:'yes',profile:'none'}}));assert.throws(()=>inputFrom({...payload,input:'x'.repeat(1201)}));assert.throws(()=>inputFrom({...payload,currentScene:{}}));
 assert.equal(inputFrom(payload).model,payload.model);
});
test('understanding parser supports escaped quotes without inventing completion',()=>{
 assert.deepEqual(understandingFromPartial('{"understanding":"他说\\"安静\\"'),{text:'他说"安静"',complete:false});
 assert.deepEqual(understandingFromPartial('{"understanding":"安静","name"'),{text:'安静',complete:true});
});
