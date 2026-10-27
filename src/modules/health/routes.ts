import { createRoute } from "@hono/zod-openapi";
import * as httpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { healthErrorSchema, healthOkSchema } from "./schema";

export const checkRoute = createRoute({
	path: "/health",
	method: "get",
	tags: ["System"],
	summary: "System Health Check",
	description: "Verify the operational status of the API and Database.",
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			healthOkSchema,
			"System is fully operational",
		),

		[httpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
			healthErrorSchema,
			"One or more dependencies are down",
		),
	},
});

export type CheckRoute = typeof checkRoute;
