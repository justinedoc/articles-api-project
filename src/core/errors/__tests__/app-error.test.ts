import * as httpStatusCodes from "stoker/http-status-codes";
import { describe, expect, it } from "vitest";
import { AppError } from "../app-error";

describe("AppError Unit Tests", () => {
	it("should default to 500 INTERNAL_SERVER_ERROR when no status is provided", () => {
		const error = new AppError("Something went wrong");

		expect(error.message).toBe("Something went wrong");
		expect(error.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
		expect(error.name).toBe("AppError");
		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(AppError);
	});

	it("should store the custom status code passed to constructor", () => {
		const error = new AppError("Resource not found", httpStatusCodes.NOT_FOUND);

		expect(error.message).toBe("Resource not found");
		expect(error.status).toBe(httpStatusCodes.NOT_FOUND);
		expect(error.status).toBe(404);
	});

	it("should capture a stack trace", () => {
		const error = new AppError("Stack error", httpStatusCodes.BAD_REQUEST);

		expect(error.stack).toBeDefined();
		expect(error.stack).toContain("AppError: Stack error");
	});
});

describe("onError Handler Unit Tests", () => {
	it("should return 500 INTERNAL_SERVER_ERROR for unhandled generic errors", async () => {
		const { onError } = await import("../error-handler");
		const mockContext = {
			newResponse: () => ({ status: 200 }),
			req: { url: "http://localhost/test", method: "GET" },
			var: { logger: { error: () => {} } },
			json: (data: unknown, status: number) => ({ data, status }),
		} as never;

		const genericError = new Error("Database connection dropped unexpectedly");
		const response = onError(genericError, mockContext) as unknown as {
			data: { success: boolean; message: string };
			status: number;
		};

		expect(response.status).toBe(500);
		expect(response.data.success).toBe(false);
	});

	it("should preserve status code for AppError", async () => {
		const { onError } = await import("../error-handler");
		const mockContext = {
			newResponse: () => ({ status: 200 }),
			req: { url: "http://localhost/test", method: "GET" },
			var: { logger: { error: () => {} } },
			json: (data: unknown, status: number) => ({ data, status }),
		} as never;

		const appError = new AppError(
			"Forbidden action",
			httpStatusCodes.FORBIDDEN,
		);
		const response = onError(appError, mockContext) as unknown as {
			data: { success: boolean; message: string };
			status: number;
		};

		expect(response.status).toBe(403);
		expect(response.data.success).toBe(false);
		expect(response.data.message).toBe("Forbidden action");
	});
});
