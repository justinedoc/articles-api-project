import { createRouter } from "@/core/server";
import { create, list, remove, update } from "./handlers";
import {
	createCommentRoute,
	deleteCommentRoute,
	listCommentsRoute,
	updateCommentRoute,
} from "./routes";

export const commentsRouter = createRouter()
	.openapi(listCommentsRoute, list)
	.openapi(createCommentRoute, create)
	.openapi(updateCommentRoute, update)
	.openapi(deleteCommentRoute, remove);

export default commentsRouter;
export * from "./schema";
