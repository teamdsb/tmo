import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Download, FileSpreadsheet, RefreshCw, Upload, X } from 'lucide-react';
import { AdminTopbar } from '../../layout/AdminTopbar';
import { ensureProtectedPage } from '../../../lib/guard';
import { hasPermission, normalizePermissionMap } from '../../../lib/permissions';
import { downloadAdminProductImportTemplate, cancelAdminProductImport, confirmAdminProductImport, createAdminProductExportJob, createAdminProductImportJob, createAdminProductRequestExportJob, createShipmentImportJob, fetchCatalogCategories, getAdminImportJob, getAdminProductImportPreview, getFeatureFlags, listAdminImportJobs, listAdminProductImportReviews, patchFeatureFlags, resolveAdminProductImportPreview, resolveAdminProductImportReview } from '../../../lib/api';
import { advanceMockProductImportJob, createMockProductExportJob, downloadProductImportTemplate, getMockProductImportJob, loadImportedMockProducts, loadMockProductImportJobs, saveMockProductImportJob } from '../../../lib/product-import';
import { cancelMockImport, confirmMockImport, createMockImportPreview, getMockImportPreview, listMockImportReviews, resolveMockImportPreview, resolveMockImportReview } from '../../../lib/product-import-workbench';
import { buildMockProducts, normalizeProduct } from './products-data';
import { importSourceLabels, importStatusLabels, importTypeLabels, type ImportJob, type ImportPreview, type ImportReview } from './import-types';
import { actionLabels, buttonClass, GroupEditor, inputClass, Pager, primaryClass, Status, Summary } from './import-ui';
type Tab = 'import' | 'export' | 'history';
type Context = {
    mode: 'dev' | 'mock';
    session?: {
        currentRole?: string;
        permissions?: {
            items?: Array<{
                code?: string;
                scope?: string;
            }>;
        };
    };
};
const busyStatuses = ['PENDING', 'RUNNING'];
const catalogJobTypes = ['PRODUCT_IMPORT', 'PRODUCT_EXPORT'];
const canUseCatalog = (session?: Context['session']) => {
    const permissions = normalizePermissionMap(session?.permissions);
    return ['BOSS', 'ADMIN'].includes(String(session?.currentRole || '').toUpperCase()) &&
        ['catalog:read', 'product:manage', 'import:product'].some(code => hasPermission(permissions, code, 'SELF'));
};
const formatDate = (value?: string) => value ? new Date(value).toLocaleString('zh-CN') : '--';
const unwrap = (response: any) => { if (response.status < 200 || response.status >= 300)
    throw new Error(response?.data?.message || response?.data?.error?.message || `请求失败（HTTP ${response.status}）`); return response.data; };
