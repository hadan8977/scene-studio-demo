export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { availableModels, PROMPT_INFO, generationConfigured } from '@/lib/generation';
import { Part1Client, runtimeConfigured } from '@/lib/runtime-client';
export async function GET() {
  if (runtimeConfigured()) {
    try {
      const health = await new Part1Client().json('/health');
      return Response.json({ configured: true, models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash · 技术结构', thinking: 'disabled', parameters: ['strict_tool'] }], defaultModel: 'deepseek-v4-flash', provider: 'Part 1 Runtime', prompt: health, error: '' }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      // 技术服务掉线不该让整站不可用：退回直连生成，只是观察入口用不了。
    }
  }
  return Response.json(
    {
      configured: generationConfigured(),
      models: await availableModels(),
      defaultModel: PROMPT_INFO.model,
      prompt: PROMPT_INFO,
      provider: 'DeepSeek 官网（备用：腾讯 dsv4flash 代理）',
      error: runtimeConfigured() ? '技术服务暂时不可达，观察入口不可用，其余功能正常。' : '',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
