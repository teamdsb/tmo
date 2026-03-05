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
import { getCustomers, postAuthPasswordLogin, setIdentityApiClientConfig } from '@tmo/identity-api-client';

import { apiBaseUrl, isDevMode } from './env';
import { getAccessToken } from './state';

// 将 Headers 实例转换成普通对象，便于上层统一读取。
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

// 统一解析响应体：优先 JSON，失败时回退为纯文本。
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

// 给 codegen client 注入通用 requester（含 Bearer token）。
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

// 在 dev 模式下拼接 /api 前缀；mock 模式保持原始路径。
const joinPath = (path) => {
  const base = (isDevMode ? apiBaseUrl || '/api' : '').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) {
    return normalizedPath;
  }
  return `${base}${normalizedPath}`;
};

// 原生请求兜底：用于尚未进入 codegen 的接口或 multipart 请求。
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

// admin-web 密码登录（支持多角色二次选择）。
export const passwordLogin = async (username, password, role) => {
  const payload = { username, password };
  if (role) {
    payload.role = role;
  }
  const response = await postAuthPasswordLogin(payload);
  return response;
};

// 拉取 bootstrap（me / permissions / featureFlags 聚合）。
export const bootstrap = async () => {
  return getBffBootstrap();
};

// 商品列表查询。
export const fetchProducts = async (params = {}) => {
  return getCatalogProducts(params);
};

// 创建商品。
export const createCatalogProduct = async (payload) => {
  return postCatalogProducts(payload);
};

// 查询商品分类。
export const fetchCatalogCategories = async () => {
  return getCatalogCategories();
};

// 创建商品分类。
export const createCatalogCategory = async (payload) => {
  return postCatalogCategories(payload);
};

// 更新商品分类。
export const updateCatalogCategory = async (categoryId, payload) => {
  return patchCatalogCategoriesCategoryId(categoryId, payload);
};

// 删除商品分类。
export const deleteCatalogCategory = async (categoryId) => {
  return deleteCatalogCategoriesCategoryId(categoryId);
};

// 订单列表查询。
export const fetchOrders = async (params = {}) => {
  return getOrders(params);
};

// 询价会话列表查询。
export const fetchInquiries = async (params = {}) => {
  return getInquiriesPrice(params);
};

// 查询单条询价会话详情。
export const fetchInquiryById = async (inquiryId) => {
  return getInquiriesPriceInquiryId(inquiryId);
};

// 查询询价会话消息流。
export const fetchInquiryMessages = async (inquiryId, params = {}) => {
  return getInquiriesPriceInquiryIdMessages(inquiryId, params);
};

// 发送询价会话消息。
export const postInquiryMessage = async (inquiryId, payload) => {
  return postInquiriesPriceInquiryIdMessages(inquiryId, payload);
};

// 更新询价会话状态或备注。
export const patchInquiry = async (inquiryId, payload) => {
  return patchInquiriesPriceInquiryId(inquiryId, payload);
};

// 查询商品需求单列表。
export const fetchProductRequests = async (params = {}) => {
  return getProductRequests(params);
};

// 物流导入任务创建。
export const createShipmentImportJob = async (excelFile) => {
  return postShipmentsImportJobs({ excelFile });
};

// 商品导入任务创建（支持 Excel + 图片压缩包）。
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

// 商品需求导出任务创建。
export const createAdminProductRequestExportJob = async (payload = {}) => {
  return requestRaw('/admin/product-requests/export-jobs', {
    method: 'POST',
    body: payload
  });
};

// 查询导入/导出任务状态。
export const getAdminImportJob = async (jobId) => {
  return requestRaw(`/admin/import-jobs/${jobId}`);
};

// 查询 feature flags。
export const getFeatureFlags = async () => {
  return requestRaw('/admin/config/feature-flags');
};

// 更新 feature flags。
export const patchFeatureFlags = async (payload) => {
  return requestRaw('/admin/config/feature-flags', {
    method: 'PATCH',
    body: payload
  });
};

// 后台首页聚合指标查询。
export const fetchAdminSummary = async () => {
  return requestRaw('/bff/admin/summary');
};

// 客户列表查询（identity 域）。
export const fetchCustomers = async (params = {}) => {
  return getCustomers(params);
};

// 小程序展示分类查询。
export const fetchMiniappDisplayCategories = async () => {
  return requestRaw('/admin/miniapp/display-categories');
};

// 小程序展示分类全量替换。
export const replaceMiniappDisplayCategories = async (payload) => {
  return requestRaw('/admin/miniapp/display-categories', {
    method: 'PUT',
    body: payload
  });
};

// 构建 query string，过滤空值并支持数组参数。
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

// 查询业务员列表（用于客户转移）。
export const fetchAdminSalesUsers = async (params = {}) => {
  return requestRaw(`/admin/sales-users${buildQueryString(params)}`);
};

// 查询客户列表（管理视角）。
export const fetchAdminCustomers = async (params = {}) => {
  return requestRaw(`/admin/customers${buildQueryString(params)}`);
};

// 批量转移客户归属。
export const batchTransferCustomers = async (payload) => {
  return requestRaw('/admin/customers/transfer', {
    method: 'POST',
    body: payload
  });
};

// 查询客户标签列表。
export const fetchAdminCustomerTags = async (params = {}) => {
  return requestRaw(`/admin/customer-tags${buildQueryString(params)}`);
};

// 创建客户标签。
export const createAdminCustomerTag = async (payload) => {
  return requestRaw('/admin/customer-tags', {
    method: 'POST',
    body: payload
  });
};

// 更新客户标签（启用/停用等）。
export const patchAdminCustomerTag = async (tagId, payload) => {
  return requestRaw(`/admin/customer-tags/${tagId}`, {
    method: 'PATCH',
    body: payload
  });
};

// 批量更新客户标签绑定关系。
export const batchUpdateCustomerTags = async (payload) => {
  return requestRaw('/admin/customers/tags:batch-update', {
    method: 'POST',
    body: payload
  });
};

// 查询客户财务档案（账期备注）。
export const getAdminCustomerFinanceProfile = async (customerId) => {
  return requestRaw(`/admin/customers/${customerId}/finance-profile`);
};

// 更新客户财务档案（账期备注）。
export const patchAdminCustomerFinanceProfile = async (customerId, paymentTermRemark) => {
  return requestRaw(`/admin/customers/${customerId}/finance-profile`, {
    method: 'PATCH',
    body: {
      paymentTermRemark
    }
  });
};
