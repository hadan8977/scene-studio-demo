import type { NextConfig } from 'next';

// 部署到子路径时设 NEXT_PUBLIC_BASE_PATH=/demo0908；不设则挂在站点根上。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  async redirects() {
    // 站点根落在子路径演示上，免得访问 hadan.blog 看到 404。
    return basePath
      ? [{ source: '/', destination: basePath, basePath: false, permanent: false }]
      : [];
  },
};

export default nextConfig;
