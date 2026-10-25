import { pinoLogger as logger } from "hono-pino";
import pino from "pino";
import { getQueryCount } from "@/core/db";
import { env } from "@/env";

const isDev = env.NODE_ENV === "development";

export const baseLogger = pino({
	name: "app-logger",
	level: env.LOG_LEVEL,
	browser: { asObject: true },

	transport: isDev
		? {
				target: "pino-pretty",
				options: {
					colorize: true,
					translateTime: "HH:MM:ss Z",
					ignore: "pid,hostname,name",
				},
			}
		: undefined,
});

const HIGH_QUERY_COUNT = 8;

export const pinoLogger = logger({
	pino: baseLogger,
	http: {
		reqId: () => crypto.randomUUID(),
		onResBindings: (c) => {
			const queryCount = getQueryCount() ?? 0;
			return {
				queryCount,
				res: {
					status: c.res.status,
				},
			};
		},
		onResLevel: (c) => {
			if (c.error || c.res.status >= 500) return "error";
			if (c.res.status >= 400) return "warn";
			const queryCount = getQueryCount() ?? 0;
			if (queryCount >= HIGH_QUERY_COUNT) return "warn";
			return "info";
		},
		onResMessage: (c) => {
			const queryCount = getQueryCount() ?? 0;
			if (c.error) return c.error.message;
			if (queryCount >= HIGH_QUERY_COUNT) {
				return `[High Query Count] Request completed (${queryCount} DB queries)`;
			}
			return `Request completed (${queryCount} DB queries)`;
		},
	},
});
