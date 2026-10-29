/**
 * CM64 addon stub — user components.
 *
 * In the open-source build, @prefix/Component names resolve to
 * components/user/. The CM64 addon can ship its own set, which it serves
 * from this module via the `@cm64` webpack alias when a `.cm64/` directory
 * is present. Returning null falls back to components/user/.
 */
export async function loadUserComponent() {
  return null;
}

export default null;
