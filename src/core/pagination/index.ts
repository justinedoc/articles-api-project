import * as httpStatusCodes from "stoker/http-status-codes";
import { z } from "zod";
import { AppError } from "@/core/errors";

export const cursorPaginationQuerySchema = z.object({
	cursor: z.string().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const encodeCursor = <T extends { createdAt: Date; id: string }>(
	record: T,
) =>
	Buffer.from(`${record.createdAt.toISOString()}|${record.id}`).toString(
		"base64url",
	);

export const decodeCursor = (cursor: string) => {
	const decoded = Buffer.from(cursor, "base64url").toString("utf8");
	const separator = decoded.indexOf("|");
	if (separator <= 0) {
		throw new AppError(
			"Invalid pagination cursor",
			httpStatusCodes.BAD_REQUEST,
		);
	}

	const createdAt = new Date(decoded.slice(0, separator));
	const id = decoded.slice(separator + 1);
	if (Number.isNaN(createdAt.getTime()) || !id) {
		throw new AppError(
			"Invalid pagination cursor",
			httpStatusCodes.BAD_REQUEST,
		);
	}

	return { createdAt, id };
};
