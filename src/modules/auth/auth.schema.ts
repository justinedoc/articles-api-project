import { z } from "@hono/zod-openapi";
import { createSchemaFactory } from "drizzle-orm/zod";
import { user } from "@/core/db/schema";

const { createSelectSchema } = createSchemaFactory({
	zodInstance: z,
});

export const selectUserSchema = createSelectSchema(user);
