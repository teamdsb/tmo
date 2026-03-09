import {
  deleteCatalogCategoriesCategoryId,
  getCatalogCategories,
  getCatalogProducts,
  getInquiriesPrice,
  getInquiriesPriceInquiryId,
  getInquiriesPriceInquiryIdMessages,
  getOrders,
  getProductRequests,
  patchCatalogCategoriesCategoryId,
  patchInquiriesPriceInquiryId,
  postCatalogCategories,
  postCatalogProducts,
  postInquiriesPriceInquiryIdMessages,
  postShipmentsImportJobs,
  setApiClientConfig
} from '@tmo/api-client';
import { getBffBootstrap, setGatewayApiClientConfig } from '@tmo/gateway-api-client';
import {
  getMe,
  getCustomers,
  getRbacPermissions,
  getRbacRoles,
  getStaff,
  patchStaffStaffId,
  postAuthPasswordLogin,
  putRbacRolesRolePermissions,
  setIdentityApiClientConfig
} from '@tmo/identity-api-client';

import { apiBaseUrl, isDevMode, paymentApiBaseUrl } from './env';
import { getAccessToken } from './state';

const toHeaderRecord = (headers) => {
  const record = {};
  if (!headers) {
    return record;
  }
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
};

const parseBody = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const requester = async (options) => {
  const headers = {
    ...(options.headers || {})
  };

  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const init = {
    method: options.method,
    headers
  };

  if (options.body !== undefined && options.body !== null) {
    init.body = options.body;
  }

  const response = await fetch(options.url, init);
  const data = await parseBody(response);
  return {
    status: response.status,
    data,
    headers: toHeaderRecord(response.headers)
  };
};

const baseUrl = isDevMode ? apiBaseUrl || '/api' : '';

setIdentityApiClientConfig({ baseUrl, requester });
setGatewayApiClientConfig({ baseUrl, requester });
setApiClientConfig({ baseUrl, requester });

const resolveBaseUrl = (value, fallback = '') => {
  return (isDevMode ? value || fallback : value || '').replace(/\/+$/, '');
};

const joinPath = (path, baseOverride = undefined) => {
  const base = resolveBaseUrl(baseOverride, '/api');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) {
    return normalizedPath;
  }
  return `${base}${normalizedPath}`;
};

const requestWithBase = async (path, options = {}, baseOverride = undefined) => {
  const headers = {
    ...(options.headers || {})
  };

  const useAuth = options.auth !== false;
  const token = getAccessToken();
  if (useAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const init = {
    method: options.method || 'GET',
    headers
  };

  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      init.body = options.body;
    } else if (typeof options.body === 'string') {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
      init.body = options.body;
    } else {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
      init.body = JSON.stringify(options.body);
    }
  }

  const response = await fetch(joinPath(path, baseOverride), init);
  return {
    status: response.status,
    data: await parseBody(response),
    headers: toHeaderRecord(response.headers)
  };
};

export const requestRaw = async (path, options = {}) => {
  return requestWithBase(path, options, apiBaseUrl);
};

export const requestPaymentRaw = async (path, options = {}) => {
  return requestWithBase(path, options, paymentApiBaseUrl);
};

export const passwordLogin = async (username, password, role) => {
  const payload = { username, password };
  if (role) {
    payload.role = role;
  }
  const response = await postAuthPasswordLogin(payload);
  return response;
};

export const bootstrap = async () => {
  return getBffBootstrap();
};

export const fetchMe = async () => {
  return getMe();
};

export const fetchProducts = async (params = {}) => {
  return getCatalogProducts(params);
};

export const createCatalogProduct = async (payload) => {
  return postCatalogProducts(payload);
};

export const fetchCatalogCategories = async () => {
  return getCatalogCategories();
};

export const createCatalogCategory = async (payload) => {
  return postCatalogCategories(payload);
};

export const updateCatalogCategory = async (categoryId, payload) => {
  return patchCatalogCategoriesCategoryId(categoryId, payload);
};

export const deleteCatalogCategory = async (categoryId) => {
  return deleteCatalogCategoriesCategoryId(categoryId);
};

export const fetchOrders = async (params = {}) => {
  return getOrders(params);
};

export const fetchInquiries = async (params = {}) => {
  return getInquiriesPrice(params);
};

export const fetchInquiryById = async (inquiryId) => {
  return getInquiriesPriceInquiryId(inquiryId);
};

export const fetchInquiryMessages = async (inquiryId, params = {}) => {
  return getInquiriesPriceInquiryIdMessages(inquiryId, params);
};

export const postInquiryMessage = async (inquiryId, payload) => {
  return postInquiriesPriceInquiryIdMessages(inquiryId, payload);
};

export const patchInquiry = async (inquiryId, payload) => {
  return patchInquiriesPriceInquiryId(inquiryId, payload);
};

export const fetchProductRequests = async (params = {}) => {
  return getProductRequests(params);
};

export const createShipmentImportJob = async (excelFile) => {
  return postShipmentsImportJobs({ excelFile });
};

export const createAdminProductImportJob = async (excelFile, imagesZip, imageBaseUrl) => {
  const form = new FormData();
  form.append('excelFile', excelFile);
  if (imagesZip) {
    form.append('imagesZip', imagesZip);
  }
  if (imageBaseUrl) {
    form.append('imageBaseUrl', imageBaseUrl);
  }
  return requestRaw('/admin/products/import-jobs', {
    method: 'POST',
    body: form
  });
};

