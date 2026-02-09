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

const requestAuthUserCode = (): Promise<PhoneProofResult> => {
  return new Promise((resolve, reject) => {
    my.getAuthCode({
      scopes: 'auth_user',
      success: (res: { authCode?: string }) => {
        const code = typeof res.authCode === 'string' && res.authCode.trim() ? res.authCode.trim() : undefined
        if (!code) {
          reject(new Error('Alipay auth_user code missing'))
          return
        }
        resolve({ code, raw: res })
      },
      fail: reject
    })
  })
}

export const getPhoneNumber = async (): Promise<PhoneProofResult> => {
  if (typeof my.getPhoneNumber === 'function') {
    try {
      const fromPhoneAPI = await new Promise<PhoneProofResult>((resolve, reject) => {
        my.getPhoneNumber({
          success: (res: { response?: string; code?: string; mobile?: string; phoneNumber?: string }) => {
            const phone = typeof res.mobile === 'string' && res.mobile.trim()
              ? res.mobile.trim()
              : typeof res.phoneNumber === 'string' && res.phoneNumber.trim()
                ? res.phoneNumber.trim()
                : undefined
            const code = typeof res.code === 'string' && res.code.trim()
              ? res.code.trim()
              : typeof res.response === 'string' && res.response.trim()
                ? res.response.trim()
                : undefined
            if (!code && !phone) {
              reject(new Error('Alipay phone proof missing'))
              return
            }
            resolve({ code, phone, raw: res })
          },
          fail: reject
        })
      })
      return fromPhoneAPI
    } catch (error) {
      // Fallback to auth_user when getPhoneNumber fails in older runtimes.
      if (typeof error === 'object' && error !== null) {
        const errMsg = String((error as { errorMessage?: string; errMsg?: string }).errorMessage
          ?? (error as { errMsg?: string }).errMsg
          ?? '')
        if (errMsg.toLowerCase().includes('deny')) {
          throw Object.assign(new Error(errMsg || 'phone authorization denied'), { code: 'PHONE_AUTH_DENIED' })
        }
      }
    }
  }

  return requestAuthUserCode()
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

export const chooseFile = (options: ChooseFileOptions = {}): Promise<ChooseFileResult> => {
  return new Promise((resolve, reject) => {
    my.chooseFile({
      count: options.count,
      type: options.type ?? 'file',
      extension: options.extension,
      success: (res: { apFilePaths?: string[]; tempFiles?: Array<{ name?: string; path: string; size?: number; type?: string }> }) => {
        const files: ChooseFile[] = []
        if (Array.isArray(res.tempFiles)) {
          res.tempFiles.forEach((file) => {
            files.push({
              path: file.path,
              name: file.name,
              size: file.size,
              type: file.type
            })
          })
        } else if (Array.isArray(res.apFilePaths)) {
          res.apFilePaths.forEach((path) => files.push({ path }))
        }
        resolve({ files, raw: res })
      },
      fail: reject
    })
  })
}

export const uploadFile = (options: UploadFileOptions): Promise<UploadFileResult> => {
  return new Promise((resolve, reject) => {
    my.uploadFile({
      url: options.url,
      filePath: options.filePath,
      fileName: options.name,
      fileType: options.fileType,
      headers: options.headers,
      formData: options.formData,
      timeout: options.timeoutMs,
      success: (res: { statusCode: number; data: string; headers?: Record<string, string> }) => {
        resolve({ statusCode: res.statusCode, data: res.data, headers: res.headers, raw: res })
      },
      fail: reject
    })
  })
}

export const getStorage = async <T>(key: string): Promise<StorageGetResult<T>> => {
  return new Promise((resolve, reject) => {
    my.getStorage({
      key,
      success: (res: { data: T }) => resolve({ data: res.data, raw: res }),
      fail: (err: { errorMessage?: string }) => {
        if (err?.errorMessage?.includes('not found')) {
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
    my.setStorage({
      key,
      data,
      success: (res: unknown) => resolve({ raw: res }),
      fail: reject
    })
  })
}

export const removeStorage = async (key: string): Promise<StorageRemoveResult> => {
  return new Promise((resolve, reject) => {
    my.removeStorage({
      key,
      success: (res: unknown) => resolve({ raw: res }),
      fail: reject
    })
  })
}

export const clearStorage = async (): Promise<StorageClearResult> => {
  return new Promise((resolve, reject) => {
    my.clearStorage({
      success: (res: unknown) => resolve({ raw: res }),
      fail: reject
    })
  })
}
