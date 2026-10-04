import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import { fetchCatalogCategories, fetchProductDetail, fetchProducts } from '../../../lib/api';
import { AdminTopbar } from '../../layout/AdminTopbar';
import {
  buildDefaultCategories, buildMockProducts, CATEGORY_STORAGE_KEY, formatCurrency,
  mergeImportedMockProducts, MOCK_PRODUCTS_STORAGE_KEY, normalizeCategoryItem,
  normalizeProduct, PRODUCTS_PAGE_SIZE, readStoredJson, resolveCategoryLabel,
  type CategoryItem, type ProductRecord
} from './products-data';

type Props = {
  mode: 'dev' | 'mock';
  normalizeDetail: (detail: unknown, fallback: ProductRecord) => ProductRecord;
};

const replaceProductQuery = (id: string) => {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('productId', id);
  else url.searchParams.delete('productId');
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
};

// Read access never mounts the management page or calls its write/review APIs.
export const ReadonlyProductsPage = ({ mode, normalizeDetail }: Props) => {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim());
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('productId') || '');
  const [detail, setDetail] = useState<ProductRecord | null>(null);
  const [detailError, setDetailError] = useState('');
  const totalPages = Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE));

  const mockProducts = useMemo(() => {
    if (mode !== 'mock') return [];
    const stored = readStoredJson<unknown[]>(MOCK_PRODUCTS_STORAGE_KEY);
    const items = Array.isArray(stored) ? stored.map((item, index) => normalizeProduct(item, index)) : buildMockProducts(30);
    return mergeImportedMockProducts(items).filter(product => product.status === 'ACTIVE');
  }, [mode]);

  useEffect(() => {
    let active = true;
    if (mode === 'mock') {
      const stored = readStoredJson<unknown[]>(CATEGORY_STORAGE_KEY);
      setCategories(Array.isArray(stored) ? stored.map((item, index) => normalizeCategoryItem(item, index)) : buildDefaultCategories());
      return;
    }
    void fetchCatalogCategories().then(response => {
      if (active && response.status === 200) {
        setCategories((response.data?.items || []).map((item, index) => normalizeCategoryItem(item, index)));
      }
    }).catch(() => { /* Product browsing remains available if category labels fail. */ });
    return () => { active = false; };
  }, [mode]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const load = async () => {
      if (mode === 'mock') {
        const keyword = query.toLowerCase();
        const filtered = mockProducts.filter(product => (!categoryId || product.categoryId === categoryId)
          && (!keyword || [product.name, product.id, ...product.models.map(model => model.code)].some(value => value.toLowerCase().includes(keyword))));
        setProducts(filtered.slice((page - 1) * PRODUCTS_PAGE_SIZE, page * PRODUCTS_PAGE_SIZE));
        setTotal(filtered.length);
        setLoading(false);
        return;
      }
      try {
        const response = await fetchProducts({ page, pageSize: PRODUCTS_PAGE_SIZE, status: 'ACTIVE', q: query || undefined, categoryId: categoryId || undefined });
        if (!active) return;
        if (response.status !== 200 || !Array.isArray(response.data?.items)) {
          const failure = response.data as { message?: string } | null;
          throw new Error(failure?.message || '商品列表加载失败，请重试。');
        }
        setProducts(response.data.items.map((item, index) => normalizeProduct(item, index)));
        setTotal(response.data.total || 0);
      } catch (failure) {
        if (!active) return;
        setProducts([]);
        setTotal(0);
        setError(failure instanceof Error ? failure.message : '商品列表加载失败，请重试。');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [mode, mockProducts, page, query, categoryId]);

  useEffect(() => {
    let active = true;
    setDetail(null);
    setDetailError('');
    if (!selectedId) return;
    if (mode === 'mock') {
      const product = mockProducts.find(item => item.id === selectedId);
      if (product) setDetail(product);
      else setDetailError('目标商品不存在或已下架。');
      return;
    }
    void fetchProductDetail(selectedId).then(response => {
      if (!active) return;
      if (response.status !== 200 || !response.data?.product || response.data.product.status !== 'ACTIVE') throw new Error('目标商品不存在或无法访问。');
      setDetail(normalizeDetail(response.data, normalizeProduct(response.data.product)));
    }).catch(failure => {
      if (active) setDetailError(failure instanceof Error ? failure.message : '商品详情加载失败。');
    });
    return () => { active = false; };
  }, [selectedId, mode, mockProducts, normalizeDetail]);

  const closeDetail = () => { setSelectedId(''); replaceProductQuery(''); };
  const openDetail = (id: string) => { setSelectedId(id); replaceProductQuery(id); };

  return <>
    <AdminTopbar title="商品中心" />
    <main className="flex-1 space-y-6 overflow-y-auto bg-background-light p-6 dark:bg-background-dark" data-testid="readonly-products-page">
      <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">商品目录（只读）</h1><p className="mt-2 text-sm text-slate-500">查看在售商品、规格与价格。</p></div>
      <div className="flex flex-wrap gap-3">
        <input aria-label="搜索在售商品" className="min-w-56 flex-1 rounded-lg border-slate-300" placeholder="搜索在售商品" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
        <select aria-label="商品分类" className="rounded-lg border-slate-300" value={categoryId} onChange={event => { setCategoryId(event.target.value); setPage(1); }}>
          <option value="">全部分类</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </div>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:bg-slate-900">
        <table className="w-full text-left text-sm"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="p-4">商品</th><th className="p-4">分类</th><th className="p-4">操作</th></tr></thead><tbody>
          {loading ? <tr><td colSpan={3} className="p-6 text-slate-500">加载中...</td></tr> : products.length ? products.map(product => <tr key={product.id} className="border-b border-slate-100" data-product-id={product.id}>
            <td className="p-4"><p className="font-semibold text-slate-900 dark:text-white">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.id}</p></td>
            <td className="p-4 text-slate-500">{resolveCategoryLabel(product.categoryId, categories)}</td>
            <td className="p-4"><button type="button" className="text-primary" onClick={() => openDetail(product.id)}>查看详情</button></td>
          </tr>) : <tr><td colSpan={3} className="p-6 text-slate-500">暂无匹配的在售商品</td></tr>}
        </tbody></table>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-500"><span>共 {total} 项 · 第 {page} / {totalPages} 页</span><div className="flex gap-3">
        <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button>
        <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40" disabled={loading || page >= totalPages} onClick={() => setPage(value => value + 1)}>下一页</button>
      </div></div>
    </main>
    {selectedId ? <div className="fixed inset-0 z-[95] flex justify-end bg-slate-900/25" onClick={event => { if (event.target === event.currentTarget) closeDetail(); }}>
      <aside role="dialog" aria-modal="true" aria-label="商品详情（只读）" className="h-screen w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4"><h2 className="text-lg font-bold text-slate-900 dark:text-white">商品详情（只读）</h2><button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={closeDetail}>关闭</button></div>
        {detailError ? <p role="alert" className="mt-5 text-sm text-red-600">{detailError}</p> : detail ? <div className="space-y-5 py-5 text-sm text-slate-700 dark:text-slate-200">
          <div><h3 className="text-xl font-semibold">{detail.name}</h3><p className="mt-2 whitespace-pre-wrap">{detail.description || '暂无商品简介'}</p></div>
          {detail.images.length ? <div className="flex flex-wrap gap-3">{detail.images.map((url, index) => <img key={`${url}-${index}`} className="h-28 w-28 rounded-lg object-contain" src={url} alt={`${detail.name}图片 ${index + 1}`} />)}</div> : null}
          <h3 className="font-semibold">规格与阶梯价</h3>
          {detail.models.filter(model => model.isActive).map((model, index) => <section key={model.id || index} className="space-y-2 rounded-lg border border-slate-200 p-4">
            <p className="font-semibold">{model.name}</p><p>规格：{model.spec || '未填写'} · 单位：{model.unit || '未填写'}</p><p>SKU：{model.code || '未设置编码'}</p>
            {model.priceTiers?.length ? <ul className="space-y-1">{model.priceTiers.map(tier => <li key={tier.minQty}>{tier.minQty}{tier.maxQty ? `–${tier.maxQty}` : '+'} {model.unit || '件'}：{formatCurrency(tier.unitPriceFen / 100)}</li>)}</ul> : <p>{mode === 'mock' && model.basePrice > 0 ? formatCurrency(model.basePrice) : '价格需询价'}</p>}
          </section>)}
          {!detail.models.some(model => model.isActive) ? <p>暂无在售规格</p> : null}
        </div> : <p className="py-6 text-sm text-slate-500">加载商品详情...</p>}
      </aside>
    </div> : null}
  </>;
};
