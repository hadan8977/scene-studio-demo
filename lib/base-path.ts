/**
 * 站点挂在子路径下时（例如 hadan.blog/demo0908），Next 的 basePath 只管
 * next/link、路由和静态资源，裸 fetch('/api/...') 不会自动加前缀，会打到站点根上。
 * 所有客户端请求都走这里拼路径。本地开发不设这个变量，前缀为空，行为不变。
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const apiUrl = (path: string) => `${BASE_PATH}${path}`;
