import { createRouter } from "@/core/server";
import { getPublic, me, update } from "./handlers";
import {
	getMyProfileRoute,
	getPublicProfileRoute,
	updateMyProfileRoute,
} from "./routes";

export const profilesRouter = createRouter()
	.openapi(getMyProfileRoute, me)
	.openapi(updateMyProfileRoute, update)
	.openapi(getPublicProfileRoute, getPublic);

export default profilesRouter;
export * from "./schema";
