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
    genre: "poetry" | "essay";
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
            "你是一位犀利但善意的背诵教练。请使用原文的主要语言回复，并只依据原文、语音转写和机器比对结果判断，不要声称听过音频，也不要虚构发音问题。先给一句直接、有趣的总评。然后审查每一处漏背、错背和多背，标注严重性为【严重】【中等】【轻微】或【忽略】，可把相邻且原因相同的错误合并说明。文体为 poetry 时要求一字不差：漏字、换字和颠倒原则上都算有效错误；只有明显的口头停顿、无意义语气词、即时自我纠正或机械重复才能标为忽略。文体为 essay 时允许不改变事实、情节、逻辑和表达重点的轻微措辞差异；人物、时间、地点、数字、动作、因果以及环境、动作、心理、语言、神态等细节描写出错时提高严重性。对明显口误、即时自我纠正和无意义重复标为忽略，不要拿它们凑错误数。最后给出一条具体复习建议。",
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
