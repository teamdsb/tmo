const RAW_REPLACEMENTS = [
  ['Admin Portal Login & Identity Selection', '管理门户登录与身份选择'],
  ['Marketplace Admin Dashboard', '商城管理仪表盘'],
  ['Product & SKU Management Center', '商品与SKU管理中心'],
  ['Order Fulfillment & Logistics Center', '订单履约与物流中心'],
  ['Excel Cart Import & Matching Tool', 'Excel购物车导入与匹配工具'],
  ['Sourcing Demand & Inquiry Center', '需求订单与询价中心'],
  ['Roles & Permissions (RBAC) Management', '角色与权限（RBAC）管理'],
  ['System Configuration & Security Settings', '系统配置与安全设置'],
  ['Customer Ownership Transfer Management', '客户归属转移管理'],
  ['Supplier Directory & Performance Center', '供应商目录与绩效中心'],
  ['Inquiry & Quote Workflow Management', '询价与报价流程管理'],
  ['Payment Management & System Audit Logs', '支付管理与系统审计日志'],
  ['Export & Batch Task Center', '导出与批处理任务中心'],
  ['Marketplace Admin', '商城管理后台'],
  ['Admin Console', '管理控制台'],
  ['Admin Dashboard', '管理仪表盘'],
  ['AdminPanel', '管理后台'],
  ['Admin User', '管理员用户'],
  ['Administrator', '管理员'],
  ['Sales Manager', '销售经理'],
  ['Customer Service', '客服专员'],
  ['Logistics Coordinator', '物流协调员'],
  ['Select Role', '选择角色'],
  ['Username or Email', '用户名或邮箱'],
  ['Forgot password?', '忘记密码？'],
  ['Please sign in to access your dashboard', '请登录以访问你的仪表盘'],
  ['Welcome Back', '欢迎回来'],
  ['Sign In', '登录'],
  ['Signing In...', '登录中...'],
  ['Need help?', '需要帮助？'],
  ['Contact Support', '联系支持'],
  ['Dashboard', '仪表盘'],
  ['Products', '商品'],
  ['Orders', '订单'],
  ['Customers', '客户'],
  ['Users', '用户'],
  ['Settings', '设置'],
  ['General', '通用'],
  ['Security', '安全'],
  ['Reports', '报表'],
  ['Inquiries', '询价'],
  ['Suppliers', '供应商'],
  ['Logistics', '物流'],
  ['Sourcing', '需求订单'],
  ['Inventory', '库存'],
  ['Analytics', '分析'],
  ['Overview', '概览'],
  ['Search orders, products...', '搜索订单、商品...'],
  ['Search inquiries...', '搜索询价...'],
  ['Search suppliers, orders, or SKUs...', '搜索供应商、订单或SKU...'],
  ['Search by SPU Name or SKU ID...', '按SPU名称或SKU编号搜索...'],
  ['Search by Order ID, Customer, or Product...', '按订单号、客户或商品搜索...'],
  ['Search Transaction ID, User, or Order #', '搜索交易号、用户或订单号'],
  ['Search customers, orders, reps...', '搜索客户、订单、销售代表...'],
  ['Export Report', '导出报表'],
  ['Export PDF', '导出 PDF'],
  ['Export', '导出'],
  ['Import', '导入'],
  ['New Task', '新建任务'],
  ['New Export', '新建导出任务'],
  ['Refresh', '刷新'],
  ['Save', '保存'],
  ['Save Changes', '保存更改'],
  ['Save Configuration', '保存配置'],
  ['Discard Changes', '放弃修改'],
  ['Business Operations', '业务运营'],
  ['Enable New User Registration', '启用新用户注册'],
  ['If disabled, only admins can create new accounts manually.', '关闭后，仅管理员可手动创建新账号。'],
  ['Allow Guest Checkout', '允许游客下单'],
  ['Customers can purchase without creating an account.', '客户无需创建账号即可购买。'],
  ['Default Pagination Limit', '默认分页条数'],
  ['20 items per page', '每页 20 条'],
  ['50 items per page', '每页 50 条'],
  ['100 items per page', '每页 100 条'],
  ['Applies to order and product lists.', '适用于订单和商品列表。'],
  ['Maintenance Mode', '维护模式'],
  ['System is Online', '系统在线'],
  ['Switch to Maintenance', '切换到维护模式'],
  ['Password Policy', '密码策略'],
  ['Require at least one special character', '至少包含一个特殊字符'],
  ['Require uppercase & lowercase', '必须同时包含大写和小写字母'],
  ['Enforce password rotation (90 days)', '强制密码轮换（90 天）'],
  ['Minimum Length', '最小长度'],
  ['Session Timeout (Minutes)', '会话超时时长（分钟）'],
  ['Automatic logout after inactivity.', '无操作时自动登出。'],
  ['2FA Enforcement', '双重验证策略'],
  ['Optional for all users', '对所有用户可选'],
  ['Mandatory for Admins', '管理员必须启用'],
  ['Mandatory for Everyone', '所有用户必须启用'],
  ['Admin Access IP Whitelist', '管理员访问 IP 白名单'],
  ['Add IP address...', '添加 IP 地址...'],
  ['Leave empty to allow access from any IP.', '留空则允许任意 IP 访问。'],
  ['Recent Configuration Changes', '最近配置变更'],
  ['Integrations', '集成'],
  ['Enabled', '已启用'],
  ['Updated', '已更新'],
  ['System', '系统'],
  ['Cancel', '取消'],
  ['Download', '下载'],
  ['Upload', '上传'],
  ['View All', '查看全部'],
  ['View all', '查看全部'],
  ['View Details', '查看详情'],
  ['View Full Profile', '查看完整资料'],
  ['View Full Audit Log', '查看完整审计日志'],
  ['View Import History', '查看导入历史'],
  ['View Risk Details', '查看风险详情'],
  ['Status', '状态'],
  ['Type', '类型'],
  ['Date', '日期'],
  ['Amount', '金额'],
  ['Action', '操作'],
  ['Actions', '操作'],
  ['Role-based Access', '基于角色的访问'],
  ['Manage Permissions', '管理权限'],
  ['System Overview', '系统概览'],
  ['Live Dashboard Summary', '实时仪表盘汇总'],
  ['All values are from backend endpoints in dev mode.', '所有数据均来自 Dev 模式后端接口。'],
  ['Recent Activity (Live)', '最近活动（实时）'],
  ['Recent Activity', '最近活动'],
  ['Action', '操作'],
  ['User', '用户'],
  ['Date', '日期'],
  ['Warnings', '告警'],
  ['Products', '商品'],
  ['Orders', '订单'],
  ['Pending Orders', '待处理订单'],
  ['Inquiries Total', '询价总数'],
  ['Inquiries Open', '开放询价'],
  ['Feature Flags', '功能开关'],
  ['Summary unavailable', '汇总不可用'],
  ['Summary endpoint failed.', '汇总接口调用失败。'],
  ['No live records available.', '暂无实时记录。'],
  ['Role-based Access', '基于角色的访问'],
  ['No dedicated RBAC analytics endpoint is wired for dashboard cards in dev mode.', 'Dev 模式下仪表盘卡片尚未接入专用 RBAC 分析接口。'],
  ['Pending Import Tasks', '待处理导入任务'],
  ['Use the Logistics page to query real import jobs by job ID.', '请在物流页面通过任务 ID 查询真实导入任务。'],
  ['Orders (Live)', '订单（实时）'],
  ['Dev mode renders only backend order data.', 'Dev 模式仅展示后端真实订单数据。'],
  ['Order List', '订单列表'],
  ['Order ID', '订单号'],
  ['Pending (Current Page)', '待处理（当前页）'],
  ['Delivered (Current Page)', '已送达（当前页）'],
  ['No orders found in backend.', '后端未找到订单数据。'],
  ['Showing', '显示'],
  ['orders from current page, total', '条当前页订单，总计'],
  ['Logistics Detail Panel', '物流详情面板'],
  ['No dedicated live logistics detail panel is wired for this page in dev mode.', 'Dev 模式下该页面尚未接入专用实时物流详情面板。'],
  ['Sourcing Inquiries (Live)', '需求订单询价（实时）'],
  ['Dev mode only shows backend inquiry records.', 'Dev 模式仅展示后端真实询价记录。'],
  ['Inquiry List', '询价列表'],
  ['Inquiry ID', '询价编号'],
  ['Message', '消息'],
  ['Created At', '创建时间'],
  ['Total Inquiries', '询价总数'],
  ['Open (Current Page)', '开放（当前页）'],
  ['Loaded Records', '已加载记录'],
  ['No inquiries found in backend.', '后端未找到询价数据。'],
  ['No message', '无消息'],
  ['Inquiry Detail Stream', '询价详情流'],
  ['No dedicated live detail thread endpoint is wired for this page in dev mode.', 'Dev 模式下该页面尚未接入专用实时详情流接口。'],
  ['Import Jobs (Live)', '导入任务（实时）'],
  ['Dev mode only keeps real backend import/export and feature-flag operations.', 'Dev 模式仅保留真实后端导入导出与功能开关操作。'],
  ['Import / Export Actions', '导入/导出操作'],
  ['Create jobs and query real backend job status.', '创建任务并查询真实后端任务状态。'],
  ['Product Import', '商品导入'],
  ['Shipment Import', '发货导入'],
  ['Request Export', '请求导出'],
  ['Import job UUID', '导入任务 UUID'],
  ['Query Job', '查询任务'],
  ['Save Flags', '保存开关'],
  ['Legacy Parsing Preview Removed', '旧版解析预览已移除'],
  ['Static parsing progress and fake candidate rows are hidden in dev mode. Use job APIs above for real progress.', 'Dev 模式下静态解析进度和模拟候选行已隐藏，请使用上方任务接口查看真实进度。'],
  ['Product Import Response', '商品导入响应'],
  ['Shipment Import Response', '发货导入响应'],
  ['Product Request Export Response', '商品请求导出响应'],
  ['Import Job Query', '导入任务查询'],
  ['Feature Flags Update', '功能开关更新'],
  ['Updated at', '更新时间'],
  ['Request Error', '请求错误'],
  ['Please input a job id.', '请输入任务 ID。'],
  ['Failed to load /orders', '加载 /orders 失败'],
  ['Failed to load /inquiries/price', '加载 /inquiries/price 失败'],
  ['Failed to load /bff/admin/summary', '加载 /bff/admin/summary 失败'],
  ['Failed to load /admin/config/feature-flags', '加载 /admin/config/feature-flags 失败'],
  ['System Audit Logs', '系统审计日志'],
  ['System Activity & Financials', '系统活动与财务'],
  ['Pending Import Tasks', '待处理导入任务'],
  ['Pending Orders', '待处理订单'],
  ['Completed Tasks', '已完成任务'],
  ['Need Help?', '需要帮助？'],
  ['Contact our support team for assistance with roles or imports.', '如需角色或导入相关帮助，请联系支持团队。'],
  ['Transactions', '交易'],
  ['Audit Logs', '审计日志'],
  ['Webhooks', 'Webhook'],
  ['Recent Transactions', '最近交易'],
  ['Audit Trail', '审计轨迹'],
  ['Daily Volume', '日交易量'],
  ['Failed Rate', '失败率'],
  ['In Progress', '进行中'],
  ['Completed Today', '今日完成'],
  ['Failed', '失败'],
  ['Recent Data Exports', '最近数据导出'],
  ['Task Name', '任务名称'],
  ['Date Initiated', '发起时间'],
  ['Ready', '就绪'],
  ['Processing', '处理中'],
  ['Expired', '已过期'],
  ['Requested by Admin', '管理员发起'],
  ['Generated by System', '系统生成'],
  ['Shipment Batch Imports', '发货批量导入'],
  ['Failed (Data Validation)', '失败（数据校验）'],
  ['Completed Successfully', '已成功完成'],
  ['Fix & Retry', '修复并重试'],
  ['Error Log', '错误日志'],
  ['Regenerate', '重新生成'],
  ['Showing', '显示'],
  ['results', '条结果'],
  ['Total', '总计'],
  ['Open', '打开'],
  ['Closed', '关闭'],
  ['Active', '启用'],
  ['Pending', '待处理'],
  ['Paid', '已支付'],
  ['Refunded', '已退款'],
  ['Success', '成功'],
  ['Unknown', '未知'],
  ['Request Error', '请求错误'],
  ['No live data available.', '暂无实时数据。'],
  ['Request failed. Please retry later.', '请求失败，请稍后重试。'],
  ['No data', '暂无数据'],
  ['No products found in backend.', '后端未返回商品数据。'],
  ['No orders found in backend.', '后端未返回订单数据。'],
  ['No inquiries found in backend.', '后端未返回询价数据。'],
  ['Please input a job id.', '请输入任务 ID。'],
  ['Login failed', '登录失败'],
  ['Please enter username and password.', '请输入用户名和密码。'],
  ['Dev mode currently supports Administrator login only.', 'Dev 模式当前仅支持管理员登录。'],
  ['Failed to load', '加载失败'],
  ['updated:', '更新时间：'],
  ['Warnings', '告警'],
  ['Support', '支持'],
  ['API Documentation', 'API 文档'],
  ['Server Status:', '服务状态：'],
  ['Operational', '运行正常'],
  ['All rights reserved.', '保留所有权利。']
];

