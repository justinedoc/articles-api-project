import { createRoute, z } from "@hono/zod-openapi";
import * as httpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { defaultErrorResponses } from "@/core/openapi/helpers";
import { createMessageSchema } from "@/core/openapi/schemas";
import { popularTagsQuerySchema, tagItemSchema } from "./schema";

const tags = ["Tags"];

export const listPopularTagsRoute = createRoute({
	method: "get",
	path: "/popular",
	summary: "List popular tags with article counts",
	tags,
	request: { query: popularTagsQuerySchema },
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			createMessageSchema("Popular tags retrieved successfully", true).extend({
				data: z.array(tagItemSchema),
			}),
			"Popular tags retrieved successfully",
		),
		...defaultErrorResponses,
	},
});

export const listTagsRoute = createRoute({
	method: "get",
	path: "/",
	summary: "List tags",
	tags,
	request: { query: popularTagsQuerySchema },
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			createMessageSchema("Tags retrieved successfully", true).extend({
				data: z.array(tagItemSchema),
			}),
			"Tags retrieved successfully",
		),
		...defaultErrorResponses,
	},
});

export type ListPopularTagsRoute = typeof listPopularTagsRoute;
export type ListTagsRoute = typeof listTagsRoute;
