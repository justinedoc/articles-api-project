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
	id: z.string().openapi({
		description: "Unique profile identifier",
		example: "prof_12345678",
	}),
	username: z.string().openapi({
		description: "Unique author handle",
		example: "johndoe",
	}),
	displayName: z.string().openapi({
		description: "Author's public display name",
		example: "John Doe",
	}),
	bio: z.string().nullable().openapi({
		description: "Author bio / biography",
		example: "Software engineer and distributed systems enthusiast.",
	}),
	avatarUrl: z.string().nullable().openapi({
		description: "Profile avatar image URL",
		example: "https://example.com/avatars/johndoe.png",
	}),
	bannerUrl: z.string().nullable().openapi({
		description: "Profile header banner image URL",
		example: "https://example.com/banners/johndoe.png",
	}),
	websiteUrl: z.string().nullable().openapi({
		description: "Personal or portfolio website URL",
		example: "https://johndoe.dev",
	}),
	socialLinks: z
		.object({
			twitter: z.string().optional(),
			github: z.string().optional(),
			linkedin: z.string().optional(),
			youtube: z.string().optional(),
		})
		.nullable()
		.optional()
		.openapi({
			description: "Links to author's external profiles",
			example: {
				twitter: "https://x.com/johndoe",
				github: "https://github.com/johndoe",
			},
		}),
	createdAt: z.date().openapi({
		description: "Profile creation timestamp",
		example: "2026-10-27T10:00:00.000Z",
	}),
});

export const updateProfileSchema = z.object({
	displayName: z
		.string()
		.min(2, "Display name must be at least 2 characters")
		.max(50, "Display name cannot exceed 50 characters")
		.optional()
		.openapi({
			description: "Updated display name (2-50 characters)",
			example: "Jane Doe",
		}),
	username: z
		.string()
		.min(3, "Username must be at least 3 characters")
		.max(30, "Username cannot exceed 30 characters")
		.regex(
			/^[a-zA-Z0-9_-]+$/,
			"Username can only contain letters, numbers, underscores, and hyphens",
		)
		.optional()
		.openapi({
			description:
				"Updated unique handle (letters, numbers, underscores, hyphens)",
			example: "janedoe",
		}),
	bio: z
		.string()
		.max(500, "Bio cannot exceed 500 characters")
		.optional()
		.nullable()
		.openapi({
			description: "Short author bio (up to 500 characters)",
			example: "Staff engineer passionate about high-throughput APIs.",
		}),
	avatarUrl: z.url("Must be a valid URL").optional().nullable().openapi({
		description: "Avatar image URL",
		example: "https://example.com/avatar.jpg",
	}),
	bannerUrl: z.url("Must be a valid URL").optional().nullable().openapi({
		description: "Banner image URL",
		example: "https://example.com/banner.jpg",
	}),
	websiteUrl: z.url("Must be a valid URL").optional().nullable().openapi({
		description: "Personal website URL",
		example: "https://janedoe.io",
	}),
	socialLinks: z
		.object({
			twitter: z.string().optional(),
			github: z.string().optional(),
			linkedin: z.string().optional(),
			youtube: z.string().optional(),
		})
		.optional()
		.openapi({
			description: "Social media links dictionary",
			example: {
				github: "https://github.com/janedoe",
				twitter: "https://x.com/janedoe",
			},
		}),
});

export type SelectProfile = z.infer<typeof selectProfileSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>;
