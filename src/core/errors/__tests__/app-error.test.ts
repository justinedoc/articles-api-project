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
