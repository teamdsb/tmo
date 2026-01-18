import { Platform } from '@tmo/shared/enums'

import type { ChooseImageOptions, ChooseImageResult, LoginResult, PayOptions, PayResult, RequestOptions, RequestResult } from './types'
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

export type {
  ChooseImageOptions,
  ChooseImageResult,
  LoginResult,
  PayOptions,
  PayResult,
  RequestOptions,
  RequestResult
}
