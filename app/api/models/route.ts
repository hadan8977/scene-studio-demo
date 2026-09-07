import { env } from 'cloudflare:workers';
import { availableModels } from '@/lib/generation';
export async function GET(){
 const config=env as unknown as Record<string,string|undefined>;
 try{const models=await availableModels();return Response.json({configured:!!config.OPENROUTER_API_KEY,models,defaultModel:models.some(m=>m.id===config.OPENROUTER_MODEL)?config.OPENROUTER_MODEL:models[0]?.id||'',error:models.length?'':'候选模型暂不可用'},{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({configured:!!config.OPENROUTER_API_KEY,models:[],defaultModel:'',error:'模型目录连接失败，请刷新重试'},{headers:{'Cache-Control':'no-store'}});}
}
