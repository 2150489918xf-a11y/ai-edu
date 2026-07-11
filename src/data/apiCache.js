export const DEFAULT_API_CACHE_TTL_MS = 60 * 1000;

const CACHE_PREFIX = 'eduai.apiCache.v2:';
const memoryStorage = new Map();

function getStorage() {
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
}

function getItem(key) {
  const storage = getStorage();
  if (storage?.getItem) return storage.getItem(key);
  return memoryStorage.get(key) || null;
}

function setItem(key, value) {
  const storage = getStorage();
  if (storage?.setItem) {
    storage.setItem(key, value);
    return;
  }
  memoryStorage.set(key, value);
}

function removeItem(key) {
  const storage = getStorage();
  if (storage?.removeItem) {
    storage.removeItem(key);
    return;
  }
  memoryStorage.delete(key);
}

function listKeys() {
  const storage = getStorage();
  if (storage?.key && Number.isFinite(storage.length)) {
    return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean);
  }
  if (storage?.keys) return [...storage.keys()];
  return [...memoryStorage.keys()];
}

function buildCacheKey(namespace, key) {
  return `${CACHE_PREFIX}${namespace}:${key}`;
}

export function stableCacheKey(value) {
  if (Array.isArray(value)) return `[${value.map(stableCacheKey).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableCacheKey(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function readApiCache(namespace, key, ttlMs = DEFAULT_API_CACHE_TTL_MS) {
  const raw = getItem(buildCacheKey(namespace, key));
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw);
    if (!entry || Date.now() - Number(entry.savedAt || 0) > ttlMs) return null;
    return entry.value;
  } catch {
    return null;
  }
}

export function writeApiCache(namespace, key, value) {
  try {
    setItem(buildCacheKey(namespace, key), JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Cache writes are best-effort. Quota or serialization failures should not break the page.
  }
}

export async function cachedApiRequest(namespace, key, loader, options = {}) {
  const ttlMs = options.ttlMs || DEFAULT_API_CACHE_TTL_MS;
  if (!options.force) {
    const cached = readApiCache(namespace, key, ttlMs);
    if (cached !== null) return cached;
  }
  const value = await loader();
  writeApiCache(namespace, key, value);
  return value;
}

export function clearApiCacheNamespace(namespace) {
  const prefix = `${CACHE_PREFIX}${namespace}:`;
  listKeys()
    .filter((key) => key.startsWith(prefix))
    .forEach(removeItem);
}

export function clearAllApiCaches() {
  listKeys()
    .filter((key) => key.startsWith(CACHE_PREFIX))
    .forEach(removeItem);
}
