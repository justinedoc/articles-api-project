import { createRouter } from "@/core/server";
import { getPublic, me, update } from "./handlers";
import {
	getMyProfileRoute,
	getPublicProfileRoute,
	updateMyProfileRoute,
} from "./routes";

export const profilesRouter = createRouter()
	.openapi(getMyProfileRoute, me)
	.openapi(getPublicProfileRoute, getPublic)
	.openapi(updateMyProfileRoute, update);

export default profilesRouter;
export * from "./schema";
