# App H5

面向 App WebView 的轻量 H5 框架，首个业务页为「意见与建议」。

客户端只负责提交；运营查看全部反馈请用独立运营后台，不要与 App 用户历史混用。

## 能力

- Vue 3 + Vite + TypeScript + hash 路由
- 375 设计稿 rem 适配 + safe-area
- Bridge 桩：`closePage` / `openHistory` / `pickImage` / `getAuth`
- 请求层：超时 10s、GET 可重试
- 开发态提交落盘到本机 `data/`；图片压缩后上传；路由级代码分割

## 开发

```bash
pnpm install
pnpm dev
```

- 客户端：`http://localhost:5173/#/feedback`
- 运营后台：`http://localhost:5173/admin.html`（仅开发服务可用）

提交后刷新运营后台即可看到记录；数据保存在本机 `data/feedbacks.json` 与 `data/uploads/`。

## 构建

```bash
pnpm build
pnpm preview
```

生产构建只打包客户端 `index.html`，不包含运营后台。

## 接入真实 API

1. 配置 `VITE_API_BASE` 指向线上接口
2. 按需调整 `src/api/feedback.ts` 字段名
3. 运营查看改为接真实运营系统，本仓库 `admin.html` 仅作本地开发查看

## Bridge

宿主可注入：

- `window.Native.closePage / openHistory / pickImage / getAuth`
- 或 `window.__APP_BRIDGE__` 同名方法
- 或 iOS `webkit.messageHandlers.Native` / Android `Native.postMessage`
