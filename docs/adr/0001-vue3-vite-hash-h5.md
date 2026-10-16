# 0001. 采用 Vue3 + Vite + hash 路由的 App H5 骨架

## Status

Accepted

## Context

本仓库是 App WebView 内的业务 H5，需要多机型适配、弱网可打开、首包可控，并快速落地「意见与建议」等表单页。候选包括 React、无框架原生 TS、以及 history 路由。

## Decision

使用 Vue 3 + Vite + TypeScript；路由使用 hash；UI 自研薄组件（不引入 Vant）；通过 Bridge 桩对接原生。

## Consequences

- 正向：开发效率高、路由在 WebView 兼容性好、样式完全可控、后续可按路由分包扩页。
- 负向：hash URL 不如 history 美观；自研组件需自行维护基础交互。
- 后续若宿主与 CDN 策略成熟，可再评估 Service Worker 与 history 路由。
