import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";
import { relations } from "./relations";

const globalForDb = globalThis as unknown as {
	pool?: Pool;
};

export const pool =
	globalForDb.pool ??
	new Pool({
		connectionString: env.DATABASE_URL,
		max: 10,
		idleTimeoutMillis: 60_000,
		connectionTimeoutMillis: 10_000,
	});

globalForDb.pool = pool;

pool.on("error", (err: unknown) => {
	console.error(
		"[Database Connection Pool Error]:",
		err instanceof Error ? err.message : err,
	);
});

interface QueryCounterStore {
	count: number;
	queries?: string[];
}

const queryCounterStorage = new AsyncLocalStorage<QueryCounterStore>();

export function getQueryCount(): number | undefined {
	return queryCounterStorage.getStore()?.count;
}

export function incrementQueryCount(query?: string): void {
	const store = queryCounterStorage.getStore();
	if (store) {
		store.count++;
		if (store.queries && query) {
			store.queries.push(query);
		}
	}
}

class QueryCountingLogger implements Logger {
	logQuery(query: string, _params: unknown[]): void {
		incrementQueryCount(query);
	}
}

export const db = drizzle({
	client: pool,
	relations,
	logger: new QueryCountingLogger(),
});
