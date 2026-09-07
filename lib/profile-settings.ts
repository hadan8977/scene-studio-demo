import { profileMemories, type ProfileId } from './scene.ts';
import {
  defaultPreferences,
  readPreferences,
  type UserPreference,
} from './user-preferences.ts';

export const PROFILE_STORAGE_KEY = 'scene-studio.profiles.v1';
export type ProfileSettings = {
  profile: ProfileId;
  removed: Record<ProfileId, string[]>;
  entries: Record<ProfileId, UserPreference[]>;
};
export const emptyProfileSettings = (): ProfileSettings => ({
  profile: 'none',
  removed: { none: [], quiet: [], fresh: [] },
  entries: {
    none: [],
    quiet: defaultPreferences('quiet'),
    fresh: defaultPreferences('fresh'),
  },
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
      result.entries[id] = result.entries[id].map((p, i) => ({
        ...p,
        deleted: result.removed[id].includes(profileMemories[id][i].content),
      }));
    }
    for (const id of ['none', 'quiet', 'fresh'] as const)
      if (Array.isArray(value.entries?.[id]))
        result.entries[id] = readPreferences(value.entries[id]);
  } catch {
    /* A damaged preference record must not affect saved scenes. */
  }
  return result;
}
