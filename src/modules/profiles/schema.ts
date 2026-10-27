import { z } from "@hono/zod-openapi";
import { createSchemaFactory } from "drizzle-orm/zod";
import { profile } from "@/core/db/schema";

const { createSelectSchema } = createSchemaFactory({
	zodInstance: z,
});

export const selectProfileSchema = createSelectSchema(profile).extend({
	displayName: z.string(),
	avatarUrl: z.string().nullable(),
});

export const publicProfileSchema = z.object({
	id: z.string(),
	username: z.string(),
	displayName: z.string(),
	bio: z.string().nullable(),
	avatarUrl: z.string().nullable(),
	bannerUrl: z.string().nullable(),
	websiteUrl: z.string().nullable(),
	socialLinks: z
		.object({
			twitter: z.string().optional(),
			github: z.string().optional(),
			linkedin: z.string().optional(),
			youtube: z.string().optional(),
		})
		.nullable()
		.optional(),
	createdAt: z.date(),
});

export const updateProfileSchema = z.object({
	displayName: z
		.string()
		.min(2, "Display name must be at least 2 characters")
		.max(50, "Display name cannot exceed 50 characters")
		.optional(),
	username: z
		.string()
		.min(3, "Username must be at least 3 characters")
		.max(30, "Username cannot exceed 30 characters")
		.regex(
			/^[a-zA-Z0-9_-]+$/,
			"Username can only contain letters, numbers, underscores, and hyphens",
		)
		.optional(),
	bio: z
		.string()
		.max(500, "Bio cannot exceed 500 characters")
		.optional()
		.nullable(),
	avatarUrl: z.url("Must be a valid URL").optional().nullable(),
	bannerUrl: z.url("Must be a valid URL").optional().nullable(),
	websiteUrl: z.url("Must be a valid URL").optional().nullable(),
	socialLinks: z
		.object({
			twitter: z.string().optional(),
			github: z.string().optional(),
			linkedin: z.string().optional(),
			youtube: z.string().optional(),
		})
		.optional(),
});

export type SelectProfile = z.infer<typeof selectProfileSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>;
