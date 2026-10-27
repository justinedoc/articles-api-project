import { sql } from "drizzle-orm";
import { db } from "@/core/db";
import { isRedisAvailable, redis } from "@/core/redis";

/**
 * checks database and redis connectivity for health checks.
 */
export const getSystemHealth = async () => {
	let database: "up" | "down" = "down";
	let redisStatus: "up" | "down" = "down";

	try {
		await db.execute(sql`SELECT 1`);
		database = "up";
	} catch {
		database = "down";
	}

	if (isRedisAvailable()) {
		try {
			const ping = await redis.ping();
			if (ping === "PONG") {
				redisStatus = "up";
			}
		} catch {
			redisStatus = "down";
		}
	}

	return { database, redis: redisStatus };
};
