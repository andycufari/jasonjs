/**
 * Deep-merge `source` onto `target` and return a NEW object.
 *
 * This function is pure: neither `target` nor `source` is mutated. That is a
 * hard requirement, not a stylistic choice — callers merge per-tenant config
 * onto shared module-level singletons (e.g. DEFAULT_AUTH_CONFIG). A mutating
 * merge leaks one tenant's settings into every other tenant served by the same
 * process, which previously made sites with no settings/auth.json inherit
 * another site's required signup fields.
 *
 * Arrays are replaced wholesale (not concatenated or merged element-wise).
 */
export function deepMerge(target, source) {
  const isPlainObject = (obj) =>
    obj !== null && typeof obj === 'object' && !Array.isArray(obj);

  if (!isPlainObject(target) || !isPlainObject(source)) {
    return source;
  }

  const output = { ...target };

  Object.keys(source).forEach(key => {
    // Never let tenant-supplied keys walk up the prototype chain.
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return;
    }

    const targetValue = target[key];
    const sourceValue = source[key];

    if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      output[key] = deepMerge(targetValue, sourceValue);
    } else if (Array.isArray(sourceValue)) {
      // Copy so the merged result never aliases the source array.
      output[key] = [...sourceValue];
    } else {
      output[key] = sourceValue;
    }
  });

  return output;
}
