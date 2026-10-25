import { createRouter } from "@/core/server";
import { me, remove, update } from "./handlers";
import {
	deleteAccountRoute,
	getProfileRoute,
	updateProfileRoute,
} from "./routes";

export const usersRouter = createRouter()
	.openapi(getProfileRoute, me)
	.openapi(updateProfileRoute, update)
	.openapi(deleteAccountRoute, remove);

export default usersRouter;
export * from "./schema";
