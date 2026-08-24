import { isAxiosError } from 'axios';
import { z } from 'zod';
import { getImpersonatedUser } from '@/api/axios.ts';
import getUserSettings from '@/api/me/settings/getUserSettings.ts';
import updateUserSettings, { updateUserSettingsKeepalive } from '@/api/me/settings/updateUserSettings.ts';
import { UserSettingsMap, UserSettingValue, userSettingsMapSchema } from '@/lib/schemas/user/settings.ts';
import { UserSettingsStore, useUserSettingsStore } from '@/stores/userSettings.ts';

const REPLICA_KEY_PREFIX = 'user_settings::';
const LOCAL_KEY_PREFIX = 'user_settings_local::';
const LAST_USER_KEY = 'user_settings_last_user';

export type UserSettingScope = 'account' | 'device';

export const DEVICE_ONLY_SETTING_KEYS: ReadonlySet<string> = new Set([
  'file_manager::editor_line_overflow',
  'file_manager::editor_engine',
  'file_manager::vscode_uri_scheme',
  'file_manager::audio_player_volume',
]);

const FLUSH_DEBOUNCE_MS = 1000;
const FLUSH_RETRY_MS = 15000;
const PERSIST_DEBOUNCE_MS = 250;

let pendingChanges: Record<string, UserSettingValue | null> = {};
let inFlightChanges: Record<string, UserSettingValue | null> = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushPromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function readStoredMap(key: string): UserSettingsMap {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    return userSettingsMapSchema.parse(JSON.parse(raw));
  } catch {
    return {};
  }
}

function isPersistable(): boolean {
  return !getImpersonatedUser() && useUserSettingsStore.getState().userUuid !== null;
}

function persistReplica() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!isPersistable()) return;

  const { userUuid, synced, local } = useUserSettingsStore.getState();
  localStorage.setItem(`${REPLICA_KEY_PREFIX}${userUuid}`, JSON.stringify(synced));
  localStorage.setItem(`${LOCAL_KEY_PREFIX}${userUuid}`, JSON.stringify(local));
}

function schedulePersistReplica() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistReplica();
  }, PERSIST_DEBOUNCE_MS);
}

function hydrateFromReplica(userUuid: string | null) {
  useUserSettingsStore.setState({
    userUuid: null,
    serverLoaded: false,
    synced: userUuid ? readStoredMap(`${REPLICA_KEY_PREFIX}${userUuid}`) : {},
    local: userUuid ? readStoredMap(`${LOCAL_KEY_PREFIX}${userUuid}`) : {},
  });
}

function scheduleFlush(delay: number = FLUSH_DEBOUNCE_MS) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushPendingChanges();
  }, delay);
}

async function runFlush(changes: Record<string, UserSettingValue | null>) {
  try {
    await updateUserSettings(changes);
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
      console.error('Server rejected user settings update', error);
    } else {
      pendingChanges = { ...changes, ...pendingChanges };
      scheduleFlush(FLUSH_RETRY_MS);
    }
  } finally {
    inFlightChanges = {};
    flushPromise = null;
    if (Object.keys(pendingChanges).length > 0 && !flushTimer) scheduleFlush();
  }
}

function flushPendingChanges(): Promise<void> {
  if (flushPromise) return flushPromise;
  if (!isPersistable() || Object.keys(pendingChanges).length === 0) return Promise.resolve();

  const changes = pendingChanges;
  pendingChanges = {};
  inFlightChanges = changes;
  flushPromise = runFlush(changes);

  return flushPromise;
}

export async function flushUserSettings() {
  while (flushPromise) {
    await flushPromise;
  }

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  await flushPendingChanges();
}

export function unloadUserSettings() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  pendingChanges = {};

  useUserSettingsStore.setState({ userUuid: null, serverLoaded: false });
}

