import {
  getInquiriesPrice,
  getInquiriesPriceInquiryId,
  getInquiriesPriceInquiryIdMessages,
  patchInquiriesPriceInquiryId,
  postInquiriesPrice,
  postInquiriesPriceInquiryIdMessages,
  type CreateInquiryMessage,
  type CreatePriceInquiry,
  type GetInquiriesPriceInquiryIdMessagesParams,
  type GetInquiriesPriceParams,
  type InquiryMessage,
  type PagedInquiryMessageList,
  type PagedPriceInquiryList,
  type PriceInquiry,
  type UpdatePriceInquiryRequest
} from '@tmo/api-client'

export interface InquiryService {
  list: (params?: GetInquiriesPriceParams) => Promise<PagedPriceInquiryList>
  create: (payload: CreatePriceInquiry) => Promise<PriceInquiry>
  get: (inquiryId: string) => Promise<PriceInquiry>
  update: (inquiryId: string, payload: UpdatePriceInquiryRequest) => Promise<PriceInquiry>
  listMessages: (inquiryId: string, params?: GetInquiriesPriceInquiryIdMessagesParams) => Promise<PagedInquiryMessageList>
  postMessage: (inquiryId: string, payload: CreateInquiryMessage) => Promise<InquiryMessage>
}

export const createInquiryService = (): InquiryService => {
  return {
    list: async (params) => (await getInquiriesPrice(params)).data,
    create: async (payload) => (await postInquiriesPrice(payload)).data,
    get: async (inquiryId) => (await getInquiriesPriceInquiryId(inquiryId)).data,
    update: async (inquiryId, payload) => (await patchInquiriesPriceInquiryId(inquiryId, payload)).data,
    listMessages: async (inquiryId, params) => (await getInquiriesPriceInquiryIdMessages(inquiryId, params)).data,
    postMessage: async (inquiryId, payload) => (await postInquiriesPriceInquiryIdMessages(inquiryId, payload)).data
  }
}
