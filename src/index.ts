import { serve } from "@hono/node-server";
import { initRedis } from "@/core/redis";
import { shutdownApp } from "@/core/server";
import { env } from "@/env";
import app from "./app";

await initRedis();

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

export { app };
export default app;
