import JSZip from 'jszip';
import * as XLSX from 'xlsx';

const MOCK_IMPORTED_PRODUCTS_STORAGE_KEY = 'admin-web-mock-imported-products';
const MOCK_IMPORT_JOBS_STORAGE_KEY = 'admin-web-mock-import-jobs';
const PRODUCT_REQUEST_EXPORT_FILE_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const PRODUCT_IMPORT_COLUMNS = [
  'groupkey',
  'skucode',
  'productname',
  'skuname',
  'categoryid',
  'description',
  'coverimage',
  'images',
  'tags',
  'filterdimensions',
  'spec',
  'attributes',
  'unit',
  'isactive',
  'pricetiers'
];

const REQUIRED_COLUMNS = ['groupkey', 'productname', 'categoryid'];
const PRODUCT_REQUEST_EXPORT_HEADERS = [
  '需求ID',
  '提交人ID',
  '归属销售ID',
  '商品名称',
  '类目ID',
  '规格',
  '材质',
  '尺寸',
  '颜色',
  '数量',
  '备注',
  '参考图片URLs',
  '创建时间',
  '更新时间'
];

const IMAGE_MIME_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml'
};

const readJson = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
};

const normalizeHeaderKey = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
};

const normalizeText = (value) => String(value || '').trim();

const splitMultiValue = (value) => {
  const raw = normalizeText(value);
  if (!raw) {
    return [];
  }
  const separator = raw.includes('|') ? '|' : raw.includes(',') ? ',' : '|';
  return raw
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeNullableString = (value) => {
  const normalized = normalizeText(value);
  return normalized || null;
};

const normalizeModelCode = (value, fallback = 'MOCK-SKU') => {
  const code = normalizeText(value)
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9\-_]/g, '');
  return code || fallback;
};

const normalizeArchiveKey = (value) => {
  return normalizeText(value)
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .toLowerCase();
};

const looksLikeUrl = (value) => /^https?:\/\//i.test(normalizeText(value));

const parseBoolDefaultTrue = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized || ['1', 'true', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n'].includes(normalized)) {
    return false;
  }
  throw new Error('isActive must be one of true/false/1/0/yes/no');
};

const parseAttributes = (value) => {
  const result = {};
  for (const item of splitMultiValue(value)) {
    const [key, rawValue] = item.split(':');
    const normalizedKey = normalizeText(key);
    const normalizedValue = normalizeText(rawValue);
    if (!normalizedKey || !normalizedValue) {
      throw new Error('attributes must use key:value pairs');
    }
    if (result[normalizedKey]) {
      throw new Error(`duplicate attribute key "${normalizedKey}"`);
    }
    result[normalizedKey] = normalizedValue;
  }
  return result;
};

const parsePriceTiers = (value) => {
  const items = splitMultiValue(value);
  if (items.length === 0) {
    return [];
  }

  const tiers = items.map((item) => {
    const [rangePart, pricePart] = item.split(':');
    if (!rangePart || !pricePart) {
      throw new Error('priceTiers must use range:price format');
    }

    const normalizedPrice = Number.parseInt(normalizeText(pricePart), 10);
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
      throw new Error('priceTiers price must be a non-negative integer fen value');
    }

    const normalizedRange = normalizeText(rangePart);
    let minQty = 0;
    let maxQty = null;
    if (normalizedRange.includes('-')) {
      const [rawMin, rawMax] = normalizedRange.split('-');
      minQty = Number.parseInt(normalizeText(rawMin), 10);
      if (!Number.isFinite(minQty) || minQty <= 0) {
        throw new Error('priceTiers range must use positive integer quantities');
      }
      const nextMax = normalizeText(rawMax);
      if (nextMax) {
        maxQty = Number.parseInt(nextMax, 10);
        if (!Number.isFinite(maxQty) || maxQty < minQty) {
          throw new Error('priceTiers maxQty must be >= minQty');
        }
      }
    } else {
      minQty = Number.parseInt(normalizedRange, 10);
      if (!Number.isFinite(minQty) || minQty <= 0) {
        throw new Error('priceTiers range must use positive integer quantities');
      }
    }

    return {
      minQty,
      maxQty,
      unitPriceFen: normalizedPrice
    };
  });

  tiers.sort((left, right) => left.minQty - right.minQty);
  return tiers;
};

