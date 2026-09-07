import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { emptyScene } from '../lib/scene';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3100' });
for (const key of ['window','document','localStorage']) Object.defineProperty(globalThis,key,{value:key==='window'?dom.window:(dom.window as any)[key],configurable:true});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { useSceneController } = await import('../lib/use-scene-controller');
const { useExperience } = await import('../components/figma-make/useExperience');
let controller: ReturnType<typeof useSceneController>, experience: ReturnType<typeof useExperience>;
function Harness() { controller=useSceneController(false); experience=useExperience(controller); return <output>{experience.feedback}</output>; }

void test('runtime product flow awaits save, surfaces blocked segment and restores through backend', async () => {
  const operations: string[]=[];
  const scene={...emptyScene(),understanding:'柔和灯光和温暖座椅，休息片刻',intent:'vague',name:'歇歇',relevance:.8,actions:[{primary:'氛围灯亮度',secondary:'20%'},{primary:'主驾座椅加热',secondary:'1挡'}]};
  const runtime={proposalId:'p1',registryRevision:'r1',valid:true,executable:true,trace:[],proposedScene:scene};
  globalThis.fetch=async (url,options)=>{
    if(String(url)==='/api/models') return Response.json({configured:true,provider:'Part 1 Runtime',models:[{id:'deepseek-v4-flash',name:'Flash'}],defaultModel:'deepseek-v4-flash'});
    if(String(url)==='/api/generate')return new Response('data: '+JSON.stringify({type:'result',result:{scene,savable:true,conceptual:false,decisions:[],changed:[],memoryUsed:[],runtime},timing:{ttft:1,understanding:1.2,total:2,attempts:1},model:'Flash'})+'\n\n');
    assert.equal(String(url),'/api/runtime');
    const body=JSON.parse(options!.body as string);operations.push(body.operation);
    return Response.json({proposal_id:'p1',scene_id:'p1',registry_revision:'r1',vehicle:body.operation==='restore'?{}:{氛围灯亮度:'20%'},virtual_seconds:body.operation==='advance'?3:0,timeline:body.operation==='apply_once'?[{due:.02,status:'pending',execution_id:'p1'}]:body.operation==='advance'?[{due:.02,status:'blocked',execution_id:'p1'}]:[]});
  };
  const root=createRoot(document.getElementById('root')!);
  await act(async()=>{root.render(<Harness/>);});
  assert.equal(controller.runtimeEnabled,true);
  await act(async()=>{await controller.run('准备休息',true,'live');});
  await act(async()=>{await experience.applyOnce();await new Promise(r=>setTimeout(r,60));});
  assert.ok(experience.feedback.includes('后续动作已停止'));
  assert.equal(experience.application,'idle');
  await act(async()=>{await controller.saveCurrent();});
  assert.equal(controller.saved[0].id,'p1');
  assert.equal(controller.saved[0].result.runtime?.proposalId,'p1');
  await act(async()=>{await experience.undo();});
  assert.deepEqual(experience.vehicle,{});
  assert.deepEqual(operations,['apply_once','advance','save','restore']);
  await act(async()=>root.unmount());
});
