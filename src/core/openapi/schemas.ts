import { z } from "@hono/zod-openapi";

export const createMessageSchema = (
	exampleMessage = "Operation successful",
	success = true,
) => {
	return z
		.object({
			success: z.boolean().openapi({ example: success }),
			message: z.string().openapi({ example: exampleMessage }),
		})
		.openapi({
			example: {
				success,
				message: exampleMessage,
			},
		});
};
