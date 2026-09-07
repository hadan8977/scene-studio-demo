'use client';
import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { ArrowUpRight, ArrowUp, Bookmark, SlidersHorizontal, Sun, AudioLines, Thermometer, Plus, Check, ChevronRight, Wind, MessageCircle, Navigation, Layers, X, LoaderCircle, CircleHelp, Trash2, RotateCcw, CircleAlert, FolderOpen } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { EXAMPLES, exampleScene, replay } from '@/lib/examples';
import { elementOf, validateScene, PROFILE_LABELS, memoriesFor, registryVersion, type SceneResult, type Context, type ProfileId, type Decision } from '@/lib/scene';
import { readSaved, upsertSaved, STORAGE_KEY, type SavedScene } from '@/lib/storage';
import type { ModelOption, Timing, GenerationEvent } from '@/lib/generation';

const initialContext:Context={driving:false,profile:'none'};
const icons={光:Sun,声:AudioLines,气:Wind,温:Thermometer,话:MessageCircle,供:Navigation,其他:Layers};
const order=['光','声','气','温','话','供','其他'];
const labelMap:Record<string,string>={'主驾温度控制':'主驾温度','音量':'媒体音量'};
const hints:Record<string,string>={'氛围灯亮度':'让车内的光安静下来','音量':'留一点声音，也留一点空间','主驾温度控制':'舒服的温度，不用再调','声场':'声音留在需要的位置','自动空气净化':'让空气清爽一点','主驾车窗':'给空气留一条缝'};
const tags:Record<string,string>={planned:'规划中',proposed:'提议中',adjusted:'已调整',forbidden:'不允许',unsupported:'做不了'};
const formatTime=(n:number|null|undefined)=>n==null?'—':n.toFixed(2)+' s';
type Source='live'|'example';
type Toast={text:string;error?:boolean};

