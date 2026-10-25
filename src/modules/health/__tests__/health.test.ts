import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";
import { createApp } from "@/core/server";
import { healthRouter } from "../index";

describe("Health test API", () => {
	const client = testClient(createApp().route("/", healthRouter));

	it("should return 200 OK and system status", async () => {
		const response = await client.api.health.$get();

		expect(response.status).toBe(200);

		const data = await response.json();

		expect(data.status).toBe("ok");
		expect(data.services.database).toBeDefined();
	});
});
