import {
  getAfterSalesTickets,
  getAfterSalesTicketsTicketId,
  getAfterSalesTicketsTicketIdMessages,
  patchAfterSalesTicketsTicketId,
  postAfterSalesTickets,
  postAfterSalesTicketsTicketIdMessages,
  type AfterSalesMessage,
  type AfterSalesTicket,
  type CreateAfterSalesTicket,
  type CreateTicketMessage,
  type GetAfterSalesTicketsParams,
  type GetAfterSalesTicketsTicketIdMessagesParams,
  type PagedAfterSalesMessageList,
  type PagedAfterSalesTicketList,
  type UpdateAfterSalesTicketRequest
} from '@tmo/api-client'

export interface AfterSalesService {
  listTickets: (params?: GetAfterSalesTicketsParams) => Promise<PagedAfterSalesTicketList>
  createTicket: (payload: CreateAfterSalesTicket) => Promise<AfterSalesTicket>
  getTicket: (ticketId: string) => Promise<AfterSalesTicket>
  updateTicket: (ticketId: string, payload: UpdateAfterSalesTicketRequest) => Promise<AfterSalesTicket>
  listMessages: (ticketId: string, params?: GetAfterSalesTicketsTicketIdMessagesParams) => Promise<PagedAfterSalesMessageList>
  postMessage: (ticketId: string, payload: CreateTicketMessage) => Promise<AfterSalesMessage>
}

export const createAfterSalesService = (): AfterSalesService => {
  return {
    listTickets: async (params) => (await getAfterSalesTickets(params)).data,
    createTicket: async (payload) => (await postAfterSalesTickets(payload)).data,
    getTicket: async (ticketId) => (await getAfterSalesTicketsTicketId(ticketId)).data,
    updateTicket: async (ticketId, payload) => (await patchAfterSalesTicketsTicketId(ticketId, payload)).data,
    listMessages: async (ticketId, params) => (await getAfterSalesTicketsTicketIdMessages(ticketId, params)).data,
    postMessage: async (ticketId, payload) => (await postAfterSalesTicketsTicketIdMessages(ticketId, payload)).data
  }
}
