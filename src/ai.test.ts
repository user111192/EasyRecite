import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { requestAiReview } from "./ai";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("发送兼容 Chat Completions 的请求并读取结果", async () => {
  let request: RequestInit | undefined;
  globalThis.fetch = async (_input, init) => {
    request = init;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: " 继续加油。 " } }] }),
      { status: 200 },
    );
  };
  const review = await requestAiReview(
    {
      endpoint: "https://example.com/v1/chat/completions",
      apiKey: "key",
      model: "demo",
    },
    {
      genre: "poetry",
      title: "测试",
      original: "你好",
      transcript: "你号",
      score: 50,
      missing: [],
      wrong: [{ expected: "好", actual: "号" }],
      extra: [],
    },
  );
  assert.equal(review, "继续加油。");
  assert.equal(
    (request?.headers as Record<string, string>).Authorization,
    "Bearer key",
  );
  assert.match(String(request?.body), /你号/);
});

test("显示兼容 API 返回的错误信息", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "模型不存在" } }), {
      status: 404,
    });
  await assert.rejects(
    () =>
      requestAiReview(
        { endpoint: "https://example.com/api", apiKey: "", model: "missing" },
        {
          genre: "essay",
          title: "测试",
          original: "你好",
          transcript: "你好",
          score: 100,
          missing: [],
          wrong: [],
          extra: [],
        },
      ),
    /模型不存在/,
  );
});
