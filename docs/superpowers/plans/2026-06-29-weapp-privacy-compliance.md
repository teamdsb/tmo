# 微信小程序隐私合规整改 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补全可审核的《隐私政策》与《用户服务协议》，并在任何微信隐私接口执行前获得用户明示同意。

**Architecture:** 以结构化 TypeScript 文档作为小程序内协议的单一内容源，使用分节长文页渲染；在 App 层接入微信隐私授权监听与统一弹窗，登录使用微信官方组合授权按钮，图片/文件选择通过统一 preflight 门禁。同时将微信公众平台中的提审版与现网版《小程序用户隐私保护指引》更新为与代码完全一致。

**Tech Stack:** Taro 4.1.9, React 18, TypeScript, Jest/Testing Library, WeChat Mini Program privacy APIs (base library 2.32.3+).

---

## 审核结论与范围

- 微信官方要求：隐私指引必须先在公众平台声明实际处理的信息；只有同步了用户的已阅读同意状态，才能调用已声明的隐私接口。
- 公众平台有两个需同步的入口：「设置 → 服务内容声明 → 用户隐私保护指引」管理现网版；「版本管理 → 提交审核 → 信息填写」管理本次提审版。本次被拦截必须先修改提审版，不能只改现网版。
- 当前代码确实处理的微信隐私类型：
  1. `open-type="getPhoneNumber"` → 「收集你的手机号」，用于账号登录、身份识别与业务联系。
  2. `wx.chooseImage` → 「收集你选中的照片或视频信息」，用于头像、客户需求参考图、客服聊天图片。
  3. `wx.chooseMessageFile` → 「收集你选中的文件」，用于购物车 Excel 导入与物流批量导入。
- 当前没有调用定位、`wx.chooseAddress`、麦克风、摄像头或微信头像昵称接口，公众平台不应超范围勾选这些类型。
- 手工输入的姓名/显示名、联系电话、收货地址、订单备注、客服内容、客户需求与订单/支付/物流记录不一定触发微信隐私 API 检测，但仍属于应在自有《隐私政策》与补充文档中明确告知的信息。

## 执行前的真实信息校验

- [ ] 在微信公众平台记录 AppID `wx8e8831fc456f019b` 的认证主体全称，并将其作为「开发者/个人信息处理者」；不从域名或产品名推测公司名。
- [ ] 由运营方确认隐私联系邮箱、联系电话、通信地址和客诉处理时限，并确保联系方式能实际收到删除/更正请求。
- [ ] 确认真实服务商及服务器所在地：微信登录/微信支付、云主机/对象存储、物流或其他受托处理方；未实际使用的服务商不写入协议。
- [ ] 由运营方确认各类数据的最短必要保存期限：账号数据、订单/支付数据、收货地址、客服记录、需求附件、安全日志和本地缓存；法定留存与用户删除请求的例外要分开说明。
- [ ] 确认小程序是否面向未满14周岁用户；企业采购工具默认不面向儿童，但仍保留未成年人联系与监护人处理条款。

### Task 1: 将两份简短文案重构为可审核协议

**Files:**
- Modify: `apps/miniapp/src/content/policies.ts`
- Create: `apps/miniapp/src/content/policies.test.ts`

- [ ] **Step 1: 先写内容结构测试**

  断言每份文档都包含版本号、生效日、更新日、运营主体、联系方式和非空 sections；断言《隐私政策》必须覆盖「收集的信息及目的」、「处理方式」、「存储地域与期限」、「共享与委托处理」、「用户权利」、「未成年人」、「变更与通知」、「联系我们」；断言三类微信隐私信息均有独立用途描述。

- [ ] **Step 2: 运行测试并确认因旧单段字符结构失败**

  Run: `pnpm --filter miniapp test -- --runTestsByPath src/content/policies.test.ts`
  Expected: FAIL，提示缺少 `sections`/版本/必要章节。

