// Stands in for the `server-only` marker package under vitest.
//
// `server-only` exists to make the Next build fail if a server module is
// pulled into a client bundle. It is resolved by the bundler and is not a
// real dependency, so a test importing any server module dies on it.
//
// Stubbing it here doesn't weaken anything: the guard is enforced at build
// time, which still happens, and this file is only ever reached by vitest.
export {};
