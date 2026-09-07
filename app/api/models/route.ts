export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { availableModels, PROMPT_INFO } from '@/lib/generation';
export async function GET() {
  return Response.json(
    {
      configured: !!process.env.DEEPSEEK_API_KEY,
      models: await availableModels(),
      defaultModel: PROMPT_INFO.model,
      prompt: PROMPT_INFO,
      provider: 'DeepSeek 官方',
      error: '',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