- [ ] **Step 3: 实现结构化文档**

  将 `PolicyKey` 保留为 `privacy | terms | data`，将 value 改为 `PolicyDocument { title, version, publishedAt, effectiveAt, summary, sections }`；每个 section 使用 `heading` 和多个 paragraph/list item，不再把整份文档压成一个 `body` 字符串。

  《隐私政策》的信息清单按功能写清「信息类型 → 收集方式 → 使用目的 → 是否必需 → 拒绝后影响」：
  - 手机号：用户点击微信手机号授权按钮，用于登录、身份校验和必要的订单/售后联系；拒绝后可游客浏览，但不能使用需登录功能。
  - 用户手工填写的名称、联系电话、收货人与地址：用于账号展示、下单和履约；拒绝提供时不能完成需要该信息的操作。
  - 订单、购物车、支付、物流、售后、询价/客户需求、客服会话：用于交易履约、客户支持、纠纷处理与账务审计。
  - 用户选中的图片：仅在用户点击上传时读取，分别用于头像、需求说明和客服发图；不读取用户未选中的相册内容。
  - 用户选中的 Excel 文件：仅在用户点击导入时读取，用于购物车或物流批量导入。
  - 设备、网络、IP、请求日志和错误信息：仅用于安全、防欺诈、故障排查与服务稳定性。
  - 本地存储的登录态、角色/权限、设置、缓存资料与已选地址 ID：用于保持登录与页面偏好，退出或清理本机数据后删除。

  《用户服务协议》覆盖：签约主体与协议范围、账号注册与企业身份、商品/询价/需求/订单规则、价格与支付、交付与售后、用户行为规范、知识产权、服务变更/中断、违约责任、法律适用与争议解决、联系方式。页面和登录入口统一更名为《用户服务协议》，不再使用「服务条款」。

  `data` 文档更名为《个人信息收集清单》，以表格化条目展示上述信息、场景、目的、保存位置和期限。

- [ ] **Step 4: 运行内容测试**

  Run: `pnpm --filter miniapp test -- --runTestsByPath src/content/policies.test.ts`
  Expected: PASS。

### Task 2: 将协议页改为可阅读的长文页

**Files:**
- Modify: `apps/miniapp/src/pages/policy/index.tsx`
- Create: `apps/miniapp/src/pages/policy/index.scss`
- Modify: `apps/miniapp/src/pages/policy/index.test.tsx`

- [ ] **Step 1: 先写页面回归测试**

  验证标题、版本/生效日、运营主体、全部章节标题、联系方式均可见；未知 `type` 回退《隐私政策》；底部不再是大块空白占位。

- [ ] **Step 2: 运行旧页面测试并确认失败**

  Run: `pnpm --filter miniapp test -- --runTestsByPath src/pages/policy/index.test.tsx`
  Expected: FAIL，因旧页仅渲染 `body` 单段文字。

- [ ] **Step 3: 实现分节渲染与阅读体验**

  保留紧凑二级页眉；页首显示文档名、版本、更新日/生效日和摘要；主体按序号渲染 section 标题、段落与列表；使用页面自然滚动，确保小屏幕下每段行高和间距可读。联系信息和生效日放在文档末尾，不做折叠。

- [ ] **Step 4: 运行页面测试**

  Run: `pnpm --filter miniapp test -- --runTestsByPath src/pages/policy/index.test.tsx`
  Expected: PASS。

### Task 3: 接入微信官方隐私授权门禁

**Files:**
- Create: `apps/miniapp/src/services/weapp-privacy.ts`
- Create: `apps/miniapp/src/services/weapp-privacy.test.ts`
- Create: `apps/miniapp/src/components/privacy-authorization-gate/index.tsx`
- Create: `apps/miniapp/src/components/privacy-authorization-gate/index.scss`
- Create: `apps/miniapp/src/components/privacy-authorization-gate/index.test.tsx`
- Modify: `apps/miniapp/src/app.ts`
- Modify: `apps/miniapp/src/app.test.tsx`
- Modify: `apps/miniapp/src/test-utils/setup.js`

