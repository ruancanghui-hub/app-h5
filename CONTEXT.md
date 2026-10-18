# App H5

App 内 WebView 承载的业务 H5 上下文：以容器页形式提供功能，并通过 Bridge 与原生协作。多上下文见 [CONTEXT-MAP.md](./CONTEXT-MAP.md)；身份相关术语在 [Identity](./identity/CONTEXT.md)。

## Language

**H5 容器页**:
App WebView 内打开的业务页面。
_Avoid_: 小程序页, 原生页, 网页

**问题反馈**:
用户通过「意见与建议」提交的一次反馈实体；已登录时绑定 Identity，未登录仍可匿名提交（可选手动联系方式）。
_Avoid_: 工单, 投诉, 建议单

**问题类型**:
问题反馈的分类，当前为功能异常、意见与建议、其他。
_Avoid_: 分类, 标签, 类别

**Bridge**:
H5 与原生之间的能力通道。
_Avoid_: SDK, 插件, Native API（泛称）

**用户历史**:
客户端内用户查看自己提交过的问题反馈的入口与列表。
_Avoid_: 运营后台, 全部反馈

**运营后台**:
运营侧查看全部问题反馈的入口与列表，与用户历史互不替代。
_Avoid_: 用户历史, App 内历史
