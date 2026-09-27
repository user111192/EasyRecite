# EasyRecite

一个使用 React、TypeScript 和 Vite 构建的中英文背诵练习应用。

## 运行

需要 Node.js 22.12+（或 24 LTS）。

```sh
npm install
npm run dev
```

打开终端显示的 localhost 地址（默认 http://localhost:5173）。

```sh
npm test       # 文本对齐算法测试
npm run build # TypeScript 检查和生产构建
npm run preview
```

## 功能

- 自定义中文 / 英文文本，本地文本库和预置示例；支持在练习页及文本库编辑标题、正文，保存后重置旧的背诵结果；可删除自建或示例文本，至少保留一篇。
- 自动判断中文 / 英文，或手动选择普通话和美式英语。自动模式根据原文是否含汉字选择，单次识别使用一种语言。
- 浏览器 SpeechRecognition / webkitSpeechRecognition 语音转文字，显示临时识别内容；结束后自动检查。
- MediaRecorder 录音，结束后可回放最近一次录音；开始新录音时释放上一段音频。
- 隐藏原文，手动输入 / 修正转写，准确率和漏背、错背、多背的高亮反馈。
- 可设置实时显示差异（设置保存在本地）：开启后随语音识别或手动输入更新，并只展示到当前最后一个已背字词；关闭后录音结束自动检查，手动输入需点击检查。
- 对照结果保留原文大小写、标点、空格和换行；非比较字符以中性色显示，不影响错误统计和准确率。
- 实时差异只展示到当前最后一个已背字词，不提前显示后续原文。
- 可配置任意兼容 OpenAI Chat Completions 的 API 地址、模型和 Bearer API Key；背诵完成后可将原文、转写与错误结果发送给 AI 生成简短锐评。API Key 仅写入当前标签页的 `sessionStorage`，地址和模型保存在 `localStorage`。浏览器直连要求服务端支持 CORS。
- 响应式桌面 / 手机界面，麦克风拒绝、网络失败和不支持浏览器等提示。

## 纠错规则

使用 Levenshtein 编辑距离和回溯对齐。中文按字，英文按词；忽略标点、空格及英文大小写，保留单词内部的撇号。准确率 = max(0, 1 − 编辑距离 / 原文字词数) × 100%。单次原文和识别内容最多 2000 字 / 词。此结果是文字匹配，不是发音评分或语义判断；语音服务转写错误也可能被标为背诵错误。

## 浏览器和隐私

麦克风需要 HTTPS 或 localhost。推荐支持 Web Speech API 的 Chrome / Edge；具体能力和网络可用性因浏览器、系统和地区而异。浏览器可能将语音发送至其提供商的远程识别服务，本应用没有音频上传后端。文本保存在当前浏览器的 localStorage，录音仅存在当前页面内存，刷新即消失。没有账户、跨设备同步或服务器存储。

参考：[SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)、[getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)。

## 项目结构

- `src/main.tsx`：文本库、练习与反馈界面
- `src/useRecorder.ts`：语音识别、录音和资源释放
- `src/compare.ts`：字词切分与纠错算法
- `src/compare.test.ts`：算法测试
- `src/style.css`：响应式样式

真实麦克风、系统权限及远程语音服务仍需在目标浏览器手动验证。