- [ ] **Step 1: 先写服务和弹窗测试**

  测试以下状态：非微信端直接通过；微信已授权时 `requirePrivacyAuthorize` 成功；未授权时 `onNeedPrivacyAuthorization` 打开弹窗；点击同意使用 `open-type="agreePrivacyAuthorization"` 并 resolve `agree`；点击拒绝 resolve `disagree` 且原隐私操作不执行；多个同时请求不重复弹窗；组件卸载时注销 listener。

- [ ] **Step 2: 运行测试并确认未实现而失败**

  Run: `pnpm --filter miniapp test -- --runTestsByPath src/services/weapp-privacy.test.ts src/components/privacy-authorization-gate/index.test.tsx src/app.test.tsx`
  Expected: FAIL，因隐私门禁不存在。

- [ ] **Step 3: 实现微信隐私服务**

  `requireWeappPrivacyAuthorization()` 在微信端封装 `wx.requirePrivacyAuthorize`，将拒绝映射为可识别的 `PRIVACY_AUTH_DENIED` 错误；`getWeappPrivacySetting()` 封装 `wx.getPrivacySetting`；`openWeappPrivacyContract()` 封装 `wx.openPrivacyContract`。基础库不支持时不假装已授权，而是显示「微信版本过低，请升级后重试」；Mock/支付宝不调用 wx 接口。

- [ ] **Step 4: 实现 App 级隐私弹窗**

  `PrivacyAuthorizationGate` 在 App 生命周期中注册 `wx.onNeedPrivacyAuthorization`。弹窗必须明确写「将处理哪类信息、用于什么」，提供「查看《小程序用户隐私保护指引》」、「同意并继续」和「暂不同意」三个明确操作。同意按钮必须是原生 `Button openType="agreePrivacyAuthorization"`，不能用普通 View 伪装。

- [ ] **Step 5: 运行隐私门禁测试**

  Run: `pnpm --filter miniapp test -- --runTestsByPath src/services/weapp-privacy.test.ts src/components/privacy-authorization-gate/index.test.tsx src/app.test.tsx`
  Expected: PASS。

### Task 4: 修正登录页的明示同意与手机号授权

**Files:**
- Modify: `apps/miniapp/src/pages/auth/login/index.tsx`
- Modify: `apps/miniapp/src/pages/auth/login/index.scss`
- Modify: `apps/miniapp/src/pages/auth/login/index.test.tsx`

- [ ] **Step 1: 先写授权顺序测试**

  断言首次进入不预勾选；未同意时不发起手机号登录；点击协议名仅打开文档不改变同意状态；同意操作由原生 privacy button 完成；登录按钮组合使用 `getPhoneNumber|agreePrivacyAuthorization`；拒绝后留在当前页并显示游客浏览选项。

- [ ] **Step 2: 运行旧登录测试并确认失败**

  Run: `pnpm --filter miniapp test -- --runTestsByPath src/pages/auth/login/index.test.tsx`
  Expected: FAIL，因旧代码只用普通 View 勾选，且登录按钮只有 `getPhoneNumber`。

- [ ] **Step 3: 实现双层同意**

  文案改为「我已阅读并同意《用户服务协议》《隐私政策》及《小程序用户隐私保护指引》」。自有协议继续跳转 policy page，微信指引使用 `openPrivacyContract`。只在 `bindagreeprivacyauthorization` 成功后将本次页面的 `agreed` 设为 true；不用本地假状态代替微信同意记录。手机号按钮使用微信官方建议的组合 open-type，授权失败时不发送登录请求。

- [ ] **Step 4: 运行登录测试**

  Run: `pnpm --filter miniapp test -- --runTestsByPath src/pages/auth/login/index.test.tsx`
  Expected: PASS。

### Task 5: 为所有图片和文件选择加上授权前置检查

**Files:**
- Modify: `apps/miniapp/src/pages/profile/edit/index.tsx`
- Modify: `apps/miniapp/src/pages/profile/edit/index.test.tsx`
- Modify: `apps/miniapp/src/pages/demand/create/index.tsx`
- Modify: `apps/miniapp/src/pages/demand/create/index.test.tsx`
- Modify: `apps/miniapp/src/pages/support/chat/index.tsx`
- Modify: `apps/miniapp/src/pages/support/chat/index.test.tsx`
- Modify: `apps/miniapp/src/pages/import/index.tsx`
- Modify: `apps/miniapp/src/pages/tracking/batch/index.tsx`
- Create: `apps/miniapp/src/pages/import/index.test.tsx`
- Create: `apps/miniapp/src/pages/tracking/batch/index.test.tsx`

