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
