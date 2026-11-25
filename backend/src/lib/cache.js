// Tiny in-process TTL cache for storefront reads. Invalidated on any catalog write.
// Swap for Redis/CDN when running more than one API instance.
const store = new Map();

export function cached(key, ttlMs, fn) {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = Promise.resolve(fn()).catch((e) => {
    store.delete(key);
    throw e;
  });
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export function invalidateCatalog() {
  store.clear();
}
