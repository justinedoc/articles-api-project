import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	user: {
		profile: r.one.profile({
			from: r.user.id,
			to: r.profile.userId,
		}),
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
}));
