# Identity

跨 App 复用的身份上下文：人只有一个 Identity；各 App 通过接入获得 AppMembership；本仓托管登录页是接入面之一。

## Language

**Identity**:
跨所有接入 App 共享的同一个人。
_Avoid_: 账号, 用户（泛称）, Account

**AppMembership**:
某个 Identity 对某个已接入 App 的加入/授权关系。
_Avoid_: 注册（指 App 侧）, 订阅

**身份服务**:
统一签发与校验 Identity 会话的平台能力。
_Avoid_: 登录系统, SSO 中台（未约定前）

**托管登录页**:
由身份服务托管、在 App WebView 中打开的注册/登录 H5 容器页。
_Avoid_: 原生登录页, 各 App 自建登录页

**邮箱凭证**:
用邮箱与密码证明 Identity 的方式；口语中的「账号注册」若无另指，即指本方式。
_Avoid_: 账号（单独实体）, 用户名注册

**社交凭证**:
用 Apple 或 Google 证明 Identity 的方式。
_Avoid_: 第三方登录（泛称到未接入的提供方）

**接入应用**:
在身份服务以 OAuth2 精简契约注册的一个 App（含 client_id 与回跳约定）。
_Avoid_: 租户, 商户, 站点

**授权确认**:
Identity 首次进入某接入应用前，对其将获得的信息范围表示同意；同意后才产生 AppMembership。
_Avoid_: 静默加入, 注册（指 App 侧）

**凭证合并**:
不同证明方式归入同一 Identity 的规则：明文邮箱相同则自动合并；Apple 隐藏邮箱不自动合并，须显式绑定。
_Avoid_: 账号打通（含糊）, 强制合并

**会话**:
身份服务签发给接入应用的登录态，含短时访问令牌与长时刷新令牌；原生经 Bridge 的 `setAuth` 回写并保管，业务侧仍用 `getAuth` 读取当前访问令牌。
_Avoid_: Ticket, Cookie（作为跨 App 主会话）, H5 localStorage 主存会话

**邮箱验证状态**:
Identity 上邮箱是否已经确认；未验证仍可持有会话，但部分能力受限。社交凭证若提供方已确认该邮箱，则视为已验证。
_Avoid_: 激活, 实名

**基础资料**:
授权确认通过后，接入应用默认可获得的 Identity 信息：identity_id、邮箱、显示名、头像；协议预留更细 scope，本期不拆档。
_Avoid_: 用户资料包, Profile（未定义前）

**密码找回**:
持有邮箱凭证的 Identity 通过邮箱重置链接或验证码设置新密码的过程。
_Avoid_: 申诉改密（无流程时）

**接入登记**:
将某 App 登记为接入应用并颁发 client_id 等凭证；一期以仓库/配置静态名单启动，再演进为内部人工后台；不做自助开放注册门户。
_Avoid_: 开放平台入驻（指外部自助）

**原生换票**:
Apple/Google 由宿主 App 原生 SDK 取得提供方令牌后，提交身份服务换取本平台会话；托管登录页只编排，不在 WebView 内走提供方 Web OAuth。尚无 AppMembership 时先走授权确认。
_Avoid_: H5 内嵌第三方 Web 登录（作为主路径）

**社交绑定**:
把某个 Apple/Google subject 记到指定 Identity 上。明文邮箱可在换票时自动合并；隐藏邮箱只通过已登录 Identity 的显式绑定挂上。
_Avoid_: 账号打通

**退出本应用**:
结束 Identity 在当前接入应用的会话；为默认退出行为。
_Avoid_: 注销（与删除身份混淆）

**撤销所有会话**:
结束该 Identity 在所有接入应用/设备上的会话；放在安全设置，非默认退出。
_Avoid_: 一键退出（含糊到范围）

**公钥客户端**:
无法保管机密的接入应用（如移动 App）；用 PKCE 完成授权，并以包名/Bundle ID 等作服务端加固。
_Avoid_: 机密客户端（套在移动端上）
