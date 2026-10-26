import { configureOpenAPI } from "@/core/openapi";
import { createRouter } from "@/core/server";
import { accountRouter } from "@/modules/account";
import { authRouter } from "@/modules/auth";
import { healthRouter } from "@/modules/health";
import { profilesRouter } from "@/modules/profiles";

export function getRoutesV1() {
	const router = createRouter();

	router.route("/system", healthRouter);
	router.route("/auth", authRouter);
	router.route("/account", accountRouter);
	router.route("/profiles", profilesRouter);

	configureOpenAPI(router, "v1");

	return router;
}
