# Phase 4E0 · 香港电车实时 ETA 授权调查

**截至 2026-11-23（香港时间），未查到可明确授权 KongDaily 调用、缓存或在商业 iOS App 显示的香港电车实时到站接口。** 香港电车的实时资料确实存在，且有官方公布的第三方合作先例。可向营办商询问合作接入，同时向 Moovit 确认其商业 API 的实况覆盖及再授权范围。两条渠道均尚未放行生产。 [香港电车官方 App 公告](https://www.hktramways.com/media/files/press-releases/20260414_Press%20Release_Hong%20Kong%20Tramways%20Unveils%20Official%20Mobile%20App.pdf) · [香港电车与 Moovit 合作公告](https://www.hktramways.com/media/files/press-releases/20180129%20HK%20Tramways%20x%20Moovit%20Press%20Release_EN.pdf) · [Moovit 官方开发文档](https://api-docs.moovit.com/)

## 可用性矩阵

| 分类 | 公开证据 | 对 KongDaily 的许可结论 |
| --- | --- | --- |
| 官方公开并附条件授权的**静态**资料 | 香港电车站点、主要路线开放数据是 CSV；运输署另提供静态 XML／GeoJSON 及 GTFS 班次资料。目录提供的查询 API 只查询其发布的数据。 | 平台规则下核对适用权利及署名，继续既有静态路线、站序、附近和状态信息。公共静态数据许可不延伸至营办商 App 的实时资料。 [营办商站点](https://data.gov.hk/en-data/dataset/hktramways-hktramways-tram-stops) · [主要路线](https://data.gov.hk/en-data/dataset/hktramways-hktramways-main-routes) · [运输署静态 GTFS](https://data.gov.hk/en-data/dataset/hk-td-tis_11-pt-headway-en) · [DATA.GOV.HK 条款](https://data.gov.hk/en/terms-and-conditions) |
| 官方消费者实时功能 | 2026-04-14 App 公告说明可查看接下来三班及目的地。营办商历史页面记录网页、站牌二维码等消费者显示渠道。免责声明讨论 RPI 的参考性质、可能中断和修改。 | 已确认显示能力。公开页面、站牌二维码和免责声明未提供第三方 API 文档、准入流程或商用再分发许可。 [官方 App 公告](https://www.hktramways.com/media/files/press-releases/20260414_Press%20Release_Hong%20Kong%20Tramways%20Unveils%20Official%20Mobile%20App.pdf) · [营办商历史](https://www.hktramways.com/en/our-story) · [RPI 免责声明](https://www.hktramways.com/en/disclaimer) |
| 官方合作接入先例，需商业申请或确认 | 2018 年新闻稿确认 Moovit 接入，并介绍与其他交通 App 分享数据的历史。Moovit 另有官方商业 API 文档，提供一般实时及 GTFS-RT 产品，并引导客户经 account manager 配置。 | 有正式对接线索。未确认香港电车是否仍开放新合作、个人开发者可否申请、Moovit 当前商业产品是否包含香港电车实况，或能否授权 KongDaily 商用显示和缓存。既有合作范围未知。 [合作公告](https://www.hktramways.com/media/files/press-releases/20180129%20HK%20Tramways%20x%20Moovit%20Press%20Release_EN.pdf) · [Moovit 官方开发文档](https://api-docs.moovit.com/) |
| 非官方／独立整理 | 社区项目注明为独立的手机后端规范及 SDK。代码许可由项目作者给出。 | 上游 API 访问及实时数据权利仍需上游确认。社区资料只用于辨别性质，没有安装 SDK、调用后端、检查 App 流量或获取凭据。 [社区项目声明](https://github.com/ByteLandTechnology/hktramways-openapi) |
| 尚未查明 | 未找到香港电车营办商正式公开的第三方 ETA 开发规范、开放目录条目或可核验的自助登记页面。 | 正式文档、独立开发者资格、商业 iOS 使用、合同和鉴权均待书面答复；目前没有获确认可用的生产端点。 |

公开来源检查涵盖香港电车官网、官方 App 及合作公告、DATA.GOV.HK 的营办商与运输署资料目录、Moovit 官方开发文档及社区项目自述。公开检索结果不能排除非公开合作渠道。约定批准文件和持续有效的服务条款是工程放行依据，亦用于 App Store 审查。 [App Store Review Guidelines §5.2.2](https://developer.apple.com/app-store/review/guidelines/#intellectual-property)

## 仍须官方确认

1. 可供独立开发者申请的正式渠道、商用 iOS 范围、分发地区、费用、登记／合同及沙盒技术文档。若经 Moovit 或其他供方，确认其对香港电车实际数据及使用场景的再授权能力。
2. API Key、签约账户等凭据要求，能否直接在移动端访问，应用总量、每客户端、突发及并发上限、更新频率和 429／其他失败处理建议。公开资料没有可用于 KongDaily 的确认配额。
3. 是否可显示在路线、站点详情和已置顶首页，允许设备端内存缓存或持久化到何种期限，是否可短时服务端缓存，能否在 App 截图、测试发布、日志或导出中使用。留存、再分发和衍生展示分别确认。
4. 必须的营办商／渠道文字署名、链接、商标使用及显示位置。直接接入和经代理分发可能有不同条件，媒体标识不沿用静态资料授权。
5. 书面确认覆盖的运营线路、站台、官方方向、跑马地支线、重复停靠、同名站牌及临时短途、改道、停用状态。要求提供官方站牌与方向映射、预测语义、时区、新鲜度、无车与无数据的区别。4C1 的 117 个静态站点不能作为实时覆盖证明。

## 授权咨询草稿（未发送）

拟通过香港电车官网公布的 `enquiry@hktramways.com` 请其转介数据合作或技术许可团队。以下两种语言任选其一。 [香港电车官方联络方式](https://www.hktramways.com/en/contact-us/)

### 繁體中文

**主旨　KongDaily 查詢香港電車實時到站資料的商用授權**

香港電車資料合作團隊您好：

我是 KongDaily 的獨立開發者。KongDaily 是一款香港公共交通 iOS App，正在開發的版本已加入電車靜態路線、站序和附近車站資料。我想了解貴公司是否提供可供獨立開發者申請的正式實時到站資料介面，並可在商業發佈的 App 內顯示預計到站時間及目的地。

如有合適渠道，請問可否提供申請流程、技術文件或測試環境，以及商用、流量／更新頻率、短暫快取、資料保留、再分發及署名條件？我們也希望了解可用的站點及方向覆蓋、站牌與路線識別碼，以及對臨時改道和跑馬地支線的支援。預期只在使用者查看相關車站或已置頂服務時按需讀取。若須透過指定合作方，煩請指引。

謝謝。

［姓名］

KongDaily

［App Store 連結及聯絡方式］

### English

**Subject — Licensing enquiry for Hong Kong Tramways real-time arrivals in KongDaily**

Dear Hong Kong Tramways Data Partnerships Team,

I am the independent developer of KongDaily, an iOS app for Hong Kong public transport. The next version includes static tram route, stop and nearby information. Does Hong Kong Tramways offer an authorised real-time arrival feed that independent developers can apply to use in a commercially distributed iOS app?

If so, could you share the application process, technical documentation or sandbox, and the terms for commercial display, request limits, update frequency, short-lived caching, retention, redistribution and attribution? We would also like to confirm stop and direction coverage, identifier mappings, and how the feed represents temporary changes and the Happy Valley branch. We expect to request data on demand when a user views a relevant stop or pinned service. If access is available through a designated partner, please let me know whom to contact.

Thank you,

[Name]

KongDaily

[App Store URL and contact details]

## 获授权后的实施路径

- **先核验合同、数据及覆盖。** 记录权利人、获准端点、保留上限、密钥管理、调用范围、署名和撤权方式。使用官方样本与授权环境核对停靠 ID、方向、目的地和时间戳。把服务访问键映射至现有 `routeId/directionId/stopId/stopSequence`，不改用户静态收藏键。对运输署与营办商站牌一对多、停靠歧义或缺少官方映射的服务保持未覆盖；仅支持站级预测时明确标为站级。
- **先上线详情，再评估首页。** 将 ETA 读数留在单独适配器，按获准键合并请求、按许可设置缓存和有界超时。前台仅对用户正在看的详情请求。可见置顶卡也须获得相应显示许可并验证映射后才接入，共享最多三张，无后台无限轮询。处理成功、空、未覆盖、离线、过期、429 和失败，使用官方生成时间与单调时钟判断新鲜度。静态信息和真实到站分别显示。
- **保护凭据和最小数据。** 只发送官方站点查询键，避免发送 GPS、收藏清单或用户身份。若允许直连则使用公开移动端凭据；合同要求服务器凭据时，另审服务端方案和发布范围，长期密钥不进 App 资源。提供可撤销门禁、来源与许可审查记录，并按合同实施到期、清缓存及停用。
- **未获授权的路线。** 保持现有 4C1–4C3 的离线目录、路线和站序、附近、公告及运营状态。Phase 4D 收藏和首页可显示静态线路、方向和站点，`realtimeEta=false`。允许用户主动打开营办商官方页面，在 App 内不借助静态班次或频率生成倒计时。 [4C0 数据审计](PHASE-4C0-TRAM-DATA-VALIDATION.md) · [4D0 收藏方案](PHASE-4D0-UNIFIED-FAVORITES-AUDIT.md)
