const subscribers = new Map();
let currentState = null;

export function getState() {
  return currentState;
}

export function setState(newState) {
  currentState = newState;
  notify("*");
  for (const key of Object.keys(newState)) {
    notify(key);
  }
}

export function applyDelta(delta) {
  if (!currentState) return;
  notify("*");
  if (delta.event_type) {
    notify(delta.event_type);
  }
}

export function subscribe(key, fn) {
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(fn);
  return () => subscribers.get(key)?.delete(fn);
}

function notify(key) {
  const fns = subscribers.get(key);
  if (!fns) return;
  for (const fn of fns) {
    try { fn(currentState); } catch { /* panel error should not break others */ }
  }
}
