import { createRouter } from "@/core/server";
import {
	archive,
	create,
	getMine,
	getPublic,
	like,
	listPublic,
	publish,
	remove,
	unlike,
	update,
} from "./handlers";
import {
	archiveArticleRoute,
	createArticleRoute,
	deleteArticleRoute,
	getOwnedArticleRoute,
	getPublicArticleRoute,
	likeArticleRoute,
	listPublicArticlesRoute,
	publishArticleRoute,
	unlikeArticleRoute,
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
	.openapi(archiveArticleRoute, archive)
	.openapi(likeArticleRoute, like)
	.openapi(unlikeArticleRoute, unlike);

export default articlesRouter;
export * from "./schema";
