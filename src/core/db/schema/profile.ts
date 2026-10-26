import {
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const profile = pgTable(
	"profile",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.unique()
			.references(() => user.id, { onDelete: "cascade" }),
		username: text("username").notNull().unique(),
		displayName: text("display_name").notNull(),
		bio: text("bio"),
		avatarUrl: text("avatar_url"),
		bannerUrl: text("banner_url"),
		websiteUrl: text("website_url"),
		socialLinks: jsonb("social_links")
			.$type<{
				twitter?: string;
				github?: string;
				linkedin?: string;
				youtube?: string;
			}>()
			.default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("profile_userId_idx").on(table.userId),
		uniqueIndex("profile_username_idx").on(table.username),
	],
);
