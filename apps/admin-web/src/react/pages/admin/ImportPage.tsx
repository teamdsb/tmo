import { useEffect, useMemo, useState } from 'react';

import { AdminTopbar } from '../../layout/AdminTopbar';
import {
  createAdminProductImportJob,
  createAdminProductRequestExportJob,
  createShipmentImportJob,
  getAdminImportJob,
  getFeatureFlags,
  patchFeatureFlags
} from '../../../lib/api';
import { ensureProtectedPage } from '../../../lib/guard';
import { hasPermission, normalizePermissionMap } from '../../../lib/permissions';
import {
  advanceMockProductImportJob,
  downloadProductImportTemplate,
  getMockProductImportJob,
  parseMockProductImport,
  saveMockProductImportJob,
  upsertImportedMockProducts
} from '../../../lib/product-import';

type PageContext = {
  mode: 'dev' | 'mock';
  session?: {
    permissions?: {
      items?: Array<{ code?: string; scope?: string }>;
    };
  };
} | null;

type ImportJobView = {
  id: string;
  type: string;
  status: string;
  progress: number;
  createdAt?: string;
  resultFileUrl?: string | null;
  errorReportUrl?: string | null;
  details?: Record<string, unknown>;
};

type FeatureFlagsState = {
  paymentEnabled: boolean;
  wechatPayEnabled: boolean;
  wechatB2bEnabled: boolean;
  alipayPayEnabled: boolean;
};

type ProductImportTemplateField = {
  header: string;
  label: string;
  level: '必填' | '建议' | '可选';
  description: string;
  example: string;
};

const defaultFlags: FeatureFlagsState = {
  paymentEnabled: false,
  wechatPayEnabled: false,
  wechatB2bEnabled: false,
  alipayPayEnabled: false
};

const statusToneClass: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
  RUNNING: 'bg-blue-50 text-blue-700 border border-blue-200',
  SUCCEEDED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 border border-rose-200'
};

const productImportTemplateFields: ProductImportTemplateField[] = [
  {
    header: 'Group Key',
    label: '商品分组键',
    level: '必填',
    description: '同一商品下的所有 SKU 填写相同值，用于把多行聚合成一个商品。',
    example: 'P-FASTENER-001'
  },
  {
    header: 'Product Name',
    label: '商品名称',
    level: '必填',
    description: '商品在目录和详情页展示的名称；同一 Group Key 必须保持一致。',
    example: '内六角圆柱头螺钉'
  },
  {
    header: 'Category ID',
    label: '分类 ID',
    level: '可选',
    description: '填写已有分类 UUID；留空表示未分类。',
    example: '11111111-1111-1111-1111-111111111111'
  },
  {
    header: 'SKU Code',
    label: 'SKU 编码',
    level: '建议',
    description: '每个 SKU 的稳定唯一编码；再次导入相同编码时会更新原 SKU。',
    example: 'SKU-M6-20'
  },
  {
    header: 'SKU Name',
    label: 'SKU 名称',
    level: '建议',
    description: '规格选项的展示名称；留空时使用商品名称。',
    example: 'M6×20mm 镀锌'
  },
  {
    header: 'Spec',
    label: '旧版规格文本',
    level: '建议',
    description: '兼容旧版；新版按层级值自动生成完整路径。与新版列同时填写时必须一致。',
    example: 'M6×20mm'
  },
  {
    header: 'Unit',
    label: '计量单位',
    level: '建议',
    description: 'SKU 的采购或销售计量单位。',
    example: '个'
  },
  {
    header: 'Is Active',
    label: 'SKU 是否启用',
    level: '建议',
    description: '支持 true/false、1/0、yes/no；留空默认启用。',
    example: 'true'
  },
  {
    header: 'Description',
    label: '商品说明',
    level: '可选',
    description: '商品级说明；同一 Group Key 的每行必须填写一致。',
    example: '钢制 8.8 级，全牙'
  },
  {
    header: 'Cover Image',
    label: '商品主图',
    level: '可选',
    description: '图片 URL，或图片 ZIP 内的文件路径。',
    example: 'images/main.png'
  },
  {
    header: 'Images',
    label: '商品图片',
    level: '可选',
    description: '推荐 JSON 字符串数组，兼容竖线 | 分隔，最多 9 张。',
    example: 'images/main.png|images/detail.png'
  },
  {
    header: 'Tags',
    label: '商品标签',
    level: '可选',
    description: '推荐 JSON 字符串数组，兼容竖线 | 分隔。',
    example: '紧固件|镀锌'
  },
  {
    header: 'Filter Dimensions',
    label: '筛选维度',
    level: '可选',
    description: '兼容旧版的有序层级名称，最多三级；与新版名称列同时填写时必须一致。',
    example: '材质|直径|长度'
  },
  {
    header: 'Attributes',
    label: '扩展属性',
    level: '可选',
    description: '推荐填写 JSON 对象以保留特殊字符；也兼容“属性名:属性值”，多个属性用竖线 | 分隔。',
    example: '材质:304不锈钢|长度:20mm'
  },
  {
    header: 'Price Tiers (Fen)',
    label: '阶梯价格（分）',
    level: '可选',
    description: '格式为“数量范围:单价分”，多档用竖线 | 分隔；留空表示暂无价格，更新已有 SKU 时会清除原阶梯价。',
    example: '1-9:1200|10-:1000'
  }
];