- [ ] **Step 1: 先为五个入口写失败测试**

  每个测试都要验证：`requireWeappPrivacyAuthorization()` 先于 `chooseImage`/`chooseMessageFile`；拒绝时选择器和上传请求均不执行；同意后只打开一次选择器。

- [ ] **Step 2: 运行相关页面测试并确认失败**

  Run: `pnpm --filter miniapp test -- --runTestsByPath src/pages/profile/edit/index.test.tsx src/pages/demand/create/index.test.tsx src/pages/support/chat/index.test.tsx src/pages/import/index.test.tsx src/pages/tracking/batch/index.test.tsx`
  Expected: FAIL，因当前所有选择器均未进行显式 privacy preflight。

- [ ] **Step 3: 在用户动作中接入门禁与就地告知**

  头像处显示「仅读取你主动选中的图片，用于账号头像」；需求图显示「用于帮助匹配商品」；客服图显示「用于本次客服沟通」；Excel 入口显示「仅处理你选中的文件，用于本次导入」。点击选择后先 await privacy preflight，成功后再调用原选择器。

- [ ] **Step 4: 运行五个入口的测试**

  Run: `pnpm --filter miniapp test -- --runTestsByPath src/pages/profile/edit/index.test.tsx src/pages/demand/create/index.test.tsx src/pages/support/chat/index.test.tsx src/pages/import/index.test.tsx src/pages/tracking/batch/index.test.tsx`
  Expected: PASS。

### Task 6: 让协议、信息清单和用户权利随时可访问

**Files:**
- Modify: `apps/miniapp/src/pages/settings/index.tsx`
- Modify: `apps/miniapp/src/pages/settings/index.test.tsx`
- Modify: `apps/miniapp/src/services/profile.ts`
- Modify: `apps/miniapp/src/services/bootstrap.ts`

- [ ] **Step 1: 先写设置页测试**

  断言「隐私与协议」下有《用户服务协议》、《隐私政策》、《个人信息收集清单》、《小程序用户隐私保护指引》；前三者跳转长文页，微信指引调用 `openPrivacyContract`；页面展示查阅、复制、更正、删除、撤回授权和注销的申请方式。

- [ ] **Step 2: 运行旧设置页测试并确认失败**

  Run: `pnpm --filter miniapp test -- --runTestsByPath src/pages/settings/index.test.tsx`
  Expected: FAIL，因当前只有折叠的单段文字，没有微信指引或权利入口。

- [ ] **Step 3: 替换折叠文案为清晰的页面入口**

  三份自有文档使用现有 `ROUTES.policy`；微信指引使用官方 contract API。增加「个人信息权利」说明卡：更正可通过资料/地址页，清除本机数据仅删除 token、bootstrap、profile、设置与缓存而不伪称删除服务器订单；服务器数据查阅/删除/注销按已确认的联系方式受理；撤回微信授权指引用户到「小程序右上角… → 设置 → 小程序已获取的信息」。

- [ ] **Step 4: 运行设置页测试**

  Run: `pnpm --filter miniapp test -- --runTestsByPath src/pages/settings/index.test.tsx`
  Expected: PASS。

### Task 7: 同步微信公众平台的《小程序用户隐私保护指引》

**Files:**
- Create: `docs/compliance/weapp-privacy-declaration.md`
- Create: `docs/compliance/weapp-privacy-supplement.txt`

- [ ] **Step 1: 生成平台填写对照表**

  `weapp-privacy-declaration.md` 固化每个平台字段的实际填写文案、对应代码位置和业务目的，避免下次提审时凭记忆勾选。必选三项为：
  - 收集你的手机号：「用于完成账号登录、身份校验，并在订单履约或售后服务必要时与你联系。」
  - 收集你选中的照片或视频信息：「仅读取你主动选中的图片，用于设置账号头像、提交客户需求参考图或在客服会话中发送图片。」
  - 收集你选中的文件：「仅读取你主动选中的 Excel 文件，用于购物车商品或物流数据的批量导入。」

