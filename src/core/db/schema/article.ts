import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { generateId } from "@/core/utils";
import { user } from "./auth";

export const articleStatus = pgEnum("article_status", [
	"draft",
	"published",
	"archived",
]);

export const article = pgTable(
	"article",
	{
		id: text("id").primaryKey().$defaultFn(generateId),
		authorId: text("author_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		slug: text("slug").notNull().unique(),
		excerpt: text("excerpt"),
		body: text("body").notNull(),
		status: articleStatus("status").notNull(),
		publishedAt: timestamp("published_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("article_status_published_at_idx").on(
			table.status,
			table.publishedAt,
		),
		index("article_author_id_idx").on(table.authorId),
	],
);
