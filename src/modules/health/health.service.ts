import { sql } from "drizzle-orm";
import { db } from "@/core/db";

export const getSystemHealth = async () => {
	let database: "up" | "down" = "down";

	try {
		await db.execute(sql`SELECT 1`);
		database = "up";
	} catch {
		database = "down";
	}

	return { database };
};
