import { z } from "@hono/zod-openapi";
import { createSchemaFactory } from "drizzle-orm/zod";
import { user } from "@/core/db/schema";

const { createSelectSchema } = createSchemaFactory({
	zodInstance: z,
});

export const selectAccountSchema = createSelectSchema(user);
export type SelectAccount = z.infer<typeof selectAccountSchema>;