- [ ] **Step 2: 完成平台其余必填项和补充文档**

  在公众平台填写用户权益、经运营方确认的保存期限、信息使用规则、共享/转让/公开披露规则、联系方式与生效日。如存在微信插件或代开发服务商，按实际情况填写；若代码和公众平台均不存在，不虚构第三方插件。

  `weapp-privacy-supplement.txt` 是小于 100KB 的纯文本，内容与小程序内《隐私政策》一致，并补充手工输入信息、订单/支付/客服数据和受托处理方。在平台上传该文本，不上传 Markdown/PDF。

- [ ] **Step 3: 同时更新现网版和本次提审版**

  先在「设置 → 服务内容声明」更新现网版，再在「提交代码审核 → 信息填写」更新当前开发版。保存后等待平台生效，重新进入两个入口核对三类信息和文案一致。

### Task 8: 全量验证、生产构建与审核前真机检查

**Files:**
- Modify: `apps/miniapp/scripts/weapp-auth-e2e.js`
- Create: `apps/miniapp/scripts/weapp-privacy-e2e.js`
- Modify: `apps/miniapp/package.json`

- [ ] **Step 1: 增加微信自动化回归**

  自动化清除授权数据后启动小程序，验证游客浏览不强制授权；点击登录会出现官方隐私同意链路；拒绝后不调用手机号登录；同意后手机号授权正常；设置页可打开三份长文与微信 contract；图片/文件选择在新用户状态下先出现隐私告知。

- [ ] **Step 2: 运行小程序全量测试**

  Run: `pnpm --filter miniapp test`
  Expected: PASS，无新增失败。

- [ ] **Step 3: 运行类型、ESLint 和样式检查**

  Run: `pnpm --filter miniapp lint:types && pnpm --filter miniapp lint:eslint && pnpm --filter miniapp lint:styles`
  Expected: 全部退出 0。

- [ ] **Step 4: 构建微信生产版并扫描产物**

  Run: `pnpm --filter miniapp build:weapp:prod`
  Expected: 构建成功；`dist/weapp` 中存在完整协议文本、`agreePrivacyAuthorization`、`getPhoneNumber|agreePrivacyAuthorization`，且不存在仅旧单段文案的页面。

- [ ] **Step 5: 同步开发者工具目录并进行真机验收**

  将正式 Git 工作区的 `apps/miniapp/dist/weapp` 同步到 `/Users/asimov3059/工作代码/tmall/tmo/apps/miniapp/dist/weapp`。在微信开发者工具中分别执行「清除授权数据」和普通缓存保留的两套验收，并在真机上检查长文滚动、官方隐私指引、拒绝后降级和再次同意。

- [ ] **Step 6: 提审说明中明确测试路径**

  向审核人员提供：「我的 → 系统设置 → 隐私与协议」查看完整文档；「我的 → 登录」验证未同意前不获取手机号；「提交需求/客服发图/批量导入」验证用户主动触发后才读取选中的图片或文件。截图中保留运营主体、生效日和联系方式。

## 不纳入本次的内容

- 不为了审核虚构第三方 SDK、数据出境或不存在的业务目的。
- 不将「退出登录/清理缓存」描述为「删除服务器个人信息」。
- 不新增定位、通讯录、麦克风、摄像头等权限。
- 本计划先完成隐私合规与审核闭环；若运营方要求小程序内自助注销、一键导出数据，需另行设计身份复核、后端删除/脱敏与法定留存流程。

## 官方依据

- 微信《小程序隐私协议开发指南》：https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html
- 微信《用户隐私保护指引填写说明》：https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/
- 微信《小程序用户隐私保护指引内容介绍》：https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/miniprogram-intro.html
- 微信 `wx.requirePrivacyAuthorize`：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/privacy/wx.requirePrivacyAuthorize.html

