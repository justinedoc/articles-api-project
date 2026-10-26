import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/core/auth";
import { auth } from "@/core/auth";
import { createApp } from "@/core/server";
import { profilesRouter } from "../index";
import * as profilesService from "../service";

describe("Profiles Routes Integration Tests", () => {
	const app = createApp().route("/profiles", profilesRouter);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return 401 Unauthorized when accessing /profiles/me without credentials", async () => {
		vi.spyOn(auth.api, "getSession").mockResolvedValue(null);

		const res = await app.request("/api/profiles/me", {
			method: "GET",
		});

		expect(res.status).toBe(401);
		const json = await res.json();
		expect(json.success).toBe(false);
		expect(json.message).toBe("Unauthorized");
	});

	it("should return 422 Unprocessable Entity when PATCH /profiles/me has an invalid payload", async () => {
		const mockSession: AuthSession = {
			session: {
				id: "sess_1",
				userId: "usr_1",
				expiresAt: new Date(Date.now() + 3600000),
				token: "token_1",
				createdAt: new Date(),
				updatedAt: new Date(),
				ipAddress: null,
				userAgent: null,
			},
			user: {
				id: "usr_1",
				email: "test@example.com",
				name: "Test User",
				emailVerified: true,
				image: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		};

		vi.spyOn(auth.api, "getSession").mockResolvedValue(mockSession);

		const res = await app.request("/api/profiles/me", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				avatarUrl: "invalid-url",
			}),
		});

		expect(res.status).toBe(422);
		const json = await res.json();
		expect(json.success).toBe(false);
		expect(json.message).toBeDefined();
	});

	it("should return 200 OK with profile when authenticated user requests GET /profiles/me", async () => {
		const mockProfile = {
			id: "prof_123",
			userId: "usr_123",
			username: "janedoe",
			displayName: "Jane Doe",
			bio: "Tech writer",
			avatarUrl: null,
			bannerUrl: null,
			websiteUrl: null,
			socialLinks: {},
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const mockSession: AuthSession = {
			session: {
				id: "sess_123",
				userId: "usr_123",
				expiresAt: new Date(Date.now() + 3600000),
				token: "token_123",
				createdAt: new Date(),
				updatedAt: new Date(),
				ipAddress: null,
				userAgent: null,
			},
			user: {
				id: "usr_123",
				name: "Jane Doe",
				email: "jane@example.com",
				emailVerified: true,
				image: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		};

		vi.spyOn(auth.api, "getSession").mockResolvedValue(mockSession);
		vi.spyOn(profilesService, "getOrCreateProfile").mockResolvedValue(
			mockProfile,
		);

		const res = await app.request("/api/profiles/me", {
			method: "GET",
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.message).toBe("Profile retrieved successfully");
		expect(json.data.username).toBe("janedoe");
		expect(json.data.displayName).toBe("Jane Doe");
	});

	it("should return 200 OK for public GET /profiles/:username without authentication", async () => {
		const mockPublic = {
			id: "prof_123",
			username: "janedoe",
			displayName: "Jane Doe",
			bio: "Tech writer",
			avatarUrl: "https://example.com/avatar.jpg",
			bannerUrl: null,
			websiteUrl: null,
			socialLinks: { twitter: "https://x.com/janedoe" },
			createdAt: new Date(),
		};

		vi.spyOn(profilesService, "getPublicProfileByUsername").mockResolvedValue(
			mockPublic,
		);

		const res = await app.request("/api/profiles/janedoe", {
			method: "GET",
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.username).toBe("janedoe");
		expect(json.data.displayName).toBe("Jane Doe");
		expect(json.data.socialLinks.twitter).toBe("https://x.com/janedoe");
	});
});
