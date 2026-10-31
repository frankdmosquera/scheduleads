// The server entry reads its keys from the host's environment. Only this much of Node is used, so the
// package builds without Node's types and runs on any server that has `process.env`.
declare const process: { env: Record<string, string | undefined> };
