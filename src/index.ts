import { serve } from "@hono/node-server";
import { initRedis } from "@/core/redis";
import { createApp, shutdownApp } from "@/core/server";
import { env } from "@/env";
import { getRoutesV1 } from "@/versions";

// Initialize Redis connection
await initRedis();

const app = createApp();

const routes = app.route("/v1", getRoutesV1());

const server = serve(
	{
		fetch: app.fetch,
		hostname: env.HOST,
		port: env.PORT,
	},
	(info) => {
		console.log(`Server is running on http://${info.address}:${info.port}`);
	},
);

process.on("SIGINT", () => shutdownApp("SIGINT", server));
process.on("SIGTERM", () => shutdownApp("SIGTERM", server));

export type AppType = typeof routes;
export default app;
