import app from "@/app";

export interface RequestOptions {
	token?: string;
	headers?: Record<string, string>;
	body?: unknown;
}

export interface ApiResponse<T = unknown> {
	status: number;
	headers: Headers;
	data: T;
	text: string;
}

export class ApiTestClient {
	constructor(private defaultToken?: string) {}

	setToken(token: string | undefined) {
		this.defaultToken = token;
	}

	async request<T = unknown>(
		method: string,
		path: string,
		options: RequestOptions = {},
	): Promise<ApiResponse<T>> {
		const headers: Record<string, string> = {
			Origin: "http://localhost:3000",
			...options.headers,
		};

		const token = options.token ?? this.defaultToken;
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		let body: string | undefined;
		if (options.body !== undefined) {
			if (typeof options.body === "string") {
				body = options.body;
			} else {
				headers["Content-Type"] = "application/json";
				body = JSON.stringify(options.body);
			}
		}

		const res = await app.request(path, {
			method,
			headers,
			body,
		});

		const text = await res.text();
		let data: T;
		try {
			data = JSON.parse(text) as T;
		} catch {
			data = text as unknown as T;
		}

		return {
			status: res.status,
			headers: res.headers,
			data,
			text,
		};
	}

	get<T = unknown>(path: string, options?: RequestOptions) {
		return this.request<T>("GET", path, options);
	}

	post<T = unknown>(path: string, body?: unknown, options?: RequestOptions) {
		return this.request<T>("POST", path, { ...options, body });
	}

	patch<T = unknown>(path: string, body?: unknown, options?: RequestOptions) {
		return this.request<T>("PATCH", path, { ...options, body });
	}

	delete<T = unknown>(path: string, options?: RequestOptions) {
		return this.request<T>("DELETE", path, options);
	}
}

export const apiClient = new ApiTestClient();
