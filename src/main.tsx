import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  Mic,
  ArrowUpRight,
  ChevronRight,
  Plus,
  Pencil,
  Check,
  Eye,
  EyeOff,
  RotateCcw,
  Square,
  Headphones,
  Sparkles,
  FileText,
  X,
  Trash2,
  Languages,
  Info,
  Settings,
} from "lucide-react";
import {
  compare,
  liveDisplayDiff,
  tokens,
  visibleDisplayDiff,
} from "./compare";
import { AiSettings, requestAiReview } from "./ai";
import { useRecorder } from "./useRecorder";
import "./style.css";
type Genre = "poetry" | "essay";
type Passage = {
  id: string;
  title: string;
  text: string;
  tag: string;
  genre: Genre;
};
const genreLabel: Record<Genre, string> = { poetry: "诗歌", essay: "作文" };
const defaults: Passage[] = [
  {
    id: "1",
    title: "春江花月夜",
    tag: "古诗词",
    genre: "poetry",
    text: "春江潮水连海平，海上明月共潮生。\n滟滟随波千万里，何处春江无月明！\n江流宛转绕芳甸，月照花林皆似霰。\n空里流霜不觉飞，汀上白沙看不见。",
  },
  {
    id: "2",
    title: "静夜思",
    tag: "古诗词",
    genre: "poetry",
    text: "床前明月光，疑是地上霜。\n举头望明月，低头思故乡。",
  },
  {
    id: "3",
    title: "The Road Not Taken",
    tag: "English",
    genre: "poetry",
    text: "Two roads diverged in a yellow wood,\nAnd sorry I could not travel both\nAnd be one traveler, long I stood\nAnd looked down one as far as I could\nTo where it bent in the undergrowth;",
  },
];
function App() {
  const [passages, setPassages] = useState<Passage[]>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("easyrecite-passages") || "null",
      );
      return Array.isArray(saved) &&
        saved.length &&
        saved.every(
          (p) =>
            typeof p.id === "string" &&
            typeof p.title === "string" &&
            typeof p.text === "string" &&
            typeof p.tag === "string",
        )
        ? saved.map((p) => ({
            ...p,
            genre:
              p.genre === "poetry" || p.genre === "essay"
                ? p.genre
                : p.tag === "古诗词" || p.tag === "English"
                  ? "poetry"
                  : "essay",
          }))
        : defaults;
    } catch {
      return defaults;
    }
  });
  const [selected, setSelected] = useState(passages[0].id),
    [language, setLanguage] = useState("auto"),
    [hidden, setHidden] = useState(false),
    [transcript, setTranscript] = useState(""),
    [result, setResult] = useState<ReturnType<typeof compare> | null>(null),
    [modal, setModal] = useState(false),
    [editingId, setEditingId] = useState<string | null>(null),
    [title, setTitle] = useState(""),
    [draft, setDraft] = useState(""),
    [draftGenre, setDraftGenre] = useState<Genre>("poetry"),
    [notice, setNotice] = useState(""),
    [manual, setManual] = useState(false),
    [aiModal, setAiModal] = useState(false),
    [aiReview, setAiReview] = useState(""),
    [aiError, setAiError] = useState(""),
    [aiLoading, setAiLoading] = useState(false),
    [tab, setTab] = useState<"practice" | "library">("practice");
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("easyrecite-ai-settings") || "{}",
      );
      return {
        endpoint:
          typeof saved.endpoint === "string"
            ? saved.endpoint
            : "https://api.openai.com/v1/chat/completions",
        model: typeof saved.model === "string" ? saved.model : "gpt-4.1-mini",
        apiKey: sessionStorage.getItem("easyrecite-ai-key") || "",
      };
    } catch {
      return {
        endpoint: "https://api.openai.com/v1/chat/completions",
        model: "gpt-4.1-mini",
        apiKey: "",
      };
    }
  });
  const [aiDraft, setAiDraft] = useState<AiSettings>(aiSettings);
  const [liveDiff, setLiveDiff] = useState(() => {
    try {
      return localStorage.getItem("easyrecite-live-diff") === "true";
    } catch {
      return false;
    }
  });
  const [showExtra, setShowExtra] = useState(() => {
    try {
      return localStorage.getItem("easyrecite-show-extra") !== "false";
    } catch {
      return true;
    }
  });
  const passage = passages.find((p) => p.id === selected) || passages[0];
  const detected = /\p{Script=Han}/u.test(passage.text) ? "zh-CN" : "en-US";
  const lang = language === "auto" ? detected : language;
  function check(text: string) {
    if (!text.trim()) {
      setResult(null);
      return;
    }
    try {
      setResult(compare(passage.text, text));
      setAiReview("");
      setAiError("");
      setNotice("");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  const recording = useRecorder(setTranscript, check);
  const busy = recording.status !== "idle";
  useEffect(() => {
    try {
      localStorage.setItem("easyrecite-passages", JSON.stringify(passages));
    } catch {
      setNotice("浏览器存储不可用，文本仅保留在本次页面中。");
    }
  }, [passages]);
  function select(id: string) {
    if (busy) return;
    setSelected(id);
    setTranscript("");
    setResult(null);
    setAiReview("");
    setAiError("");
    setHidden(false);
    setTab("practice");
  }
  function openEditor(existing?: Passage) {
    if (busy) return;
    setEditingId(existing?.id ?? null);
    setTitle(existing?.title ?? "");
    setDraft(existing?.text ?? "");
    setDraftGenre(existing?.genre ?? "poetry");
    setNotice("");
    setModal(true);
  }
  function save() {
    if (busy) return;
    if (!title.trim() || !tokens(draft).length) {
      setNotice("请填写标题和有效的背诵文本。");
      return;
    }
    if (tokens(draft).length > 2000) {
      setNotice("文本请控制在 2000 字 / 词以内。");
      return;
    }
    const p = {
      id: editingId ?? crypto.randomUUID(),
      title: title.trim(),
      text: draft,
      tag: genreLabel[draftGenre],
      genre: draftGenre,
    };
    setPassages((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? p : item))
        : [...current, p],
    );
    select(p.id);
    setModal(false);
    setTitle("");
    setDraft("");
    setNotice("");
  }
  const liveComparison = useMemo(() => {
    if (!liveDiff || !(transcript + recording.interim).trim())
      return { result: null, error: "" };
    try {
      return {
        result: compare(
          passage.text,
          [transcript, recording.interim].filter(Boolean).join(" "),
        ),
        error: "",
      };
    } catch (error) {
      return { result: null, error: (error as Error).message };
    }
  }, [liveDiff, transcript, recording.interim, passage.text]);
  const visibleResult = busy
    ? liveDiff
      ? liveComparison.result
      : null
    : liveDiff
      ? liveComparison.result
      : result;
  const isLivePreview = Boolean(liveDiff && liveComparison.result && !result);
  const fullVisibleDiff = visibleResult
    ? isLivePreview
      ? liveDisplayDiff(visibleResult.displayDiff)
      : visibleResult.displayDiff
    : [];
  const visibleDiff = visibleDisplayDiff(fullVisibleDiff, showExtra);
  const errors = isLivePreview
    ? fullVisibleDiff.filter(
        (d) => d.type !== "correct" && d.type !== "ignored",
      )
    : visibleResult?.diff.filter((d) => d.type !== "correct") || [];

  function saveAiSettings() {
    try {
      localStorage.setItem(
        "easyrecite-ai-settings",
        JSON.stringify({
          endpoint: aiDraft.endpoint.trim(),
          model: aiDraft.model.trim(),
        }),
      );
      sessionStorage.setItem("easyrecite-ai-key", aiDraft.apiKey);
      setAiSettings({
        ...aiDraft,
        endpoint: aiDraft.endpoint.trim(),
        model: aiDraft.model.trim(),
      });
      setAiModal(false);
      setAiError("");
    } catch {
      setAiError("浏览器无法保存 API 配置，但本次页面仍可继续使用。");
    }
  }

  function openAiSettings() {
    setAiDraft(aiSettings);
    setAiModal(true);
  }

  async function generateAiReview() {
    if (!result || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    setAiReview("");
    try {
      const review = await requestAiReview(aiSettings, {
        genre: passage.genre,
        title: passage.title,
        original: passage.text,
        transcript,
        score: result.score,
        missing: result.diff
          .filter((item) => item.type === "missing")
          .map((item) => item.expected),
        wrong: result.diff
          .filter((item) => item.type === "wrong")
          .map((item) => ({ expected: item.expected, actual: item.actual })),
        extra: result.diff
          .filter((item) => item.type === "extra")
          .map((item) => item.actual),
      });
      setAiReview(review);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 请求失败。";
      setAiError(
        message === "Failed to fetch"
          ? "无法连接 API。请检查地址、网络和服务端 CORS 设置。"
          : message,
      );
    } finally {
      setAiLoading(false);
    }
  }
  return (
    <div className="app">
      <aside>
        <a className="brand" href="./">
          <span className="logo">
            <BookOpen size={23} />
          </span>
          EasyRecite<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">我的学习空间</div>
        <nav>
          <button
            className={tab === "practice" ? "nav active" : "nav"}
            onClick={() => setTab("practice")}
          >
            <Mic size={18} />
            背诵练习
            <ChevronRight size={16} />
          </button>
          <button
            className={tab === "library" ? "nav active" : "nav"}
            onClick={() => setTab("library")}
          >
            <BookOpen size={18} />
            我的文本库<span className="count">{passages.length}</span>
          </button>
        </nav>
        <div className="side-heading">
          我的文本{" "}
          <button
            aria-label="添加文本"
            onClick={() => openEditor()}
            disabled={busy}
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="passage-list">
          {passages.map((p) => (
            <button
              key={p.id}
              disabled={busy}
              onClick={() => select(p.id)}
              className={
                passage.id === p.id ? "passage-link selected" : "passage-link"
              }
            >
              <FileText size={16} />
              <span>{p.title}</span>
              {passage.id === p.id && <span className="tiny-dot" />}
            </button>
          ))}
        </div>
        <div className="side-note">
          <span>一点一滴，记忆更清晰。</span>
          <p>每一次开口，都是一次进步。</p>
          <div className="mini-wave">▂ ▅ ▃ ▇ ▄ ▂ ▅ ▃ ▆ ▂</div>
        </div>
        <div className="profile">
          <span className="avatar">E</span>
          <div>
            我的专注时光<small>保持好奇，坚持练习</small>
          </div>
          <span className="online" />
        </div>
      </aside>
      <div className="main-shell">
        <header>
          <div>
            学习空间 <ChevronRight size={13} />{" "}
            <strong>{tab === "practice" ? "背诵练习" : "我的文本库"}</strong>
          </div>
          <div className="header-actions">
            <span className="local-badge">
              <span /> 文本保存在本地
            </span>
            <button className="settings-button" onClick={openAiSettings}>
              <Settings size={15} /> AI 设置
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div className="eyebrow">SPEAK. REMEMBER. GROW.</div>
            <div className="heading-row">
              <div>
                <h1>
                  {tab === "practice"
                    ? "让记忆，有回响。"
                    : "每一段文字，都值得记住。"}
                </h1>
                <p>从一段文字开始，用自己的声音，把知识留在心里。</p>
              </div>
              <button
                className="primary"
                onClick={() => openEditor()}
                disabled={busy}
              >
                <Plus size={17} />
                新建文本
              </button>
            </div>
          </div>
          {tab === "library" ? (
            <div className="library">
              {passages.map((p) => (
                <article className="card library-card" key={p.id}>
                  <span className="tag">{genreLabel[p.genre]}</span>
                  <h2>{p.title}</h2>
                  <p>{p.text}</p>
                  <div>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => select(p.id)}
                    >
                      开始练习
                      <ArrowUpRight size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`编辑${p.title}`}
                      disabled={busy}
                      onClick={() => openEditor(p)}
                    >
                      <Pencil size={16} />
                      编辑
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`删除${p.title}`}
                      disabled={busy || passages.length === 1}
                      onClick={() => {
                        setPassages(passages.filter((x) => x.id !== p.id));
                        if (selected === p.id)
                          select(passages.find((x) => x.id !== p.id)!.id);
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <>
              <div className="steps">
                <span className="step">
                  <b>1</b> 选择文本
                </span>
                <div />
                <span className="step">
                  <b>2</b> 开始背诵
                </span>
                <div />
                <span className="step">
                  <b>3</b> 查看反馈
                </span>
              </div>
              <div className="practice-grid">
                <section className="card text-card">
                  <div className="card-header">
                    <h2>
                      <FileText size={18} />
                      背诵文本
                    </h2>
                    <span className="tag">{genreLabel[passage.genre]}</span>
                  </div>
                  <div className="text-toolbar">
                    <span>{tokens(passage.text).length} 字 / 词</span>
                    <button disabled={busy} onClick={() => openEditor(passage)}>
                      <Pencil size={15} />
                      编辑文本
                    </button>
                    <button onClick={() => setHidden(!hidden)}>
                      {hidden ? <Eye size={15} /> : <EyeOff size={15} />}{" "}
                      {hidden ? "显示原文" : "隐藏原文"}
                    </button>
                  </div>
                  <div className={"reading " + (hidden ? "concealed" : "")}>
                    <div className="poem-accent" />
                    <h3>{hidden ? "专注回忆，慢慢来" : passage.title}</h3>
                    {hidden ? (
                      <p>
                        原文已隐藏
                        <br />
                        让记忆成为你的提示。
                      </p>
                    ) : (
                      <p>{passage.text}</p>
                    )}
                  </div>
                  <div className="text-footer">
                    <Sparkles size={15} />
                    <span>先读一遍，再试着隐藏原文背诵。</span>
                  </div>
                </section>
                <section className="card recording-card">
                  <div className="card-header">
                    <h2>
                      <Mic size={18} />
                      开始背诵
                    </h2>
                    <span className={"status " + (busy ? "live" : "")}>
                      <i />
                      {busy ? "录音进行中" : "准备就绪"}
                    </span>
                  </div>
                  <div className="language">
                    <Languages size={17} />
                    <label htmlFor="language">识别语言</label>
                    <select
                      id="language"
                      value={language}
                      disabled={busy}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <option value="auto">
                        自动检测 · {detected === "zh-CN" ? "中文" : "English"}
                      </option>
                      <option value="zh-CN">中文（普通话）</option>
                      <option value="en-US">English (US)</option>
                    </select>
                  </div>
                  <div className={"mic-area " + (busy ? "is-recording" : "")}>
                    <div className="mic-orbit">
                      <div className="mic-icon">
                        <Mic size={36} strokeWidth={1.6} />
                      </div>
                    </div>
                    <h3>{busy ? "正在倾听你的声音…" : "准备好了，就开口吧"}</h3>
                    <p>
                      {busy
                        ? "清晰、自然地背诵，完成后点击结束"
                        : "点击下方按钮，开始你的背诵练习"}
                    </p>
                    <div className="wave" aria-hidden="true">
                      {Array.from({ length: 31 }, (_, i) => (
                        <i
                          key={i}
                          style={{
                            height: 8 + ((i * 7) % 19),
                            animationDelay: `${i * 0.07}s`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="timer">
                      {String(Math.floor(recording.seconds / 60)).padStart(
                        2,
                        "0",
                      )}
                      <span>:</span>
                      {String(recording.seconds % 60).padStart(2, "0")}
                    </div>
                  </div>
                  <button
                    className={"record-button " + (busy ? "stop" : "")}
                    disabled={
                      recording.status === "starting" ||
                      recording.status === "stopping"
                    }
                    onClick={() => {
                      if (busy) recording.stop();
                      else {
                        setResult(null);
                        recording.start(lang);
                      }
                    }}
                  >
                    {busy ? <Square size={16} /> : <Mic size={18} />}{" "}
                    {recording.status === "starting"
                      ? "正在请求麦克风…"
                      : recording.status === "stopping"
                        ? "正在整理识别结果…"
                        : busy
                          ? "结束背诵并检查"
                          : "开始背诵"}
                  </button>
                  <p className="permission-note">
                    首次使用需要允许浏览器访问麦克风
                  </p>
                </section>
              </div>
              {(recording.error || notice) && (
                <div className="alert" role="alert">
                  <Info size={17} />
                  {recording.error || notice}
                </div>
              )}
              <section className="card feedback">
                <div className="card-header">
                  <h2>
                    <Check size={18} />
                    背诵反馈
                  </h2>
                  <button className="subtle" onClick={() => setManual(!manual)}>
                    {manual ? "收起输入" : "手动输入检查"}
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div className="feedback-settings">
                  <label className="live-toggle">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={liveDiff}
                      onChange={(e) => {
                        setLiveDiff(e.target.checked);
                        try {
                          localStorage.setItem(
                            "easyrecite-live-diff",
                            String(e.target.checked),
                          );
                        } catch {
                          /* The setting still works for this visit. */
                        }
                      }}
                    />
                    实时显示差异
                  </label>
                  <label className="live-toggle extra-toggle">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={showExtra}
                      onChange={(event) => {
                        setShowExtra(event.target.checked);
                        try {
                          localStorage.setItem(
                            "easyrecite-show-extra",
                            String(event.target.checked),
                          );
                        } catch {
                          /* The setting still works for this visit. */
                        }
                      }}
                    />
                    显示多背内容
                  </label>
                  <p>
                    {liveDiff
                      ? "随识别或输入更新；只展示到当前最后一个已背字词，录音中的结果仅供参考。"
                      : "录音结束后自动显示差异，手动输入时点击「检查背诵」。"}
                  </p>
                  {liveDiff && liveComparison.error && (
                    <p role="alert">{liveComparison.error}</p>
                  )}
                </div>
                {(busy || transcript) && (
                  <div className="transcript">
                    <span className="eyebrow">识别内容</span>
                    <p>
                      {transcript}
                      <em>{recording.interim}</em>
                      {!transcript && !recording.interim && "正在等待你的声音…"}
                    </p>
                  </div>
                )}
                {manual && (
                  <div className="manual">
                    <label htmlFor="transcript">输入或修正识别内容</label>
                    <textarea
                      id="transcript"
                      value={transcript}
                      maxLength={14000}
                      disabled={busy}
                      onChange={(e) => {
                        setTranscript(e.target.value);
                        setResult(null);
                      }}
                      placeholder="在这里输入你背诵的内容…"
                    />
                    <button
                      className="primary"
                      disabled={busy || !transcript.trim()}
                      onClick={() => check(transcript)}
                    >
                      检查背诵
                      <Check size={16} />
                    </button>
                  </div>
                )}
                {visibleResult ? (
                  <div className="result">
                    <div className="score">
                      <strong>
                        {isLivePreview ? "—" : visibleResult.score}
                        {!isLivePreview && <small>%</small>}
                      </strong>
                      <div>
                        <h3>
                          {isLivePreview
                            ? "实时对照 · 等待背诵完成"
                            : visibleResult.score === 100
                              ? "太棒了，背诵完全正确！"
                              : "每次练习，都更进一步"}
                        </h3>
                        <p>
                          准确率 · 漏背{" "}
                          {errors.filter((d) => d.type === "missing").length} ·
                          错背 {errors.filter((d) => d.type === "wrong").length}{" "}
                          · 多背{" "}
                          {errors.filter((d) => d.type === "extra").length}
                        </p>
                      </div>
                      <button
                        aria-label="清除检查结果"
                        className="icon-button"
                        disabled={busy}
                        onClick={() => {
                          setResult(null);
                          setTranscript("");
                        }}
                      >
                        <RotateCcw size={18} />
                      </button>
                    </div>
                    <div className="diff">
                      {visibleDiff.map((d, i) => (
                        <span
                          key={i}
                          className={d.type}
                          title={
                            d.type === "wrong"
                              ? `应背：${d.expected}；实际：${d.actual}`
                              : d.type === "missing"
                                ? "漏背"
                                : d.type === "extra"
                                  ? "多背"
                                  : d.type === "ignored"
                                    ? "仅展示，不参与比较"
                                    : "正确"
                          }
                        >
                          {d.type === "wrong" ? (
                            <>
                              <s>{d.actual}</s>
                              <b>{d.expected}</b>
                            </>
                          ) : (
                            d.expected || d.actual
                          )}
                        </span>
                      ))}
                    </div>
                    <div className="legend">
                      <span>绿色：正确</span>
                      <span>橙色：漏背</span>
                      <span>红色：错背（划线为实际内容）</span>
                      {showExtra && <span>紫色：多背</span>}
                    </div>
                    <p className="result-note">
                      保留原文标点、空格和换行，但不参与比较；忽略英文大小写，中文按字、英文按词比较。识别结果可能有误，可手动修正后重新检查。
                    </p>
                    {!isLivePreview && result && (
                      <div className="ai-review">
                        <div className="ai-review-heading">
                          <div>
                            <h3>
                              <Sparkles size={17} /> AI 锐评
                            </h3>
                            <p>
                              按{genreLabel[passage.genre]}
                              标准分析每处错误、判断更像识别错误还是真实记错，并把原文、转写和比对结果发送到你配置的
                              API。
                            </p>
                          </div>
                          <button
                            className="primary"
                            disabled={aiLoading}
                            onClick={generateAiReview}
                          >
                            <Sparkles size={15} />
                            {aiLoading
                              ? "正在锐评…"
                              : aiReview
                                ? "重新锐评"
                                : "让 AI 锐评一下"}
                          </button>
                        </div>
                        {aiError && (
                          <p className="ai-error" role="alert">
                            {aiError}{" "}
                            <button onClick={openAiSettings}>检查设置</button>
                          </p>
                        )}
                        {aiReview && (
                          <div className="ai-review-content">{aiReview}</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  !busy &&
                  !manual && (
                    <div className="empty-feedback">
                      <div className="empty-icon">
                        <Headphones size={25} />
                      </div>
                      <div>
                        <h3>你的进步，值得被听见</h3>
                        <p>完成一次背诵后，这里会显示准确率和逐字纠错。</p>
                      </div>
                      <span className="empty-dots">···</span>
                    </div>
                  )
                )}
                {recording.audio && (
                  <div className="audio">
                    <span>
                      <Headphones size={16} /> 最近一次录音
                    </span>
                    <audio controls src={recording.audio} />
                  </div>
                )}
              </section>
              <div className="bottom-note">
                <Info size={15} />
                <span>
                  建议使用 Chrome 或
                  Edge。语音识别可能需要联网，音频可能由浏览器发送至其语音服务；本应用不上传或保存录音到服务器。
                </span>
              </div>
            </>
          )}
          <footer>
            <span>EasyRecite · 把文字，变成自己的知识。</span>
            <span>
              一步一步，记得更牢 <span className="footer-spark">✧</span>
            </span>
          </footer>
        </main>
      </div>
      {modal && (
        <div className="overlay" onClick={() => setModal(false)}>
          <section
            className="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setModal(false);
            }}
          >
            <div className="card-header">
              <h2 id="modal-title">
                {editingId ? "编辑背诵文本" : "新建背诵文本"}
              </h2>
              <button
                className="icon-button"
                aria-label="关闭"
                onClick={() => setModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <label>
              标题
              <input
                autoFocus
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="给这段文字起个名字"
              />
            </label>
            <label>
              文体
              <select
                value={draftGenre}
                onChange={(event) => setDraftGenre(event.target.value as Genre)}
              >
                <option value="poetry">诗歌</option>
                <option value="essay">作文</option>
              </select>
            </label>
            <label>
              背诵内容
              <textarea
                value={draft}
                maxLength={14000}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="粘贴中文或英文文本，最多 2000 字 / 词…"
              />
            </label>
            <p>{tokens(draft).length} / 2000 字 / 词 · 仅保存在当前浏览器</p>
            {notice && (
              <p role="alert" className="form-error">
                {notice}
              </p>
            )}
            <button className="primary" onClick={save}>
              {editingId ? "保存修改" : "保存并开始练习"}
              <ArrowUpRight size={16} />
            </button>
          </section>
        </div>
      )}
      {aiModal && (
        <div className="overlay" onClick={() => setAiModal(false)}>
          <section
            className="modal card ai-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="card-header">
              <h2 id="ai-modal-title">
                <Settings size={18} /> AI API 设置
              </h2>
              <button
                className="icon-button"
                aria-label="关闭 AI 设置"
                onClick={() => setAiModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <label>
              Chat Completions API 地址
              <input
                autoFocus
                type="url"
                value={aiDraft.endpoint}
                onChange={(event) =>
                  setAiDraft((current) => ({
                    ...current,
                    endpoint: event.target.value,
                  }))
                }
                placeholder="https://example.com/v1/chat/completions"
              />
            </label>
            <label>
              模型名称
              <input
                value={aiDraft.model}
                onChange={(event) =>
                  setAiDraft((current) => ({
                    ...current,
                    model: event.target.value,
                  }))
                }
                placeholder="模型 ID"
              />
            </label>
            <label>
              API Key（可留空）
              <input
                type="password"
                autoComplete="off"
                value={aiDraft.apiKey}
                onChange={(event) =>
                  setAiDraft((current) => ({
                    ...current,
                    apiKey: event.target.value,
                  }))
                }
                placeholder="sk-…"
              />
            </label>
            <div className="api-privacy-note">
              <Info size={16} />
              <span>
                API Key
                仅保存在当前标签页；地址和模型保存在本地。生成锐评时，原文、识别内容和错误结果会直接发送到该
                API。服务端必须允许浏览器跨域请求。
              </span>
            </div>
            {aiError && (
              <p className="form-error" role="alert">
                {aiError}
              </p>
            )}
            <button
              className="primary"
              disabled={!aiDraft.endpoint.trim() || !aiDraft.model.trim()}
              onClick={saveAiSettings}
            >
              保存 AI 设置
              <Check size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
