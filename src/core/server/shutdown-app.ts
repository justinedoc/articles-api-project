import type { ServerType } from "@hono/node-server";
import { pool } from "@/core/db";
import { closeRedis } from "@/core/redis";

let isShuttingDown = false;

export function shutdownApp(signal: string, server: ServerType): Promise<void> {
	if (isShuttingDown) {
		console.log(`\nSecond ${signal} received. Forcing immediate exit.`);
		process.exit(1);
	}
	isShuttingDown = true;

	console.log(`\nReceived ${signal}. Initiating graceful shutdown...`);

	// Force close after 10s if connections refuse to drain
	const forceExitTimeout = setTimeout(() => {
		console.error("Shutdown timed out. Forcing exit.");
		process.exit(1);
	}, 10_000);
	forceExitTimeout.unref();

	// Close idle keep-alive connections if supported
	const serverWithIdle = server as unknown as {
		closeIdleConnections?: () => void;
	};
	if (typeof serverWithIdle.closeIdleConnections === "function") {
		serverWithIdle.closeIdleConnections();
	}

	return new Promise<void>((resolve) => {
		server.close(async (err) => {
			clearTimeout(forceExitTimeout);
			if (err && (err as { code?: string }).code !== "ERR_SERVER_NOT_RUNNING") {
				console.error("Error closing HTTP server:", err);
			}

			try {
				await pool.end();
				console.log("Database connection pool drained.");
			} catch (poolErr) {
				console.error("Error draining database pool:", poolErr);
			}

			try {
				await closeRedis();
			} catch (redisErr) {
				console.error("Error closing Redis connection:", redisErr);
			}

			console.log("Graceful shutdown complete.");
			resolve();
			process.exit(0);
		});
	});
}
