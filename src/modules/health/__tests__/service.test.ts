import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/core/db";
import * as redisModule from "@/core/redis";
import { getSystemHealth } from "../service";

describe("Health Service", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("should report database and redis as up when healthy", async () => {
		vi.spyOn(db, "execute").mockResolvedValue({} as never);
		vi.spyOn(redisModule, "isRedisAvailable").mockReturnValue(true);
		vi.spyOn(redisModule.redis, "ping").mockResolvedValue("PONG");

		const health = await getSystemHealth();
		expect(health.database).toBe("up");
		expect(health.redis).toBe("up");
	});

	it("should report database as down when db query fails", async () => {
		vi.spyOn(db, "execute").mockRejectedValue(new Error("DB connection lost"));
		vi.spyOn(redisModule, "isRedisAvailable").mockReturnValue(true);
		vi.spyOn(redisModule.redis, "ping").mockResolvedValue("PONG");

		const health = await getSystemHealth();
		expect(health.database).toBe("down");
		expect(health.redis).toBe("up");
	});

	it("should report redis as down when ping fails or redis is unavailable", async () => {
		vi.spyOn(db, "execute").mockResolvedValue({} as never);
		vi.spyOn(redisModule, "isRedisAvailable").mockReturnValue(true);
		vi.spyOn(redisModule.redis, "ping").mockRejectedValue(
			new Error("Redis error"),
		);

		const health = await getSystemHealth();
		expect(health.database).toBe("up");
		expect(health.redis).toBe("down");
	});
});
