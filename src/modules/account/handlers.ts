import * as httpStatusCodes from "stoker/http-status-codes";
import { AppError } from "@/core/errors";
import type { AppRouteHandler } from "@/core/types";
import type { DeleteAccountRoute, GetAccountRoute } from "./routes";
import { deleteAccount, getAccount } from "./service";

export const me: AppRouteHandler<GetAccountRoute> = async (c) => {
	const user = c.get("user");
	if (!user) throw new AppError("Unauthorized", httpStatusCodes.UNAUTHORIZED);

	const result = await getAccount(user.id);

	return c.json(
		{ success: true, message: "Account retrieved successfully", data: result },
		httpStatusCodes.OK,
	);
};

export const remove: AppRouteHandler<DeleteAccountRoute> = async (c) => {
	const user = c.get("user");
	if (!user) throw new AppError("Unauthorized", httpStatusCodes.UNAUTHORIZED);

	await deleteAccount(user.id);

	return c.json(
		{ success: true, message: "Account deleted successfully" },
		httpStatusCodes.OK,
	);
};
