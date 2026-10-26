import * as httpStatusCodes from "stoker/http-status-codes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/core/db";
import { AppError } from "@/core/errors";
import { createComment, deleteComment } from "../service";

vi.mock("@/core/db", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
	},
}));

const publishedArticle = [{ id: "article-1" }];
const existingComment = {
	id: "comment-1",
	articleId: "article-1",
	authorId: "user-1",
	parentId: null,
	body: "A comment",
	deletedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

const selectChain = (result: unknown) => ({
	from: vi.fn().mockReturnThis(),
	where: vi.fn().mockResolvedValue(result),
});

describe("Comment Service", () => {
	beforeEach(() => vi.clearAllMocks());

	it("creates replies only under comments from the same published article", async () => {
		vi.mocked(db.select)
			.mockReturnValueOnce(selectChain(publishedArticle) as never)
			.mockReturnValueOnce(selectChain([existingComment]) as never);
		const created = {
			...existingComment,
			id: "comment-2",
			parentId: "comment-1",
		};
		vi.mocked(db.insert).mockReturnValue({
			values: vi.fn().mockReturnThis(),
			returning: vi.fn().mockResolvedValue([created]),
		} as never);

		await expect(
			createComment("article-1", "user-2", {
				body: "A reply",
				parentId: "comment-1",
			}),
		).resolves.toEqual(created);
	});

	it("rejects replies to soft-deleted comments", async () => {
		vi.mocked(db.select)
			.mockReturnValueOnce(selectChain(publishedArticle) as never)
			.mockReturnValueOnce(
				selectChain([{ ...existingComment, deletedAt: new Date() }]) as never,
			);

		await expect(
			createComment("article-1", "user-2", {
				body: "A reply",
				parentId: "comment-1",
			}),
		).rejects.toThrow(
			new AppError(
				"Cannot reply to a deleted comment",
				httpStatusCodes.CONFLICT,
			),
		);
	});

	it("soft-deletes comments and preserves their rows for replies", async () => {
		vi.mocked(db.select).mockReturnValue(
			selectChain([existingComment]) as never,
		);
		const deleted = {
			...existingComment,
			body: "Comment deleted",
			deletedAt: new Date(),
		};
		vi.mocked(db.update).mockReturnValue({
			set: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			returning: vi.fn().mockResolvedValue([deleted]),
		} as never);

		await expect(deleteComment("comment-1", "user-1")).resolves.toEqual(
			deleted,
		);
		expect(db.update).toHaveBeenCalled();
	});
});
