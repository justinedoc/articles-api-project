import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Logger } from "pino";
import type { AuthSession } from "@/core/lib/auth";

export type AppBindings = {
	Variables: {
		logger: Logger;

		user: AuthSession["user"] | null;
		session: AuthSession["session"] | null;
	};
};

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<
	R,
	AppBindings
>;
