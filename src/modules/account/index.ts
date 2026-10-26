import { createRouter } from "@/core/server";
import { me, remove } from "./handlers";
import { deleteAccountRoute, getAccountRoute } from "./routes";

export const accountRouter = createRouter()
	.openapi(getAccountRoute, me)
	.openapi(deleteAccountRoute, remove);

export default accountRouter;
export * from "./schema";
