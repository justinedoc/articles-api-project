import { createMiddleware } from "hono/factory";
import * as httpStatusCodes from "stoker/http-status-codes";
import { auth } from "@/core/auth";
import type { AppBindings } from "@/core/types";

export const authMiddleware = createMiddleware<AppBindings>(async (c, next) => {
	let user = c.get("user");
	let session = c.get("session");

	if (!session || !user) {
		const authResult = await auth.api.getSession({
			headers: c.req.raw.headers,
		});

		if (!authResult) {
			return c.json(
				{
					success: false,
					message: "Unauthorized",
				},
				httpStatusCodes.UNAUTHORIZED,
			);
		}

		user = authResult.user;
		session = authResult.session;
		c.set("user", user);
		c.set("session", session);
	}

	c.var?.logger?.info({ userId: user.id }, "User accessed protected route");
	await next();
});