export async function loadUserSettings(userUuid: string) {
  const state = useUserSettingsStore.getState();
  if (state.userUuid === userUuid && state.serverLoaded) return;

  if (state.userUuid !== userUuid) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    pendingChanges = {};
    inFlightChanges = {};

    hydrateFromReplica(userUuid);
  }
  useUserSettingsStore.setState({ userUuid });

  if (!getImpersonatedUser()) localStorage.setItem(LAST_USER_KEY, userUuid);

  try {
    const serverSettings = await getUserSettings();

    useUserSettingsStore.setState((current) => {
      if (current.userUuid !== userUuid) return current;

      const synced = { ...serverSettings };
      for (const [key, value] of Object.entries({ ...inFlightChanges, ...pendingChanges })) {
        if (value === null) delete synced[key];
        else synced[key] = value;
      }

      return { ...current, synced, serverLoaded: true };
    });

    persistReplica();
    importLegacyUserSettings();
  } catch (error) {
    console.error('Failed to load user settings', error);
  }
}

function effectiveValueOf(state: UserSettingsStore, key: string): UserSettingValue | undefined {
  return key in state.local ? state.local[key] : state.synced[key];
}

function effectiveValue(key: string): UserSettingValue | undefined {
  return effectiveValueOf(useUserSettingsStore.getState(), key);
}

const PARSE_CACHE = new WeakMap<z.ZodType<unknown>, Map<string, { raw: unknown; value: unknown }>>();

function parseSettingValue<T>(key: string, raw: UserSettingValue | undefined, schema: z.ZodType<T>, fallback: T): T {
  if (raw === undefined) return fallback;

  let bySchema = PARSE_CACHE.get(schema);
  if (!bySchema) {
    bySchema = new Map();
    PARSE_CACHE.set(schema, bySchema);
  }

  const cached = bySchema.get(key);
  if (cached && cached.raw === raw) return cached.value as T;

  const parsed = schema.safeParse(raw);
  const value = parsed.success ? parsed.data : fallback;
  bySchema.set(key, { raw, value });

  return value;
}

export function getUserSetting<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  return parseSettingValue(key, effectiveValue(key), schema, fallback);
}

export function setUserSetting(key: string, value: UserSettingValue) {
  const state = useUserSettingsStore.getState();

  if (key in state.local) {
    if (Object.is(state.local[key], value)) return;

    useUserSettingsStore.setState({ local: { ...state.local, [key]: value } });
    schedulePersistReplica();
    return;
  }

  if (Object.is(state.synced[key], value)) return;

  useUserSettingsStore.setState({ synced: { ...state.synced, [key]: value } });

  if (isPersistable()) {
    schedulePersistReplica();
    pendingChanges[key] = value;
    scheduleFlush();
  }
}

export function setUserSettingLocal(key: string, value: UserSettingValue) {
  const state = useUserSettingsStore.getState();
  if (key in state.local && Object.is(state.local[key], value)) return;

  useUserSettingsStore.setState({ local: { ...state.local, [key]: value } });
  schedulePersistReplica();
}

export function removeUserSetting(key: string) {
  if (key in useUserSettingsStore.getState().local) {
    clearUserSettingOverride(key);
    return;
  }

  useUserSettingsStore.setState((state) => {
    const { [key]: _, ...synced } = state.synced;
    return { synced };
  });

  if (isPersistable()) {
    schedulePersistReplica();
    pendingChanges[key] = null;
    scheduleFlush();
  }
}

export function useUserSettingScope(key: string): UserSettingScope {
  return useUserSettingsStore((state) => (key in state.local ? 'device' : 'account'));
}

export function useUserSettingsLoaded(): boolean {
  return useUserSettingsStore((state) => state.serverLoaded);
}

export function overrideUserSettingLocally(key: string, value: UserSettingValue) {
  if (DEVICE_ONLY_SETTING_KEYS.has(key)) return;

  useUserSettingsStore.setState((state) => (key in state.local ? state : { local: { ...state.local, [key]: value } }));
  persistReplica();
}

export function clearUserSettingOverride(key: string) {
  useUserSettingsStore.setState((state) => {
    if (!(key in state.local)) return state;

    const { [key]: _, ...local } = state.local;
    return { local };
  });
  persistReplica();
}

export async function pushUserSettingToAccount(key: string) {
  const state = useUserSettingsStore.getState();
  if (!(key in state.local) || !isPersistable()) return;

  const value = state.local[key];
  await updateUserSettings({ [key]: value });

  useUserSettingsStore.setState((current) => {
    const { [key]: _, ...local } = current.local;
    if (value === null) {
      const { [key]: _synced, ...synced } = current.synced;
      return { local, synced };
    }

    return { local, synced: { ...current.synced, [key]: value } };
  });
  persistReplica();
}

