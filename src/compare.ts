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
  const edits = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  const matches = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  const distance = Array.from(
    { length: a.length + 1 },
    () => new Uint32Array(b.length + 1),
  );
  // 0: diagonal, 1: missing source token, 2: extra spoken token.
  const move = Array.from(
    { length: a.length + 1 },
    () => new Uint8Array(b.length + 1),
  );
  for (let i = 1; i <= a.length; i++) {
    edits[i][0] = i;
    move[i][0] = 1;
  }
  for (let j = 1; j <= b.length; j++) {
    edits[0][j] = j;
    move[0][j] = 2;
  }
  const isBetter = (
    candidateEdits: number,
    candidateMatches: number,
    candidateDistance: number,
    bestEdits: number,
    bestMatches: number,
    bestDistance: number,
  ) =>
    candidateEdits < bestEdits ||
    (candidateEdits === bestEdits &&
      (candidateMatches > bestMatches ||
        (candidateMatches === bestMatches &&
          candidateDistance < bestDistance)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const equal = substitutionCost(i - 1, j - 1) === 0;
      let bestEdits = edits[i - 1][j - 1] + Number(!equal);
      let bestMatches = matches[i - 1][j - 1] + Number(equal);
      let bestDistance =
        distance[i - 1][j - 1] + (equal ? Math.abs(i - j) : 0);
      let bestMove = 0;

      const missingEdits = edits[i - 1][j] + 1;
      if (
        isBetter(
          missingEdits,
          matches[i - 1][j],
          distance[i - 1][j],
          bestEdits,
          bestMatches,
          bestDistance,
        )
      ) {
        bestEdits = missingEdits;
        bestMatches = matches[i - 1][j];
        bestDistance = distance[i - 1][j];
        bestMove = 1;
      }

      const extraEdits = edits[i][j - 1] + 1;
      if (
        isBetter(
          extraEdits,
          matches[i][j - 1],
          distance[i][j - 1],
          bestEdits,
          bestMatches,
          bestDistance,
        )
      ) {
        bestEdits = extraEdits;
        bestMatches = matches[i][j - 1];
        bestDistance = distance[i][j - 1];
        bestMove = 2;
      }

      edits[i][j] = bestEdits;
      matches[i][j] = bestMatches;
      distance[i][j] = bestDistance;
      move[i][j] = bestMove;
    }
  }
  const diff: Diff[] = [];
  let i = a.length,
    j = b.length;
  while (i || j) {
    if (i && j && move[i][j] === 0) {
      diff.push({
        type: substitutionCost(i - 1, j - 1) === 0 ? "correct" : "wrong",
        expected: a[--i],
        actual: b[--j],
      });
    } else if (i && move[i][j] === 1)
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
      ? Math.max(
          0,
          Math.round((1 - edits[a.length][b.length] / a.length) * 100),
        )
      : 0,
    total: a.length,
  };
}