export const createAdminProductRequestExportJob = async (payload = {}) => {
  return requestRaw('/admin/product-requests/export-jobs', {
    method: 'POST',
    body: payload
  });
};

export const getAdminImportJob = async (jobId) => {
  return requestRaw(`/admin/import-jobs/${jobId}`);
};

export const getFeatureFlags = async () => {
  return requestRaw('/admin/config/feature-flags');
};

export const patchFeatureFlags = async (payload) => {
  return requestRaw('/admin/config/feature-flags', {
    method: 'PATCH',
    body: payload
  });
};

export const fetchAdminSummary = async () => {
  return requestRaw('/bff/admin/summary');
};

export const fetchCustomers = async (params = {}) => {
  return getCustomers(params);
};

export const fetchStaffUsers = async (params = {}) => {
  return getStaff(params);
};

export const patchStaffRoles = async (staffId, roles) => {
  return patchStaffStaffId(staffId, {
    roles
  });
};

export const patchStaffStatus = async (staffId, status, disabledReason = undefined) => {
  return patchStaffStaffId(staffId, {
    status,
    disabledReason
  });
};

export const fetchRbacRoles = async () => {
  return getRbacRoles();
};

export const fetchRbacPermissions = async () => {
  return getRbacPermissions();
};

export const replaceRbacRolePermissions = async (roleCode, permissions) => {
  return putRbacRolesRolePermissions(roleCode, {
    permissions
  });
};

export const fetchMiniappDisplayCategories = async () => {
  return requestRaw('/admin/miniapp/display-categories');
};

export const replaceMiniappDisplayCategories = async (payload) => {
  return requestRaw('/admin/miniapp/display-categories', {
    method: 'PUT',
    body: payload
  });
};

const buildQueryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== '') {
          search.append(key, String(item));
        }
      });
      return;
    }
    search.append(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

export const fetchAdminSalesUsers = async (params = {}) => {
  return requestRaw(`/admin/sales-users${buildQueryString(params)}`);
};

export const fetchAdminUsers = async (params = {}) => {
  return requestRaw(`/admin/users${buildQueryString(params)}`);
};

export const patchAdminUser = async (userId, payload) => {
  return requestRaw(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: payload
  });
};

export const fetchAdminCustomers = async (params = {}) => {
  return requestRaw(`/admin/customers${buildQueryString(params)}`);
};

export const promoteAdminCustomerToSales = async (customerId) => {
  return requestRaw(`/admin/customers/${customerId}/promote-to-sales`, {
    method: 'POST',
    body: {}
  });
};

export const batchTransferCustomers = async (payload) => {
  return requestRaw('/admin/customers/transfer', {
    method: 'POST',
    body: payload
  });
};

export const fetchAdminCustomerTags = async (params = {}) => {
  return requestRaw(`/admin/customer-tags${buildQueryString(params)}`);
};

export const createAdminCustomerTag = async (payload) => {
  return requestRaw('/admin/customer-tags', {
    method: 'POST',
    body: payload
  });
};

export const patchAdminCustomerTag = async (tagId, payload) => {
  return requestRaw(`/admin/customer-tags/${tagId}`, {
    method: 'PATCH',
    body: payload
  });
};

export const batchUpdateCustomerTags = async (payload) => {
  return requestRaw('/admin/customers/tags:batch-update', {
    method: 'POST',
    body: payload
  });
};

export const getAdminCustomerFinanceProfile = async (customerId) => {
  return requestRaw(`/admin/customers/${customerId}/finance-profile`);
};

export const patchAdminCustomerFinanceProfile = async (customerId, paymentTermRemark) => {
  return requestRaw(`/admin/customers/${customerId}/finance-profile`, {
    method: 'PATCH',
    body: {
      paymentTermRemark
    }
  });
};

export const fetchAdminInquiryRequirementProfile = async (inquiryId) => {
  return requestRaw(`/admin/inquiries/${inquiryId}/requirement-profile`);
};

export const fetchAdminSuppliers = async (params = {}) => {
  return requestRaw(`/admin/suppliers${buildQueryString(params)}`);
};

export const fetchAdminSupplierById = async (supplierId) => {
  return requestRaw(`/admin/suppliers/${supplierId}`);
};

export const patchAdminSupplierById = async (supplierId, payload) => {
  return requestRaw(`/admin/suppliers/${supplierId}`, {
    method: 'PATCH',
    body: payload
  });
};

export const fetchAdminSupplierContacts = async (supplierId) => {
  return requestRaw(`/admin/suppliers/${supplierId}/contacts`);
};

export const fetchAdminSupplierScorecards = async (supplierId) => {
  return requestRaw(`/admin/suppliers/${supplierId}/scorecards`);
};

export const fetchAdminPaymentTransactions = async (params = {}) => {
  return requestPaymentRaw(`/admin/payments/transactions${buildQueryString(params)}`);
};

export const fetchAdminPaymentTransaction = async (transactionId) => {
  return requestPaymentRaw(`/admin/payments/transactions/${transactionId}`);
};

export const fetchAdminPaymentAuditLogs = async (params = {}) => {
  return requestPaymentRaw(`/admin/payments/audit-logs${buildQueryString(params)}`);
};

export const fetchAdminPaymentWebhooks = async (params = {}) => {
  return requestPaymentRaw(`/admin/payments/webhooks${buildQueryString(params)}`);
};

export const replayAdminPaymentWebhook = async (webhookId) => {
  return requestPaymentRaw(`/admin/payments/webhooks/${webhookId}/replay`, {
    method: 'POST',
    body: {}
  });
};
