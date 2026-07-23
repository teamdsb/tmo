import { Platform } from '@tmo/shared/enums'

import type {
  ChooseFileOptions,
  ChooseFile,
  ChooseFileResult,
  ChooseImageOptions,
  ChooseImageResult,
  LoginResult,
  PhoneProofResult,
  PayOptions,
  PayResult,
  RequestMethod,
  RequestOptions,
  RequestResult,
  StorageClearResult,
  StorageGetResult,
  StorageRemoveResult,
  StorageSetResult,
  UploadFileOptions,
  UploadFileResult
} from './types'
import * as alipay from './alipay'
import * as weapp from './weapp'

declare const wx: any
declare const my: any

export const getPlatform = (): Platform => {
  if (typeof wx !== 'undefined' && typeof wx.login === 'function') {
    return Platform.Weapp
  }
  if (typeof my !== 'undefined' && typeof my.getAuthCode === 'function') {
    return Platform.Alipay
  }
  return Platform.Unknown
}

export const isWeapp = (): boolean => getPlatform() === Platform.Weapp

export const isAlipay = (): boolean => getPlatform() === Platform.Alipay

export const login = (): Promise<LoginResult> => {
  switch (getPlatform()) {
    case Platform.Weapp:
      return weapp.login()
    case Platform.Alipay:
      return alipay.login()
    default:
      return Promise.reject(new Error('login is not supported on this platform'))
  }
}

export const getPhoneNumber = (): Promise<PhoneProofResult> => {
  switch (getPlatform()) {
    case Platform.Weapp:
      return weapp.getPhoneNumber()
    case Platform.Alipay:
      return alipay.getPhoneNumber()
    default:
      return Promise.reject(new Error('getPhoneNumber is not supported on this platform'))
  }
}

export const request = async <T>(options: RequestOptions): Promise<RequestResult<T>> => {
  switch (getPlatform()) {
    case Platform.Weapp:
      return weapp.request<T>(options)
    case Platform.Alipay:
      return alipay.request<T>(options)
    default:
      return Promise.reject(new Error('request is not supported on this platform'))
  }
}

export const pay = async (options: PayOptions): Promise<PayResult> => {
  switch (getPlatform()) {
    case Platform.Weapp:
      return weapp.pay(options)
    case Platform.Alipay:
      return alipay.pay(options)
    default:
      return Promise.reject(new Error('pay is not supported on this platform'))
  }
}

export const chooseImage = async (options?: ChooseImageOptions): Promise<ChooseImageResult> => {
  switch (getPlatform()) {
    case Platform.Weapp:
      return weapp.chooseImage(options)
    case Platform.Alipay:
      return alipay.chooseImage(options)
    default:
      return Promise.reject(new Error('chooseImage is not supported on this platform'))
  }
}

export const chooseFile = async (options?: ChooseFileOptions): Promise<ChooseFileResult> => {
  switch (getPlatform()) {
    case Platform.Weapp:
      return weapp.chooseFile(options)
    case Platform.Alipay:
      return alipay.chooseFile(options)
    default:
      return Promise.reject(new Error('chooseFile is not supported on this platform'))
  }
}

export const uploadFile = async (options: UploadFileOptions): Promise<UploadFileResult> => {
  switch (getPlatform()) {
    case Platform.Weapp:
      return weapp.uploadFile(options)
    case Platform.Alipay:
      return alipay.uploadFile(options)
    default:
      return Promise.reject(new Error('uploadFile is not supported on this platform'))
  }
}

export const getStorage = async <T>(key: string): Promise<StorageGetResult<T>> => {
  switch (getPlatform()) {
    case Platform.Weapp:
      return weapp.getStorage<T>(key)
    case Platform.Alipay:
      return alipay.getStorage<T>(key)
    default:
      return Promise.reject(new Error('getStorage is not supported on this platform'))
  }
}

export const setStorage = async (key: string, data: unknown): Promise<StorageSetResult> => {
  switch (getPlatform()) {
    case Platform.Weapp:
      return weapp.setStorage(key, data)
    case Platform.Alipay:
      return alipay.setStorage(key, data)
    default:
      return Promise.reject(new Error('setStorage is not supported on this platform'))
  }
}

export const removeStorage = async (key: string): Promise<StorageRemoveResult> => {
  switch (getPlatform()) {
    case Platform.Weapp:
      return weapp.removeStorage(key)
    case Platform.Alipay:
      return alipay.removeStorage(key)
    default:
      return Promise.reject(new Error('removeStorage is not supported on this platform'))
  }
}

export const clearStorage = async (): Promise<StorageClearResult> => {
  switch (getPlatform()) {
    case Platform.Weapp:
      return weapp.clearStorage()
    case Platform.Alipay:
      return alipay.clearStorage()
    default:
      return Promise.reject(new Error('clearStorage is not supported on this platform'))
  }
}

export type {
  ChooseFileOptions,
  ChooseFile,
  ChooseFileResult,
  ChooseImageOptions,
  ChooseImageResult,
  LoginResult,
  PhoneProofResult,
  PayOptions,
  PayResult,
  RequestMethod,
  RequestOptions,
  RequestResult,
  StorageClearResult,
  StorageGetResult,
  StorageRemoveResult,
  StorageSetResult,
  UploadFileOptions,
  UploadFileResult
}
