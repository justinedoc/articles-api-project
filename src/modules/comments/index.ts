import { createRouter } from "@/core/server";
import { create, list, listReplies, remove, update } from "./handlers";
import {
	createCommentRoute,
	deleteCommentRoute,
	listCommentRepliesRoute,
	listCommentsRoute,
	updateCommentRoute,
} from "./routes";

export const commentsRouter = createRouter()
	.openapi(listCommentsRoute, list)
	.openapi(listCommentRepliesRoute, listReplies)
	.openapi(createCommentRoute, create)
	.openapi(updateCommentRoute, update)
	.openapi(deleteCommentRoute, remove);

export default commentsRouter;
export * from "./schema";
