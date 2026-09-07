import { profileMemories, type ProfileId } from './scene.ts';

export const PROFILE_STORAGE_KEY = 'scene-studio.profiles.v1';
export type ProfileSettings = {
  profile: ProfileId;
  removed: Record<ProfileId, string[]>;
};
export const emptyProfileSettings = (): ProfileSettings => ({
  profile: 'none',
  removed: { none: [], quiet: [], fresh: [] },
});

export function readProfileSettings(raw: string | null): ProfileSettings {
  const result = emptyProfileSettings();
  try {
    const value = JSON.parse(raw || 'null');
    if (!value || !['none', 'quiet', 'fresh'].includes(value.profile))
      return result;
    result.profile = value.profile;
    for (const id of ['quiet', 'fresh'] as const) {
      result.removed[id] = profileMemories[id]
        .filter(
          (m) =>
            Array.isArray(value.removed?.[id]) &&
            value.removed[id].includes(m.content),
        )
        .map((m) => m.content);
    }
  } catch {
    /* A damaged preference record must not affect saved scenes. */
  }
  return result;
}
