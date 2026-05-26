export function createLazyGeneratedValue<T extends object>(
  loadValue: () => T,
  target: T
): T {
  let loaded = false;

  function hydrate() {
    if (loaded) {
      return target;
    }

    const value = loadValue();
    if (Array.isArray(target) && Array.isArray(value)) {
      for (const item of value) {
        target.push(item);
      }
    } else {
      Object.assign(target, value);
    }

    loaded = true;
    return target;
  }

  return new Proxy(target, {
    get(currentTarget, property, receiver) {
      const value = Reflect.get(hydrate(), property, receiver);
      return typeof value === "function" ? value.bind(currentTarget) : value;
    },
    getOwnPropertyDescriptor(_currentTarget, property) {
      return Reflect.getOwnPropertyDescriptor(hydrate(), property);
    },
    has(_currentTarget, property) {
      return property in hydrate();
    },
    ownKeys() {
      return Reflect.ownKeys(hydrate());
    },
  });
}

export function createLazyGeneratedRecord<T extends Record<string, unknown>>(
  loadValue: () => T,
  target: T,
  loadPartitionForKey: (key: string) => Partial<T> | null | undefined
): T {
  let loaded = false;
  const loadedKeys = new Set<string>();

  function hydrate() {
    if (loaded) {
      return target;
    }

    Object.assign(target, loadValue());
    loaded = true;
    return target;
  }

  function hydrateKey(property: string) {
    if (
      loaded ||
      Object.prototype.hasOwnProperty.call(target, property) ||
      loadedKeys.has(property)
    ) {
      return target;
    }

    const value = loadPartitionForKey(property);
    loadedKeys.add(property);
    if (value && typeof value === "object") {
      Object.assign(target, value);
    }
    return target;
  }

  return new Proxy(target, {
    get(currentTarget, property, receiver) {
      const hydratedTarget =
        typeof property === "string" ? hydrateKey(property) : hydrate();
      const value = Reflect.get(hydratedTarget, property, receiver);
      return typeof value === "function" ? value.bind(currentTarget) : value;
    },
    getOwnPropertyDescriptor(_currentTarget, property) {
      const hydratedTarget =
        typeof property === "string" ? hydrateKey(property) : hydrate();
      return Reflect.getOwnPropertyDescriptor(hydratedTarget, property);
    },
    has(_currentTarget, property) {
      const hydratedTarget =
        typeof property === "string" ? hydrateKey(property) : hydrate();
      return property in hydratedTarget;
    },
    ownKeys() {
      return Reflect.ownKeys(hydrate());
    },
  });
}
