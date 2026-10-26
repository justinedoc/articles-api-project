import { createRouter } from "@/core/server";
import {
	archive,
	create,
	getMine,
	getPublic,
	listPublic,
	publish,
	remove,
	update,
} from "./handlers";
import {
	archiveArticleRoute,
	createArticleRoute,
	deleteArticleRoute,
	getOwnedArticleRoute,
	getPublicArticleRoute,
	listPublicArticlesRoute,
	publishArticleRoute,
	updateArticleRoute,
} from "./routes";

export const articlesRouter = createRouter()
	.openapi(createArticleRoute, create)
	.openapi(listPublicArticlesRoute, listPublic)
	.openapi(getPublicArticleRoute, getPublic)
	.openapi(getOwnedArticleRoute, getMine)
	.openapi(updateArticleRoute, update)
	.openapi(deleteArticleRoute, remove)
	.openapi(publishArticleRoute, publish)
	.openapi(archiveArticleRoute, archive);

export default articlesRouter;
export * from "./schema";
