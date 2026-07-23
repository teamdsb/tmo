import type {
  ChooseFile,
  ChooseFileOptions,
  ChooseFileResult,
  ChooseImageOptions,
  ChooseImageResult,
  LoginResult,
  PhoneProofResult,
  PayOptions,
  PayResult,
  RequestOptions,
  RequestResult,
  StorageClearResult,
  StorageGetResult,
  StorageRemoveResult,
  StorageSetResult,
  UploadFileOptions,
  UploadFileResult
} from '../types'

declare const wx: any

const TOURIST_APP_ID = 'touristappid'

const createTouristModeError = () => {
  const error = new Error('WeChat tourist mode is not supported for login')
  return Object.assign(error, { code: 'WEAPP_TOURIST_MODE_UNSUPPORTED' as const })
}

const createPhoneAuthError = (code: string, message: string) => {
  const error = new Error(message)
  return Object.assign(error, { code })
}

const isTouristMode = (): boolean => {
  try {
    const appId = wx.getAccountInfoSync?.()?.miniProgram?.appId
    return !appId || appId === TOURIST_APP_ID
  } catch {
    return false
  }
}

export const login = (): Promise<LoginResult> => {
  if (isTouristMode()) {
    return Promise.reject(createTouristModeError())
  }
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res: { code: string }) => resolve({ code: res.code, raw: res }),
      fail: reject
    })
  })
}

export const getPhoneNumber = (): Promise<PhoneProofResult> => {
  if (typeof wx.getPhoneNumber !== 'function') {
    return Promise.reject(createPhoneAuthError('WEAPP_GET_PHONE_UNSUPPORTED', 'WeChat getPhoneNumber is not supported'))
  }

  return new Promise((resolve, reject) => {
    wx.getPhoneNumber({
      success: (res: { code?: string; phoneNumber?: string }) => {
        const code = typeof res.code === 'string' && res.code.trim() ? res.code.trim() : undefined
        const phone = typeof res.phoneNumber === 'string' && res.phoneNumber.trim()
          ? res.phoneNumber.trim()
          : undefined

        if (!code && !phone) {
          reject(createPhoneAuthError('WEAPP_PHONE_PROOF_MISSING', 'WeChat phone proof missing'))
          return
        }

        resolve({ code, phone, raw: res })
      },
      fail: (err: { errMsg?: string }) => {
        if (err?.errMsg?.toLowerCase().includes('deny')) {
          reject(createPhoneAuthError('PHONE_AUTH_DENIED', err.errMsg))
          return
        }
        reject(err)
      }
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

export const chooseFile = (options: ChooseFileOptions = {}): Promise<ChooseFileResult> => {
  return new Promise((resolve, reject) => {
    wx.chooseMessageFile({
      count: options.count,
      type: options.type,
      extension: options.extension,
      success: (res: { tempFiles?: Array<{ name?: string; path: string; size?: number; type?: string }> }) => {
        const files: ChooseFile[] = (res.tempFiles ?? []).map((file) => ({
          path: file.path,
          name: file.name,
          size: file.size,
          type: file.type
        }))
        resolve({ files, raw: res })
      },
      fail: reject
    })
  })
}

export const uploadFile = (options: UploadFileOptions): Promise<UploadFileResult> => {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: options.url,
      filePath: options.filePath,
      name: options.name,
      header: options.headers,
      formData: options.formData,
      timeout: options.timeoutMs,
      success: (res: { statusCode: number; data: string; header?: Record<string, string> }) => {
        resolve({ statusCode: res.statusCode, data: res.data, headers: res.header, raw: res })
      },
      fail: reject
    })
  })
}

export const getStorage = async <T>(key: string): Promise<StorageGetResult<T>> => {
  return new Promise((resolve, reject) => {
    wx.getStorage({
      key,
      success: (res: { data: T }) => resolve({ data: res.data, raw: res }),
      fail: (err: { errMsg?: string }) => {
        if (err?.errMsg?.includes('data not found')) {
          resolve({ data: null, raw: err })
          return
        }
        reject(err)
      }
    })
  })
}

export const setStorage = async (key: string, data: unknown): Promise<StorageSetResult> => {
  return new Promise((resolve, reject) => {
    wx.setStorage({
      key,
      data,
      success: (res: unknown) => resolve({ raw: res }),
      fail: reject
    })
  })
}

export const removeStorage = async (key: string): Promise<StorageRemoveResult> => {
  return new Promise((resolve, reject) => {
    wx.removeStorage({
      key,
      success: (res: unknown) => resolve({ raw: res }),
      fail: reject
    })
  })
}

export const clearStorage = async (): Promise<StorageClearResult> => {
  return new Promise((resolve, reject) => {
    wx.clearStorage({
      success: (res: unknown) => resolve({ raw: res }),
      fail: reject
    })
  })
}
