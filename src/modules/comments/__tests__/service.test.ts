import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/core/errors";
import { cleanupTestUsers, createTestUser } from "@/core/test-utils";
import { createArticle, transitionArticle } from "@/modules/articles/service";
import {
	createComment,
	deleteComment,
	listComments,
	updateComment,
} from "../service";

describe("Comment Service (PostgreSQL integration)", () => {
	const testUserIds = new Set<string>();
	let authorId: string;
	let commenterId: string;
	let articleId: string;

	beforeEach(async () => {
		const author = await createTestUser("author");
		const commenter = await createTestUser("commenter");
		testUserIds.add(author.id);
		testUserIds.add(commenter.id);
		authorId = author.id;
		commenterId = commenter.id;
		const article = await createArticle(authorId, {
			title: "Commented article",
			body: "Body",
		});
		articleId = article.id;
		await transitionArticle(articleId, authorId, "published");
	});

	afterEach(async () => {
		await cleanupTestUsers(testUserIds);
		testUserIds.clear();
	});

	it("supports arbitrary nested replies and cursor listing", async () => {
		const root = await createComment(articleId, commenterId, {
			body: "Root",
		});
		const reply = await createComment(articleId, authorId, {
			body: "Reply",
			parentId: root.id,
		});
		await createComment(articleId, commenterId, {
			body: "Nested reply",
			parentId: reply.id,
		});

		const page = await listComments(articleId, undefined, 2);
		expect(page.data).toHaveLength(2);
		expect(page.nextCursor).toBeTruthy();

		const nextPage = await listComments(
			articleId,
			page.nextCursor ?? undefined,
			2,
		);
		expect(
			new Set([...page.data, ...nextPage.data].map(({ id }) => id)).size,
		).toBe(3);
		expect(
			nextPage.data.some(({ id }) => page.data.some((item) => item.id === id)),
		).toBe(false);
	});

	it("soft-deletes comments and retains replies", async () => {
		const root = await createComment(articleId, commenterId, {
			body: "Root",
		});
		const reply = await createComment(articleId, authorId, {
			body: "Reply",
			parentId: root.id,
		});

		const deleted = await deleteComment(root.id, commenterId);
		expect(deleted?.body).toBe("Comment deleted");
		await expect(
			createComment(articleId, commenterId, {
				body: "Blocked",
				parentId: root.id,
			}),
		).rejects.toThrow(new AppError("Cannot reply to a deleted comment", 409));

		await expect(
			updateComment(reply.id, authorId, "Edited"),
		).resolves.toMatchObject({ body: "Edited" });
		const listed = await listComments(articleId, undefined, 10);
		expect(listed.data.map(({ id }) => id)).toEqual([root.id, reply.id]);
	});

	it("rejects edits by non-owners", async () => {
		const created = await createComment(articleId, commenterId, {
			body: "Owned",
		});
		await expect(updateComment(created.id, authorId, "Nope")).rejects.toThrow(
			new AppError("You do not own this comment", 403),
		);
	});
});
