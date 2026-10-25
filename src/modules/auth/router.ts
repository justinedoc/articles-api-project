import { auth } from "@/core/auth";
import { createRouter } from "@/core/server";

export const authRouter = createRouter().on(["POST", "GET"], "/*", (c) => {
	return auth.handler(c.req.raw);
});

export default authRouter;
