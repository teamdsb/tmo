export type PolicyKey = 'privacy' | 'terms' | 'data'

export const POLICY_CONTENT: Record<PolicyKey, { title: string; body: string }> = {
  privacy: {
    title: '隐私政策',
    body: '我们会在登录、下单、收货与售后流程中处理账号信息、角色信息、订单与地址数据，用于完成身份识别、履约协同与客户服务。你可以通过退出登录、清除缓存或联系支持团队处理本地留存信息。'
  },
  terms: {
    title: '服务条款',
    body: '账号需按真实业务身份使用；询价、下单、支付与售后流程应遵守平台规则与企业采购约定。业务员工作台、Mock 调试能力及测试环境仅用于授权账号，不作为正式交易依据。'
  },
  data: {
    title: '数据说明',
    body: '小程序会本地缓存登录态、Bootstrap 信息与部分设置项。Mock 模式使用离线模拟数据，不访问真实后端；Real 模式会读取当前配置的接口环境。重置或清除缓存后，部分页面状态需要重新拉取。'
  }
}

export const isPolicyKey = (value: unknown): value is PolicyKey => (
  value === 'privacy' || value === 'terms' || value === 'data'
)
