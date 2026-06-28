import { useEffect, useMemo, useState } from 'react';

import { fetchCatalogCategories, fetchProductRequests } from '../../../lib/api';
import { ensureProtectedPage } from '../../../lib/guard';
import { AdminTopbar } from '../../layout/AdminTopbar';
import { buildDefaultCategories, type CategoryItem } from './products-data';
import {
  buildMockProductRequests,
  matchesProductRequestQuery,
  normalizeProductRequest,
  type ProductRequestRecord
} from './product-requests-data';

type PageContext = { mode: 'dev' | 'mock' } | null;
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const PAGE_SIZE = 10;

const formatDateTime = (value: string) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
};

const shortId = (value: string) => value ? `${value.slice(0, 8)}…` : '--';

const toDateBoundary = (value: string, endOfDay = false) => {
  if (!value) return undefined;
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
  return new Date(`${value}T${time}+08:00`).toISOString();
};

const ProductRequestDrawer = ({
  categoryName,
  onClose,
  onPreview,
  request
}: {
  categoryName: string;
  onClose: () => void;
  onPreview: (url: string) => void;
  request: ProductRequestRecord | null;
}) => {
  if (!request) return null;
  const fields = [
    ['规格', request.spec],
    ['材质', request.material],
    ['尺寸', request.dimensions],
    ['颜色', request.color],
    ['需求数量', request.qty]
  ];
  return (
    <>
      <button aria-label="关闭需求详情" className="fixed inset-0 z-[100] bg-slate-900/30" onClick={onClose} type="button" />
      <aside className="fixed right-0 top-0 z-[101] h-screen w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl" data-testid="product-request-detail">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900">需求订单详情</h2>
            <p className="mt-1 text-xs text-slate-500">需求单号：{request.id}</p>
          </div>
          <button aria-label="关闭" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-5 p-6">
          <section className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">需求名称</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">{request.name}</h3>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-slate-500">提交时间</p><p className="mt-1 text-slate-800">{formatDateTime(request.createdAt)}</p></div>
              <div><p className="text-xs text-slate-500">类目</p><p className="mt-1 text-slate-800">{categoryName}</p></div>
              <div className="col-span-2"><p className="text-xs text-slate-500">客户 ID</p><p className="mt-1 break-all font-mono text-xs text-slate-800">{request.createdByUserId}</p></div>
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">需求参数</h3>
            <dl className="mt-3 grid grid-cols-2 gap-4">
              {fields.map(([label, value]) => (
                <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-800">{value || '--'}</dd></div>
              ))}
            </dl>
          </section>
          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">需求说明</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{request.note || '暂无补充说明'}</p>
          </section>
          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">参考图片（{request.referenceImageUrls.length}）</h3>
            {request.referenceImageUrls.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {request.referenceImageUrls.map((url, index) => (
                  <button className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50" key={`${url}-${index}`} onClick={() => onPreview(url)} type="button">
                    <img alt={`需求参考图 ${index + 1}`} className="h-full w-full object-cover" src={url} />
                  </button>
                ))}
              </div>
            ) : <p className="mt-2 text-sm text-slate-500">暂无参考图片。</p>}
          </section>
        </div>
      </aside>
    </>
  );
};