const tierPricingFromPriceTiers = (tiers) => {
  if (!Array.isArray(tiers) || tiers.length < 2) {
    return [];
  }
  const basePriceFen = Number(tiers[0]?.unitPriceFen || 0);
  if (!Number.isFinite(basePriceFen) || basePriceFen <= 0) {
    return [];
  }
  return tiers.slice(1).map((tier) => {
    const discountRate = Math.max(1, Math.min(89, Math.round(((basePriceFen - tier.unitPriceFen) / basePriceFen) * 100)));
    return {
      minQty: tier.minQty,
      discountRate
    };
  });
};

const mimeTypeForFileName = (fileName) => {
  const ext = normalizeText(fileName).split('.').pop()?.toLowerCase() || '';
  return IMAGE_MIME_BY_EXT[ext] || 'application/octet-stream';
};

const bytesToDataUrl = (bytes, fileName) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return `data:${mimeTypeForFileName(fileName)};base64,${btoa(binary)}`;
};

const loadZipIndex = async (imagesZipFile) => {
  if (!imagesZipFile) {
    return new Map();
  }
  const zip = await JSZip.loadAsync(await imagesZipFile.arrayBuffer());
  const index = new Map();
  Object.values(zip.files).forEach((entry) => {
    if (entry.dir) {
      return;
    }
    const normalized = normalizeArchiveKey(entry.name);
    index.set(normalized, entry);
    const baseName = normalizeArchiveKey(entry.name.split('/').pop() || entry.name);
    if (!index.has(baseName)) {
      index.set(baseName, entry);
    }
  });
  return index;
};

const resolveImageRef = async (ref, imageBaseUrl, zipIndex) => {
  const normalized = normalizeText(ref);
  if (!normalized) {
    return null;
  }
  if (looksLikeUrl(normalized)) {
    return normalized;
  }
  if (normalizeText(imageBaseUrl)) {
    return new URL(normalized.replace(/^\/+/, ''), `${normalizeText(imageBaseUrl).replace(/\/+$/, '')}/`).toString();
  }
  const key = normalizeArchiveKey(normalized);
  const zipEntry = zipIndex.get(key) || zipIndex.get(normalizeArchiveKey(normalized.split('/').pop() || normalized));
  if (!zipEntry) {
    throw new Error(`image "${normalized}" was not found in imagesZip`);
  }
  const bytes = await zipEntry.async('uint8array');
  return bytesToDataUrl(bytes, zipEntry.name);
};

const workbookRowsFromFile = async (excelFile) => {
  const workbook = XLSX.read(await excelFile.arrayBuffer(), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('empty workbook');
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('empty worksheet');
  }
  return rows;
};

