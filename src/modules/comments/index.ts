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
	.openapi(createCommentRoute, create)
	.openapi(listCommentsRoute, list)
	.openapi(listCommentRepliesRoute, listReplies)
	.openapi(updateCommentRoute, update)
	.openapi(deleteCommentRoute, remove);

export default commentsRouter;
export * from "./schema";