const escapeRegExp = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const REPLACEMENTS = RAW_REPLACEMENTS
  .slice()
  .sort((a, b) => b[0].length - a[0].length)
  .map(([source, target]) => [new RegExp(escapeRegExp(source), 'g'), target]);

const hasEnglish = (value) => /[A-Za-z]/.test(value);

const translateValue = (value) => {
  if (!value || !hasEnglish(value)) {
    return value;
  }

  let translated = value;
  for (const [pattern, target] of REPLACEMENTS) {
    translated = translated.replace(pattern, target);
  }
  return translated;
};

const shouldSkipTextNode = (node) => {
  const parent = node.parentElement;
  if (!parent) {
    return true;
  }

  if (parent.closest('script, style, noscript, code, pre, textarea, .material-symbols-outlined, [data-i18n-skip="true"]')) {
    return true;
  }

  return false;
};

const translateTextNode = (node) => {
  if (shouldSkipTextNode(node)) {
    return;
  }
  const original = node.nodeValue;
  if (!original || !hasEnglish(original)) {
    return;
  }
  const translated = translateValue(original);
  if (translated !== original) {
    node.nodeValue = translated;
  }
};

const translateAttributes = (root) => {
  const element = root.nodeType === Node.ELEMENT_NODE ? root : null;
  const scope = element || document;
  const nodes = scope.querySelectorAll('[placeholder],[title],[aria-label],[alt]');
  nodes.forEach((node) => {
    ['placeholder', 'title', 'aria-label', 'alt'].forEach((attr) => {
      const raw = node.getAttribute(attr);
      if (!raw || !hasEnglish(raw)) {
        return;
      }
      const translated = translateValue(raw);
      if (translated !== raw) {
        node.setAttribute(attr, translated);
      }
    });
  });
};

const translateTree = (root) => {
  if (!root) {
    return;
  }

  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root);
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    translateTextNode(node);
    node = walker.nextNode();
  }

  translateAttributes(root);
};

let installed = false;
let scheduled = false;

const scheduleTranslate = () => {
  if (scheduled) {
    return;
  }
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    translateTree(document.body);
    if (document.title) {
      document.title = translateValue(document.title);
    }
  });
};

export const installZhLocalization = () => {
  if (installed) {
    scheduleTranslate();
    return;
  }
  installed = true;

  document.documentElement.lang = 'zh-CN';
  scheduleTranslate();

  const observer = new MutationObserver(() => {
    scheduleTranslate();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
};
