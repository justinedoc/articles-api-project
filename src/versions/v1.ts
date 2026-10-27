import { configureOpenAPI } from "@/core/openapi";
import { createRouter } from "@/core/server";
import { accountRouter } from "@/modules/account";
import { articlesRouter } from "@/modules/articles";
import { authRouter } from "@/modules/auth";
import { commentsRouter } from "@/modules/comments";
import { healthRouter } from "@/modules/health";
import { profilesRouter } from "@/modules/profiles";
import { tagsRouter } from "@/modules/tags";

export function getRoutesV1() {
	const router = createRouter();

	router.route("/system", healthRouter);
	router.route("/auth", authRouter);
	router.route("/account", accountRouter);
	router.route("/profiles", profilesRouter);
	router.route("/articles", articlesRouter);
	router.route("/tags", tagsRouter);
	router.route("/", commentsRouter);

	configureOpenAPI(router, "v1");

	return router;
}
