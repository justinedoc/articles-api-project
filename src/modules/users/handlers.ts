import * as httpStatusCodes from "stoker/http-status-codes";
import { AppError } from "@/core/errors";
import type { AppRouteHandler } from "@/core/types";
import type {
	DeleteAccountRoute,
	GetProfileRoute,
	UpdateProfileRoute,
} from "./routes";
import { deleteAccount, getProfile, updateProfile } from "./service";

export const me: AppRouteHandler<GetProfileRoute> = async (c) => {
	const user = c.get("user");
	if (!user) throw new AppError("Unauthorized", httpStatusCodes.UNAUTHORIZED);

	const result = await getProfile(user.id);

	return c.json(
		{ success: true, message: "Profile retrieved successfully", data: result },
		httpStatusCodes.OK,
	);
};

export const update: AppRouteHandler<UpdateProfileRoute> = async (c) => {
	const payload = c.req.valid("json");
	const user = c.get("user");

	if (!user) throw new AppError("Unauthorized", httpStatusCodes.UNAUTHORIZED);

	const result = await updateProfile(user.id, payload);

	return c.json(
		{ success: true, message: "Profile updated successfully", data: result },
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
