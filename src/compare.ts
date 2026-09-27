export type Diff = {
  type: "correct" | "missing" | "extra" | "wrong";
  expected: string;
  actual: string;
};
export function tokens(text: string) {
  return (
    text
      .normalize("NFKC")
      .toLowerCase()
      .match(/\p{Script=Han}|[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []
  );
}
export function compare(expected: string, actual: string) {
  const a = tokens(expected),
    b = tokens(actual);
  if (a.length > 2000 || b.length > 2000)
    throw new Error("每次请控制在 2000 字 / 词以内。");
  const dp = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
  const diff: Diff[] = [];
  let i = a.length,
    j = b.length;
  while (i || j) {
    if (
      i &&
      j &&
      dp[i][j] === dp[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1])
    ) {
      diff.push({
        type: a[i - 1] === b[j - 1] ? "correct" : "wrong",
        expected: a[--i],
        actual: b[--j],
      });
    } else if (i && dp[i][j] === dp[i - 1][j] + 1)
      diff.push({ type: "missing", expected: a[--i], actual: "" });
    else diff.push({ type: "extra", expected: "", actual: b[--j] });
  }
  return {
    diff: diff.reverse(),
    score: a.length
      ? Math.max(0, Math.round((1 - dp[a.length][b.length] / a.length) * 100))
      : 0,
    total: a.length,
  };
}
