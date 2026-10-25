import { createRouter } from "@/core/lib/create-app";
import authRouter from "@/modules/auth/auth.router";
import healthRouter from "@/modules/health/health.router";
import configureOpenAPI from "@/modules/openapi";
import usersRouter from "@/modules/user/user.router";

export function getRoutesV1() {
	const router = createRouter();

	router.route("/system", healthRouter);
	router.route("/users", usersRouter);
	router.route("/auth", authRouter);

	configureOpenAPI(router, "v1");

	return router;
}
