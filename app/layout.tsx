import type { Metadata } from 'next';
import './globals.css';
import './cockpit-theme.css';
export const metadata: Metadata = {
  title: '小塔场景 · LUMA 座舱',
  icons: { icon: '/favicon.svg' },
  description: '在车机中用一句话创建场景，查看、续改并保存在我的场景。',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
