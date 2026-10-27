import { createRouter } from "@/core/server";
import {
	archive,
	create,
	getMine,
	getPublic,
	like,
	listMine,
	listPublic,
	publish,
	remove,
	trending,
	unlike,
	update,
} from "./handlers";
import {
	archiveArticleRoute,
	createArticleRoute,
	deleteArticleRoute,
	getOwnedArticleRoute,
	getPublicArticleRoute,
	getTrendingArticlesRoute,
	likeArticleRoute,
	listOwnedArticlesRoute,
	listPublicArticlesRoute,
	publishArticleRoute,
	unlikeArticleRoute,
	updateArticleRoute,
} from "./routes";

export const articlesRouter = createRouter()
	.openapi(createArticleRoute, create)
	.openapi(listPublicArticlesRoute, listPublic)
	.openapi(getTrendingArticlesRoute, trending)
	.openapi(listOwnedArticlesRoute, listMine)
	.openapi(getPublicArticleRoute, getPublic)
	.openapi(getOwnedArticleRoute, getMine)
	.openapi(updateArticleRoute, update)
	.openapi(publishArticleRoute, publish)
	.openapi(archiveArticleRoute, archive)
	.openapi(deleteArticleRoute, remove)
	.openapi(likeArticleRoute, like)
	.openapi(unlikeArticleRoute, unlike);

export default articlesRouter;
export * from "./schema";
