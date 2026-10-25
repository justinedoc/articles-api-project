import { createMiddleware } from "hono/factory";
import * as httpStatusCodes from "stoker/http-status-codes";
import { auth } from "@/core/lib/auth";
import type { AppBindings } from "@/core/lib/types";

export const authMiddleware = createMiddleware<AppBindings>(async (c, next) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });

	if (!session) {
		return c.json(
			{
				success: false,
				message: "Unauthorized",
			},
			httpStatusCodes.UNAUTHORIZED,
		);
	}

	c.set("user", session.user);
	c.set("session", session.session);

	c.var.logger.info(
		{ userId: session.user.id },
		"User accessed protected route",
	);
	await next();
});