export function useDeviceOverrideCount(): number {
  return useUserSettingsStore(
    (state) => Object.keys(state.local).filter((key) => !DEVICE_ONLY_SETTING_KEYS.has(key)).length,
  );
}

export function resetAllDeviceOverrides() {
  useUserSettingsStore.setState((state) => ({
    local: Object.fromEntries(Object.entries(state.local).filter(([key]) => DEVICE_ONLY_SETTING_KEYS.has(key))),
  }));
  persistReplica();
}

export function useUserSetting<T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
): [T, (value: T | ((previous: T) => T)) => void] {
  const stored = useUserSettingsStore((state) => effectiveValueOf(state, key));

  const setValue = (next: T | ((previous: T) => T)) => {
    const resolved =
      typeof next === 'function' ? (next as (previous: T) => T)(getUserSetting(key, schema, fallback)) : next;
    setUserSetting(key, resolved as UserSettingValue);
  };

  return [parseSettingValue(key, stored, schema, fallback), setValue];
}

export function useUserSettingMapEntry<T>(
  key: string,
  entry: string,
  schema: z.ZodType<T>,
  fallback: T,
): [T, (value: T) => void] {
  const value = useUserSettingsStore((state) => {
    const map = effectiveValueOf(state, key);
    if (map === null || typeof map !== 'object' || Array.isArray(map)) return fallback;

    const stored = (map as Record<string, UserSettingValue>)[entry];
    if (stored === undefined) return fallback;

    const parsed = schema.safeParse(stored);
    return parsed.success ? parsed.data : fallback;
  });

  return [value, (next) => setUserSettingMapEntry(key, entry, next as UserSettingValue)];
}

export function setUserSettingMapEntry(key: string, entry: string, value: UserSettingValue) {
  const current = effectiveValue(key);
  const map =
    current !== null && typeof current === 'object' && !Array.isArray(current)
      ? { ...(current as Record<string, UserSettingValue>) }
      : {};

  map[entry] = value;
  setUserSetting(key, map);
}

export function subscribeUserSetting(key: string, callback: (value: UserSettingValue | undefined) => void): () => void {
  let previous = effectiveValue(key);

  return useUserSettingsStore.subscribe((state) => {
    const value = effectiveValueOf(state, key);
    if (Object.is(value, previous)) return;

    previous = value;
    callback(value);
  });
}

const parseBoolean = (raw: string) => raw === 'true';
const parseNumber = (raw: string) => (Number.isFinite(Number(raw)) ? Number(raw) : undefined);
const parseRaw = (raw: string) => raw;

const LEGACY_IMPORTS: {
  legacyKey: string;
  key: string;
  parse: (raw: string) => UserSettingValue | undefined;
  local?: boolean;
}[] = [
  { legacyKey: 'file_sorting_mode', key: 'file_manager::sorting_mode', parse: parseRaw },
  { legacyKey: 'file_click_once', key: 'file_manager::click_once', parse: parseBoolean },
  { legacyKey: 'file_prefer_physical_size', key: 'file_manager::prefer_physical_size', parse: parseBoolean },
  { legacyKey: 'file_editor_minimap', key: 'file_manager::editor_minimap', parse: parseBoolean },
  { legacyKey: 'file_editor_font_size', key: 'file_manager::editor_font_size', parse: parseNumber },
  { legacyKey: 'file_image_viewer_smoothing', key: 'file_manager::image_viewer_smoothing', parse: parseBoolean },
  {
    legacyKey: 'file_editor_lineoverflow',
    key: 'file_manager::editor_line_overflow',
    parse: parseBoolean,
    local: true,
  },
  { legacyKey: 'file_editor_engine', key: 'file_manager::editor_engine', parse: parseRaw, local: true },
  { legacyKey: 'file_vscode_uri_scheme', key: 'file_manager::vscode_uri_scheme', parse: parseRaw, local: true },
  { legacyKey: 'file_audio_player_volume', key: 'file_manager::audio_player_volume', parse: parseNumber, local: true },
  { legacyKey: 'terminal_console_font_size', key: 'console::font_size', parse: parseNumber },
  { legacyKey: 'normalize_cpu_load', key: 'console::normalize_cpu_load', parse: parseBoolean },
  { legacyKey: 'form-engine:advanced-mode', key: 'form_engine::advanced_mode', parse: parseBoolean },
];

