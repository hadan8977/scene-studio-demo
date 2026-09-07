import { capabilities } from '../../../lib/scene.ts';

/** Display metadata is derived from the actual registry, never a second capability list. */
export const REGISTRY = Object.fromEntries(
  capabilities.map((c) => {
    const spec = c.act_values;
    return [
      c.zh,
      spec && !Array.isArray(spec)
        ? {
            min: Number(spec.range[0]),
            max: Number(spec.range[1]),
            unit: String(spec.range[3]),
            boolean: false,
          }
        : {
            min: undefined,
            max: undefined,
            unit: undefined,
            boolean:
              Array.isArray(spec) &&
              spec.length === 2 &&
              spec.includes('开启') &&
              spec.includes('关闭'),
          },
    ];
  }),
);
