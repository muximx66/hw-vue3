const triggerType = {
  SET: "SET",
  ADD: "ADD",
  DELETE: "DELETE",
};
const ITERATE_KEY = Symbol();
const bucket = new WeakMap();
const effectStack = [];
let activeEffect;
function reactive(data) {
  return new Proxy(data, {
    get(target, key, receiver) {
      track(target, key);
      return Reflect.get(target, key, receiver);
    },
    set(target, key, newVal, receiver) {
      const type = Object.prototype.hasOwnProperty.call(target, key)
        ? triggerType.SET
        : triggerType.ADD;
      Reflect.set(target, key, newVal, receiver);
      trigger(target, key, type);
    },
    has(target, key, receiver) {
      track(target, key);
      return Reflect.has(target, key, receiver);
    },
    ownKeys(target) {
      track(target, ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    deleteProperty(target, key) {
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const res = Reflect.deleteProperty(target, key);
      if (res && hadKey) {
        trigger(target, key, triggerType.DELETE);
      }
      return res;
    },
  });
}
function watch(source, cb, options = {}) {
  if (typeof source === "function") {
    getter = source;
  } else {
    getter = () => traverse(source);
  }
  let newVal, oldVal, cleanup;
  function onInvalidate(fn) {
    cleanup = fn;
  }
  function job() {
    newVal = effectFn();
    if (cleanup) {
      cleanup();
    }
    cb(newVal, oldVal, onInvalidate);
    oldVal = newVal;
  }
  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler: () => {
      if (options.flush === "post") {
        const p = Promise.resolve();
        p.then(job);
      }
    },
  });
  if (options.immediate) {
    job();
  } else {
    oldVal = effectFn();
  }
}
function traverse(value, seen = new Set()) {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  for (const key in value) {
    traverse(value[key], seen);
  }
  return value;
}
function computed(getter) {
  let dirty = true;
  let value;
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true;
      trigger(obj, "value");
    },
  });

  const obj = {
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      track(obj, "value");
      return value;
    },
  };
  return obj;
}
function effect(fn, options = {}) {
  function effectFn() {
    activeEffect = effectFn;
    effectStack.push(effectFn);
    cleanup(effectFn);
    const res = fn();
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
    return res;
  }
  effectFn.deps = [];
  effectFn.options = options;
  if (!options.lazy) {
    effectFn();
  }
  return effectFn;
}
function cleanup(effectFn) {
  const deps = effectFn.deps;
  for (let i = 0, len = deps.length; i < len; i++) {
    deps[i].delete(effectFn);
  }
  effectFn.length = 0;
}
function track(target, key) {
  if (!activeEffect) return;
  let depsMap = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}
function trigger(target, key, type) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  const effectsToRun = new Set();
  effects &&
    effects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  if (type === triggerType.ADD || type === triggerType.DELETE) {
    const iterateEffects = depsMap.get(ITERATE_KEY);
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }
  effectsToRun.forEach((effectFn) => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
}
