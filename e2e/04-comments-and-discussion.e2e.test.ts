import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiClient } from "./helpers/client";
import {
	cleanupE2EUsers,
	createE2EUser,
	type E2EUser,
} from "./helpers/test-user";

describe("E2E: Comments & Discussion Threads", () => {
	const createdUserIds = new Set<string>();
	let author: E2EUser;
	let readerA: E2EUser;
	let readerB: E2EUser;
	let publishedArticleId: string;

	beforeAll(async () => {
		author = await createE2EUser("comments_author");
		readerA = await createE2EUser("comments_user_a");
		readerB = await createE2EUser("comments_user_b");
		createdUserIds.add(author.id);
		createdUserIds.add(readerA.id);
		createdUserIds.add(readerB.id);

		// Create & publish an article to comment on
		const articleRes = await author.client.post<{ data: { id: string } }>(
			"/api/v1/articles",
			{
				title: "Discussion Board Topic",
				body: "Open discussion on software design.",
			},
		);
		publishedArticleId = articleRes.data.data.id;
		await author.client.post(`/api/v1/articles/${publishedArticleId}/publish`);
	});

	afterAll(async () => {
		await cleanupE2EUsers(createdUserIds);
	});

	it("should create top-level comment and threaded reply", async () => {
		// 1. Reader A posts top-level comment
		const comment1Res = await readerA.client.post<{
			success: boolean;
			data: {
				id: string;
				body: string;
				parentId: string | null;
				authorId: string;
			};
		}>(`/api/v1/articles/${publishedArticleId}/comments`, {
			body: "First thought on this article: great read!",
		});

		expect(comment1Res.status).toBe(201);
		expect(comment1Res.data.data.body).toBe(
			"First thought on this article: great read!",
		);
		expect(comment1Res.data.data.parentId).toBeNull();
		expect(comment1Res.data.data.authorId).toBe(readerA.id);
		const parentCommentId = comment1Res.data.data.id;

		// 2. Reader B replies to Reader A's comment
		const replyRes = await readerB.client.post<{
			success: boolean;
			data: {
				id: string;
				body: string;
				parentId: string | null;
				authorId: string;
			};
		}>(`/api/v1/articles/${publishedArticleId}/comments`, {
			body: "I completely agree with your point.",
			parentId: parentCommentId,
		});

		expect(replyRes.status).toBe(201);
		expect(replyRes.data.data.body).toBe("I completely agree with your point.");
		expect(replyRes.data.data.parentId).toBe(parentCommentId);
		expect(replyRes.data.data.authorId).toBe(readerB.id);

		// 3. Public retrieval of root article comments (paginated root only)
		const listRes = await apiClient.get<{
			success: boolean;
			data: {
				data: Array<{
					id: string;
					body: string;
					parentId: string | null;
					replyCount: number;
				}>;
				nextCursor: string | null;
			};
		}>(`/api/v1/articles/${publishedArticleId}/comments`);

		expect(listRes.status).toBe(200);
		// Should only return top-level comments
		const rootComment = listRes.data.data.data.find(
			(c) => c.id === parentCommentId,
		);
		expect(rootComment).toBeDefined();
		expect(rootComment?.parentId).toBeNull();
		expect(rootComment?.replyCount).toBe(1);
		// The reply should NOT be in the root comments list
		expect(
			listRes.data.data.data.some((c) => c.id === replyRes.data.data.id),
		).toBe(false);

		// 4. On-demand retrieval of direct replies
		const repliesRes = await apiClient.get<{
			success: boolean;
			data: {
				data: Array<{
					id: string;
					body: string;
					parentId: string | null;
					replyCount: number;
				}>;
				nextCursor: string | null;
			};
		}>(`/api/v1/comments/${parentCommentId}/replies`);

		expect(repliesRes.status).toBe(200);
		expect(repliesRes.data.data.data.length).toBe(1);
		expect(repliesRes.data.data.data[0].id).toBe(replyRes.data.data.id);
		expect(repliesRes.data.data.data[0].parentId).toBe(parentCommentId);

		// 5. Nested reply & Recursive tree retrieval (?tree=true)
		const nestedReplyRes = await readerA.client.post<{
			data: { id: string; parentId: string | null };
		}>(`/api/v1/articles/${publishedArticleId}/comments`, {
			body: "Replying to Reader B's reply!",
			parentId: replyRes.data.data.id,
		});
		expect(nestedReplyRes.status).toBe(201);

		const treeRes = await apiClient.get<{
			success: boolean;
			data: {
				data: Array<{
					id: string;
					body: string;
					parentId: string | null;
					replies: Array<{
						id: string;
						body: string;
						parentId: string | null;
						replies: unknown[];
					}>;
				}>;
				nextCursor: string | null;
			};
		}>(`/api/v1/comments/${parentCommentId}/replies?tree=true`);

		expect(treeRes.status).toBe(200);
		expect(treeRes.data.data.data.length).toBe(1);
		expect(treeRes.data.data.data[0].id).toBe(replyRes.data.data.id);
		expect(treeRes.data.data.data[0].replies.length).toBe(1);
		expect(treeRes.data.data.data[0].replies[0].id).toBe(
			nestedReplyRes.data.data.id,
		);
	});

	it("should allow comment author to update body, rejecting non-authors with 403", async () => {
		// Reader A creates comment
		const createRes = await readerA.client.post<{ data: { id: string } }>(
			`/api/v1/articles/${publishedArticleId}/comments`,
			{ body: "Typo in this coment" },
		);
		const commentId = createRes.data.data.id;

		// Reader B tries to edit Reader A's comment
		const unauthorizedEdit = await readerB.client.patch(
			`/api/v1/comments/${commentId}`,
			{ body: "Malicious edit" },
		);
		expect(unauthorizedEdit.status).toBe(403);
		expect(unauthorizedEdit.text).toContain("You do not own this comment");

		// Reader A fixes their typo
		const authorEdit = await readerA.client.patch<{
			data: { id: string; body: string };
		}>(`/api/v1/comments/${commentId}`, {
			body: "Fixed: Typo in this comment",
		});
		expect(authorEdit.status).toBe(200);
		expect(authorEdit.data.data.body).toBe("Fixed: Typo in this comment");
	});

	it("should soft-delete comments, prevent editing deleted comments, and block replies to them", async () => {
		// Reader A creates comment to delete
		const createRes = await readerA.client.post<{ data: { id: string } }>(
			`/api/v1/articles/${publishedArticleId}/comments`,
			{ body: "Regrettable comment" },
		);
		const commentId = createRes.data.data.id;

		// Reader B tries to delete Reader A's comment (403)
		const unauthorizedDelete = await readerB.client.delete(
			`/api/v1/comments/${commentId}`,
		);
		expect(unauthorizedDelete.status).toBe(403);

		// Reader A soft-deletes comment
		const deleteRes = await readerA.client.delete<{
			data: { body: string; deletedAt: string | null };
		}>(`/api/v1/comments/${commentId}`);
		expect(deleteRes.status).toBe(200);
		expect(deleteRes.data.data.body).toBe("Comment deleted");
		expect(deleteRes.data.data.deletedAt).toBeDefined();

		// Attempting to edit a deleted comment returns 409
		const editDeleted = await readerA.client.patch(
			`/api/v1/comments/${commentId}`,
			{ body: "Attempting resurrection" },
		);
		expect(editDeleted.status).toBe(409);
		expect(editDeleted.text).toContain("Deleted comments cannot be edited");

		// Attempting to reply to a deleted comment returns 409
		const replyToDeleted = await readerB.client.post(
			`/api/v1/articles/${publishedArticleId}/comments`,
			{
				body: "Replying to ghost",
				parentId: commentId,
			},
		);
		expect(replyToDeleted.status).toBe(409);
		expect(replyToDeleted.text).toContain("Cannot reply to a deleted comment");
	});
});
