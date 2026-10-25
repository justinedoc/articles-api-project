import { configureOpenAPI } from "@/core/openapi";
import { createRouter } from "@/core/server";
import { authRouter } from "@/modules/auth";
import { healthRouter } from "@/modules/health";
import { usersRouter } from "@/modules/users";

export function getRoutesV1() {
	const router = createRouter();

	router.route("/system", healthRouter);
	router.route("/users", usersRouter);
	router.route("/auth", authRouter);

	configureOpenAPI(router, "v1");

	return router;
}
