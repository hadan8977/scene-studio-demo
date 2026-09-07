/** Appendix C keeps string values; these rules resolve the registry's custom-value placeholders. */
export const structuredFields: Record<
  string,
  { hint: string; example?: string }
> = {
  生效时间: { hint: 'HH:MM，例如 07:00', example: '07:00' },
  生效时间段: { hint: '全天，或 08:00-18:00', example: '全天' },
  重复周期: {
    hint: '每天、工作日、周末，或 1,3,5（周一到周日为 1–7）',
    example: '每天',
  },
  指定日期: { hint: 'YYYYMMDD，例如 20260907', example: '20260907' },
  日期区间: { hint: 'YYYYMMDD-YYYYMMDD', example: '20260907-20260908' },
  播放指定音乐: { hint: '输入具体歌曲名' },
  壁纸: { hint: '输入具体壁纸名' },
  主题: { hint: '输入具体主题名' },
};
const clock = (s: string) => /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(s);
const date = (s: string) => {
  if (!/^\d{8}$/.test(s)) return false;
  const y = +s.slice(0, 4),
    m = +s.slice(4, 6),
    d = +s.slice(6, 8);
  if (y < 2000 || y > 2099) return false;
  const value = new Date(Date.UTC(y, m - 1, d));
  return (
    value.getUTCFullYear() === y &&
    value.getUTCMonth() === m - 1 &&
    value.getUTCDate() === d
  );
};
export function validStructuredValue(
  primary: string,
  value: string,
): boolean | null {
  if (primary === '生效时间') return clock(value);
  if (primary === '生效时间段')
    return (
      value === '全天' ||
      (value.split('-').length === 2 &&
        value.split('-').every(clock) &&
        value.split('-')[0] !== value.split('-')[1])
    );
  if (primary === '重复周期')
    return (
      ['每天', '工作日', '周末'].includes(value) ||
      (/^[1-7](,[1-7]){0,6}$/.test(value) &&
        new Set(value.split(',')).size === value.split(',').length)
    );
  if (primary === '指定日期') return date(value);
  if (primary === '日期区间') {
    const [a, b, ...rest] = value.split('-');
    return !rest.length && date(a || '') && date(b || '') && a <= b;
  }
  if (['播放指定音乐', '壁纸', '主题'].includes(primary))
    return (
      !!value.trim() &&
      value.length <= 80 &&
      !value.split('').some(c => c.charCodeAt(0) < 32 || c === '<' || c === '>') &&
      !['歌曲名', '选择壁纸', '选择主题', '自定义'].includes(value)
    );
  return null;
}
