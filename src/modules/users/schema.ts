import { z } from "@hono/zod-openapi";
import { createSchemaFactory } from "drizzle-orm/zod";
import { user } from "@/core/db/schema";

const { createSelectSchema } = createSchemaFactory({
	zodInstance: z,
});

export const selectUserSchema = createSelectSchema(user);

export const updateProfileSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters").optional(),
	avatarUrl: z.url("Must be a valid URL").optional(),
});

export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>;
