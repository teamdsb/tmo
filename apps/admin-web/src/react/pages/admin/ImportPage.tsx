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
  alipayPayEnabled: boolean;
};

const defaultFlags: FeatureFlagsState = {
  paymentEnabled: false,
  wechatPayEnabled: false,
  alipayPayEnabled: false
};

const statusToneClass: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
  RUNNING: 'bg-blue-50 text-blue-700 border border-blue-200',
  SUCCEEDED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 border border-rose-200'
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
    if (!context || context.mode !== 'dev' || !latestJob?.id || !['PENDING', 'RUNNING'].includes(latestJob.status)) {
      return;
    }

    let cancelled = false;
    const timer = window.setInterval(() => {
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
        const mockJob: ImportJobView = {
          id: buildMockJobId('request-export'),
          type: 'PRODUCT_REQUEST_EXPORT',
          status: 'SUCCEEDED',
          progress: 100,
          createdAt: new Date().toISOString(),
          details: {
            note: 'Mock 模式下仅模拟需求导出任务。'
          }
        };
        setLatestJob(mockJob);
        setLatestResponse(mockJob);
        saveMockProductImportJob(mockJob);
        setStatusMessage('Mock 模式已模拟需求导出任务。');
        return;
      }

      const response = await createAdminProductRequestExportJob({});
      setLatestResponse(response.data || response);
      if (response.status !== 202 || !response.data) {
        setErrorMessage(`需求导出提交失败（HTTP ${response.status}）。`);
        return;
      }
      setLatestJob(response.data as ImportJobView);
      setStatusMessage('需求导出任务已创建。');
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
        const job = getMockProductImportJob(queryJobId.trim());
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

      <main className="flex-1 mx-auto w-full max-w-[1440px] px-6 py-8 md:px-10">
        <div className="grid gap-6 xl:grid-cols-[1.35fr_minmax(320px,0.9fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Import Jobs</p>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">商品 Excel 导入工作台</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                    real 模式会真正创建 `/admin/products/import-jobs` 任务并自动轮询状态；mock 模式会在浏览器内解析 Excel 和 ZIP，并把成功导入的商品写入本地存储，随后可在商品页查看。
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
                  <div className="text-slate-300">当前模式</div>
                  <div className="mt-1 text-lg font-semibold">{context.mode === 'dev' ? 'real / dev' : 'mock'}</div>
                </div>
              </div>

              {(statusMessage || errorMessage) ? (
                <div className="mt-5 space-y-3">
                  {statusMessage ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {statusMessage}
                    </div>
                  ) : null}
                  {errorMessage ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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
                  <p className="mt-1 text-sm text-slate-500">模板按“一行一个 SKU”组织；同一 `groupKey` 聚合为一个商品，`skuCode` 命中时执行更新。</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${canProductImport ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {canProductImport ? '可执行' : '无权限'}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">商品 Excel</span>
                  <input
                    accept=".xls,.xlsx"
                    className="block w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    onChange={(event) => setProductExcelFile(event.target.files?.[0] || null)}
                    type="file"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">图片 ZIP（可选）</span>
                  <input
                    accept=".zip"
                    className="block w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    onChange={(event) => setProductImagesZip(event.target.files?.[0] || null)}
                    type="file"
                  />
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Image Base URL（可选）</span>
                <input
                  className="block w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  onChange={(event) => setImageBaseUrl(event.target.value)}
                  placeholder="https://cdn.example.com/catalog/"
                  value={imageBaseUrl}
                />
              </label>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <p className="font-medium text-slate-800">模板字段</p>
                <p className="mt-2 leading-6">
                  `groupKey`、`skuCode`、`productName`、`skuName`、`categoryId`、`description`、`coverImage`、`images`、
                  `tags`、`filterDimensions`、`spec`、`attributes`、`unit`、`isActive`、`priceTiers`。
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
                      onChange={(event) => setQueryJobId(event.target.value)}
                      placeholder="输入导入任务 ID"
                      value={queryJobId}
                    />
                    <button
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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

              <div className="mt-5 grid gap-3 md:grid-cols-3">
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
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${jobToneClass}`}>
                    {latestJob.status}
                  </span>
                ) : null}
              </div>

              {!latestJob ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                  暂无任务。创建商品导入、物流导入或需求导出后会在这里显示。
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{latestJob.type}</div>
                        <div className="mt-2 break-all text-sm font-semibold text-slate-900">{latestJob.id}</div>
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
                      <span>下载结果摘要</span>
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
