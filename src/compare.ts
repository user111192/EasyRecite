export type Diff = {
  type: "correct" | "missing" | "extra" | "wrong";
  expected: string;
  actual: string;
};
// Keep source offsets separately from normalized comparison keys.
function segments(text: string) {
  return [
    ...text.matchAll(/\p{Script=Han}|[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu),
  ].map((match) => ({
    text: match[0],
    key: match[0].normalize("NFKC").toLowerCase(),
    start: match.index!,
    end: match.index! + match[0].length,
  }));
}
export function tokens(text: string) {
  return segments(text).map((segment) => segment.key);
}
export type DisplayDiff = Omit<Diff, "type"> & {
  type: Diff["type"] | "ignored";
};

export function liveDisplayDiff(displayDiff: DisplayDiff[]) {
  let lastProgress = -1;
  for (let index = displayDiff.length - 1; index >= 0; index--) {
    const item = displayDiff[index];
    if (item.type !== "missing" && item.type !== "ignored") {
      lastProgress = index;
      break;
    }
  }
  return lastProgress < 0 ? [] : displayDiff.slice(0, lastProgress + 1);
}

export function visibleDisplayDiff(
  displayDiff: DisplayDiff[],
  showExtra: boolean,
) {
  return showExtra
    ? displayDiff
    : displayDiff.filter((item) => item.type !== "extra");
}

export function compare(expected: string, actual: string) {
  const source = segments(expected),
    spoken = segments(actual);
  const a = source.map((s) => s.key),
    b = spoken.map((s) => s.key);
  if (a.length > 2000 || b.length > 2000)
    throw new Error("每次请控制在 2000 字 / 词以内。");
  const substitutionCost = (sourceIndex: number, spokenIndex: number) =>
    Number(a[sourceIndex] !== b[spokenIndex]);
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
        dp[i - 1][j - 1] + substitutionCost(i - 1, j - 1),
      );
  const diff: Diff[] = [];
  let i = a.length,
    j = b.length;
  while (i || j) {
    if (
      i &&
      j &&
      dp[i][j] === dp[i - 1][j - 1] + substitutionCost(i - 1, j - 1)
    ) {
      diff.push({
        type: substitutionCost(i - 1, j - 1) === 0 ? "correct" : "wrong",
        expected: a[--i],
        actual: b[--j],
      });
    } else if (i && dp[i][j] === dp[i - 1][j] + 1)
      diff.push({ type: "missing", expected: a[--i], actual: "" });
    else diff.push({ type: "extra", expected: "", actual: b[--j] });
  }
  diff.reverse();
  const displayDiff: DisplayDiff[] = [];
  let sourceIndex = 0,
    spokenIndex = 0,
    cursor = 0;
  for (const item of diff) {
    const original = item.type !== "extra" ? source[sourceIndex++] : undefined;
    const said = item.type !== "missing" ? spoken[spokenIndex++] : undefined;
    if (original) {
      if (original.start > cursor)
        displayDiff.push({
          type: "ignored",
          expected: expected.slice(cursor, original.start),
          actual: "",
        });
      cursor = original.end;
    }
    displayDiff.push({
      ...item,
      expected: original?.text ?? "",
      actual: said?.text ?? "",
    });
  }
  if (cursor < expected.length)
    displayDiff.push({
      type: "ignored",
      expected: expected.slice(cursor),
      actual: "",
    });
  return {
    diff,
    displayDiff,
    score: a.length
      ? Math.max(0, Math.round((1 - dp[a.length][b.length] / a.length) * 100))
      : 0,
    total: a.length,
  };
}
