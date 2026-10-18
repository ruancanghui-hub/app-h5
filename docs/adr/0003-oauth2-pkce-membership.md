# 0003. 精简 OAuth2 + PKCE，Identity 与 AppMembership 分离

## Status

Accepted

## Context

多 App 接入需要可登记的 Client 与跨 App 身份模型。可选静默加入、每 App 独立账号、或完整 IdP/自助开放门户。移动端无法保管 client_secret。

## Decision

采用 Identity（全局一人）+ AppMembership（经授权确认产生）；接入为精简 OAuth2（授权码 + PKCE 公钥客户端），包名/Bundle ID 作加固；Client 先静态名单，再内部后台，不做外部自助入驻。同明文邮箱凭证自动合并；Apple 隐藏邮箱须显式绑定。

## Consequences

- 正向：开放式接入有正经契约；自有 App 数据模型可扩展到外部；安全默认合理。
- 负向：比「发个 AppKey 直接发 token」多授权确认与换票步骤；一期需维护静态 Client 配置。
