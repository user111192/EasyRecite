export type AiSettings = {
  endpoint: string;
  apiKey: string;
  model: string;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export async function requestAiReview(
  settings: AiSettings,
  input: {
    title: string;
    original: string;
    transcript: string;
    score: number;
    missing: string[];
    wrong: Array<{ expected: string; actual: string }>;
    extra: string[];
  },
  signal?: AbortSignal,
) {
  const endpoint = settings.endpoint.trim();
  const model = settings.model.trim();
  if (!endpoint || !model) throw new Error("请先填写 API 地址和模型名称。");

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("API 地址格式不正确，请填写完整的 http(s) 地址。");
  }
  if (!/^https?:$/.test(parsed.protocol))
    throw new Error("API 地址只支持 http 或 https。");

  const response = await fetch(parsed.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.apiKey.trim()
        ? { Authorization: `Bearer ${settings.apiKey.trim()}` }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "你是一位犀利但善意的背诵教练。请使用用户所背文本的主要语言回复。先给一句有趣、直接的锐评，再指出最值得修正的具体问题，最后给出一条可执行的复习建议。不要虚构发音问题，不要声称听过音频；只根据原文、转写与文字比对结果判断。控制在 250 字以内。",
        },
        {
          role: "user",
          content: JSON.stringify(input, null, 2),
        },
      ],
      temperature: 0.7,
    }),
    signal,
  });

  const text = await response.text();
  let data: ChatCompletionResponse;
  try {
    data = JSON.parse(text) as ChatCompletionResponse;
  } catch {
    throw new Error(
      response.ok
        ? "API 返回的不是有效 JSON。"
        : `API 请求失败（${response.status}）。`,
    );
  }
  if (!response.ok)
    throw new Error(
      data.error?.message || `API 请求失败（${response.status}）。`,
    );
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("API 没有返回可显示的评价内容。");
  return content;
}
