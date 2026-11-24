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

/* SRV-02 (follow-up remediation 2026-11-24 — WS-254/DOC-044): القارئ أصبح
 * تدفقيًّا — السقف الصارم يُفرَض على البايتات أثناء استهلاك مجرى الطلب نفسه
 * (قبل أن يكتمل أي تجميع في الذاكرة)، والمجرى يُلغى فور تجاوز السقف، ولا
 * يبقى أي مسار يجمّع الجسم كاملًا ثم يفحص حجمه بعد التحميل. الطول المعلن
 * (Content-Length) يبقى تلميحًا للرفض المبكر فقط؛ والعدّ بالبايتات لا بعد
 * المحارف — جسم متعدد البايتات لا يمكن أن يتجاوز السقف البايتي بصمت. */

/** Read the request body as bytes with the hard streaming byte cap.
 *
 * The single canonical bounded body door (SRV-02):
 *  - the DECLARED content-length is refused BEFORE the stream is touched (an
 *    oversized request never starts reading — early-rejection hint only);
 *  - the body stream is consumed chunk-by-chunk with a running BYTE count;
 *    the moment the count would exceed the cap the reader is CANCELLED (the
 *    stream is stopped and closed — no further bytes are pulled or buffered)
 *    and the honest `body_too_large` refusal is thrown;
 *  - a body-less request (GET/HEAD/empty) returns an empty byte array — no
 *    second unbounded clone/read path exists anywhere.
 */
export async function readBodyBytesWithin(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new HttpError(400, "bad_request", { reason: "body_too_large", maxBytes });
  }
  const body = request.body;
  if (body === null) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      /* Cancel the stream as soon as the byte cap would be exceeded — stop
       * pulling, stop buffering; the excess bytes are never read. */
      try {
        await reader.cancel();
      } catch {
        /* cancellation is best-effort; the refusal below is the guarantee. */
      }
      throw new HttpError(400, "bad_request", { reason: "body_too_large", maxBytes });
    }
    chunks.push(value);
  }
  if (chunks.length === 1) return chunks[0];
  const total = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    total.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return total;
}

/** SRV-02: read a request body as text through the ONE streaming byte-capped
 * door (`readBodyBytesWithin`) — the cap is enforced on BYTES while the stream
 * is consumed (Content-Length stays an early-rejection hint; the lying or
 * missing header and chunked streams are capped mid-stream and cancelled).
 * The Manage routes and the idempotency command wrapper share this one
 * helper so no body-reading path can bypass the limit anymore. */
export async function readBodyTextWithin(request: Request, maxBytes: number): Promise<string> {
  const bytes = await readBodyBytesWithin(request, maxBytes);
  /* Same UTF-8 decoding semantics as `request.text()` (non-fatal — invalid
   * sequences become replacement characters, never a throw). */
  return new TextDecoder("utf-8").decode(bytes);
}

/** Read and parse a JSON request body (max 256 KB). */
export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(400, "bad_request", { field: "content-type" });
  }
  /* SRV-02 (follow-up 2026-11-24): the body is read through the ONE
   * streaming byte-capped door — the declared length is refused early, and
   * missing/lying lengths and chunked streams are byte-capped DURING the
   * stream with the reader cancelled at the cap (never buffered whole). */
  const text = await readBodyTextWithin(request, JSON_BODY_MAX_BYTES);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "bad_request", { reason: "invalid_json" });
  }
}
