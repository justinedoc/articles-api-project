import { createRoute, z } from "@hono/zod-openapi";
import * as httpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { authMiddleware } from "@/core/auth/middleware";
import { defaultErrorResponses } from "@/core/openapi/helpers";
import { createMessageSchema } from "@/core/openapi/schemas";
import {
	publicProfileSchema,
	selectProfileSchema,
	updateProfileSchema,
} from "./schema";

const tags = ["Profiles"];
const security = [{ BearerAuth: [] }];

export const getMyProfileRoute = createRoute({
	method: "get",
	path: "/me",
	summary: "Get current user author profile",
	description: "Retrieves the authenticated user's author profile details.",
	tags,
	security,
	middleware: [authMiddleware],
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			createMessageSchema("Profile retrieved successfully", true).extend({
				data: selectProfileSchema,
			}),
			"Current user profile",
		),
		...defaultErrorResponses,
	},
});

export const updateMyProfileRoute = createRoute({
	method: "patch",
	path: "/me",
	summary: "Update current user author profile",
	description:
		"Updates public author details (displayName, username, bio, avatarUrl, bannerUrl, websiteUrl, socialLinks). Synchronizes displayName and avatarUrl with user account credentials.",
	tags,
	security,
	middleware: [authMiddleware],
	request: {
		body: jsonContentRequired(updateProfileSchema, "Profile update details"),
	},
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			createMessageSchema("Profile updated successfully", true).extend({
				data: selectProfileSchema,
			}),
			"Updated user profile",
		),
		...defaultErrorResponses,
	},
});

export const getPublicProfileRoute = createRoute({
	method: "get",
	path: "/{username}",
	summary: "Get public author profile",
	description:
		"Fetches public profile information for any author by their unique username.",
	tags,
	request: {
		params: z.object({
			username: z.string().openapi({
				param: {
					name: "username",
					in: "path",
				},
				example: "johndoe",
				description: "Author's unique handle",
			}),
		}),
	},
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			createMessageSchema("Public profile retrieved successfully", true).extend(
				{
					data: publicProfileSchema,
				},
			),
			"Public author profile",
		),
		...defaultErrorResponses,
	},
});

export type GetMyProfileRoute = typeof getMyProfileRoute;
export type UpdateMyProfileRoute = typeof updateMyProfileRoute;
export type GetPublicProfileRoute = typeof getPublicProfileRoute;
