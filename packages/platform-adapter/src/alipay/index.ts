import type {
  ChooseImageOptions,
  ChooseImageResult,
  LoginResult,
  PayOptions,
  PayResult,
  RequestOptions,
  RequestResult
} from '../types'

declare const my: any

export const login = (): Promise<LoginResult> => {
  return new Promise((resolve, reject) => {
    my.getAuthCode({
      scopes: 'auth_base',
      success: (res: { authCode: string }) => resolve({ code: res.authCode, raw: res }),
      fail: reject
    })
  })
}

export const request = async <T>(options: RequestOptions): Promise<RequestResult<T>> => {
  return new Promise((resolve, reject) => {
    my.request({
      url: options.url,
      method: options.method,
      data: options.data,
      headers: options.headers,
      timeout: options.timeoutMs,
      success: (res: { data: T; status: number; headers?: Record<string, string> }) => {
        resolve({ data: res.data, statusCode: res.status, headers: res.headers, raw: res })
      },
      fail: reject
    })
  })
}

export const pay = (options: PayOptions): Promise<PayResult> => {
  return new Promise((resolve, reject) => {
    my.tradePay({
      ...options.payload,
      success: (res: unknown) => resolve({ raw: res }),
      fail: reject
    })
  })
}

export const chooseImage = (options: ChooseImageOptions = {}): Promise<ChooseImageResult> => {
  return new Promise((resolve, reject) => {
    my.chooseImage({
      count: options.count,
      sizeType: options.sizeType,
      sourceType: options.sourceType,
      success: (res: { apFilePaths?: string[]; tempFilePaths?: string[] }) => {
        resolve({ tempFilePaths: res.apFilePaths ?? res.tempFilePaths ?? [], raw: res })
      },
      fail: reject
    })
  })
}
