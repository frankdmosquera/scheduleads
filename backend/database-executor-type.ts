// Backend: what a writer runs its queries on: the shared pool, or a caller's open transaction, so
// several writes can land together or not at all. Both can open a nested transaction (a savepoint).

import type { db } from "./database.js";

export type DatabaseExecutorType = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