const parseWorkbook = async (excelFile, imagesZipFile, imageBaseUrl) => {
  const rows = await workbookRowsFromFile(excelFile);
  const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
  const headerIndex = new Map();
  headerRow.forEach((header, index) => {
    const key = normalizeHeaderKey(header);
    if (key) {
      headerIndex.set(key, index);
    }
  });

  const missingHeaders = REQUIRED_COLUMNS.filter((key) => !headerIndex.has(key));
  if (missingHeaders.length > 0) {
    throw new Error(`missing required headers: ${missingHeaders.join(', ')}`);
  }

  const zipIndex = await loadZipIndex(imagesZipFile);
  const states = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    const joined = row.map((item) => normalizeText(item)).join('');
    if (!joined) {
      continue;
    }

    const cellValue = (key) => {
      const index = headerIndex.get(key);
      if (index === undefined) {
        return '';
      }
      return normalizeText(row[index]);
    };

    const state = {
      rowNumber: rowIndex + 1,
      groupKey: cellValue('groupkey'),
      skuCode: cellValue('skucode'),
      productName: cellValue('productname'),
      skuName: cellValue('skuname') || cellValue('productname'),
      categoryId: cellValue('categoryid'),
      description: normalizeNullableString(cellValue('description')),
      coverImage: cellValue('coverimage'),
      images: splitMultiValue(cellValue('images')),
      tags: splitMultiValue(cellValue('tags')),
      filterDimensions: splitMultiValue(cellValue('filterdimensions')),
      spec: normalizeNullableString(cellValue('spec')),
      unit: normalizeNullableString(cellValue('unit')),
      rawValues: Object.fromEntries(PRODUCT_IMPORT_COLUMNS.map((key) => [key, cellValue(key)])),
      error: ''
    };

    try {
      if (!state.groupKey) {
        throw new Error('groupKey is required');
      }
      if (!state.productName) {
        throw new Error('productName is required');
      }
      if (!state.skuName) {
        throw new Error('skuName is required');
      }
      if (!state.categoryId) {
        throw new Error('categoryId is required');
      }

      const attributes = parseAttributes(cellValue('attributes'));
      if (!state.spec && attributes.spec) {
        state.spec = attributes.spec;
        delete attributes.spec;
      }
      state.attributes = attributes;
      state.isActive = parseBoolDefaultTrue(cellValue('isactive'));
      state.priceTiers = parsePriceTiers(cellValue('pricetiers'));
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
    }

    states.push(state);
  }

  if (states.length === 0) {
    throw new Error('no data rows found');
  }

  const groups = new Map();
  for (const state of states) {
    if (state.error) {
      continue;
    }
    if (!groups.has(state.groupKey)) {
      groups.set(state.groupKey, []);
    }
    groups.get(state.groupKey).push(state);
  }

  const products = [];
  for (const groupRows of groups.values()) {
    const firstRow = groupRows[0];
    const seenSkuCodes = new Set();
    let groupMessage = '';
    for (const row of groupRows) {
      if (row.skuCode && seenSkuCodes.has(row.skuCode)) {
        groupMessage = `duplicate skuCode "${row.skuCode}" in the same group`;
        break;
      }
      if (row.skuCode) {
        seenSkuCodes.add(row.skuCode);
      }
      if (
        row.productName !== firstRow.productName ||
        row.categoryId !== firstRow.categoryId ||
        row.description !== firstRow.description ||
        row.coverImage !== firstRow.coverImage ||
        JSON.stringify(row.images) !== JSON.stringify(firstRow.images) ||
        JSON.stringify(row.tags) !== JSON.stringify(firstRow.tags) ||
        JSON.stringify(row.filterDimensions) !== JSON.stringify(firstRow.filterDimensions)
      ) {
        groupMessage = 'rows in the same groupKey must share identical product-level fields';
        break;
      }
    }

    if (groupMessage) {
      groupRows.forEach((row) => {
        row.error = groupMessage;
      });
      continue;
    }

    try {
      const resolvedImages = [];
      for (const ref of firstRow.images) {
        const value = await resolveImageRef(ref, imageBaseUrl, zipIndex);
        if (value && !resolvedImages.includes(value)) {
          resolvedImages.push(value);
        }
      }

      let coverImageUrl = null;
      if (firstRow.coverImage) {
        coverImageUrl = await resolveImageRef(firstRow.coverImage, imageBaseUrl, zipIndex);
      }
      if (!coverImageUrl && resolvedImages.length > 0) {
        coverImageUrl = resolvedImages[0];
      }
      if (coverImageUrl && !resolvedImages.includes(coverImageUrl)) {
        resolvedImages.unshift(coverImageUrl);
      }

      const models = groupRows.map((row, index) => ({
        name: row.skuName,
        code: normalizeModelCode(row.skuCode, `${normalizeModelCode(row.groupKey, 'MOCK')}-${index + 1}`),
        basePrice: Number(((row.priceTiers[0]?.unitPriceFen || 0) / 100).toFixed(2))
      }));

      products.push({
        id: `mock-import-${normalizeModelCode(firstRow.groupKey, 'GROUP')}`,
        name: firstRow.productName,
        categoryId: firstRow.categoryId,
        description: firstRow.description || '',
        coverImageUrl: coverImageUrl || '',
        images: resolvedImages,
        tags: firstRow.tags,
        filterDimensions: firstRow.filterDimensions,
        status: groupRows.every((row) => row.isActive === false) ? 'INACTIVE' : 'ACTIVE',
        inventory: 0,
        models,
        tierPricing: tierPricingFromPriceTiers(firstRow.priceTiers),
        importedAt: new Date().toISOString()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      groupRows.forEach((row) => {
        row.error = message;
      });
    }
  }

  const failedRows = states.filter((row) => row.error);
  return {
    products,
    failedRows,
    totalRows: states.length,
    successRows: states.length - failedRows.length,
    failedCount: failedRows.length
  };
};

export const parseMockProductImport = async ({ excelFile, imagesZipFile, imageBaseUrl }) => {
  return parseWorkbook(excelFile, imagesZipFile, imageBaseUrl);
};

export const loadImportedMockProducts = () => {
  const stored = readJson(MOCK_IMPORTED_PRODUCTS_STORAGE_KEY);
  return Array.isArray(stored) ? stored : [];
};

export const upsertImportedMockProducts = (incomingProducts) => {
  const current = loadImportedMockProducts();
  const next = [...current];

  for (const incoming of Array.isArray(incomingProducts) ? incomingProducts : []) {
    const incomingCodes = new Set(
      (Array.isArray(incoming?.models) ? incoming.models : [])
        .map((model, index) => normalizeModelCode(model?.code, `${incoming?.id || 'IMPORT'}-${index + 1}`))
    );

    const existingIndex = next.findIndex((item) => {
      return (Array.isArray(item?.models) ? item.models : []).some((model, index) => (
        incomingCodes.has(normalizeModelCode(model?.code, `${item?.id || 'IMPORT'}-${index + 1}`))
      ));
    });

    if (existingIndex >= 0) {
      const existing = next[existingIndex];
      next[existingIndex] = {
        ...existing,
        ...incoming,
        id: existing.id || incoming.id
      };
      continue;
    }

    next.unshift(incoming);
  }

  writeJson(MOCK_IMPORTED_PRODUCTS_STORAGE_KEY, next);
  return next;
};

export const loadMockProductImportJobs = () => {
  const stored = readJson(MOCK_IMPORT_JOBS_STORAGE_KEY);
  return Array.isArray(stored) ? stored : [];
};

export const saveMockProductImportJob = (job) => {
  const jobs = loadMockProductImportJobs();
  const nextJobs = [job, ...jobs.filter((item) => item?.id !== job?.id)].slice(0, 30);
  writeJson(MOCK_IMPORT_JOBS_STORAGE_KEY, nextJobs);
  return nextJobs;
};

export const getMockProductImportJob = (jobId) => {
  return loadMockProductImportJobs().find((item) => item?.id === jobId) || null;
};

const buildMockProductRequestExportRows = () => {
  const timestamp = new Date().toISOString();
  return [
    [
      'mock-request-001',
      'mock-customer-001',
      'mock-sales-001',
      '高精度铝合金支架',
      'mock-category-metal',
      '6061-T6',
      '铝合金',
      '120x40x8mm',
      '银色',
      '200 件',
      '用于打样报价',
      'https://example.com/mock-request-001-a.png | https://example.com/mock-request-001-b.png',
      timestamp,
      timestamp
    ],
    [
      'mock-request-002',
      'mock-customer-002',
      '',
      '注塑外壳',
      'mock-category-plastic',
      'ABS',
      'ABS',
      '180x90x35mm',
      '黑色',
      '500 件',
      '需要开模建议',
      '',
      timestamp,
      timestamp
    ]
  ];
};

const buildMockProductRequestExportFileUrl = () => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    PRODUCT_REQUEST_EXPORT_HEADERS,
    ...buildMockProductRequestExportRows()
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, '需求导出');
  const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
  return `data:${PRODUCT_REQUEST_EXPORT_FILE_MIME};base64,${base64}`;
};

export const advanceMockProductImportJob = (jobId) => {
  const current = getMockProductImportJob(jobId);
  if (!current) {
    return null;
  }
  if (current.type !== 'PRODUCT_REQUEST_EXPORT' || !['PENDING', 'RUNNING'].includes(current.status)) {
    return current;
  }

  const nextPollCount = Number(current.mockPollCount || 0) + 1;
  const nextJob = nextPollCount >= 2
    ? {
        ...current,
        status: 'SUCCEEDED',
        progress: 100,
        resultFileUrl: buildMockProductRequestExportFileUrl(),
        details: {
          exportedRows: 2,
          note: 'Mock 模式已生成需求导出 Excel 文件。'
        },
        mockPollCount: nextPollCount
      }
    : {
        ...current,
        status: 'RUNNING',
        progress: Math.max(Number(current.progress) || 0, 55),
        details: {
          note: 'Mock 模式正在生成需求导出文件。'
        },
        mockPollCount: nextPollCount
      };
  saveMockProductImportJob(nextJob);
  return nextJob;
};
