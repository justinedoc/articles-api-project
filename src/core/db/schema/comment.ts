import {
	type AnyPgColumn,
	index,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { generateId } from "@/core/utils";
import { article } from "./article";
import { user } from "./auth";

export const comment = pgTable(
	"comment",
	{
		id: text("id").primaryKey().$defaultFn(generateId),
		articleId: text("article_id")
			.notNull()
			.references(() => article.id, { onDelete: "cascade" }),
		authorId: text("author_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		parentId: text("parent_id").references((): AnyPgColumn => comment.id, {
			onDelete: "cascade",
		}),
		body: text("body").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("comment_article_id_created_at_idx").on(
			table.articleId,
			table.createdAt,
		),
		index("comment_parent_id_created_at_idx").on(
			table.parentId,
			table.createdAt,
		),
		index("comment_author_id_idx").on(table.authorId),
	],
);
