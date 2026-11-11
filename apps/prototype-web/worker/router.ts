/**
 * API router — method + path matching for `/api/*` routes.
 * Routes are registered as literal path segments (no dynamic segments in v1
 * except simple `{id}` tails handled by their owners).
 */

import { HttpError, errorResponse, type ApiResult } from "./http.ts";

export interface RouteContext {
  request: Request;
  url: URL;
  params: Record<string, string>;
  env: import("./env.ts").Env;
}

export type RouteHandler = (ctx: RouteContext) => Response | Promise<Response>;

interface Route {
  method: string;
  segments: string[]; // e.g. ["auth", "session"]; ":id" marks a capture
  handler: RouteHandler;
}

export class ApiRouter {
  private readonly routes: Route[] = [];

  add(method: string, path: string, handler: RouteHandler): this {
    const segments = path.split("/").filter(segment => segment.length > 0);
    this.routes.push({ method: method.toUpperCase(), segments, handler });
    return this;
  }

  get(path: string, handler: RouteHandler): this {
    return this.add("GET", path, handler);
  }

  post(path: string, handler: RouteHandler): this {
    return this.add("POST", path, handler);
  }

  delete(path: string, handler: RouteHandler): this {
    return this.add("DELETE", path, handler);
  }

  put(path: string, handler: RouteHandler): this {
    return this.add("PUT", path, handler);
  }

  /** Match a request; returns the handler + captured params, or 404/405. */
  private match(
    method: string,
    pathSegments: string[],
  ): { route: Route; params: Record<string, string> } | null {
    let sawPathMatch = false;
    for (const route of this.routes) {
      if (route.segments.length !== pathSegments.length) continue;
      const params: Record<string, string> = {};
      let matched = true;
      for (let index = 0; index < route.segments.length; index += 1) {
        const pattern = route.segments[index]!;
        const actual = pathSegments[index]!;
        if (pattern.startsWith(":")) {
          if (actual.length === 0) {
            matched = false;
            break;
          }
          params[pattern.slice(1)] = decodeURIComponent(actual);
        } else if (pattern !== actual) {
          matched = false;
          break;
        }
      }
      if (!matched) continue;
      sawPathMatch = true;
      if (route.method === method) return { route, params };
    }
    if (sawPathMatch) throw new HttpError(405, "method_not_allowed");
    return null;
  }

  /** Dispatch; centralizes 404/405/error mapping so no stack ever leaks. */
  async dispatch(ctx: Omit<RouteContext, "params">): Promise<ApiResult> {
    // Routes are registered WITH the leading "api" segment (e.g. "api/health").
    const pathSegments = ctx.url.pathname.split("/").filter(segment => segment.length > 0);
    try {
      const found = this.match(ctx.request.method, pathSegments);
      if (!found) return errorResponse("not_found", 404);
      return await found.route.handler({ ...ctx, params: found.params });
    } catch (error) {
      if (error instanceof HttpError) {
        return errorResponse(error.code, error.status, error.details);
      }
      // Never log or echo raw errors/PII — a code only.
      return errorResponse("internal_error", 500, { reason: "unhandled" });
    }
  }
}

/** Read and parse a JSON request body (max 256 KB). */
export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(400, "bad_request", { field: "content-type" });
  }
  const text = await request.text();
  if (text.length > 256 * 1024) throw new HttpError(400, "bad_request", { reason: "body_too_large" });
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "bad_request", { reason: "invalid_json" });
  }
}
