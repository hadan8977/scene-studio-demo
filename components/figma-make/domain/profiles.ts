// ── 记忆档案（轻量）─────────────────────────────────────────
// 演示"同一句话不同方案"。偏好可移除，负面偏好优先。

import type { Profile } from './types';

export const PROFILES: Profile[] = [
  {
    id: 'none',
    name: '默认',
    blurb: '个人偏好',
    preferences: [],
  },
  {
    id: 'lin',
    name: '林',
    blurb: '偏暗的灯、较低音量、24℃',
    preferences: [
      { id: 'lin_light', label: '偏暗的氛围灯' },
      { id: 'lin_vol', label: '较低音量' },
      { id: 'lin_temp', label: '温度 24℃' },
      { id: 'lin_no_fragrance', label: '香氛', negative: true },
    ],
  },
  {
    id: 'zhou',
    name: '周',
    blurb: '更亮一点、22℃、空气净化',
    preferences: [
      { id: 'zhou_light', label: '更亮的氛围灯' },
      { id: 'zhou_temp', label: '温度 22℃' },
      { id: 'zhou_purify', label: '偏好空气净化' },
      { id: 'zhou_no_window', label: '车窗', negative: true },
    ],
  },
];

export function getProfile(
  id: string,
  overrides?: Record<string, string[]>,
): Profile {
  const base = PROFILES.find((p) => p.id === id) ?? PROFILES[0];
  const removed = overrides?.[id] ?? [];
  if (removed.length === 0) return base;
  return {
    ...base,
    preferences: base.preferences.filter((p) => !removed.includes(p.id)),
  };
}
