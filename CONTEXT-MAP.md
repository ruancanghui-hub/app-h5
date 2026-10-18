# Context Map

## Contexts

- [App H5](./CONTEXT.md): App WebView 内业务 H5 容器页（如问题反馈），经 Bridge 与原生协作
- [Identity](./identity/CONTEXT.md): 跨 App 共享的身份与接入关系；各 App 经身份服务接入

## Relationships

- **Identity → App H5**: 托管登录页完成认证后，经 Bridge `setAuth` 回写会话；之后 H5 业务页仍通过 `getAuth` 取访问令牌
- **接入应用 → 身份服务**: 静态名单/内部登记为接入应用；社交登录走宿主原生换票
- **接入应用 → Identity**: 经授权确认产生 AppMembership；默认获得基础资料；Identity 全局唯一
- **Identity ⟷ 邮箱/社交凭证**: 同明文邮箱自动合并为同一 Identity；Apple 隐藏邮箱需显式绑定
- **问题反馈 → Identity**: 已登录提交时绑定 `identity_id`；匿名提交不绑定
- **CVNivo → Identity**: Flutter `client_id=cvnivo` 走共享登录；CVNivo API 用 Identity access token 换求职者账户 JWT（见 CVNivo `docs/IDENTITY-LINK.md`）
