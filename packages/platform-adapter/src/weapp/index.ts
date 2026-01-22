import type {
  ChooseImageOptions,
  ChooseImageResult,
  LoginResult,
  PayOptions,
  PayResult,
  RequestOptions,
  RequestResult
} from '../types'

declare const wx: any

export const login = (): Promise<LoginResult> => {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res: { code: string }) => resolve({ code: res.code, raw: res }),
      fail: reject
    })
  })
}

export const request = async <T>(options: RequestOptions): Promise<RequestResult<T>> => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: options.url,
      method: options.method,
      data: options.data,
      header: options.headers,
      timeout: options.timeoutMs,
      success: (res: { data: T; statusCode: number; header?: Record<string, string> }) => {
        resolve({ data: res.data, statusCode: res.statusCode, headers: res.header, raw: res })
      },
      fail: reject
    })
  })
}

export const pay = (options: PayOptions): Promise<PayResult> => {
  return new Promise((resolve, reject) => {
    wx.requestPayment({
      ...options.payload,
      success: (res: unknown) => resolve({ raw: res }),
      fail: reject
    })
  })
}

export const chooseImage = (options: ChooseImageOptions = {}): Promise<ChooseImageResult> => {
  return new Promise((resolve, reject) => {
    wx.chooseImage({
      count: options.count,
      sizeType: options.sizeType,
      sourceType: options.sourceType,
      success: (res: { tempFilePaths: string[] }) => {
        resolve({ tempFilePaths: res.tempFilePaths, raw: res })
      },
      fail: reject
    })
  })
}
