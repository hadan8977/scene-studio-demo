import registry from './data/capabilities.json' with { type: 'json' };
export type UserPreference = {
  id: string;
  primary: string;
  value: string;
  negative: boolean;
  deleted?: boolean;
};
export const PREFERENCE_FIELDS = [
  { primary: '主驾温度控制', label: '温度' },
  { primary: '氛围灯亮度', label: '氛围灯' },
  { primary: '音量', label: '媒体音量' },
  { primary: '声场', label: '声场' },
  { primary: '自动空气净化', label: '空气净化' },
  { primary: '内外循环设置', label: '空气循环' },
  { primary: '主驾座椅通风', label: '座椅通风' },
  { primary: '主驾座椅加热', label: '座椅加热' },
  { primary: '方向盘加热', label: '方向盘加热' },
  { primary: '香氛开关', label: '香氛' },
  { primary: '主驾车窗', label: '车窗' },
  { primary: '屏幕亮度', label: '屏幕亮度' },
  { primary: '备注', label: '其他偏好' },
];
export const preferenceLabel = (primary: string) =>
  PREFERENCE_FIELDS.find((f) => f.primary === primary)?.label || primary;
export function preferenceValues(primary: string): string[] {
  const cap = registry.capabilities.find((c) => c.zh === primary),
    spec = cap?.act_values;
  if (!spec) return [];
  if (Array.isArray(spec))
    return spec.filter(
      (v) =>
        !['自定义'].includes(v) &&
        !(cap?.deny_act_values as string[] | undefined)?.includes(v),
    );
  const [lo, hi, step, unit] = spec.range;
  return Array.from(
    {
      length: Math.min(
        110,
        Math.floor((Number(hi) - Number(lo)) / Number(step)) + 1,
      ),
    },
    (_, i) => `${Number(lo) + i * Number(step)}${unit}`,
  );
}
export function validPreference(p: unknown): p is UserPreference {
  if (!p || typeof p !== 'object') return false;
  const a = p as UserPreference;
  return (
    typeof a.id === 'string' &&
    a.id.length > 0 &&
    a.id.length < 100 &&
    PREFERENCE_FIELDS.some((f) => f.primary === a.primary) &&
    typeof a.value === 'string' &&
    typeof a.negative === 'boolean' &&
    (a.deleted === undefined || typeof a.deleted === 'boolean') &&
    (a.primary === '备注'
      ? a.value.trim().length > 0 && a.value.length <= 120
      : preferenceValues(a.primary).includes(a.value)) &&
    (!a.negative || ['香氛开关', '主驾车窗', '备注'].includes(a.primary))
  );
}
export function readPreferences(value: unknown): UserPreference[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>(),
    ids = new Set<string>();
  return value
    .filter(validPreference)
    .slice(0, 24)
    .filter((p) => {
      const key = p.primary === '备注' ? p.primary + p.id : p.primary;
      if (ids.has(p.id) || (!p.deleted && seen.has(key))) return false;
      ids.add(p.id);
      if (!p.deleted) seen.add(key);
      return true;
    })
    .map((p) => ({
      id: p.id,
      primary: p.primary,
      value: p.value.trim(),
      negative: p.negative,
      deleted: !!p.deleted,
    }));
}
export function preferenceMemory(p: UserPreference) {
  const content = p.negative
    ? p.primary === '香氛开关'
      ? '不喜欢香氛，不要开香氛'
      : p.primary === '主驾车窗'
        ? '不喜欢开车窗'
        : p.value
    : p.primary === '主驾温度控制'
      ? `主驾温度${p.value}`
      : p.primary === '氛围灯亮度'
        ? `等人或休息时氛围灯亮度${p.value}`
        : p.primary === '音量'
          ? `等人或休息时媒体音量${p.value}`
          : p.primary === '自动空气净化' && p.value === '开启'
            ? '喜欢自动空气净化'
            : p.primary === '备注'
              ? p.value
              : `${p.primary}${p.value}`;
  return {
    type: p.negative ? ('dislike' as const) : ('preference' as const),
    content,
    confidence: 1,
  };
}
export function defaultPreferences(profile: string): UserPreference[] {
  const rows: Record<string, [string, string, string, boolean?][]> = {
    none: [],
    quiet: [
      ['lin_light', '氛围灯亮度', '20%'],
      ['lin_vol', '音量', '20%'],
      ['lin_temp', '主驾温度控制', '24℃'],
      ['lin_no_fragrance', '香氛开关', '关闭', true],
    ],
    fresh: [
      ['zhou_light', '氛围灯亮度', '40%'],
      ['zhou_temp', '主驾温度控制', '22℃'],
      ['zhou_purify', '自动空气净化', '开启'],
      ['zhou_no_window', '主驾车窗', '关闭', true],
    ],
  };
  return (rows[profile] || []).map(([id, primary, value, negative]) => ({
    id,
    primary,
    value,
    negative: !!negative,
    deleted: false,
  }));
}
