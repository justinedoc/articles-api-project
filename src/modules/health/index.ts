import { createRouter } from "@/core/server";
import { check } from "./handlers";
import { checkRoute } from "./routes";

export const healthRouter = createRouter().openapi(checkRoute, check);

export default healthRouter;
