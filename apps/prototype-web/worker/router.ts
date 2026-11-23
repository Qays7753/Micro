/**
 * API router — method + path matching for `/api/*` routes.
 * Routes are registered as literal path segments (no dynamic segments in v1
 * except simple `{id}` tails handled by their owners).
 */

import { HttpError, errorResponse, type ApiResult } from "./http.ts";

/** Route context: the `DB` binding already resolved into a `Db` (EX-D20). */
export interface RouteContext {
  request: Request;
  url: URL;
  params: Record<string, string>;
  env: import("./db/db.ts").RuntimeEnv<import("./env.ts").Env>;
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

/** The single canonical JSON body cap (SRV-02) — every JSON route reads
 * through `readJsonBody`/`readBodyTextWithin` with this limit; command routes
 * inherit it through the idempotency wrapper unless they register a larger
 * documented cap (the Manage migration envelope). */
export const JSON_BODY_MAX_BYTES = 256 * 1024;

/** SRV-02 (2026-11-23): read a request body as text with BOTH size layers —
 * the DECLARED content-length is refused BEFORE the body is buffered (an
 * oversized request never reaches `text()`), and the post-read cap stays for
 * the lying or missing header case (chunked bodies). The Manage routes and
 * the idempotency command wrapper share this one helper so no body-reading
 * path can bypass the limit anymore. */
export async function readBodyTextWithin(request: Request, maxBytes: number): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new HttpError(400, "bad_request", { reason: "body_too_large", maxBytes });
  }
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(400, "bad_request", { reason: "body_too_large", maxBytes });
  return text;
}

/** Read and parse a JSON request body (max 256 KB). */
export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(400, "bad_request", { field: "content-type" });
  }
  /* SRV-02 (Post-Group 6 — order bd242b3e): the declared length is checked
   * BEFORE the body is read — an oversized request is refused early instead
   * of being buffered first. The post-read cap below stays for the lying or
   * missing header case (chunked bodies). */
  const text = await readBodyTextWithin(request, JSON_BODY_MAX_BYTES);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "bad_request", { reason: "invalid_json" });
  }
}
