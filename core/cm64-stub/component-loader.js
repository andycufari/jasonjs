/**
 * CM64 addon stub — component loader.
 *
 * In the open-source build, site components are compiled natively at build
 * time. Runtime compilation of components (database mode) is provided by the
 * CM64 addon, which replaces this module via the `@cm64` webpack alias when
 * a `.cm64/` directory is present.
 */
export async function loadStudioComponent() {
  throw new Error(
    'Runtime-compiled components require the CM64 addon (.cm64/). This open-source build compiles site components natively at build time.'
  );
}

export default null;
