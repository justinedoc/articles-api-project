import { createRoute } from "@hono/zod-openapi";
import * as httpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { authMiddleware } from "@/core/auth/middleware";
import { defaultErrorResponses } from "@/core/openapi/helpers";
import { createMessageSchema } from "@/core/openapi/schemas";
import { selectAccountSchema } from "./schema";

const tags = ["Account Management"];
const security = [{ BearerAuth: [] }];

export const getAccountRoute = createRoute({
	method: "get",
	path: "/me",
	summary: "Get current user account details",
	description:
		"Retrieves private account information and authentication credentials status.",
	tags,
	security,
	middleware: [authMiddleware],
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			createMessageSchema("Account retrieved successfully", true).extend({
				data: selectAccountSchema,
			}),
			"Current user account details",
		),
		...defaultErrorResponses,
	},
});

export const deleteAccountRoute = createRoute({
	method: "delete",
	path: "/me",
	summary: "Delete user account",
	description:
		"Permanently deletes the current user account, profile, and all associated sessions and articles.",
	tags,
	security,
	middleware: [authMiddleware],
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			createMessageSchema("Account deleted successfully", true),
			"Account deleted successfully",
		),
		...defaultErrorResponses,
	},
});

export type GetAccountRoute = typeof getAccountRoute;
export type DeleteAccountRoute = typeof deleteAccountRoute;
