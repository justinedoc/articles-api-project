import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	user: {
		profile: r.one.profile({
			from: r.user.id,
			to: r.profile.userId,
		}),

		comments: r.many.comment(),
		articles: r.many.article(),
		sessions: r.many.session(),
		accounts: r.many.account(),
	},

	profile: {
		user: r.one.user({
			from: r.profile.userId,
			to: r.user.id,
		}),
	},

	session: {
		user: r.one.user({
			from: r.session.userId,
			to: r.user.id,
		}),
	},

	account: {
		user: r.one.user({
			from: r.account.userId,
			to: r.user.id,
		}),
	},

	article: {
		comments: r.many.comment(),
		tags: r.many.articleTag(),
		author: r.one.user({
			from: r.article.authorId,
			to: r.user.id,
		}),
	},

	tag: {
		articles: r.many.articleTag(),
	},

	articleTag: {
		article: r.one.article({
			from: r.articleTag.articleId,
			to: r.article.id,
		}),
		tag: r.one.tag({
			from: r.articleTag.tagId,
			to: r.tag.id,
		}),
	},

	comment: {
		article: r.one.article({
			from: r.comment.articleId,
			to: r.article.id,
		}),
		author: r.one.user({
			from: r.comment.authorId,
			to: r.user.id,
		}),
	},
}));
