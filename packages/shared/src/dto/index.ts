export interface ApiError {
  code: string
  message: string
  detail?: string
}

export interface PagedResponse<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export interface IdName {
  id: string
  name: string
}

// Integer fen amount (1/100 yuan) for prices.
export type MoneyFen = number
