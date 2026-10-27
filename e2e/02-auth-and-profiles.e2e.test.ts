import { afterAll, describe, expect, it } from "vitest";
import { apiClient } from "./helpers/client";
import { cleanupE2EUsers, createE2EUser } from "./helpers/test-user";

describe("E2E: Auth & Author Profiles", () => {
	const createdUserIds = new Set<string>();

	afterAll(async () => {
		await cleanupE2EUsers(createdUserIds);
	});

	it("should reject unauthenticated access to /profiles/me with 401", async () => {
		const res = await apiClient.get("/api/v1/profiles/me");
		expect(res.status).toBe(401);
		expect(res.data).toMatchObject({
			success: false,
			message: "Unauthorized",
		});
	});

	it("should sign up user, auto-provision profile, and retrieve it via /profiles/me", async () => {
		const user = await createE2EUser("alice");
		createdUserIds.add(user.id);

		// Fetch profile using Bearer token
		const res = await user.client.get<{
			success: boolean;
			data: {
				userId: string;
				displayName: string;
				username: string;
				bio: string | null;
				avatarUrl: string | null;
			};
		}>("/api/v1/profiles/me");

		expect(res.status).toBe(200);
		expect(res.data.success).toBe(true);
		expect(res.data.data.userId).toBe(user.id);
		expect(res.data.data.displayName).toBe("E2E Alice");
		expect(res.data.data.username).toBeDefined();
		expect(res.data.data.username.length).toBeGreaterThan(0);
	});

	it("should update profile and synchronize displayName and avatarUrl with user account (SSOT)", async () => {
		const user = await createE2EUser("bob");
		createdUserIds.add(user.id);

		// Update profile
		const patchRes = await user.client.patch<{
			success: boolean;
			data: {
				displayName: string;
				username: string;
				avatarUrl: string;
				bio: string;
				websiteUrl: string;
				socialLinks: { twitter: string };
			};
		}>("/api/v1/profiles/me", {
			displayName: "Bob The Builder",
			username: `builder_bob_${Date.now()}`,
			avatarUrl: "https://example.com/avatar-bob.jpg",
			bio: "Can we build it? Yes we can!",
			websiteUrl: "https://builder.example.com",
			socialLinks: { twitter: "https://x.com/builderbob" },
		});

		expect(patchRes.status).toBe(200);
		expect(patchRes.data.success).toBe(true);
		expect(patchRes.data.data.displayName).toBe("Bob The Builder");
		expect(patchRes.data.data.avatarUrl).toBe(
			"https://example.com/avatar-bob.jpg",
		);
		expect(patchRes.data.data.bio).toBe("Can we build it? Yes we can!");

		// Verify GET /profiles/me returns updated fields
		const getProfileRes = await user.client.get<{
			data: { displayName: string; avatarUrl: string; bio: string };
		}>("/api/v1/profiles/me");
		expect(getProfileRes.data.data.displayName).toBe("Bob The Builder");
		expect(getProfileRes.data.data.avatarUrl).toBe(
			"https://example.com/avatar-bob.jpg",
		);

		// Verify GET /account/me confirms SSOT synchronization (user.name and user.image)
		const getAccountRes = await user.client.get<{
			success: boolean;
			data: { name: string; image: string; email: string };
		}>("/api/v1/account/me");
		expect(getAccountRes.status).toBe(200);
		expect(getAccountRes.data.data.name).toBe("Bob The Builder");
		expect(getAccountRes.data.data.image).toBe(
			"https://example.com/avatar-bob.jpg",
		);
	});

	it("should prevent duplicate username updates with 409 Conflict", async () => {
		const user1 = await createE2EUser("charlie");
		const user2 = await createE2EUser("dave");
		createdUserIds.add(user1.id);
		createdUserIds.add(user2.id);

		const uniqueHandle = `handle_${Date.now()}`;

		// User 1 claims handle
		const res1 = await user1.client.patch("/api/v1/profiles/me", {
			username: uniqueHandle,
		});
		expect(res1.status).toBe(200);

		// User 2 attempts to claim the same handle
		const res2 = await user2.client.patch("/api/v1/profiles/me", {
			username: uniqueHandle,
		});
		expect(res2.status).toBe(409);
		expect(res2.text).toContain("Username is already taken");
	});

	it("should serve public profile at /profiles/:username and return 404 for unknown authors", async () => {
		const user = await createE2EUser("eve");
		createdUserIds.add(user.id);

		const handle = `eve_${Date.now()}`;
		await user.client.patch("/api/v1/profiles/me", {
			username: handle,
			displayName: "Eve Online",
			bio: "Security Researcher",
		});

		// Public retrieval without auth
		const publicRes = await apiClient.get<{
			success: boolean;
			data: {
				username: string;
				displayName: string;
				bio: string;
			};
		}>(`/api/v1/profiles/${handle}`);

		expect(publicRes.status).toBe(200);
		expect(publicRes.data.data.username).toBe(handle);
		expect(publicRes.data.data.displayName).toBe("Eve Online");
		expect(publicRes.data.data.bio).toBe("Security Researcher");

		// Case-insensitivity check
		const upperRes = await apiClient.get(
			`/api/v1/profiles/${handle.toUpperCase()}`,
		);
		expect(upperRes.status).toBe(200);

		// Non-existent author
		const notFoundRes = await apiClient.get(
			"/api/v1/profiles/non_existent_author_handle_123",
		);
		expect(notFoundRes.status).toBe(404);
	});
});
