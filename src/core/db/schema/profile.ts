import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const profile = pgTable("profile", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: "cascade" }),
	username: text("username").notNull().unique(),
	bio: text("bio"),
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
});
