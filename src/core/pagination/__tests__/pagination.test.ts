import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../index";

describe("cursor pagination", () => {
	it("round-trips the stable timestamp and id ordering key", () => {
		const record = {
			createdAt: new Date("2026-10-26T20:00:00.000Z"),
			id: "comment-1",
		};

		expect(decodeCursor(encodeCursor(record))).toEqual(record);
	});

	it("rejects malformed cursors", () => {
		expect(() => decodeCursor("not-a-valid-cursor")).toThrow(
			"Invalid pagination cursor",
		);
	});
});
