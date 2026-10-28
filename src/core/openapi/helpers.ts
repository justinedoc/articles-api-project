import { z } from "@hono/zod-openapi";
import * as httpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageSchema } from "@/core/openapi/schemas";
import { cursorPaginationQuerySchema } from "@/core/pagination";

/**
 * Standardized error responses used across most OpenAPI routes.
 */
export const defaultErrorResponses = {
	[httpStatusCodes.BAD_REQUEST]: jsonContent(
		createMessageSchema("The request was invalid.", false),
		"Bad Request",
	),
	[httpStatusCodes.UNAUTHORIZED]: jsonContent(
		createMessageSchema("Unauthorized access.", false),
		"Unauthorized",
	),
	[httpStatusCodes.FORBIDDEN]: jsonContent(
		createMessageSchema(
			"You do not have permission to perform this action.",
			false,
		),
		"Forbidden",
	),
	[httpStatusCodes.NOT_FOUND]: jsonContent(
		createMessageSchema("The requested resource was not found.", false),
		"Not Found",
	),
	[httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
		createMessageSchema("Validation failed. Please check your inputs.", false),
		"Validation Error",
	),
	[httpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
		createMessageSchema("An unexpected error occurred.", false),
		"Internal Server Error",
	),
};

export { cursorPaginationQuerySchema };

export const cursorPaginationResultSchema = <
	T extends z.ZodType,
	K extends string = "data",
>(
	schema: T,
	key: K = "data" as K,
) =>
	z.object({
		[key]: z.array(schema).openapi({
			description: "List of items for the current page",
		}),
		nextCursor: z.string().nullable().openapi({
			description:
				"Cursor to fetch the next page, or null if no further pages exist",
			example: "MjAyNi0xMC0yN1QwOTo0NTozMi4wMDBafGFydF8xMjM",
		}),
	} as { [P in K]: z.ZodArray<T> } & {
		nextCursor: z.ZodNullable<z.ZodString>;
	});
