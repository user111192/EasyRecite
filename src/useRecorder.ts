import { useEffect, useRef, useState } from "react";
type RecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
export function useRecorder(
  onTranscript: (text: string) => void,
  onComplete: (text: string) => void,
) {
  const [status, setStatus] = useState<
    "idle" | "starting" | "recording" | "stopping"
  >("idle");
  const [error, setError] = useState(""),
    [audio, setAudio] = useState(""),
    [seconds, setSeconds] = useState(0),
    [interim, setInterim] = useState("");
  const active = useRef(false),
    stream = useRef<MediaStream | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    recognition = useRef<Recognition | null>(null),
    url = useRef(""),
    full = useRef(""),
    complete = useRef(onComplete),
    change = useRef(onTranscript),
    mounted = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  complete.current = onComplete;
  change.current = onTranscript;
  function finish() {
    if (timer.current) clearTimeout(timer.current);
    if (!active.current) return;
    active.current = false;
    if (recognition.current) {
      recognition.current.onend = null;
      recognition.current.onresult = null;
      recognition.current.onerror = null;
      recognition.current.abort();
    }
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    if (mounted.current) {
      setStatus("idle");
      setInterim("");
      complete.current(full.current);
    }
  }
  function stop() {
    setStatus("stopping");
    recognition.current?.stop();
    timer.current = setTimeout(finish, 1500);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current = false;
      if (timer.current) clearTimeout(timer.current);
      recognition.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, []);
  useEffect(() => {
    if (status !== "recording") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);
  async function start(lang: string) {
    setError("");
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const Constructor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      setError(
        "当前浏览器不支持语音识别，请尝试 Chrome / Edge，或在下方手动输入背诵内容。",
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("录音需要支持的浏览器和 HTTPS 或 localhost 环境。");
      return;
    }
    setStatus("starting");
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        mic.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = mic;
      if (url.current) URL.revokeObjectURL(url.current);
      setAudio("");
      full.current = "";
      change.current("");
      setSeconds(0);
      setInterim("");
      const chunks: BlobPart[] = [];
      const media = new MediaRecorder(mic);
      recorder.current = media;
      media.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      media.onstop = () => {
        if (!mounted.current) return;
        url.current = URL.createObjectURL(
          new Blob(chunks, { type: media.mimeType }),
        );
        setAudio(url.current);
      };
      media.onerror = () => {
        setError("录音中断，请检查麦克风后重试。");
        recognition.current?.abort();
        finish();
      };
      const speech: Recognition = new Constructor();
      recognition.current = speech;
      speech.lang = lang;
      speech.continuous = true;
      speech.interimResults = true;
      speech.onresult = (e) => {
        let pending = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal)
            full.current +=
              (full.current ? " " : "") + e.results[i][0].transcript;
          else pending += e.results[i][0].transcript;
        }
        change.current(full.current);
        setInterim(pending);
      };
      speech.onerror = (e) => {
        const messages: Record<string, string> = {
          "not-allowed":
            "麦克风或语音识别权限被拒绝，请在浏览器地址栏中允许访问。",
          network: "语音识别服务连接失败，请检查网络；也可以手动输入检查。",
          "no-speech": "没有检测到语音，请靠近麦克风后重试。",
          "audio-capture": "无法访问麦克风，请检查设备是否可用。",
          "language-not-supported": "当前语音服务不支持所选语言。",
        };
        setError(messages[e.error] || `语音识别已中断（${e.error}），请重试。`);
        finish();
      };
      speech.onend = finish;
      active.current = true;
      media.start();
      speech.start();
      setStatus("recording");
    } catch (e) {
      active.current = false;
      recognition.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      setStatus("idle");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "麦克风权限被拒绝，请在浏览器中允许访问后重试。"
          : "无法启动录音，请检查麦克风连接及浏览器权限。",
      );
    }
  }
  return { status, error, audio, seconds, interim, start, stop };
}
