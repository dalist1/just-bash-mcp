/**
 * Exact passthrough of the upstream just-bash public API.
 *
 * Keeping this as a wildcard export guarantees this wrapper stays 1:1 with
 * whatever the installed just-bash version exposes.
 */
export * from "just-bash";
