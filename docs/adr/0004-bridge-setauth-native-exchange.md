# 0004. Bridge setAuth 回写会话；社交走原生换票

## Status

Accepted

## Context

既有 Bridge 仅 `getAuth` 只读，假定原生已有 token。托管登录在 WebView 内完成；Apple/Google 在 WebView 走 Web OAuth 坑多。会话需 access + refresh。

## Decision

扩展 Bridge：`setAuth` 回写 accessToken、refreshToken、identityId、expiresAt；业务仍 `getAuth`。社交登录契约为宿主原生 SDK 取提供方令牌后向身份服务换票；实现顺序先邮箱凭证，后社交换票。禁止以 H5 localStorage 作为跨 App 主会话。

## Consequences

- 正向：与现有 H5 请求层兼容；原生持有刷新能力；社交路径稳定。
- 负向：所有宿主 App 需实现 `setAuth`；社交换票依赖各端原生接入进度。