export const ProductRequestsPage = () => {
  const [context, setContext] = useState<PageContext>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [items, setItems] = useState<ProductRequestRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [createdAfter, setCreatedAfter] = useState('');
  const [createdBefore, setCreatedBefore] = useState('');
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ProductRequestRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    void ensureProtectedPage().then((resolved) => {
      if (!cancelled && resolved) setContext({ mode: resolved.mode === 'dev' ? 'dev' : 'mock' });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(queryInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    if (!context) return;
    let cancelled = false;
    const load = async () => {
      setLoadState('loading');
      setErrorMessage('');
      try {
        if (context.mode === 'mock') {
          const allItems = buildMockProductRequests().filter((item) => {
            const created = new Date(item.createdAt).getTime();
            const after = createdAfter ? new Date(toDateBoundary(createdAfter) as string).getTime() : Number.NEGATIVE_INFINITY;
            const before = createdBefore ? new Date(toDateBoundary(createdBefore, true) as string).getTime() : Number.POSITIVE_INFINITY;
            return matchesProductRequestQuery(item, query) && created >= after && created <= before;
          });
          const start = (page - 1) * PAGE_SIZE;
          if (!cancelled) {
            setItems(allItems.slice(start, start + PAGE_SIZE));
            setTotal(allItems.length);
            setCategories(buildDefaultCategories());
            setLoadState('ready');
          }
          return;
        }
        const [requestResponse, categoryResponse] = await Promise.all([
          fetchProductRequests({
            q: query || undefined,
            createdAfter: toDateBoundary(createdAfter),
            createdBefore: toDateBoundary(createdBefore, true),
            page,
            pageSize: PAGE_SIZE
          }),
          fetchCatalogCategories().catch(() => null)
        ]);
        if (requestResponse.status !== 200 || !Array.isArray(requestResponse.data?.items)) {
          throw new Error('需求订单加载失败。');
        }
        if (!cancelled) {
          setItems(requestResponse.data.items.map((item, index) => normalizeProductRequest(item, index)));
          setTotal(Number(requestResponse.data.total || 0));
          setCategories(categoryResponse?.status === 200 && Array.isArray(categoryResponse.data?.items)
            ? categoryResponse.data.items as CategoryItem[]
            : []);
          setLoadState('ready');
        }
      } catch (error) {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
          setLoadState('error');
          setErrorMessage(error instanceof Error ? error.message : '需求订单加载失败。');
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [context, createdAfter, createdBefore, page, query]);

  const categoryNameById = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" data-testid="product-requests-page">
      <AdminTopbar searchPlaceholder="搜索需求订单..." leftSlot={<h2 className="text-xl font-bold text-slate-900">需求订单</h2>} />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div><h1 className="text-3xl font-black text-slate-900">客户需求订单</h1><p className="mt-2 text-sm text-slate-500">查看客户在小程序提交的找货与非标寻源需求。</p></div>
            <a className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary" href="/import.html#request-export">
              <span className="material-symbols-outlined text-lg">download</span>导出需求
            </a>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_180px_auto]">
              <label className="text-xs text-slate-500">关键字
                <input className="mt-1 w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" data-testid="request-search" onChange={(event) => setQueryInput(event.target.value)} placeholder="需求编号、客户 ID、名称或参数" type="search" value={queryInput} />
              </label>
              <label className="text-xs text-slate-500">开始日期
                <input className="mt-1 w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" data-testid="request-created-after" onChange={(event) => { setCreatedAfter(event.target.value); setPage(1); }} type="date" value={createdAfter} />
              </label>
              <label className="text-xs text-slate-500">结束日期
                <input className="mt-1 w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" data-testid="request-created-before" onChange={(event) => { setCreatedBefore(event.target.value); setPage(1); }} type="date" value={createdBefore} />
              </label>
              <button className="self-end rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={() => { setQueryInput(''); setQuery(''); setCreatedAfter(''); setCreatedBefore(''); setPage(1); }} type="button">清空筛选</button>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-4">提交时间</th><th className="px-5 py-4">需求内容</th><th className="px-5 py-4">数量</th><th className="px-5 py-4">类目</th><th className="px-5 py-4">客户 ID</th><th className="px-5 py-4">参考图</th><th className="px-5 py-4 text-right">操作</th></tr></thead>
                <tbody className="divide-y divide-slate-100" data-testid="product-request-table-body">
                  {loadState === 'loading' ? <tr><td className="px-5 py-12 text-center text-slate-500" colSpan={7}>正在加载需求订单...</td></tr> : null}
                  {loadState === 'error' ? <tr><td className="px-5 py-12 text-center text-red-600" colSpan={7}>{errorMessage}</td></tr> : null}
                  {loadState === 'ready' && items.length === 0 ? <tr><td className="px-5 py-12 text-center text-slate-500" colSpan={7}>当前筛选条件下暂无需求订单。</td></tr> : null}
                  {loadState === 'ready' ? items.map((item) => (
                    <tr className="hover:bg-slate-50" data-request-id={item.id} key={item.id}>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDateTime(item.createdAt)}</td>
                      <td className="max-w-xs px-5 py-4"><p className="font-semibold text-slate-900">{item.name}</p><p className="mt-1 truncate text-xs text-slate-500">{item.spec || item.material || item.note || '暂无参数说明'}</p></td>
                      <td className="px-5 py-4 text-slate-700">{item.qty || '--'}</td>
                      <td className="px-5 py-4 text-slate-700">{categoryNameById.get(item.categoryId) || '未分类'}</td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-600" title={item.createdByUserId}>{shortId(item.createdByUserId)}</td>
                      <td className="px-5 py-4 text-slate-700">{item.referenceImageUrls.length} 张</td>
                      <td className="px-5 py-4 text-right"><button className="font-medium text-primary hover:text-primary-dark" data-testid={`view-product-request-${item.id}`} onClick={() => setSelectedRequest(item)} type="button">查看</button></td>
                    </tr>
                  )) : null}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4"><p className="text-sm text-slate-500">显示 {from}-{to} 条，共 {total} 条</p><div className="flex gap-2"><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40" data-testid="request-prev-page" disabled={page <= 1 || loadState === 'loading'} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">上一页</button><span className="px-2 py-1.5 text-sm text-slate-600">{page}/{totalPages}</span><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40" data-testid="request-next-page" disabled={page >= totalPages || loadState === 'loading'} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">下一页</button></div></div>
          </section>
        </div>
      </main>

      <ProductRequestDrawer categoryName={categoryNameById.get(selectedRequest?.categoryId || '') || '未分类'} onClose={() => setSelectedRequest(null)} onPreview={setPreviewUrl} request={selectedRequest} />
      {previewUrl ? <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-6" onClick={() => setPreviewUrl('')} role="presentation"><button aria-label="关闭图片预览" className="absolute right-6 top-6 text-white" onClick={() => setPreviewUrl('')} type="button"><span className="material-symbols-outlined text-3xl">close</span></button><img alt="需求参考图大图" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" onClick={(event) => event.stopPropagation()} src={previewUrl} /></div> : null}
    </div>
  );
};
