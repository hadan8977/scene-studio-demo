/**
 * 输出契约的字段上限。
 *
 * 这份数字和 lib/data/p36-release.json 的 contract 段是同一份，冻结评测用的
 * 也是它；tests/contract.test.ts 会核对两边一致，防止改了一边忘了另一边。
 * 单独成文件是因为 lib/scene.ts 会进浏览器包，不能把整段系统提示词带过去。
 *
 * 中文全角、英文半角，同宽的卡片能放下约两倍英文字符，所以两种语言各有上限。
 * name 不分语言：冻结评测里它就是一个 14 的定值。
 */
export const CONTRACT = {
  understanding: { zh: 120, en: 200 },
  name: { zh: 14, en: 14 },
  say: { zh: 30, en: 60 },
  actions: 8,
  conditions: 4,
  memory: 3,
} as const;

export type FieldLimit = { zh: number; en: number };

/**
 * 按码点数，和评测脚本里 Python 的 len() 一致；JS 的 .length 数的是
 * UTF-16 单元，遇到超出基本平面的字符会和评测口径对不上。
 */
export const countChars = (text: string) => Array.from(text).length;

export const isLatin = (text: string) =>
  !Array.from(text).some((ch) => ch.codePointAt(0)! > 0x7f);

export const capOf = (text: string, limit: FieldLimit) =>
  isLatin(text) ? limit.en : limit.zh;

export const overflows = (text: string, limit: FieldLimit) =>
  countChars(text) > capOf(text, limit);
