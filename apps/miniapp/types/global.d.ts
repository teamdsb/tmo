/// <reference types="@tarojs/taro" />

declare module '*.png';
declare module '*.gif';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.css';
declare module '*.less';
declare module '*.scss';
declare module '*.sass';
declare module '*.styl';

declare const __TMO_API_BASE_URL__: string;
declare const __TMO_GATEWAY_BASE_URL__: string;
declare const __TMO_COMMERCE_BASE_URL__: string;
declare const __TMO_IDENTITY_BASE_URL__: string;
declare const __TMO_GATEWAY_DEV_TOKEN__: string;
declare const __TMO_COMMERCE_DEV_TOKEN__: string;
declare const __TMO_IDENTITY_DEV_TOKEN__: string;
declare const __TMO_MOCK_MODE__: string;
declare const __TMO_ENABLE_MOCK_LOGIN__: string;
declare const __TMO_WEAPP_PHONE_PROOF_SIMULATION__: string;

declare namespace NodeJS {
  interface ProcessEnv {
    /** NODE 内置环境变量, 会影响到最终构建生成产物 */
    NODE_ENV: 'development' | 'production',
    /** 当前构建的平台 */
    TARO_ENV: 'weapp' | 'swan' | 'alipay' | 'h5' | 'rn' | 'tt' | 'qq' | 'jd' | 'harmony' | 'jdrn'
    /**
     * 当前构建的小程序 appid
     * @description 若不同环境有不同的小程序，可通过在 env 文件中配置环境变量`TARO_APP_ID`来方便快速切换 appid， 而不必手动去修改 dist/project.config.json 文件
     * @see https://taro-docs.jd.com/docs/next/env-mode-config#特殊环境变量-taro_app_id
     */
    TARO_APP_ID: string
    TARO_APP_API_BASE_URL?: string
    TARO_APP_GATEWAY_BASE_URL?: string
    TARO_APP_GATEWAY_DEV_TOKEN?: string
    TARO_APP_COMMERCE_BASE_URL?: string
    TARO_APP_COMMERCE_DEV_TOKEN?: string
    TARO_APP_MOCK_MODE?: string
    TARO_APP_ENABLE_MOCK_LOGIN?: string
    TARO_APP_WEAPP_PHONE_PROOF_SIMULATION?: string
    TARO_APP_IDENTITY_BASE_URL?: string
    TARO_APP_IDENTITY_DEV_TOKEN?: string
  }
}
