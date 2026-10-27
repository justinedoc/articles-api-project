import * as httpStatusCodes from "stoker/http-status-codes";
import { setPublicCacheHeaders } from "@/core/server";
import type { AppRouteHandler } from "@/core/types";
import type { ListPopularTagsRoute, ListTagsRoute } from "./routes";
import { listPopularTags } from "./service";

export const popular: AppRouteHandler<ListPopularTagsRoute> = async (c) => {
	const { limit } = c.req.valid("query");
	const result = await listPopularTags(limit);
	setPublicCacheHeaders(c, 300, 900);
	return c.json(
		{
			success: true,
			message: "Popular tags retrieved successfully",
			data: result,
		},
		httpStatusCodes.OK,
	);
};

export const list: AppRouteHandler<ListTagsRoute> = async (c) => {
	const { limit } = c.req.valid("query");
	const result = await listPopularTags(limit);
	setPublicCacheHeaders(c, 300, 900);
	return c.json(
		{
			success: true,
			message: "Tags retrieved successfully",
			data: result,
		},
		httpStatusCodes.OK,
	);
};
