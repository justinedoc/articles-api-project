import type { ServerType } from "@hono/node-server";

export default async function shutdownApp(signal: string, server: ServerType) {
	console.log(`\nReceived ${signal}. Initiating graceful shutdown...`);
	server.close(async (err) => {
		if (err) {
			console.error("Error closing HTTP server:", err);
		} else {
			console.log("HTTP server closed.");
		}

		console.log("Graceful shutdown complete.");
		process.exit(0);
	});
}
