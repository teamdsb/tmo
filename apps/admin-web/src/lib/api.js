import {
  deleteCatalogCategoriesCategoryId,
  getCatalogCategories,
  getCatalogProducts,
  getInquiriesPrice,
  getOrders,
  getProductRequests,
  patchCatalogCategoriesCategoryId,
  postCatalogCategories,
  postCatalogProducts,
  postShipmentsImportJobs,
  setApiClientConfig
} from '@tmo/api-client';
import { getBffBootstrap, setGatewayApiClientConfig } from '@tmo/gateway-api-client';
import { getCustomers, postAuthPasswordLogin, setIdentityApiClientConfig } from '@tmo/identity-api-client';

import { apiBaseUrl, isDevMode } from './env';
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

const joinPath = (path) => {
  const base = (isDevMode ? apiBaseUrl || '/api' : '').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) {
    return normalizedPath;
  }
  return `${base}${normalizedPath}`;
};

export const requestRaw = async (path, options = {}) => {
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

  const response = await fetch(joinPath(path), init);
  return {
    status: response.status,
    data: await parseBody(response),
    headers: toHeaderRecord(response.headers)
  };
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

export const fetchProductRequests = async (params = {}) => {
  return getProductRequests(params);
};

export const createShipmentImportJob = async (excelFile) => {
  return postShipmentsImportJobs({ excelFile });
};

export const createAdminProductImportJob = async (excelFile, imagesZip) => {
  const form = new FormData();
  form.append('excelFile', excelFile);
  if (imagesZip) {
    form.append('imagesZip', imagesZip);
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

export const fetchAdminCustomers = async (params = {}) => {
  return requestRaw(`/admin/customers${buildQueryString(params)}`);
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