const LEGACY_PREFIX_IMPORTS: {
  legacyPrefix: string;
  key: string;
  parse: (raw: string) => UserSettingValue | undefined;
}[] = [
  { legacyPrefix: 'server-group-expanded-', key: 'dashboard::server_groups_expanded', parse: parseBoolean },
  { legacyPrefix: 'backup-group-expanded-', key: 'server::backup_groups_expanded', parse: parseBoolean },
];

function importLegacyUserSettings() {
  if (!isPersistable()) return;

  const { synced, local } = useUserSettingsStore.getState();
  const syncedImports: Record<string, UserSettingValue> = {};
  const localImports: Record<string, UserSettingValue> = {};

  for (const { legacyKey, key, parse, local: isLocal } of LEGACY_IMPORTS) {
    const raw = localStorage.getItem(legacyKey);
    if (raw === null) continue;

    if (!(key in synced) && !(key in local)) {
      const value = parse(raw);
      if (value !== undefined) {
        if (isLocal) localImports[key] = value;
        else syncedImports[key] = value;
      }
    }

    localStorage.removeItem(legacyKey);
  }

  for (const { legacyPrefix, key, parse } of LEGACY_PREFIX_IMPORTS) {
    const legacyKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey?.startsWith(legacyPrefix)) legacyKeys.push(storageKey);
    }
    if (legacyKeys.length === 0) continue;

    if (!(key in synced)) {
      const map: Record<string, UserSettingValue> = {};
      for (const storageKey of legacyKeys) {
        const value = parse(localStorage.getItem(storageKey) ?? '');
        if (value !== undefined) map[storageKey.slice(legacyPrefix.length)] = value;
      }
      if (Object.keys(map).length > 0) syncedImports[key] = map;
    }

    for (const storageKey of legacyKeys) localStorage.removeItem(storageKey);
  }

  try {
    const globalState = JSON.parse(localStorage.getItem('global') ?? '{}')?.state;
    if (globalState && typeof globalState === 'object') {
      if (!('shortcuts::overrides' in synced) && globalState.shortcutOverrides) {
        syncedImports['shortcuts::overrides'] = globalState.shortcutOverrides;
      }
      if (!('dashboard::server_list_show_others' in synced) && typeof globalState.serverListShowOthers === 'boolean') {
        syncedImports['dashboard::server_list_show_others'] = globalState.serverListShowOthers;
      }
    }
  } catch {
    // ignore
  }

  if (Object.keys(localImports).length > 0) {
    useUserSettingsStore.setState((state) => ({ local: { ...state.local, ...localImports } }));
  }
  if (Object.keys(syncedImports).length > 0) {
    useUserSettingsStore.setState((state) => ({ synced: { ...state.synced, ...syncedImports } }));
    Object.assign(pendingChanges, syncedImports);
    scheduleFlush();
  }
  if (Object.keys(localImports).length > 0 || Object.keys(syncedImports).length > 0) {
    persistReplica();
  }
}

window.addEventListener('storage', (event) => {
  const { userUuid } = useUserSettingsStore.getState();
  if (!userUuid || event.storageArea !== localStorage) return;

  if (event.key === `${REPLICA_KEY_PREFIX}${userUuid}`) {
    const synced = readStoredMap(event.key);
    for (const [key, value] of Object.entries({ ...inFlightChanges, ...pendingChanges })) {
      if (value === null) delete synced[key];
      else synced[key] = value;
    }
    useUserSettingsStore.setState({ synced });
  } else if (event.key === `${LOCAL_KEY_PREFIX}${userUuid}`) {
    useUserSettingsStore.setState({ local: readStoredMap(event.key) });
  }
});

window.addEventListener('pagehide', () => {
  persistReplica();

  const changes = { ...inFlightChanges, ...pendingChanges };
  if (!isPersistable() || Object.keys(changes).length === 0) return;

  pendingChanges = {};

  updateUserSettingsKeepalive(changes);
});

hydrateFromReplica(localStorage.getItem(LAST_USER_KEY));
