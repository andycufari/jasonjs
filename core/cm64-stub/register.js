/**
 * CM64 addon stub — boot registration.
 *
 * In the open-source build there is nothing to register: the local sites/
 * filesystem is the built-in implementation. When a `.cm64/` directory is
 * present, the `@cm64` webpack alias resolves to it instead and its
 * register() installs the remote file-source adapter at boot.
 */
export async function register() {}
