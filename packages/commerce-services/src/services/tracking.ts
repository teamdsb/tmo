import {
  getOrdersOrderIdTracking,
  postOrdersOrderIdTracking,
  type ImportJob,
  type TrackingInfo,
  type UpdateTrackingRequest
} from '@tmo/api-client'

import type { UploadClient } from '../uploads'

export interface TrackingService {
  getTracking: (orderId: string) => Promise<TrackingInfo>
  updateTracking: (orderId: string, request: UpdateTrackingRequest) => Promise<TrackingInfo>
  uploadShipmentImportExcel: (filePath: string) => Promise<ImportJob>
}

export const createTrackingService = (uploadClient: UploadClient): TrackingService => {
  return {
    getTracking: async (orderId) => (await getOrdersOrderIdTracking(orderId)).data,
    updateTracking: async (orderId, request) => (await postOrdersOrderIdTracking(orderId, request)).data,
    uploadShipmentImportExcel: async (filePath) => {
      return uploadClient.upload<ImportJob>('/shipments/import-jobs', filePath, 'excelFile')
    }
  }
}
