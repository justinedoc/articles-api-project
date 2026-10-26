import {
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { article } from "./article";
import { user } from "./auth";

export const articleLike = pgTable(
	"article_like",
	{
		articleId: text("article_id")
			.notNull()
			.references(() => article.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.articleId, table.userId] }),
		index("article_like_user_id_idx").on(table.userId),
	],
);