productImportTemplateFields.splice(1, 0,
  { header: 'Product ID', label: '商品 ID', level: '可选', description: '导出后保留原 ID，回导优先定位原商品；新建时留空。', example: '' },
  { header: 'SKU ID', label: 'SKU ID', level: '可选', description: '导出后保留原 ID；新建规格时留空。', example: '' },
  { header: 'Product Status', label: '商品状态', level: '可选', description: 'DRAFT、ACTIVE 或 INACTIVE；留空时新商品为草稿，已有商品保留状态。', example: 'DRAFT' },
  ...[1, 2, 3].flatMap((level): ProductImportTemplateField[] => [
    { header: `Spec ${level} Name`, label: `第 ${level} 级名称`, level: '建议', description: '同一商品所有行保持名称和顺序一致；二、三级可留空，不允许跳级。', example: ['材质', '长度', '直径'][level - 1] },
    { header: `Spec ${level} Value`, label: `第 ${level} 级值`, level: '建议', description: '填写当前 SKU 在该层级的值；启用的完整规格组合不得重复。', example: ['不锈钢', '20mm', 'M6'][level - 1] }
  ])
);

const templateFieldLevelClass: Record<ProductImportTemplateField['level'], string> = {
  必填: 'border-rose-200 bg-rose-50 text-rose-700',
  建议: 'border-blue-200 bg-blue-50 text-blue-700',
  可选: 'border-slate-200 bg-slate-100 text-slate-600'
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
};

const buildMockJobId = (prefix: string) => {
  return `mock-${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 100000).toString(36)}`;
};

const renderJson = (value: unknown) => {
  return JSON.stringify(value, null, 2);
};

