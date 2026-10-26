import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "@/core/test-utils";
import { healthRouter } from "../index";
import * as healthService from "../service";

describe("Health Routes", () => {
	const app = createTestApp("/", healthRouter);

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("should return 200 OK and system status when database is up", async () => {
		vi.spyOn(healthService, "getSystemHealth").mockResolvedValue({
			database: "up",
			redis: "up",
		});

		const res = await app.request("/api/health");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.status).toBe("ok");
		expect(data.services.database).toBe("up");
		expect(data.services.redis).toBe("up");
		expect(data.timestamp).toBeDefined();
	});

	it("should return 503 SERVICE_UNAVAILABLE when database is down", async () => {
		vi.spyOn(healthService, "getSystemHealth").mockResolvedValue({
			database: "down",
			redis: "up",
		});

		const res = await app.request("/api/health");
		expect(res.status).toBe(503);

		const data = await res.json();
		expect(data.status).toBe("error");
		expect(data.services.database).toBe("down");
	});
});
