export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { availableModels, PROMPT_INFO } from '@/lib/generation';
import { Part1Client, runtimeConfigured } from '@/lib/runtime-client';
export async function GET() {
  if (runtimeConfigured()) {
    try {
      const health = await new Part1Client().json('/health');
      return Response.json({ configured: true, models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash · 技术结构', thinking: 'disabled', parameters: ['strict_tool'] }], defaultModel: 'deepseek-v4-flash', provider: 'Part 1 Runtime', prompt: health, error: '' }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return Response.json({ configured: false, models: [], defaultModel: '', provider: 'Part 1 Runtime', error: '技术服务暂时不可达，请检查本地服务。' }, { headers: { 'Cache-Control': 'no-store' } });
    }
  }
  return Response.json(
    {
      configured: !!process.env.DEEPSEEK_API_KEY,
      models: await availableModels(),
      defaultModel: PROMPT_INFO.model,
      prompt: PROMPT_INFO,
      provider: '腾讯 dsv4flash 代理（失败回落 DeepSeek 官网）',
      error: '',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
