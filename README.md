# App H5

面向 App WebView 的轻量 H5 框架。业务页含「意见与建议」与可复用的**托管登录页**；身份服务同仓独立进程，供多 App 接入。

客户端反馈只负责提交；运营查看全部反馈请用独立运营后台，不要与 App 用户历史混用。领域术语见 `CONTEXT-MAP.md`。

## 能力

- Vue 3 + Vite + TypeScript + hash 路由
- 375 设计稿 rem 适配 + safe-area
- Bridge 桩：`closePage` / `openHistory` / `pickImage` / `getAuth` / `setAuth`
- 身份服务：邮箱注册/登录、授权确认、PKCE 换票、密码找回（社交原生换票契约已留口）
- 请求层：超时 10s、GET 可重试
- 开发态提交落盘到本机 `data/`；图片压缩后上传；路由级代码分割

## 开发

```bash
pnpm install
pnpm dev
```

- 客户端：`http://localhost:5173/#/feedback`
- 托管登录：`http://localhost:5173/#/auth/login?client_id=app-h5-preview`
- 运营后台：`http://localhost:5173/admin.html`（仅开发服务可用）

开发态反馈与身份 API 均挂在 Vite middleware。反馈数据：`data/feedbacks.json`；身份数据：`data/identity/store.json`。

### 接入应用（一期静态名单）

见 `server/identity/clients.ts`。预置 `app-h5-preview`、`demo-app`。流程：登录/注册 → 授权确认 → PKCE 换票 → `Bridge.setAuth`。

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

- `window.Native.closePage / openHistory / pickImage / getAuth / setAuth`
- 或 `window.__APP_BRIDGE__` 同名方法
- 或 iOS `webkit.messageHandlers.Native` / Android `Native.postMessage`

`setAuth` 载荷：`{ accessToken, refreshToken, identityId, expiresAt }`。无原生时浏览器预览写入 `sessionStorage`（非正式主会话）。

## 身份 API（摘要）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/identity/v1/register` | 邮箱注册 → loginTicket |
| POST | `/api/identity/v1/login` | 邮箱登录 → loginTicket |
| POST | `/api/identity/v1/consent` | 授权确认 → authorization code |
| POST | `/api/identity/v1/token` | code+PKCE / refresh_token 换会话 |
| GET | `/api/identity/v1/me` | 当前 Identity |
| POST | `/api/identity/v1/password/forgot` | 找回（配置 SMTP 后发信） |
| POST | `/api/identity/v1/token/social` | Apple/Google id_token 换票 |
| POST | `/api/identity/v1/social/bind` | 已登录后显式绑定社交凭证 |

原生换票请求：`{ provider: "apple"|"google", idToken, clientId, bundleId }`。验签通过且已有 AppMembership 时直接返回会话；否则返回 `needsConsent` 与 `loginTicket`。

发信环境变量：`SMTP_HOST`、`SMTP_PORT`（465 为隐式 TLS）、`SMTP_USER`、`SMTP_PASS`、`MAIL_FROM`、`PUBLIC_ORIGIN`。未配置时开发态仍在接口里回传凭证。

接入登记页：`/identity-admin.html`（生产走运营 basic auth）。名单落在 `data/identity/clients.json`。Apple/Google 受众写在接入应用上，也可用 `APPLE_AUDIENCES` / `GOOGLE_AUDIENCES`。

生产：身份服务监听 `127.0.0.1:3901`，nginx 将 `/api/identity/` 反代至该端口。
