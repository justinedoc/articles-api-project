import * as httpStatusCodes from "stoker/http-status-codes";
import { AppError } from "@/core/errors";
import type { AppRouteHandler } from "@/core/types";
import type {
	GetMyProfileRoute,
	GetPublicProfileRoute,
	UpdateMyProfileRoute,
} from "./routes";
import {
	getOrCreateProfile,
	getPublicProfileByUsername,
	updateProfile,
} from "./service";

export const me: AppRouteHandler<GetMyProfileRoute> = async (c) => {
	const user = c.get("user");
	if (!user) throw new AppError("Unauthorized", httpStatusCodes.UNAUTHORIZED);

	const result = await getOrCreateProfile(user.id);

	return c.json(
		{ success: true, message: "Profile retrieved successfully", data: result },
		httpStatusCodes.OK,
	);
};

export const update: AppRouteHandler<UpdateMyProfileRoute> = async (c) => {
	const payload = c.req.valid("json");
	const user = c.get("user");

	if (!user) throw new AppError("Unauthorized", httpStatusCodes.UNAUTHORIZED);

	const result = await updateProfile(user.id, payload);

	return c.json(
		{ success: true, message: "Profile updated successfully", data: result },
		httpStatusCodes.OK,
	);
};

export const getPublic: AppRouteHandler<GetPublicProfileRoute> = async (c) => {
	const { username } = c.req.valid("param");

	const result = await getPublicProfileByUsername(username);

	return c.json(
		{
			success: true,
			message: "Public profile retrieved successfully",
			data: result,
		},
		httpStatusCodes.OK,
	);
};
