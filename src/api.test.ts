import { assertEquals } from "jsr:@std/assert@1.0.14";
import { listTraces } from "./api.ts";

Deno.test("listTraces constructs request", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = ((
    input: Request | URL | string,
    init?: RequestInit,
  ) => {
    calls.push({
      url: typeof input === "string" ? input : input.toString(),
      init,
    });
    const body = JSON.stringify({ items: [], offset: 5, limit: 10, total: 0 });
    return Promise.resolve(new Response(body, { status: 200 }));
  }) as typeof fetch;

  let tempHome: string | undefined;
  try {
    tempHome = await Deno.makeTempDir();
    Deno.env.set("EVAL_API_URL", "http://api.test");
    Deno.env.set("EVAL_API_KEY", "test-key");
    Deno.env.set("EVAL_WORKSPACE_ID", "ws-123");
    Deno.env.set("HOME", tempHome);
    await listTraces(5, 10, "asc");
  } finally {
    globalThis.fetch = origFetch;
    Deno.env.delete("EVAL_API_URL");
    Deno.env.delete("EVAL_API_KEY");
    Deno.env.delete("EVAL_WORKSPACE_ID");
    Deno.env.delete("HOME");
    if (tempHome) {
      await Deno.remove(tempHome, { recursive: true }).catch(() => {});
    }
  }

  assertEquals(calls.length, 1);
  assertEquals(
    calls[0].url,
    "http://api.test/traces/list?offset=5&limit=10&only_completed=true&order=asc",
  );
  const headers = new Headers(calls[0].init?.headers);
  assertEquals(headers.get("Authorization"), "Bearer test-key");
  assertEquals(headers.get("X-Workspace-Id"), "ws-123");
});
