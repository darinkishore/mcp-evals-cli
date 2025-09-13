import { assertEquals } from "@std/assert";
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

  try {
    Deno.env.set("EVAL_API_URL", "http://api.test");
    await listTraces(5, 10, "asc");
  } finally {
    globalThis.fetch = origFetch;
    Deno.env.delete("EVAL_API_URL");
  }

  assertEquals(calls.length, 1);
  assertEquals(
    calls[0].url,
    "http://api.test/traces/list?offset=5&limit=10&only_completed=true&order=asc",
  );
});
