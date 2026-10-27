import { createRouter } from "@/core/server";
import { list, popular } from "./handlers";
import { listPopularTagsRoute, listTagsRoute } from "./routes";

export const tagsRouter = createRouter()
	.openapi(listTagsRoute, list)
	.openapi(listPopularTagsRoute, popular);

export default tagsRouter;
export * from "./schema";