export default function SceneStudio(){
 const [ctx,setCtx]=useState<Context>(initialContext);
 const [result,setResult]=useState<SceneResult|null>(()=>validateScene(exampleScene('rain',initialContext),initialContext,EXAMPLES[0].input));
 const [heard,setHeard]=useState(EXAMPLES[0].input),[input,setInput]=useState(''),[editing,setEditing]=useState(false);
 const [mode,setMode]=useState<Source>('example'),[source,setSource]=useState<Source>('example');
 const [models,setModels]=useState<ModelOption[]>([]),[model,setModel]=useState(''),[configured,setConfigured]=useState(false),[catalogError,setCatalogError]=useState(''),[catalogLoading,setCatalogLoading]=useState(true);
 const [busy,setBusy]=useState(false),[streamText,setStreamText]=useState(''),[elapsed,setElapsed]=useState(0),[status,setStatus]=useState(''),[error,setError]=useState('');
 const [timing,setTiming]=useState<Timing|null>(null),[modelUsed,setModelUsed]=useState('');
 const [review,setReview]=useState(false),[library,setLibrary]=useState(false),[saved,setSaved]=useState<SavedScene[]>([]),[activeId,setActiveId]=useState<string|null>(null),[isSaved,setIsSaved]=useState(false),[why,setWhy]=useState(false),[notice,setNotice]=useState<Toast|null>(null);
 const inp=useRef<HTMLInputElement>(null),abort=useRef<AbortController|null>(null),requestId=useRef(0),started=useRef(0),mounted=useRef(true);
 const stateRef=useRef({result,source,heard,busy,activeId,saved});stateRef.current={result,source,heard,busy,activeId,saved};
 const showToast=(text:string,isError=false)=>setNotice({text,error:isError});
 async function loadModels(){setCatalogLoading(true);setCatalogError('');try{const response=await fetch('/api/models');if(!response.ok)throw new Error();const data=await response.json() as {models:ModelOption[];defaultModel:string;configured:boolean;error?:string};if(!mounted.current)return;setModels(data.models||[]);setModel(m=>data.models?.some((x:ModelOption)=>x.id===m)?m:data.defaultModel||'');setConfigured(!!data.configured);setCatalogError(data.error||'');}catch{if(mounted.current)setCatalogError('模型目录暂时连接不上，可稍后重试');}finally{if(mounted.current)setCatalogLoading(false);}}
 useEffect(()=>{mounted.current=true;try{setSaved(readSaved(localStorage.getItem(STORAGE_KEY)));}catch{showToast('浏览器存储不可用，保存功能暂时不可用',true);}void loadModels();return()=>{mounted.current=false;abort.current?.abort();};},[]);
 useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(null),4500);return()=>clearTimeout(id);},[notice]);
 useEffect(()=>{if(!busy)return;const id=setInterval(()=>setElapsed((performance.now()-started.current)/1000),100);return()=>clearInterval(id);},[busy]);
 function cancel(){requestId.current++;abort.current?.abort();setBusy(false);setStreamText('');setStatus('');}
 function changeContext(next:Context){cancel();setCtx(next);setIsSaved(false);setTiming(null);if(result){const validated=validateScene(result.scene,next,heard);setResult({...validated,memoryUsed:result.memoryUsed.filter(m=>memoriesFor(next).some(n=>n.content===m)),decisions:[...validated.decisions,...result.decisions.filter(d=>d.final===undefined && !validated.decisions.some(x=>x.primary===d.primary))]});}}
 function discard(){cancel();setResult(null);setHeard('');setInput('');setEditing(false);setActiveId(null);setIsSaved(false);setError('');setTiming(null);setWhy(false);inp.current?.focus();}
 async function run(text=input,forceNew=false):Promise<SceneResult|null>{
  const query=text.trim();if(!query)return null;
  cancel();const id=++requestId.current;const controller=new AbortController();abort.current=controller;
  const previous=!forceNew&&(editing||!!result?.scene.clarify)?result?.scene:undefined;
  setError('');setStatus('');setInput(query);setBusy(true);setElapsed(0);setStreamText('');started.current=performance.now();setTiming(null);setIsSaved(false);setWhy(false);
  let done=false;let output:SceneResult|null=null;const deadline=setTimeout(()=>controller.abort(),31000);
  try{
   if(mode==='example'){
    const next=replay(query,ctx,previous);
    // Example timing is solely an interface transition, never a measured model latency.
    await new Promise<void>((resolve,reject)=>{const t=setTimeout(resolve,650);controller.signal.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Cancelled','AbortError'));},{once:true});});
    if(id!==requestId.current)return null;output=next;setSource('example');setModelUsed('预设交互示例');done=true;
   }else{
    if(!configured)throw new Error('真实 AI 尚未连接。请先配置服务端密钥，再在评审面板刷新连接。');
    if(!model)throw new Error('没有可用的候选模型，请在评审面板刷新。');
    const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:query,model,context:ctx,currentScene:previous}),signal:controller.signal});
    if(!response.ok){const data=await response.json() as {error?:string};throw new Error(data.error||'生成暂时不可用');}
    if(!response.body)throw new Error('生成服务没有返回内容');
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    function handle(line:string){if(!line.startsWith('data:'))return;const event=JSON.parse(line.slice(5)) as GenerationEvent;if(id!==requestId.current)return;
     if(event.type==='understanding')setStreamText(event.text);
     if(event.type==='retry'){setStatus(event.text);setStreamText('');}
     if(event.type==='error')throw new Error(event.message);
     if(event.type==='result'){output=event.result;setTiming(event.timing);setModelUsed(event.model);setSource('live');done=true;}
    }
    try{while(true){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()||'';for(const line of lines)handle(line);}buffer+=decoder.decode();if(buffer.trim())handle(buffer);}finally{await reader.cancel().catch(()=>{});}
    if(!done)throw new Error('连接已中断，输入已保留，请重试');
   }
   if(id!==requestId.current)return null;
   setResult(output);setHeard(previous?heard:query);if(!previous){setActiveId(null);setEditing(false);}else setEditing(false);
   setInput('');setStreamText('');return output;
  }catch(e){if(id!==requestId.current)return null;const message=controller.signal.aborted?'等待已结束，输入已保留。可以重试。':e instanceof Error?e.message:'生成失败，请重试';setError(message);return null;}
  finally{clearTimeout(deadline);if(id===requestId.current){setBusy(false);setStatus('');}}
 }
 function saveCurrent(){const s=stateRef.current;if(!s.result?.savable||s.busy)throw new Error('请先完成一个可以保存的场景');const item:SavedScene={id:s.activeId||crypto.randomUUID(),input:s.heard,source:s.source,result:s.result,updatedAt:new Date().toISOString()};const next=upsertSaved(s.saved,item);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));setSaved(next);setActiveId(item.id);setIsSaved(true);showToast('已存入我的场景 · 尚未执行');return {id:item.id,name:item.result.scene.name};}catch{showToast('浏览器无法保存，请检查存储空间',true);throw new Error('保存失败');}}
 function openSaved(item:SavedScene){cancel();setResult(validateScene(item.result.scene,ctx,item.input));setHeard(item.input);setSource(item.source);setMode(item.source);setActiveId(item.id);setIsSaved(true);setEditing(false);setError('');setInput('');setLibrary(false);setTiming(null);}
 function removeMemory(content:string){changeContext({...ctx,ignoredMemories:[...(ctx.ignoredMemories||[]),content]});showToast('已移除此演示偏好，下次生成不再使用');}
 const actionsRef=useRef({run,saveCurrent});actionsRef.current={run,saveCurrent};
 useEffect(()=>{
  type Mcp={registerTool:(tool:{name:string;title:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>void|Promise<void>};
  const context=(document as Document & {modelContext?:Mcp}).modelContext;if(!context?.registerTool)return;const life=new AbortController();
  const tools=[{name:'create_scene_proposal',title:'生成场景提案',description:'用当前模式生成场景提案并显示结果，不保存也不执行车辆动作。示例模式仅支持页面列出的示例。',inputSchema:{type:'object',properties:{input:{type:'string',minLength:1,maxLength:1200}},required:['input'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(value:unknown){const v=value as {input?:unknown};if(typeof v?.input!=='string'||!v.input.trim()||v.input.length>1200)throw new Error('输入无效');const r=await actionsRef.current.run(v.input,true);if(!r)throw new Error('生成未完成');return {name:r.scene.name,savable:r.savable,clarify:r.scene.clarify};}},
   {name:'save_current_scene',title:'保存当前场景',description:'将当前已校验的提案保存到本浏览器，不执行车辆动作。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(value:unknown){if(!value||typeof value!=='object'||Object.keys(value).length)throw new Error('不接受参数');return actionsRef.current.saveCurrent();}}];
  for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:life.signal})).catch(()=>{});}catch{}}return()=>life.abort();
 },[]);
 const scene=result?.scene;
 const rows=(scene?.actions||[]).slice().sort((a,b)=>order.indexOf(elementOf(a.primary))-order.indexOf(elementOf(b.primary)));
 const exclusions=result?.decisions.filter(d=>d.final===undefined)||[];
 const displayConditions=scene?.conditions||[];
 const meaningfulSource=source==='example'?'示例提案 · 非实时生成':'AI 生成提案';
 function decisionFor(primary:string,kind='action'){return result?.decisions.find(d=>d.primary===primary&&d.kind===kind&&d.final!==undefined);}
 function rowView(primary:string,value:string,index:number,decision?:Decision){const element=elementOf(primary),Icon=icons[element];const numeric=/^(\d+(?:\.\d+)?)(%|℃|挡)$/.exec(value);const parts=numeric?[numeric[1],numeric[2]==='℃'?'°C':numeric[2]]:null;const changed=result?.changed.includes(primary);return <div key={primary+index} className={'action-row'+(changed?' changed':'')} style={{animationDelay:`${index*60}ms`} as CSSProperties}><div className="element-icon"><Icon size={23}/></div><span className="element-name">{element}</span><div className="action-description">{labelMap[primary]||primary}{decision&&decision.status!=='accepted'&&<span className={'inline-tag '+decision.status}>{tags[decision.status]}</span>}<small>{decision&&decision.status!=='accepted'?decision.reason:hints[primary]||'按这个场景的需要设置'}{changed?' · 刚刚修改':''}</small></div><div className={'action-value'+(!parts?' text-value':'')}>{decision?.status==='adjusted'&&<del>{decision.original}</del>}{parts?<>{parts[0]}<span>{parts[1]}</span></>:value}</div>{parts&&parts[1]==='%'?<div className="level-meter" aria-hidden="true">{Array.from({length:10},(_,i)=><i key={i} className={i<Number(parts[0])/10?'lit':''}/>)}</div>:<div className="value-note">{parts?.[1]==='°C'?'恒温':changed?'已更新':''}</div>}</div>;}
 return <main className="studio">
  <header className="topbar"><a href="/" className="wordmark" aria-label="场景首页"><span className="brand-mark">∥</span>场景<span className="brand-en">SCENE</span></a><nav><button className="nav-button" onClick={()=>setLibrary(true)}><Bookmark size={17}/>我的场景<span className="count">{saved.length}</span></button><button className="icon-button" aria-label="打开评审面板" title="评审面板" onClick={()=>setReview(true)}><SlidersHorizontal size={19}/></button></nav></header>
  <section className="workspace"><div className="workspace-heading"><div><p className="eyebrow">MADE FOR YOUR MOMENT</p><h1>此刻，刚刚好。</h1></div><button className="context-label" onClick={()=>setReview(true)}><i/>{ctx.driving?'行驶中':'停车中'}<span className="divider"/><span className="profile-short">{ctx.profile==='none'?'个人空间':PROFILE_LABELS[ctx.profile].split(' · ')[0]+'的空间'}</span></button></div>
  <div className={'scene-card'+(busy?' generating':'')} aria-busy={busy}>
   <div className="card-topline"><span>{busy?'正在理解':scene?.clarify?'需要你补充':isSaved?'我的场景':'场景提案'} <span className="muted">/ 01</span></span><span className="source-label">{busy?(mode==='example'?'示例交互 · 非模型调用':'实时生成中'):meaningfulSource}</span></div>
   {busy?<div className="loading-scene" role="status"><div className="listening-mark"><i/><i/><i/></div><p className="heard">“{input}”</p><h2>{streamText?'我听懂了':'留一点时间'}<span className="title-dot">.</span></h2><p className="understanding">{streamText||(mode==='example'?'正在展开这份示例提案。':elapsed>=2.5?'我再想想，正在整理适合你的方案。':'正在理解你的需要。')}</p><div className="loading-bottom"><span>{status||(mode==='live'?`${elapsed.toFixed(1)} 秒 · 仅展示经过校验的动作`:'示例过渡，不计入真实时延')}</span><button className="text-button" onClick={cancel}>取消</button></div></div>:scene?<>
    <div className="scene-intro"><p className="heard">“{heard}”</p><h2>{scene.name||'这一刻'}<span className="title-dot">.</span></h2><p className="understanding">{scene.understanding||'这一句暂时不需要创建车内场景。'}</p>{!ctx.driving&&<div className="conditions">{displayConditions.length?displayConditions.map((c,i)=>{const d=decisionFor(c.primary,'condition');return <span key={c.primary+i}>{i===0?'当':scene.logic==='AND'?'且':'或'}<span className="condition-value">{c.primary} {c.op==='=='?'':c.op} {c.secondary}{d?.status==='planned'||d?.status==='proposed'?<small>{tags[d.status]}</small>:null}</span></span>}):<span>使用方式<span className="condition-value">手动开启</span></span>}</div>}</div>
    {scene.clarify?<div className="clarification"><CircleHelp size={22}/><p>{scene.clarify}</p></div>:ctx.driving?<div className="driving-summary"><p>场景：{scene.name}</p><p>动作：{rows.map(a=>`${labelMap[a.primary]||a.primary} ${a.secondary}`).join('，')||'暂无可用动作'}</p><p>停车后可查看完整提案并编辑{exclusions.length?' · 有'+exclusions.length+'项未采用':''}</p></div>:<>
     <div className="arrangement"><div className="section-caption">为你布置<span>{String(rows.length).padStart(2,'0')} 个动作</span></div>{rows.map((a,i)=>rowView(a.primary,a.secondary,i,decisionFor(a.primary)))}{scene.say&&rowView('小塔播报',scene.say,rows.length)}{!rows.length&&!scene.say&&<p className="no-actions">这次不安排车内动作。</p>}</div>
     {exclusions.length>0&&<div className="excluded-items">{exclusions.map((d,i)=><div key={d.primary+i}><CircleAlert size={15}/><div><span className="excluded-title">{d.primary}{d.original&&d.original!==heard?' · '+d.original:''}</span><small>{d.reason}</small></div><span className="inline-tag">{tags[d.status]}</span></div>)}</div>}
     {!!result?.memoryUsed.length&&<div className="memory-strip"><span>用到了你的偏好</span>{result.memoryUsed.map(m=><button key={m} onClick={()=>removeMemory(m)} title="移除此演示偏好">{m}<X size={12}/></button>)}</div>}
     {!!scene.memory.length&&<div className="memory-strip pending-memory"><span>建议记住 · 尚未保存</span>{scene.memory.map((m,i)=><span key={i}>{m.content}</span>)}</div>}
    </>}
    <div className="card-note"><span className="note-dot"/>{result?.conceptual?'含规划或提议能力，仅概念展示。':'所有动作由你确认，保存后不会立即执行。'}<button onClick={()=>setWhy(!why)} aria-expanded={why}>为什么这样布置<ChevronRight size={14}/></button></div>
    {why&&<div className="why-content"><p>{scene.understanding}</p><p>{result?.memoryUsed.length?'参考了上方列出的偏好。':'未使用记忆档案。'}{exclusions.length?` ${exclusions.length}项请求未采用，原因已在提案中列出。`:''}</p>{!!scene.warnings.length&&<p>{scene.warnings.join('；')}</p>}</div>}
    <div className="card-actions"><button className="primary-button" disabled={!result?.savable||isSaved||ctx.driving} onClick={()=>{try{saveCurrent();}catch{}}}><Check size={17}/>{isSaved?'已保存':'就这样保存'}</button><button className="secondary-button" disabled={ctx.driving} onClick={()=>{setEditing(true);setInput('');inp.current?.focus();}}>{scene.clarify?'补充一句':'改一下'}<ArrowUpRight size={16}/></button><button className="text-button" onClick={discard}>不用</button>{ctx.driving&&<span className="driving-note">停车后继续</span>}</div>
   </>:<div className="empty-scene"><div className="empty-emblem"><Plus size={34}/></div><h2>从你的一句话开始<span className="title-dot">.</span></h2><p>说一个场景，或者一种你想要的感觉。</p><span>光、声、空气与温度，会找到适合的组合。</span></div>}
  </div>
  {editing&&<div className="edit-indicator"><span>正在修改「{scene?.name}」· 其他设置会保留</span><button onClick={()=>{setEditing(false);setInput('');}}>退出修改<X size={13}/></button></div>}
  <form className={'composer'+(editing?' editing':'')} onSubmit={e=>{e.preventDefault();void run();}}><span className="composer-symbol">{editing?<SlidersHorizontal size={20}/>:<Plus size={22}/>}</span><input ref={inp} aria-label={editing?'修改当前场景':'描述你想要的场景'} value={input} onChange={e=>setInput(e.target.value)} maxLength={1200} placeholder={scene?.clarify?'补充一下你的想法':editing?'比如：灯再暗一点':'说说你想要的，剩下的交给我'} disabled={ctx.driving} onKeyDown={e=>{if(e.nativeEvent.isComposing&&e.key==='Enter')e.preventDefault();}}/><button type="submit" className="send-button" disabled={!input.trim()||ctx.driving} aria-label={busy?'重新生成':'生成场景'}>{busy?<LoaderCircle size={20} className="spin"/>:<ArrowUp size={21}/>}</button></form>
  {error&&<div className="error-line" role="alert"><CircleAlert size={17}/><span>{error}</span><button onClick={()=>void run()}>重试<RotateCcw size={13}/></button></div>}
  <div className="suggestions"><span>{editing?'只改一处':'也可以试试'}</span>{(editing?['灯再暗一点','小声一点','再凉一点']:EXAMPLES.slice(0,3).map(x=>x.label)).map(label=><button key={label} disabled={ctx.driving} onClick={()=>{const text=editing?label:EXAMPLES.find(x=>x.label===label)!.input;void run(text,!editing);}}>{label}<ArrowUpRight size={13}/></button>)}</div>
  <div className="connection-line"><span className={'connection-dot '+(mode==='live'&&configured?'connected':'')}/><span>{mode==='example'?'示例模式 · 自由对话需要连接真实 AI':configured?'真实 AI 已连接 · OpenRouter':'真实 AI 尚未连接'}</span><button onClick={()=>setReview(true)}>{mode==='example'?'切换真实 AI':'查看连接'}<ArrowUpRight size={12}/></button></div>
  <footer className="workspace-footer"><span>每一次布置，都由你说了算。</span><span>SCENE LAB<span className="tiny-dot"/>01</span></footer>
  </section>
  <Sheet open={review} onOpenChange={setReview}><SheetContent className="review-panel"><SheetHeader><SheetTitle>看见它的判断</SheetTitle><SheetDescription>产品评审 · 车况与档案均为演示数据</SheetDescription></SheetHeader><div className="panel-body">
   <section><h3>生成来源</h3><Select value={mode} onValueChange={v=>{if(v==='example'||v==='live'){cancel();setMode(v);setError('');}}}><SelectTrigger className="panel-select" aria-label="生成来源"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="example">示例模式 · 预设交互</SelectItem><SelectItem value="live">真实 AI · OpenRouter</SelectItem></SelectContent></Select><div className="connection-details"><span>{catalogLoading?'正在检查连接…':configured?'服务端密钥已配置':'服务端密钥尚未配置'}</span><button onClick={()=>void loadModels()} disabled={catalogLoading}><RotateCcw size={13}/>刷新</button></div>{!configured&&<p className="panel-hint">在服务端配置 OPENROUTER_API_KEY 后刷新。密钥不会出现在浏览器。</p>}{catalogError&&<p className="panel-error">{catalogError}</p>}
   <label className="panel-label">模型</label><Select value={model} onValueChange={v=>{if(v)setModel(v);}}><SelectTrigger className="panel-select" aria-label="模型" disabled={!models.length}><SelectValue placeholder="等待可用模型"/></SelectTrigger><SelectContent>{models.map(m=><SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select><p className="panel-hint">仅列出项目候选中当前目录存在的模型。目录可见不代表密钥或额度有效。</p></section>
   <section><h3>这一刻的状态</h3><div className="panel-switch"><div>行驶中<small>切换后仅显示三行摘要</small></div><Switch checked={ctx.driving} onCheckedChange={driving=>changeContext({...ctx,driving})} aria-label="行驶中"/></div><label className="panel-label">记忆档案</label><Select value={ctx.profile} onValueChange={v=>{if(v)changeContext({...ctx,profile:v as ProfileId,ignoredMemories:[]});}}><SelectTrigger className="panel-select" aria-label="记忆档案"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(PROFILE_LABELS).map(([id,label])=><SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select>{memoriesFor(ctx).length?memoriesFor(ctx).map(m=><div className="profile-memory" key={m.content}><span><small>{m.type==='dislike'?'不喜欢':'偏好'}</small>{m.content}</span><button aria-label={'删除偏好：'+m.content} onClick={()=>removeMemory(m.content)}><Trash2 size={14}/></button></div>):<p className="panel-hint">没有可用记忆。切换档案后，再生成同一句话比较差异。</p>}</section>
   <section><h3>本次链路</h3><ol className="route-list"><li><i/>场景应用输入<span>用户主动创建</span></li><li><i/>{source==='example'?'预设交互示例':'场景大脑 · 一次调用'}<span>{source==='example'?'未调用模型':modelUsed||'等待生成'}</span></li><li><i/>独立验证器<span>{result?`${result.decisions.filter(d=>d.status!=='accepted').length}项标注或裁决`:'等待提案'}</span></li><li><i/>场景提案<span>等待你的决定，不执行车辆动作</span></li></ol><div className="timing-grid"><div>首字<b>{source==='live'?formatTime(timing?.ttft):'—'}</b></div><div>理解句出齐<b>{source==='live'?formatTime(timing?.understanding):'—'}</b></div><div>完整结果<b>{source==='live'?formatTime(timing?.total):'—'}</b></div></div><p className="panel-hint">{source==='example'?'示例动画不是模型时延。':'目标：理解句0.6秒、完整结果2.5秒。以上为实际测量，不代表已达标。'}</p></section>
   <section><h3>裁决记录</h3>{result?.decisions.length?result.decisions.map((d,i)=><div className="decision" key={i}><div><b>{d.primary}</b><span className={'decision-status '+d.status}>{d.status==='accepted'?'通过':tags[d.status]}</span></div><p>{d.original}{d.final&&d.final!==d.original?' → '+d.final:''}</p><small>{d.reason}</small></div>):<p className="panel-hint">尚无裁决记录</p>}<p className="panel-hint">注册表 {registryVersion} · 96条</p></section>
   <section><h3>更多评审例子</h3><div className="panel-examples">{EXAMPLES.slice(3).map(x=><button key={x.id} onClick={()=>{if(ctx.driving){showToast('先切换到停车状态',true);return;}setReview(false);void run(x.input,true);}}>{x.label}<ArrowUpRight size={14}/></button>)}</div></section>
   <details className="raw-data"><summary>结构化结果</summary><pre>{JSON.stringify(result,null,2)}</pre></details>
  </div></SheetContent></Sheet>
  <Sheet open={library} onOpenChange={setLibrary}><SheetContent className="review-panel"><SheetHeader><SheetTitle>我的场景 <span className="muted">{saved.length}</span></SheetTitle><SheetDescription>保存在当前浏览器 · 保存不会执行车辆动作</SheetDescription></SheetHeader><div className="panel-body">{saved.length?saved.map(item=><button key={item.id} className="saved-item" onClick={()=>openSaved(item)}><div><span className="saved-source">{item.source==='example'?'示例场景':'AI生成'}{item.result.conceptual?' · 含概念能力':''}</span><h3>{item.result.scene.name}</h3><p>{item.result.scene.actions.length}个动作 · {item.result.scene.conditions.length?'按条件触发':'手动开启'}</p><small>{item.input}</small></div><ArrowUpRight size={20}/></button>):<div className="empty-library"><FolderOpen size={35}/><h3>还没有保存的场景</h3><p>遇到合适的提案，点“就这样保存”。</p><button className="secondary-button" onClick={()=>setLibrary(false)}>回到提案</button></div>}</div></SheetContent></Sheet>
  {notice&&<div className={'toast-message'+(notice.error?' toast-error':'')} role="status">{notice.error?<CircleAlert size={17}/>:<Check size={17}/>} {notice.text}</div>}
 </main>;
}
