import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compare,
  liveDisplayDiff,
  tokens,
  visibleDisplayDiff,
} from "./compare";
test("忽略中文标点、英文大小写", () => {
  assert.equal(compare("你好，世界！ Hello.", "你好世界 hello").score, 100);
});
test("漏背与多背不会使后续内容错位", () => {
  assert.deepEqual(
    compare("春眠不觉晓", "春眠觉晓").diff.map((d) => d.type),
    ["correct", "correct", "missing", "correct", "correct"],
  );
  assert.equal(
    compare("hello world", "hello beautiful world").diff[1].type,
    "extra",
  );
});
test("替换、空结果与重复词", () => {
  assert.equal(compare("床前明月光", "床前明月亮").diff.at(-1)?.type, "wrong");
  assert.equal(compare("hello", "").score, 0);
  assert.equal(
    compare("a a b", "a b").diff.filter((d) => d.type === "missing").length,
    1,
  );
});
test("中英混合按字和词切分；限制输入规模", () => {
  assert.deepEqual(tokens("你好 React 19"), ["你", "好", "react", "19"]);
  assert.throws(() => compare("你".repeat(2001), ""));
});

test("结果保留原文标点、空白、换行和大小写而不影响评分", () => {
  const original = " 你好，世界！\nHello,  WORLD.\t";
  const result = compare(original, "你好世界 hello world");
  assert.equal(result.score, 100);
  assert.equal(result.displayDiff.map((d) => d.expected).join(""), original);
  assert.ok(
    result.displayDiff.some(
      (d) => d.type === "ignored" && d.expected.includes("\n"),
    ),
  );
  assert.equal(result.diff.filter((d) => d.type !== "correct").length, 0);
});
test("错误对齐后仍完整保留原文，实际词保留大小写", () => {
  const original = "Hello, world!\n再见。";
  const result = compare(original, "Hello Beautiful earth 再");
  assert.equal(result.displayDiff.map((d) => d.expected).join(""), original);
  assert.ok(result.displayDiff.some((d) => d.actual === "Beautiful"));
  assert.equal(compare("，\n！", "").displayDiff[0].expected, "，\n！");
});

test("实时结果截止到最后一个非漏背字符", () => {
  const result = compare("你好，世界！\n明天见。", "你好世");
  const visible = liveDisplayDiff(result.displayDiff);
  assert.equal(visible.map((d) => d.expected).join(""), "你好，世");
  assert.equal(visible.at(-1)?.type, "correct");
  assert.deepEqual(liveDisplayDiff(compare("你好", "").displayDiff), []);
});

test("可以隐藏多背内容但不改变原始比对结果", () => {
  const result = compare("你好", "你真的好");
  assert.ok(result.displayDiff.some((item) => item.type === "extra"));
  assert.equal(
    visibleDisplayDiff(result.displayDiff, false).some(
      (item) => item.type === "extra",
    ),
    false,
  );
  assert.ok(result.diff.some((item) => item.type === "extra"));
});
