import { index, pgTable, primaryKey, text, unique } from "drizzle-orm/pg-core";
import { generateId } from "@/core/utils";
import { article } from "./article";

export const tag = pgTable(
	"tag",
	{
		id: text("id").primaryKey().$defaultFn(generateId),
		name: text("name").notNull(),
	},
	(table) => [unique("tag_name_unique").on(table.name)],
);

export const articleTag = pgTable(
	"article_tag",
	{
		articleId: text("article_id")
			.notNull()
			.references(() => article.id, { onDelete: "cascade" }),
		tagId: text("tag_id")
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.articleId, table.tagId] }),
		index("article_tag_tag_id_idx").on(table.tagId),
	],
);
