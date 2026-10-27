import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/core/errors";
import { cleanupTestUsers, createTestUser } from "@/core/test-utils";
import { createArticle, transitionArticle } from "@/modules/articles/service";
import {
	createComment,
	deleteComment,
	listCommentReplies,
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

	it("supports paginating root comments with replyCount and loading replies on demand", async () => {
		const root1 = await createComment(articleId, commenterId, {
			body: "Root 1",
		});
		const root2 = await createComment(articleId, commenterId, {
			body: "Root 2",
		});

		// Reply to root 1
		const reply1 = await createComment(articleId, authorId, {
			body: "Reply to Root 1",
			parentId: root1.id,
		});

		// Reply to reply 1 (nested)
		await createComment(articleId, commenterId, {
			body: "Nested reply under Reply 1",
			parentId: reply1.id,
		});

		// 1. Root comments listing only returns root1 and root2
		const roots = await listComments(articleId, undefined, 10);
		expect(roots.data).toHaveLength(2);
		expect(roots.data.map((c) => c.id)).toEqual([root1.id, root2.id]);

		const foundRoot1 = roots.data.find((c) => c.id === root1.id);
		expect(foundRoot1?.replyCount).toBe(1);

		const foundRoot2 = roots.data.find((c) => c.id === root2.id);
		expect(foundRoot2?.replyCount).toBe(0);

		// 2. Load direct replies for root1
		const directReplies = await listCommentReplies(root1.id, undefined, 10);
		expect(directReplies.data).toHaveLength(1);
		expect(directReplies.data[0].id).toBe(reply1.id);
		expect(directReplies.data[0].replyCount).toBe(1);

		// 3. Load recursive tree for root1 (?tree=true)
		const replyTree = await listCommentReplies(root1.id, undefined, 10, true);
		expect(replyTree.data).toHaveLength(1);
		expect(replyTree.data[0].id).toBe(reply1.id);
		expect(replyTree.data[0].replies).toHaveLength(1);
		expect(replyTree.data[0].replies?.[0].body).toBe(
			"Nested reply under Reply 1",
		);
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

		const roots = await listComments(articleId, undefined, 10);
		expect(roots.data.map(({ id }) => id)).toEqual([root.id]);
		expect(roots.data[0].replyCount).toBe(1);

		const replies = await listCommentReplies(root.id, undefined, 10);
		expect(replies.data.map(({ id }) => id)).toEqual([reply.id]);
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
