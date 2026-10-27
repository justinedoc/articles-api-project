import { createRouter } from "@/core/server";
import { list, popular } from "./handlers";
import { listPopularTagsRoute, listTagsRoute } from "./routes";

export const tagsRouter = createRouter()
	.openapi(listPopularTagsRoute, popular)
	.openapi(listTagsRoute, list);

export default tagsRouter;
export * from "./schema";
