let activeEffect;
const bucket = new WeakMap();
const effectStack = [];
function reactive(data) {
  return new Proxy(data, {
    get(target, key) {
      track(target, key);
      return target[key];
    },
    set(target, key, newVal) {
      target[key] = newVal;
      trigger(target, key);
    },
  });
}

function effect(fn, options = {}) {
  function effectFn() {
    activeEffect = effectFn;
    effectStack.push(effectFn);
    cleanup(effectFn);
    fn();
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
  }
  effectFn.deps = [];
  effectFn.options = options;
  effectFn();
}
function cleanup(effectFn) {
  for (let i = 0, len = effectFn.deps.length; i < len; i++) {
    const deps = effectFn.deps[i];
    deps.forEach((dep) => {
      dep.delete(effectFn);
    });
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
function trigger(target, key) {
  const depsMap = bucket.get(target);
  const effects = depsMap.get(key);
  const effectsToRun = new Set();
  effects &&
    effects.forEach((effectFn) => {
      if (effectFn.scheduler) {
        effectFn.scheduler(effectFn);
      } else {
        effectsToRun.add(effectFn);
      }
    });
  effectsToRun.forEach((effectFn) => {
    if (effectFn !== activeEffect) {
      effectFn();
    }
  });
}
