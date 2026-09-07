import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '场景 · 一句话，刚刚好', description: '把一句话，变成适合此刻的车内场景。' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
 return <html lang="zh-CN" className="dark"><body>{children}</body></html>;
}
