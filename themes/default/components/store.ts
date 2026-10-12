"use client";

import { useSyncExternalStore } from "react";

/**
 * Vrednost koja se čuva u localStorage pregledača i preživljava osvežavanje.
 * Na serveru i tokom hidratacije važi `initial`, pa se HTML sa servera poklapa.
 */
export function createStore<T>(key: string, initial: T, revive?: (value: T) => T) {
  let cache: { value: T } | null = null;
  const listeners = new Set<() => void>();

  function read(): T {
    if (cache) return cache.value;
    let value = initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) value = JSON.parse(raw) as T;
      if (revive) value = revive(value);
    } catch {
      value = initial;
    }
    cache = { value };
    return value;
  }

  function write(next: T) {
    cache = { value: next };
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Pregledač bez dozvole za skladištenje: vrednost važi do osvežavanja.
    }
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    // Izmena iz drugog taba.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      cache = null;
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  const serverValue = () => initial;

  return {
    read,
    write,
    use: () => useSyncExternalStore(subscribe, read, serverValue),
  };
}