export const ImportPage = ({ defaultTab = 'import' }: {
    defaultTab?: Tab;
}) => {
    const [context, setContext] = useState<Context | null>(null);
    const [tab, setTab] = useState<Tab>(defaultTab);
    const [excel, setExcel] = useState<File | null>(null);
    const [zip, setZip] = useState<File | null>(null);
    const [imageBaseUrl, setImageBaseUrl] = useState('');
    const [shipmentFile, setShipmentFile] = useState<File | null>(null);
    const [job, setJob] = useState<ImportJob | null>(null);
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [previewPage, setPreviewPage] = useState(1);
    const [previewReviewOnly, setPreviewReviewOnly] = useState(false);
    const [batchCategoryId, setBatchCategoryId] = useState('');
    const [expanded, setExpanded] = useState('');
    const [history, setHistory] = useState<{
        items: ImportJob[];
        total: number;
    }>({ items: [], total: 0 });
    const [historyPage, setHistoryPage] = useState(1);
    const [historyType, setHistoryType] = useState('');
    const [historyStatus, setHistoryStatus] = useState('');
    const [reviews, setReviews] = useState<{
        items: ImportReview[];
        total: number;
    }>({ items: [], total: 0 });
    const [reviewPage, setReviewPage] = useState(1);
    const [reviewStatus, setReviewStatus] = useState('PENDING');
    const [categories, setCategories] = useState<Array<{
        id: string;
        name: string;
    }>>([]);
    const [exportFilter, setExportFilter] = useState({ q: '', categoryId: '', status: 'ALL', needsReview: false });
    const [queryJobId, setQueryJobId] = useState('');
    const [busy, setBusy] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [flags, setFlags] = useState<Record<string, boolean>>({ paymentEnabled: false, wechatPayEnabled: false, wechatB2bEnabled: false, alipayPayEnabled: false });
    const confirmKeys = useRef<Record<string, string>>({});
    const restoredJob = useRef(false);
    const permissions = normalizePermissionMap(context?.session?.permissions);
    const canCatalog = canUseCatalog(context?.session);
    const canImport = canCatalog && hasPermission(permissions, 'import:product', 'SELF');
    const canShipment = hasPermission(permissions, 'import:shipment', 'SELF');
    const canRequestExport = hasPermission(permissions, 'product_request:export', 'SELF');
    const canFlags = hasPermission(permissions, 'config:feature_flags', 'ALL');
    const mock = context?.mode === 'mock';
    const tabs: Array<[Tab, string]> = canCatalog ? [['import', '商品导入'], ['export', '商品导出'], ['history', '任务历史']] : [];
    const unmappedGroups = preview?.items.filter(group => !group.categoryId || group.categoryId === '00000000-0000-0000-0000-000000000000') || [];
    useEffect(() => { let active = true; void ensureProtectedPage().then(async (value) => { if (!active || !value)
        return; setContext(value as Context); if (!canUseCatalog(value.session)) return; if (value.mode === 'dev') {
        const response = await fetchCatalogCategories();
        if (active && response.status === 200)
            setCategories(response.data?.items || []);
    }
    else {
        try {
            setCategories(JSON.parse(localStorage.getItem('admin-web-products-categories') || '[]'));
        }
        catch {
            setCategories([]);
        }
    } }); return () => { active = false; }; }, []);
    const run = async (name: string, action: () => Promise<void>) => { setBusy(name); setError(''); setMessage(''); try {
        await action();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
    }
    finally {
        setBusy('');
    } };
    const loadPreview = useCallback(async (id: string, page = 1) => { if (!canCatalog) return; setPreview(mock ? getMockImportPreview(id, { page, pageSize: 20, needsReview: previewReviewOnly }) : unwrap(await getAdminProductImportPreview(id, { page, pageSize: 20, needsReview: previewReviewOnly || undefined }))); }, [mock, previewReviewOnly, canCatalog]);
    const selectJob = useCallback(async (id: string) => { const value = mock ? getMockProductImportJob(id) : unwrap(await getAdminImportJob(id)); if (!value)
        throw new Error('未找到任务。'); if (!canCatalog && catalogJobTypes.includes(value.type)) throw new Error('当前账号无权查看商品导入导出任务。'); setJob(value); setPreviewPage(1); setExpanded(''); if (canCatalog && value.type === 'PRODUCT_IMPORT' && !busyStatuses.includes(value.status))
        await loadPreview(id, 1);
    else
        setPreview(null); }, [mock, loadPreview, canCatalog]);
    const refreshHistory = useCallback(async () => { if (!context || !canCatalog)
        return; if (mock) {
        const items = loadMockProductImportJobs().filter(item => (!historyType || item.type === historyType) && (!historyStatus || item.status === historyStatus));
        setHistory({ items: items.slice((historyPage - 1) * 20, historyPage * 20), total: items.length });
    }
    else
        setHistory(unwrap(await listAdminImportJobs({ page: historyPage, pageSize: 20, type: historyType, status: historyStatus }))); }, [context, mock, historyPage, historyType, historyStatus, canCatalog]);
    const refreshReviews = useCallback(async () => { if (!context || !canCatalog)
        return; setReviews(mock ? listMockImportReviews({ page: reviewPage, pageSize: 20, status: reviewStatus }) : unwrap(await listAdminProductImportReviews({ page: reviewPage, pageSize: 20, status: reviewStatus }))); }, [context, mock, reviewPage, reviewStatus, canCatalog]);
    useEffect(() => { if (!context || !canCatalog)
        return; void refreshHistory().catch(e => setError(e.message)); void refreshReviews().catch(e => setError(e.message)); }, [context, refreshHistory, refreshReviews]);
    useEffect(() => { if (!context || !canCatalog || restoredJob.current)
        return; restoredJob.current = true; const id = new URLSearchParams(window.location.search).get('jobId'); if (id)
        void selectJob(id).catch(e => setError(e.message)); }, [context, selectJob]);
    useEffect(() => { if (job?.type === 'PRODUCT_IMPORT' && !busyStatuses.includes(job.status))
        void loadPreview(job.id, previewPage).catch(e => setError(e.message)); }, [job?.id, job?.status, previewPage, loadPreview]);
    useEffect(() => { if (!job || !busyStatuses.includes(job.status))
        return; let active = true; let inFlight = false; const timer = window.setInterval(async () => { if (inFlight)
        return; inFlight = true; try {
        const next = mock ? advanceMockProductImportJob(job.id) : unwrap(await getAdminImportJob(job.id));
        if (active && next) {
            setJob(next);
            if (!busyStatuses.includes(next.status)) {
                await refreshHistory();
                await refreshReviews();
            }
        }
    }
    catch (e) {
        if (active)
            setError(`进度暂时无法更新：${e instanceof Error ? e.message : String(e)}`);
    }
    finally {
        inFlight = false;
    } }, 1500); return () => { active = false; window.clearInterval(timer); }; }, [job?.id, job?.status, mock, refreshHistory, refreshReviews]);
    useEffect(() => { if (context?.mode === 'dev' && canFlags)
        void getFeatureFlags().then(response => { if (response.status === 200)
            setFlags(response.data); }); }, [context?.mode, canFlags]);
    const upload = () => run('upload', async () => { if (!excel)
        throw new Error('请选择商品 Excel 文件。'); const next = mock ? await createMockImportPreview({ excelFile: excel, imagesZipFile: zip, imageBaseUrl }) : unwrap(await createAdminProductImportJob(excel, zip, imageBaseUrl.trim())); setJob(next); setPreview(null); setPreviewPage(1); setExpanded(''); setMessage('文件已接收，识别完成后请确认导入。'); await refreshHistory(); if (next.status === 'AWAITING_CONFIRMATION')
        await loadPreview(next.id); });
    const confirm = () => run('confirm', async () => { if (!job || !preview)
        return; const key = `${job.id}:${preview.revision}`; confirmKeys.current[key] ||= crypto.randomUUID(); setJob(mock ? confirmMockImport(job.id, preview.revision, confirmKeys.current[key]) : unwrap(await confirmAdminProductImport(job.id, preview.revision, confirmKeys.current[key]))); setMessage('已确认导入。待复核项目会保留在任务历史中。'); await refreshHistory(); await refreshReviews(); });
    const resolveGroups = async (groups: any[], successMessage = '修正已保存，请复核最新识别结果。') => run('resolution', async () => { if (!job || !preview || !canImport)
        return; if (mock)
        resolveMockImportPreview(job.id, { expectedRevision: preview.revision, groups });
    else
        unwrap(await resolveAdminProductImportPreview(job.id, { expectedRevision: preview.revision, groups })); await loadPreview(job.id, previewPage); setJob(mock ? getMockProductImportJob(job.id) : unwrap(await getAdminImportJob(job.id))); setMessage(successMessage); });
    const resolvePreview = async (group: any) => resolveGroups([group]);
    const applyBatchCategory = async () => {
        if (!batchCategoryId || !unmappedGroups.length) return;
        await resolveGroups(unmappedGroups.map(group => ({ key: group.key, categoryId: batchCategoryId, rows: [] })), `已为当前页 ${unmappedGroups.length} 个待分类商品设置分类。`);
    };
    const exportProducts = () => run('export', async () => { if (mock) {
        let stored: any[];
        try {
            stored = JSON.parse(localStorage.getItem('admin-web-mock-products') || 'null') || buildMockProducts();
        }
        catch {
            stored = buildMockProducts();
        }
        const imported = loadImportedMockProducts();
        const ids = new Set(imported.map(item => item.id));
        const reviewIds = new Set(listMockImportReviews({ status: 'PENDING', pageSize: 100000 }).items.map(item => item.productId));
        const products = [...stored.filter(item => !ids.has(item.id)), ...imported].map(normalizeProduct).filter(item => (!exportFilter.q || `${item.name} ${item.id} ${item.models.map(model => `${model.name} ${model.code}`).join(' ')}`.toLowerCase().includes(exportFilter.q.toLowerCase())) && (!exportFilter.categoryId || item.categoryId === exportFilter.categoryId) && (exportFilter.status === 'ALL' || item.status === exportFilter.status) && (!exportFilter.needsReview || reviewIds.has(item.id)));
        setJob(createMockProductExportJob(products));
    }
    else
        setJob(unwrap(await createAdminProductExportJob({ ...exportFilter, q: exportFilter.q.trim() || undefined, categoryId: exportFilter.categoryId || undefined, needsReview: exportFilter.needsReview || undefined }))); setPreview(null); setMessage('商品导出任务已创建。'); await refreshHistory(); });
    const secondaryJob = (type: 'SHIPMENT_IMPORT' | 'PRODUCT_REQUEST_EXPORT') => run(type, async () => { if (type === 'SHIPMENT_IMPORT' && !shipmentFile)
        throw new Error('请选择物流 Excel 文件。'); let next: ImportJob; if (mock) {
        next = { id: `mock-${crypto.randomUUID()}`, type, status: type === 'SHIPMENT_IMPORT' ? 'SUCCEEDED' : 'PENDING', progress: 0, createdAt: new Date().toISOString() };
        saveMockProductImportJob(next);
    }
    else
        next = unwrap(await (type === 'SHIPMENT_IMPORT' ? createShipmentImportJob(shipmentFile) : createAdminProductRequestExportJob({}))); setJob(next); setPreview(null); setMessage(`${importTypeLabels[type]}任务已创建。`); await refreshHistory(); });
    if (!context)
        return <main className="flex-1 p-6 text-sm text-slate-500">正在加载导入与导出...</main>;
    return <><AdminTopbar searchPlaceholder="搜索商品、订单..." leftSlot={<div className="flex items-center gap-2 text-slate-900"><FileSpreadsheet size={21} className="text-primary"/><h1 className="text-lg font-semibold">导入与导出</h1></div>}/><main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 md:px-8" data-testid="import-page">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200"><nav className="flex gap-5" aria-label="数据工作台">{!canCatalog ? <span className="py-3 text-sm font-semibold text-slate-800">批量任务</span> : null}{tabs.map(([value, label]) => <button type="button" key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => setTab(value)} className={`border-b-2 py-3 text-sm font-medium ${tab === value ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>{label}{value === 'history' && reviews.total > 0 && reviewStatus === 'PENDING' ? <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">{reviews.total}</span> : null}</button>)}</nav><span className="text-xs text-slate-500">{mock ? '演示环境' : '已连接服务'}</span></div>
    {message ? <div role="status" data-testid="import-status-message" className="my-4 flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Check size={16}/>{message}</div> : null}{error ? <div role="alert" data-testid="import-error-message" className="my-4 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={16} className="mt-0.5 shrink-0"/>{error}</div> : null}
    {canCatalog && tab === 'import' ? <section className="py-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-900">上传商品文件</h2><button type="button" className={buttonClass} data-testid="download-product-template" disabled={!canImport || Boolean(busy)} onClick={() => void run('template', async () => { if (mock)
        downloadProductImportTemplate();
    else
        await downloadAdminProductImportTemplate(); })}><Download size={16}/>下载标准模板</button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><label className="text-sm text-slate-700">商品 Excel<input type="file" accept=".xlsx" className={`${inputClass} mt-2 block w-full`} data-testid="product-import-excel" onChange={e => setExcel(e.target.files?.[0] || null)}/></label><label className="text-sm text-slate-700">图片 ZIP（可选）<input type="file" accept=".zip" className={`${inputClass} mt-2 block w-full`} data-testid="product-import-zip" onChange={e => setZip(e.target.files?.[0] || null)}/></label><label className="text-sm text-slate-700">图片基础地址（可选）<input className={`${inputClass} mt-2 block w-full`} data-testid="product-import-image-base-url" value={imageBaseUrl} onChange={e => setImageBaseUrl(e.target.value)} placeholder="https://cdn.example.com/catalog/"/></label></div><div className="mt-4 flex flex-wrap items-center gap-4"><button className={primaryClass} data-testid="product-import-submit" type="button" disabled={!canImport || Boolean(busy)} onClick={() => void upload()}><Upload size={16}/>{busy === 'upload' ? '正在识别...' : '识别并预览'}</button><details data-testid="product-import-template-guide" className="text-sm text-slate-600"><summary className="cursor-pointer">文件格式</summary><p className="mt-2 max-w-3xl text-xs leading-6">支持试运行母表、旧版商品业务表和标准模板。标准模板必填表头：Group Key、Product Name、Category ID；三级规格使用 Spec 1 Name / Value 至 Spec 3 Name / Value，Price Tiers (Fen) 保存阶梯价。保留 Product ID 与 SKU ID 可回导更新。</p></details></div></section> : null}
    {canCatalog && tab === 'export' ? <section className="space-y-4 py-5"><h2 className="text-base font-semibold text-slate-900">导出商品</h2><div className="flex flex-wrap items-end gap-3"><label className="text-xs text-slate-600">搜索<input className={`${inputClass} mt-1 block`} aria-label="导出搜索" value={exportFilter.q} onChange={e => setExportFilter({ ...exportFilter, q: e.target.value })}/></label><label className="text-xs text-slate-600">分类<select className={`${inputClass} mt-1 block`} aria-label="导出分类" value={exportFilter.categoryId} onChange={e => setExportFilter({ ...exportFilter, categoryId: e.target.value })}><option value="">全部分类</option>{categories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label className="text-xs text-slate-600">状态<select className={`${inputClass} mt-1 block`} aria-label="导出状态" value={exportFilter.status} onChange={e => setExportFilter({ ...exportFilter, status: e.target.value })}><option value="ALL">全部状态</option><option value="DRAFT">草稿</option><option value="ACTIVE">已上架</option><option value="INACTIVE">已下架</option></select></label><label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={exportFilter.needsReview} onChange={e => setExportFilter({ ...exportFilter, needsReview: e.target.checked })}/>仅待复核商品</label><button className={primaryClass} disabled={!canImport || Boolean(busy)} type="button" onClick={() => void exportProducts()}><Download size={16}/>创建导出任务</button></div></section> : null}
    {job && (canCatalog || !catalogJobTypes.includes(job.type)) ? <section className="border-t border-slate-200 py-5" data-testid="latest-import-job"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-base font-semibold text-slate-900">{job.fileName || importTypeLabels[job.type] || '任务详情'}</h2><Status job={job}/></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span data-testid="latest-import-job-id">{job.id}</span><span>{formatDate(job.createdAt)}</span>{job.sourceFormat ? <span>{importSourceLabels[job.sourceFormat] || '商品文件'}</span> : null}</div></div><button type="button" title="刷新任务" aria-label="刷新任务" className={buttonClass} disabled={Boolean(busy)} onClick={() => void run('refresh', () => selectJob(job.id))}><RefreshCw size={16}/></button></div>{busyStatuses.includes(job.status) ? <div className="mt-4 flex items-center gap-3 text-xs text-slate-500"><div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100"><div className="h-full bg-primary" style={{ width: `${job.progress}%` }}/></div>{job.progress}%</div> : null}<div className="mt-4"><Summary value={preview?.summary || job.summary}/></div><div className="mt-3 flex flex-wrap gap-4 text-sm">{job.resultFileUrl ? <a className="inline-flex items-center gap-2 text-primary" href={job.resultFileUrl} download={job.type === 'PRODUCT_EXPORT' ? '商品导出.xlsx' : job.type === 'PRODUCT_REQUEST_EXPORT' ? '商品需求导出.xlsx' : ''}><Download size={16}/>{job.type.includes('EXPORT') ? '下载导出文件' : '下载导入结果'}</a> : null}{job.errorReportUrl ? <a className="inline-flex items-center gap-2 text-red-700" href={job.errorReportUrl} download><Download size={16}/>下载错误报告</a> : null}</div>
      {canCatalog && preview ? <div className="mt-5" data-testid="import-preview"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-800">商品与规格预览 <span className="font-normal text-slate-500">版本 {preview.revision}</span></h3><label className="flex items-center gap-2 text-xs text-amber-800"><input type="checkbox" checked={previewReviewOnly} onChange={event => { setPreviewReviewOnly(event.target.checked); setPreviewPage(1); }}/>仅看待复核</label>{job.status === 'AWAITING_CONFIRMATION' ? <div className="flex gap-2"><button type="button" className={buttonClass} disabled={Boolean(busy)} onClick={() => void run('cancel', async () => { setJob(mock ? cancelMockImport(job.id) : unwrap(await cancelAdminProductImport(job.id))); await refreshHistory(); })}><X size={16}/>取消任务</button><button type="button" className={primaryClass} data-testid="product-import-confirm" disabled={!canImport || Boolean(busy) || Boolean(preview.summary.failedRows)} onClick={() => void confirm()}><Check size={16}/>确认导入</button></div> : null}</div>{preview.summary.failedRows > 0 && job.status === 'AWAITING_CONFIRMATION' ? <p className="mb-3 text-sm text-red-700">存在阻断错误，请修正或跳过对应行后再确认。</p> : null}<div className="mb-4 flex flex-wrap items-center gap-2">{canImport && job.status === 'AWAITING_CONFIRMATION' ? <><select aria-label="批量设置分类" className={inputClass} value={batchCategoryId} onChange={event => setBatchCategoryId(event.target.value)}><option value="">选择已有分类</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button type="button" className={buttonClass} disabled={Boolean(busy) || !batchCategoryId || !unmappedGroups.length} onClick={() => void applyBatchCategory()}>应用到本页待分类商品</button><span className="text-xs text-slate-500">本页 {unmappedGroups.length} 个待分类商品</span></> : null}</div><div className="divide-y divide-slate-200 border-y border-slate-200">{preview.items.map(group => <div key={group.key}><button type="button" className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-left md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_80px_100px_20px]" aria-expanded={expanded === group.key} onClick={() => setExpanded(expanded === group.key ? '' : group.key)}><span className="break-words text-sm font-medium text-slate-900">{group.productName}<span className="mt-1 block text-xs font-normal text-slate-500">{group.productId ? '已有商品' : '新商品'}{group.issues?.length ? ` · ${group.issues.length} 项提醒` : ''}</span></span><span className="hidden text-xs text-slate-600 md:block">{group.dimensions.join(' / ') || '未识别规格'}</span><span className="hidden text-xs text-slate-600 md:block">{group.rows.length} 个 SKU</span><span className={`text-xs ${group.action === 'SPLIT' ? 'text-amber-800' : group.action === 'ERROR' ? 'text-red-700' : 'text-slate-600'}`}>{actionLabels[group.action] || group.action}</span><ChevronDown size={16} className={`hidden text-slate-400 md:block ${expanded === group.key ? 'rotate-180' : ''}`}/></button>{expanded === group.key ? <GroupEditor group={group} categories={categories} editable={canImport && job.status === 'AWAITING_CONFIRMATION'} busy={Boolean(busy)} onSave={resolvePreview}/> : null}</div>)}</div><Pager page={previewPage} total={preview.total} pageSize={20} onChange={setPreviewPage}/></div> : null}
    </section> : tab !== 'history' ? <div className="border-t border-slate-200 py-6 text-sm text-slate-500" data-testid="latest-import-job-empty">暂无当前任务</div> : null}
    {canCatalog && tab === 'history' ? <section className="space-y-6 py-5"><div><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-900">任务记录</h2><div className="flex flex-wrap gap-2"><select className={inputClass} aria-label="任务类型" value={historyType} onChange={e => { setHistoryType(e.target.value); setHistoryPage(1); }}><option value="">全部类型</option>{Object.entries(importTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><select className={inputClass} aria-label="任务状态" value={historyStatus} onChange={e => { setHistoryStatus(e.target.value); setHistoryPage(1); }}><option value="">全部状态</option>{Object.entries(importStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button type="button" className={buttonClass} aria-label="刷新任务历史" onClick={() => void run('history', async () => { await refreshHistory(); await refreshReviews(); })}><RefreshCw size={16}/></button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="border-y border-slate-200 text-xs text-slate-500"><tr><th className="py-2">文件 / 类型</th><th>创建时间</th><th>状态</th><th>操作</th></tr></thead><tbody>{history.items.map(item => <tr key={item.id} className="border-b border-slate-100"><td className="py-3 pr-3"><div className="max-w-96 break-words font-medium">{item.fileName || importTypeLabels[item.type]}</div><span className="text-xs text-slate-500">{importTypeLabels[item.type]}</span></td><td className="pr-3 text-xs text-slate-600">{formatDate(item.createdAt)}</td><td><Status job={item}/></td><td><button type="button" className="text-primary" onClick={() => void run('query', () => selectJob(item.id))}>查看</button></td></tr>)}</tbody></table>{!history.items.length ? <p className="py-5 text-sm text-slate-500">暂无任务记录</p> : null}</div><Pager page={historyPage} total={history.total} pageSize={20} onChange={setHistoryPage}/></div>
      <div className="border-t border-slate-200 pt-5"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-900">商品复核</h2><select className={inputClass} aria-label="复核状态" value={reviewStatus} onChange={e => { setReviewStatus(e.target.value); setReviewPage(1); }}><option value="PENDING">待复核</option><option value="RESOLVED">已解决</option></select></div><div className="divide-y divide-slate-200">{reviews.items.map(item => <div className="flex flex-wrap items-start justify-between gap-3 py-3" key={item.id}><div className="min-w-0 flex-1"><a className="break-words text-sm font-medium text-primary" href={`/products.html?productId=${encodeURIComponent(item.productId)}`}>{item.productName || '查看商品'}</a><p className="mt-1 text-sm text-amber-800">{item.message}</p><p className="mt-1 text-xs text-slate-500">{item.sourceSheet} · 第 {item.sourceRow} 行</p></div><div className="flex gap-3"><button type="button" className="text-sm text-slate-500" onClick={() => void run('review-job', () => selectJob(item.jobId))}>来源任务</button>{item.status === 'PENDING' ? <button className={buttonClass} type="button" disabled={Boolean(busy)} onClick={() => void run('review', async () => { if (mock)
            resolveMockImportReview(item.id);
        else
            unwrap(await resolveAdminProductImportReview(item.id)); await refreshReviews(); await refreshHistory(); if (job) await selectJob(job.id); })}><Check size={15}/>标记已解决</button> : null}</div></div>)}</div>{!reviews.items.length ? <p className="py-5 text-sm text-slate-500">暂无{reviewStatus === 'PENDING' ? '待复核' : '已解决'}项目</p> : null}<Pager page={reviewPage} total={reviews.total} pageSize={20} onChange={setReviewPage}/></div>
    </section> : null}
    <details open={!canCatalog || undefined} className="mt-4 border-t border-slate-200 py-4 text-sm"><summary className="cursor-pointer text-slate-600">其他批量任务与设置</summary><div className="mt-4 flex flex-wrap items-end gap-4"><label className="text-xs text-slate-600">物流 Excel<input className={`${inputClass} mt-1 block`} type="file" accept=".xlsx" data-testid="shipment-import-excel" onChange={e => setShipmentFile(e.target.files?.[0] || null)}/></label><button type="button" data-testid="shipment-import-submit" className={buttonClass} disabled={!canShipment || Boolean(busy)} onClick={() => void secondaryJob('SHIPMENT_IMPORT')}><Upload size={16}/>导入物流</button><button type="button" data-testid="request-export-submit" className={buttonClass} disabled={!canRequestExport || Boolean(busy)} onClick={() => void secondaryJob('PRODUCT_REQUEST_EXPORT')}><Download size={16}/>导出商品需求</button></div><div className="mt-4 flex gap-2"><input className={`${inputClass} max-w-sm flex-1`} aria-label="任务 ID" placeholder="任务 ID" data-testid="import-job-query" value={queryJobId} onChange={e => setQueryJobId(e.target.value)}/><button type="button" className={buttonClass} data-testid="import-job-query-submit" disabled={Boolean(busy) || !queryJobId.trim()} onClick={() => void run('query', () => selectJob(queryJobId.trim()))}>查询</button></div>{canFlags ? <details className="mt-4 border-t border-slate-100 pt-4"><summary className="cursor-pointer text-slate-600">支付功能开关</summary><div className="mt-3 flex flex-wrap gap-4">{[['paymentEnabled', '支付开关'], ['wechatPayEnabled', '微信支付'], ['wechatB2bEnabled', '微信 B2B 支付'], ['alipayPayEnabled', '支付宝支付']].map(([key, label]) => <label className="flex items-center gap-2" key={key}><input type="checkbox" disabled={mock} checked={Boolean(flags[key])} onChange={e => setFlags({ ...flags, [key]: e.target.checked })}/>{label}</label>)}<button type="button" className={buttonClass} disabled={mock || Boolean(busy)} onClick={() => void run('flags', async () => { unwrap(await patchFeatureFlags(flags)); setMessage('功能开关已更新。'); })}>保存功能开关</button></div></details> : null}</details>
  </main></>;
};
