import { describe, expect, it, vi } from "vitest";
import { createTestApp } from "@/core/test-utils";
import { tagsRouter } from "../index";
import * as tagService from "../service";

describe("Tags Routes Integration Tests", () => {
	const app = createTestApp("/tags", tagsRouter);

	it("should return 200 OK and Cache-Control header on GET /tags/popular", async () => {
		vi.spyOn(tagService, "listPopularTags").mockResolvedValue([
			{ id: "tag_1", name: "typescript", articleCount: 15 },
			{ id: "tag_2", name: "postgresql", articleCount: 8 },
		]);

		const res = await app.request("/api/tags/popular");

		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toContain("public");
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data).toHaveLength(2);
		expect(json.data[0].name).toBe("typescript");
	});
});
