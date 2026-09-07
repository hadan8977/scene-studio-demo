import { emptyScene, type Scene, type Context, memoriesFor, validateScene, mergeEdit, type SceneResult } from './scene.ts';
export const EXAMPLES = [
 {id:'rain',label:'雨夜回家',input:'做一个雨夜回家的场景'},
 {id:'wait',label:'等人时，舒服一点',input:'等人时，帮我布置得舒服一点'},
 {id:'quiet',label:'别吵醒后排',input:'做个安静场景，别吵醒后排'},
 {id:'boundary',label:'看看能力边界',input:'把氛围灯改成蓝色，关闭行人警报音，车窗开到50%'},
 {id:'clarify',label:'试试追问',input:'帮我把那个打开'},
 {id:'english',label:'Try in English',input:'Create a quiet scene for waiting in the car'},
];
export function exampleScene(id:string,ctx:Context):Scene {
 const s={...emptyScene(),intent:'vague',relevance:.9};const mem=memoriesFor(ctx);const fresh=mem.some(m=>m.content.includes('22℃'));const light=mem.some(m=>m.content.includes('亮度40%'))?'40%':mem.some(m=>m.content.includes('亮度20%'))?'20%':'30%';const purify=mem.some(m=>m.content.includes('空气净化'));
 if(id==='rain')return {...s,intent:'precise',name:'雨夜归途',understanding:'你说的“雨夜回家”，是让路上的这一段，更安稳一点。',conditions:[{primary:'时段',op:'==',secondary:'夜晚'},{primary:'天气',op:'==',secondary:'雨'},{primary:'位置',op:'==',secondary:'家'}],actions:[{primary:'氛围灯亮度',secondary:'30%'},{primary:'音量',secondary:'20%'},{primary:'主驾温度控制',secondary:'24℃'}]};
 if(id==='wait'||id==='english')return {...s,name:id==='english'?'Quiet moment':'等你的片刻',understanding:id==='english'?'“A quiet scene for waiting” — a little less light, a comfortable temperature.':'“等人时舒服一点”，把这段等待，留给自己。',actions:[{primary:'氛围灯亮度',secondary:light},{primary:'音量',secondary:'20%'},{primary:'主驾温度控制',secondary:fresh?'22℃':'24℃'},...(purify?[{primary:'自动空气净化',secondary:'开启'}]:[])]};
 if(id==='quiet')return {...s,name:'轻一点',understanding:'“别吵醒后排”，声音留在前排，光也收一点。',actions:[{primary:'氛围灯亮度',secondary:'20%'},{primary:'声场',secondary:'前排模式'},{primary:'音量',secondary:'20%'}]};
 if(id==='boundary')return {...s,intent:'action',name:'透透气',understanding:'你想“车窗开到50%”，我会说明能做的部分和需要保留的边界。',actions:[{primary:'低速行人警报音',secondary:'关闭'},{primary:'主驾车窗',secondary:'50%'}],unsupported:['氛围灯改成蓝色']};
 return {...s,intent:'clarify',name:'再告诉我一点',understanding:'你说的“那个”，还需要一个具体对象。',clarify:'你想打开空调、灯光，还是车窗？'};
}
export function replay(input:string,ctx:Context,current?:Scene):SceneResult {
 if(current){
  const s=structuredClone(current);s.clarify=null;s.memory=[];
  const patterns:[RegExp,string,(v:string)=>string][]=[[/暗|dimmer|darker/i,'氛围灯亮度',v=>Math.max(10,parseInt(v)-10)+'%'],[/亮|brighter/i,'氛围灯亮度',v=>Math.min(100,parseInt(v)+10)+'%'],[/小声|lower.*volume|quieter/i,'音量',v=>Math.max(0,parseInt(v)-10)+'%'],[/凉|cooler/i,'主驾温度控制',v=>Math.max(18,parseInt(v)-2)+'℃'],[/暖|warmer/i,'主驾温度控制',v=>Math.min(32,parseInt(v)+2)+'℃']];
  const match=patterns.find(([p])=>p.test(input));
  if(match){const a=s.actions.find(x=>x.primary===match[1]);if(a){a.secondary=match[2](a.secondary);s.understanding=`“${input}”，只调整${a.primary}，其余保留。`;const merged=mergeEdit(current,s,input);return {...validateScene(merged.scene,ctx,input),changed:merged.changed};}}
  if(current.clarify && /空调|灯光|车窗/.test(input)){s.intent='action';s.name='随手开启';s.understanding=`“${input}”，这次只打开这一项。`;s.actions=[{primary:input.includes('空调')?'空调总开关':input.includes('灯光')?'氛围灯开关':'主驾车窗',secondary:input.includes('车窗')?'20%':'开启'}];return validateScene(s,ctx,input);}
  throw new Error('示例模式支持预设场景，以及“暗一点、小声一点、凉一点”等续改；自由对话请连接真实 AI。');
 }
 const example=EXAMPLES.find(x=>x.input===input || x.label===input);
 if(!example)throw new Error('这句话不在示例集中。请选择下方示例，或在评审面板连接真实 AI。');
 return validateScene(exampleScene(example.id,ctx),ctx,input);
}
