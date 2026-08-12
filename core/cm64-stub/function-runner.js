/**
 * CM64 addon stub — function runner.
 *
 * In the open-source build, site functions are loaded from the local sites/
 * folder. Executing functions stored in a database (studio mode) is provided
 * by the CM64 addon, which replaces this module via the `@cm64` webpack
 * alias when a `.cm64/` directory is present.
 */
export async function runStudioFunction() {
  throw new Error(
    'Database-mode function execution requires the CM64 addon (.cm64/).'
  );
}

export async function loadStudioFunction() {
  throw new Error(
    'Database-mode function loading requires the CM64 addon (.cm64/).'
  );
}

export default null;
