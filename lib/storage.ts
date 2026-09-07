import { parseScene, type SceneResult, type ProfileId } from './scene.ts';
export type SavedScene={id:string;input:string;source:'live'|'example';result:SceneResult;updatedAt:string;profileId?:ProfileId};
export const STORAGE_KEY='scene-studio.saved.v1';
export function readSaved(text:string|null):SavedScene[]{
 if(!text)return [];try{const data=JSON.parse(text);if(!Array.isArray(data))return [];return data.filter(x=>{try{return typeof x.id==='string' && typeof x.input==='string' && ['live','example'].includes(x.source) && typeof x.updatedAt==='string' && Array.isArray(x.result?.decisions) && !!parseScene(x.result.scene);}catch{return false;}}).slice(0,60);}catch{return [];}
}
export function upsertSaved(items:SavedScene[],item:SavedScene):SavedScene[]{return [item,...items.filter(x=>x.id!==item.id)].slice(0,60);}