export const ImportPage = () => {
  const [context, setContext] = useState<PageContext>(null);
  const [ready, setReady] = useState(false);
  const [productExcelFile, setProductExcelFile] = useState<File | null>(null);
  const [productImagesZip, setProductImagesZip] = useState<File | null>(null);
  const [shipmentExcelFile, setShipmentExcelFile] = useState<File | null>(null);
  const [imageBaseUrl, setImageBaseUrl] = useState('');
  const [queryJobId, setQueryJobId] = useState('');
  const [latestJob, setLatestJob] = useState<ImportJobView | null>(null);
  const [latestResponse, setLatestResponse] = useState<unknown>(null);
  const [flags, setFlags] = useState<FeatureFlagsState>(defaultFlags);
  const [flagsLoaded, setFlagsLoaded] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void ensureProtectedPage().then((resolved) => {
      if (cancelled) {
        return;
      }
      setContext((resolved || null) as PageContext);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const permissionMap = useMemo(() => normalizePermissionMap(context?.session?.permissions), [context?.session?.permissions]);
  const canProductImport = hasPermission(permissionMap, 'import:product', 'SELF');
  const canShipmentImport = hasPermission(permissionMap, 'import:shipment', 'SELF');
  const canRequestExport = hasPermission(permissionMap, 'product_request:export', 'SELF');
  const canManageFlags = hasPermission(permissionMap, 'config:feature_flags', 'ALL');

  useEffect(() => {
    if (!context || context.mode !== 'dev' || !canManageFlags) {
      setFlagsLoaded(true);
      return;
    }

    let cancelled = false;
    void getFeatureFlags().then((response) => {
      if (cancelled) {
        return;
      }
      if (response.status === 200 && response.data) {
        setFlags({
          paymentEnabled: Boolean((response.data as FeatureFlagsState).paymentEnabled),
          wechatPayEnabled: Boolean((response.data as FeatureFlagsState).wechatPayEnabled),
          wechatB2bEnabled: Boolean((response.data as FeatureFlagsState).wechatB2bEnabled),
          alipayPayEnabled: Boolean((response.data as FeatureFlagsState).alipayPayEnabled)
        });
      }
      setFlagsLoaded(true);
    }).catch(() => {
      if (!cancelled) {
        setFlagsLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [context, canManageFlags]);

  useEffect(() => {
    if (!context || !latestJob?.id || !['PENDING', 'RUNNING'].includes(latestJob.status)) {
      return;
    }

    let cancelled = false;
    let requestInFlight = false;
    const timer = window.setInterval(() => {
      if (context.mode === 'mock') {
        const nextJob = advanceMockProductImportJob(latestJob.id);
        if (cancelled || !nextJob) {
          return;
        }
        setLatestJob(nextJob as ImportJobView);
        setLatestResponse(nextJob);
        if (!['PENDING', 'RUNNING'].includes(String(nextJob.status || ''))) {
          window.clearInterval(timer);
        }
        return;
      }

      if (requestInFlight) {
        return;
      }
      requestInFlight = true;
      void getAdminImportJob(latestJob.id).then((response) => {
        if (cancelled) {
          return;
        }
        if (response.status === 200 && response.data) {
          setLatestJob(response.data as ImportJobView);
          setLatestResponse(response.data);
          const nextStatus = String((response.data as ImportJobView).status || '');
          if (!['PENDING', 'RUNNING'].includes(nextStatus)) {
            window.clearInterval(timer);
          }
        }
      }).catch(() => {
        if (!cancelled) {
          window.clearInterval(timer);
        }
      }).finally(() => {
        requestInFlight = false;
      });
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [context, latestJob?.id, latestJob?.status]);

  if (!ready) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <p className="text-sm text-slate-500">正在加载导入工作台...</p>
      </main>
    );
  }

  if (!context) {
    return <main className="flex-1" />;
  }

  const resetMessages = () => {
    setStatusMessage('');
    setErrorMessage('');
  };

  const handleProductImport = async () => {
    if (!productExcelFile) {
      setErrorMessage('请选择商品 Excel 文件。');
      return;
    }
    resetMessages();
    setSubmittingAction('product-import');

    try {
      if (context.mode === 'mock') {
        const runningJob: ImportJobView = {
          id: buildMockJobId('product'),
          type: 'PRODUCT_IMPORT',
          status: 'RUNNING',
          progress: 15,
          createdAt: new Date().toISOString()
        };
        setLatestJob(runningJob);
        setLatestResponse(runningJob);
        saveMockProductImportJob(runningJob);

        const parsed = await parseMockProductImport({
          excelFile: productExcelFile,
          imagesZipFile: productImagesZip,
          imageBaseUrl
        });
        const persisted = upsertImportedMockProducts(parsed.products);
        const completedJob: ImportJobView = {
          ...runningJob,
          status: 'SUCCEEDED',
          progress: 100,
          details: {
            totalRows: parsed.totalRows,
            successRows: parsed.successRows,
            failedRows: parsed.failedCount,
            importedProducts: parsed.products.map((item) => item.name),
            persistedProductCount: persisted.length,
            failedRowsPreview: parsed.failedRows.slice(0, 10)
          }
        };
        setLatestJob(completedJob);
        setLatestResponse(completedJob);
        saveMockProductImportJob(completedJob);
        setStatusMessage(`Mock 导入完成：成功 ${parsed.successRows} 行，失败 ${parsed.failedCount} 行。商品页已写入本地导入结果。`);
        return;
      }

      const response = await createAdminProductImportJob(productExcelFile, productImagesZip, imageBaseUrl.trim());
      setLatestResponse(response.data || response);
      if (response.status !== 202 || !response.data) {
        setErrorMessage(`商品导入提交失败（HTTP ${response.status}）。`);
        return;
      }
      setLatestJob(response.data as ImportJobView);
      setStatusMessage('商品导入任务已创建，页面会自动轮询任务状态。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleShipmentImport = async () => {
    if (!shipmentExcelFile) {
      setErrorMessage('请选择物流 Excel 文件。');
      return;
    }
    resetMessages();
    setSubmittingAction('shipment-import');
    try {
      if (context.mode === 'mock') {
        const mockJob: ImportJobView = {
          id: buildMockJobId('shipment'),
          type: 'SHIPMENT_IMPORT',
          status: 'SUCCEEDED',
          progress: 100,
          createdAt: new Date().toISOString(),
          details: {
            note: 'Mock 模式下仅模拟创建物流导入任务，不会写入真实订单。'
          }
        };
        setLatestJob(mockJob);
        setLatestResponse(mockJob);
        saveMockProductImportJob(mockJob);
        setStatusMessage('Mock 模式已模拟物流导入任务。');
        return;
      }

      const response = await createShipmentImportJob(shipmentExcelFile);
      setLatestResponse(response.data || response);
      if (response.status !== 202 || !response.data) {
        setErrorMessage(`物流导入提交失败（HTTP ${response.status}）。`);
        return;
      }
      setLatestJob(response.data as ImportJobView);
      setStatusMessage('物流导入任务已创建。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleRequestExport = async () => {
    resetMessages();
    setSubmittingAction('request-export');
    try {
      if (context.mode === 'mock') {
        const mockJob: ImportJobView & { mockPollCount: number } = {
          id: buildMockJobId('request-export'),
          type: 'PRODUCT_REQUEST_EXPORT',
          status: 'PENDING',
          progress: 0,
          createdAt: new Date().toISOString(),
          mockPollCount: 0
        };
        setLatestJob(mockJob);
        setLatestResponse(mockJob);
        saveMockProductImportJob(mockJob);
        setStatusMessage('Mock 需求导出任务已创建，页面会自动轮询任务状态。');
        return;
      }

      const response = await createAdminProductRequestExportJob({});
      setLatestResponse(response.data || response);
      if (response.status !== 202 || !response.data) {
        setErrorMessage(`需求导出提交失败（HTTP ${response.status}）。`);
        return;
      }
      setLatestJob(response.data as ImportJobView);
      setStatusMessage('需求导出任务已创建，页面会自动轮询任务状态。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleQueryJob = async () => {
    if (!queryJobId.trim()) {
      setErrorMessage('请输入任务 ID。');
      return;
    }
    resetMessages();
    setSubmittingAction('query-job');
    try {
      if (context.mode === 'mock') {
        const job = advanceMockProductImportJob(queryJobId.trim()) || getMockProductImportJob(queryJobId.trim());
        if (!job) {
          setErrorMessage('未找到该 mock 任务。');
          return;
        }
        setLatestJob(job as ImportJobView);
        setLatestResponse(job);
        setStatusMessage('已加载本地 mock 任务。');
        return;
      }

      const response = await getAdminImportJob(queryJobId.trim());
      setLatestResponse(response.data || response);
      if (response.status !== 200 || !response.data) {
        setErrorMessage(`查询任务失败（HTTP ${response.status}）。`);
        return;
      }
      setLatestJob(response.data as ImportJobView);
      setStatusMessage('已刷新导入任务状态。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleSaveFlags = async () => {
    resetMessages();
    setSubmittingAction('save-flags');
    try {
      const response = await patchFeatureFlags(flags);
      setLatestResponse(response.data || response);
      if (response.status !== 200) {
        setErrorMessage(`保存功能开关失败（HTTP ${response.status}）。`);
        return;
      }
      setStatusMessage('功能开关已更新。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmittingAction(null);
    }
  };

  const jobToneClass = statusToneClass[String(latestJob?.status || '').toUpperCase()] || 'bg-slate-100 text-slate-700 border border-slate-200';
  const resultFileLabel = ['PRODUCT_REQUEST_EXPORT', 'PRODUCT_EXPORT'].includes(latestJob?.type || '') ? '下载导出文件' : '下载结果摘要';

  return (
    <>
      <AdminTopbar
        searchPlaceholder="搜索导入任务..."
        leftSlot={
          <div className="flex items-center gap-4 text-slate-900 dark:text-white">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">upload_file</span>
            </div>
            <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">导入与导出</h2>
          </div>
        }
      />

      <main className="flex-1 mx-auto w-full max-w-[1440px] px-6 py-8 md:px-10" data-testid="import-page">
        <div className="grid gap-6 xl:grid-cols-[1.35fr_minmax(320px,0.9fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Import Jobs</p>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">商品 Excel 导入工作台</h1>
                </div>
                <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
                  <div className="text-slate-300">当前模式</div>
                  <div className="mt-1 text-lg font-semibold">{context.mode === 'dev' ? '生产环境' : '演示环境'}</div>
                </div>
              </div>

              {(statusMessage || errorMessage) ? (
                <div className="mt-5 space-y-3">
                  {statusMessage ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" data-testid="import-status-message">
                      {statusMessage}
                    </div>
                  ) : null}
                  {errorMessage ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" data-testid="import-error-message">
                      {errorMessage}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">商品导入</h2>
                  <p className="mt-1 text-sm text-slate-500">上传符合下方模板要求的 Excel，系统按“一行一个 SKU”导入商品和规格。</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${canProductImport ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {canProductImport ? '可执行' : '无权限'}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">商品 Excel（仅 .xlsx）</span>
                  <input
                    accept=".xlsx"
                    className="block w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    data-testid="product-import-excel"
                    onChange={(event) => setProductExcelFile(event.target.files?.[0] || null)}
                    type="file"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">图片 ZIP（可选）</span>
                  <input
                    accept=".zip"
                    className="block w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    data-testid="product-import-zip"
                    onChange={(event) => setProductImagesZip(event.target.files?.[0] || null)}
                    type="file"
                  />
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Image Base URL（可选）</span>
                <input
                  className="block w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  data-testid="product-import-image-base-url"
                  onChange={(event) => setImageBaseUrl(event.target.value)}
                  placeholder="https://cdn.example.com/catalog/"
                  value={imageBaseUrl}
                />
              </label>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200" data-testid="product-import-template-guide">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Excel 模板要求</h3>
                      <p className="mt-1 text-sm text-slate-600">系统只读取第一张工作表。第一行必须使用下表中的英文表头，第二行开始填写商品数据。</p>
                    </div>
                    <button type="button" data-testid="download-product-template" onClick={downloadProductImportTemplate} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">下载新版 Excel 模板</button>
                  </div>
                </div>

                <div className="space-y-5 px-5 py-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-xs font-semibold text-slate-400">01</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">同一商品使用相同分组键</div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">同一商品的全部 SKU 使用相同 <code className="font-mono text-slate-800">Group Key</code>。</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-xs font-semibold text-slate-400">02</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">商品级字段保持一致</div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">同组的名称、状态、分类、说明、图片、标签和规格层级必须完全一致。</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-xs font-semibold text-slate-400">03</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">图片需要可访问</div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">本地图片随 ZIP 上传；线上图片可填写完整 URL 或配合 Image Base URL。</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    <span className="font-semibold">必填表头：</span>
                    <code className="ml-1 font-mono">Group Key</code>、<code className="font-mono">Product Name</code>、<code className="font-mono">Category ID</code>。
                    分类值可留空；商品 ID 可替代分组键。某行无效时整个商品组回滚。导出文件保留 ID 后可直接修改回导，文件未包含的 SKU 保留。无 SKU 商品保留空 SKU 行。
                  </div>

                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">字段说明</h4>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {(['必填', '建议', '可选'] as const).map((level) => (
                          <span className={`rounded-full border px-2.5 py-1 font-semibold ${templateFieldLevelClass[level]}`} key={level}>{level}</span>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-[860px] w-full border-collapse text-left text-sm">
                        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Excel 表头</th>
                            <th className="px-4 py-3 font-semibold">中文含义</th>
                            <th className="px-4 py-3 font-semibold">填写说明</th>
                            <th className="px-4 py-3 font-semibold">示例</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {productImportTemplateFields.map((field) => (
                            <tr className="align-top" key={field.header}>
                              <td className="whitespace-nowrap px-4 py-3">
                                <code className="font-mono font-semibold text-slate-900">{field.header}</code>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <div className="font-medium text-slate-800">{field.label}</div>
                                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${templateFieldLevelClass[field.level]}`}>{field.level}</span>
                              </td>
                              <td className="max-w-[360px] px-4 py-3 leading-5 text-slate-600">{field.description}</td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <code className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">{field.example}</code>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                    <span className="font-semibold">格式提醒：</span>多个标签、图片、筛选维度、属性或价格档位统一使用竖线 <code className="font-mono">|</code> 分隔；价格单位是“分”，例如 <code className="font-mono">1200</code> 表示 ¥12.00。
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="product-import-submit"
                  disabled={!canProductImport || submittingAction === 'product-import'}
                  onClick={() => {
                    void handleProductImport();
                  }}
                  type="button"
                >
                  {submittingAction === 'product-import' ? '提交中...' : '创建商品导入任务'}
                </button>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">物流导入</h2>
                    <p className="mt-1 text-sm text-slate-500">继续保留现有 real 物流导入入口，mock 模式只模拟任务创建。</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${canShipmentImport ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {canShipmentImport ? '可执行' : '无权限'}
                  </span>
                </div>

                <label className="mt-5 block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">物流 Excel</span>
                  <input
                    accept=".xls,.xlsx"
                    className="block w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    onChange={(event) => setShipmentExcelFile(event.target.files?.[0] || null)}
                    type="file"
                  />
                </label>

                <button
                  className="mt-5 inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canShipmentImport || submittingAction === 'shipment-import'}
                  onClick={() => {
                    void handleShipmentImport();
                  }}
                  type="button"
                >
                  {submittingAction === 'shipment-import' ? '提交中...' : '创建物流导入任务'}
                </button>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" id="request-export">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">需求导出</h2>
                    <p className="mt-1 text-sm text-slate-500">保留真实需求导出任务入口，便于与商品导入页统一查看任务状态。</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${canRequestExport ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {canRequestExport ? '可执行' : '无权限'}
                  </span>
                </div>

                <button
                  className="mt-5 inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="request-export-submit"
                  disabled={!canRequestExport || submittingAction === 'request-export'}
                  onClick={() => {
                    void handleRequestExport();
                  }}
                  type="button"
                >
                  {submittingAction === 'request-export' ? '提交中...' : '创建需求导出任务'}
                </button>

                <div className="mt-6 border-t border-slate-100 pt-6">
                  <h3 className="text-sm font-semibold text-slate-900">任务查询</h3>
                  <div className="mt-3 flex gap-3">
                    <input
                      className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      data-testid="import-job-query"
                      onChange={(event) => setQueryJobId(event.target.value)}
                      placeholder="输入导入任务 ID"
                      value={queryJobId}
                    />
                    <button
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="import-job-query-submit"
                      disabled={submittingAction === 'query-job'}
                      onClick={() => {
                        void handleQueryJob();
                      }}
                      type="button"
                    >
                      {submittingAction === 'query-job' ? '查询中...' : '查询'}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">支付功能开关</h2>
                  <p className="mt-1 text-sm text-slate-500">沿用原导入页的 feature flags 操作；mock 模式仅展示当前本地状态。</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${canManageFlags ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {canManageFlags ? '可管理' : '无权限'}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4 text-sm text-slate-700">
                  <input
                    checked={flags.paymentEnabled}
                    disabled={!canManageFlags || context.mode !== 'dev' || !flagsLoaded}
                    onChange={(event) => setFlags((current) => ({ ...current, paymentEnabled: event.target.checked }))}
                    type="checkbox"
                  />
                  支付开关
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4 text-sm text-slate-700">
                  <input
                    checked={flags.wechatPayEnabled}
                    disabled={!canManageFlags || context.mode !== 'dev' || !flagsLoaded}
                    onChange={(event) => setFlags((current) => ({ ...current, wechatPayEnabled: event.target.checked }))}
                    type="checkbox"
                  />
                  微信支付
                </label>
				<label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4 text-sm text-slate-700">
				  <input
				    checked={flags.wechatB2bEnabled}
				    disabled={!canManageFlags || context.mode !== 'dev' || !flagsLoaded}
				    onChange={(event) => setFlags((current) => ({ ...current, wechatB2bEnabled: event.target.checked }))}
				    type="checkbox"
				  />
				  微信 B2B 支付
				</label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4 text-sm text-slate-700">
                  <input
                    checked={flags.alipayPayEnabled}
                    disabled={!canManageFlags || context.mode !== 'dev' || !flagsLoaded}
                    onChange={(event) => setFlags((current) => ({ ...current, alipayPayEnabled: event.target.checked }))}
                    type="checkbox"
                  />
                  支付宝支付
                </label>
              </div>

              <div className="mt-5">
                <button
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canManageFlags || context.mode !== 'dev' || submittingAction === 'save-flags'}
                  onClick={() => {
                    void handleSaveFlags();
                  }}
                  type="button"
                >
                  {submittingAction === 'save-flags' ? '保存中...' : '保存功能开关'}
                </button>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">最近任务</h2>
                  <p className="mt-1 text-sm text-slate-500">优先展示最近一次创建或查询的任务。</p>
                </div>
                {latestJob ? (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${jobToneClass}`} data-testid="latest-import-job-status">
                    {latestJob.status}
                  </span>
                ) : null}
              </div>

              {!latestJob ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500" data-testid="latest-import-job-empty">
                  暂无任务。创建商品导入、物流导入或需求导出后会在这里显示。
                </div>
              ) : (
                <div className="mt-5 space-y-4" data-testid="latest-import-job">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{latestJob.type}</div>
                        <div className="mt-2 break-all text-sm font-semibold text-slate-900" data-testid="latest-import-job-id">{latestJob.id}</div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div>创建时间</div>
                        <div className="mt-1">{formatDateTime(latestJob.createdAt)}</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                        <span>进度</span>
                        <span>{latestJob.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, latestJob.progress))}%` }} />
                      </div>
                    </div>
                  </div>

                  {latestJob.resultFileUrl ? (
                    <a
                      className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                      href={latestJob.resultFileUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span>{resultFileLabel}</span>
                      <span className="material-symbols-outlined text-lg">download</span>
                    </a>
                  ) : null}

                  {latestJob.errorReportUrl ? (
                    <a
                      className="flex items-center justify-between rounded-2xl border border-rose-200 px-4 py-3 text-sm text-rose-700 transition hover:bg-rose-50"
                      href={latestJob.errorReportUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span>下载错误报告</span>
                      <span className="material-symbols-outlined text-lg">download</span>
                    </a>
                  ) : null}

                  {latestJob.details ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4">
                      <pre className="max-h-[420px] overflow-auto text-xs leading-5 text-slate-100">{renderJson(latestJob.details)}</pre>
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">调试响应</h2>
              <p className="mt-1 text-sm text-slate-500">保留原导入工具页的原始响应视角，便于联调和排错。</p>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-950 p-4">
                <pre className="max-h-[520px] overflow-auto text-xs leading-5 text-slate-100">
                  {latestResponse ? renderJson(latestResponse) : '暂无响应数据'}
                </pre>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
};
