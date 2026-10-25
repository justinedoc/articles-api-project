import type { ServerType } from "@hono/node-server";

import { pool } from "@/core/db";

export async function shutdownApp(signal: string, server: ServerType) {
	console.log(`\nReceived ${signal}. Initiating graceful shutdown...`);

	// Force close after 10s if connections refuse to drain
	const forceExitTimeout = setTimeout(() => {
		console.error("Shutdown timed out. Forcing exit.");
		process.exit(1);
	}, 10_000);

	server.close(async (err) => {
		clearTimeout(forceExitTimeout);
		if (err) console.error("Error closing HTTP server:", err);

		try {
			await pool.end();
			console.log("Database connection pool drained.");
		} catch (poolErr) {
			console.error("Error draining database pool:", poolErr);
		}

		console.log("Graceful shutdown complete.");
		process.exit(0);
	});
}
