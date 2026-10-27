import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/core/db";
import { article, articleLike, comment, profile, user } from "@/core/db/schema";
import { cleanupE2EUsers, createE2EUser } from "./helpers/test-user";

describe("E2E: Account Lifecycle & Database Cascades", () => {
	it("should retrieve authenticated account details via GET /account/me", async () => {
		const testUser = await createE2EUser("account_inspector");

		const res = await testUser.client.get<{
			success: boolean;
			data: { id: string; email: string; name: string };
		}>("/api/v1/account/me");

		expect(res.status).toBe(200);
		expect(res.data.success).toBe(true);
		expect(res.data.data.id).toBe(testUser.id);
		expect(res.data.data.email).toBe(testUser.email);
		expect(res.data.data.name).toBe(testUser.name);

		await cleanupE2EUsers([testUser.id]);
	});

	it("should delete account and cascade-delete profile, articles, comments, and likes from DB", async () => {
		const authorUser = await createE2EUser("cascade_author");
		const otherUser = await createE2EUser("other_publisher");

		// 1. Other user publishes an article
		const otherArticleRes = await otherUser.client.post<{
			data: { id: string };
		}>("/api/v1/articles", {
			title: "Other Author Article",
			body: "Content to be liked by cascade author",
		});
		const otherArticleId = otherArticleRes.data.data.id;
		const otherPublishRes = await otherUser.client.post(
			`/api/v1/articles/${otherArticleId}/publish`,
		);
		expect(otherPublishRes.status).toBe(200);

		// 2. Author creates an article, comments on it, and likes other user's article
		const authorArticleRes = await authorUser.client.post<{
			data: { id: string };
		}>("/api/v1/articles", {
			title: "Author Article To Be Cascaded",
			body: "This article must be deleted when account is deleted",
		});
		const authorArticleId = authorArticleRes.data.data.id;
		const authorPublishRes = await authorUser.client.post(
			`/api/v1/articles/${authorArticleId}/publish`,
		);
		expect(authorPublishRes.status).toBe(200);

		// Author comments on their own published article
		const commentRes = await authorUser.client.post(
			`/api/v1/articles/${authorArticleId}/comments`,
			{
				body: "Author comment to be cascaded",
			},
		);
		expect(commentRes.status).toBe(201);

		// Author likes other user's article
		const likeRes = await authorUser.client.post(
			`/api/v1/articles/${otherArticleId}/like`,
		);
		expect(likeRes.status).toBe(200);

		// Verify records exist in DB prior to deletion
		const preProfiles = await db
			.select()
			.from(profile)
			.where(eq(profile.userId, authorUser.id));
		expect(preProfiles.length).toBe(1);

		const preArticles = await db
			.select()
			.from(article)
			.where(eq(article.authorId, authorUser.id));
		expect(preArticles.length).toBe(1);

		const preComments = await db
			.select()
			.from(comment)
			.where(eq(comment.authorId, authorUser.id));
		expect(preComments.length).toBe(1);

		const preLikes = await db
			.select()
			.from(articleLike)
			.where(eq(articleLike.userId, authorUser.id));
		expect(preLikes.length).toBe(1);

		// 3. Delete account via DELETE /api/v1/account/me
		const deleteRes = await authorUser.client.delete<{
			success: boolean;
			message: string;
		}>("/api/v1/account/me");

		expect(deleteRes.status).toBe(200);
		expect(deleteRes.data.success).toBe(true);

		// 4. Verify cascade deletion across all relational tables
		const remainingUsers = await db
			.select()
			.from(user)
			.where(eq(user.id, authorUser.id));
		expect(remainingUsers).toEqual([]);

		const remainingProfiles = await db
			.select()
			.from(profile)
			.where(eq(profile.userId, authorUser.id));
		expect(remainingProfiles).toEqual([]);

		const remainingArticles = await db
			.select()
			.from(article)
			.where(eq(article.authorId, authorUser.id));
		expect(remainingArticles).toEqual([]);

		const remainingComments = await db
			.select()
			.from(comment)
			.where(eq(comment.authorId, authorUser.id));
		expect(remainingComments).toEqual([]);

		const remainingLikes = await db
			.select()
			.from(articleLike)
			.where(eq(articleLike.userId, authorUser.id));
		expect(remainingLikes).toEqual([]);

		// 5. Subsequent request with deleted user's token returns 401 Unauthorized
		const unauthorizedRes = await authorUser.client.get("/api/v1/account/me");
		expect(unauthorizedRes.status).toBe(401);

		// Cleanup other user
		await cleanupE2EUsers([otherUser.id]);
	});
});
