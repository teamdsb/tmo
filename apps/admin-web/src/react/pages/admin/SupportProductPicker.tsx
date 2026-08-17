import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, Search, X } from 'lucide-react';

import { fetchProducts } from '../../../lib/api';

export type SupportProductOption = {
  id: string;
  name: string;
  coverImageUrl?: string | null;
  status?: string;
};

type SupportProductPickerProps = {
  open: boolean;
  disabled?: boolean;
  onClose: () => void;
  onSelect: (product: SupportProductOption) => Promise<void> | void;
};

const PAGE_SIZE = 12;

const normalizeProduct = (value: unknown): SupportProductOption | null => {
  const item = value as Record<string, unknown> | null;
  const id = String(item?.id || '').trim();
  const name = String(item?.name || '').trim();
  if (!id || !name) {
    return null;
  }
  return {
    id,
    name,
    coverImageUrl: typeof item?.coverImageUrl === 'string' ? item.coverImageUrl : '',
    status: typeof item?.status === 'string' ? item.status : ''
  };
};

export const SupportProductPicker = ({ open, disabled = false, onClose, onSelect }: SupportProductPickerProps) => {
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState<SupportProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [selectingId, setSelectingId] = useState('');

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const loadProducts = useCallback(async (nextPage: number, nextQuery: string) => {
    setLoading(true);
    setError('');
    setActionError('');
    try {
      const response = await fetchProducts({
        page: nextPage,
        pageSize: PAGE_SIZE,
        q: nextQuery || undefined
      });
      if (response.status !== 200) {
        const errorData = response?.data as { message?: string } | null;
        throw new Error(errorData?.message || '加载商品失败');
      }
      const items = Array.isArray(response?.data?.items)
        ? response.data.items.map((item) => normalizeProduct(item)).filter(Boolean) as SupportProductOption[]
        : [];
      setProducts(items);
      setTotal(Number(response?.data?.total) || 0);
      setPage(nextPage);
      setQuery(nextQuery);
    } catch (loadError) {
      setProducts([]);
      setTotal(0);
      setError(loadError instanceof Error ? loadError.message : '加载商品失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSearchInput('');
    setActionError('');
    void loadProducts(1, '');
  }, [loadProducts, open]);

  if (!open) {
    return null;
  }

  const submitSearch = () => {
    if (loading) {
      return;
    }
    void loadProducts(1, searchInput.trim());
  };

  const selectProduct = async (product: SupportProductOption) => {
    if (disabled || selectingId) {
      return;
    }
    setActionError('');
    setSelectingId(product.id);
    try {
      await onSelect(product);
    } catch (selectError) {
      setActionError(selectError instanceof Error ? selectError.message : '商品卡片发送失败');
    } finally {
      setSelectingId('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6" data-testid="support-product-picker">
      <section className="flex max-h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="选择商品">
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">选择要发送的商品</h2>
            <p className="mt-1 text-xs text-slate-500">仅展示当前已上架商品，客户可点击卡片进入详情。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="关闭商品选择器">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitSearch();
                }
              }}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500"
              placeholder="搜索商品名称"
              data-testid="support-product-search-input"
            />
          </div>
          <button
            type="button"
            onClick={submitSearch}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300"
            data-testid="support-product-search-submit"
          >
            搜索
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {actionError ? <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError}</p> : null}
          {loading ? <p className="py-16 text-center text-sm text-slate-500">正在加载商品...</p> : null}
          {!loading && error ? (
            <div className="py-16 text-center">
              <p className="text-sm text-rose-600">{error}</p>
              <button type="button" onClick={() => void loadProducts(page, query)} className="mt-3 text-sm font-semibold text-blue-600">重试</button>
            </div>
          ) : null}
          {!loading && !error && products.length === 0 ? <p className="py-16 text-center text-sm text-slate-500">没有找到匹配商品</p> : null}
          {!loading && !error && products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {products.map((product) => (
                <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex h-32 items-center justify-center bg-slate-100">
                    {product.coverImageUrl ? (
                      <img src={product.coverImageUrl} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <ImageOff className="h-7 w-7 text-slate-400" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 min-h-10 text-sm font-semibold text-slate-900">{product.name}</p>
                    <button
                      type="button"
                      disabled={disabled || Boolean(selectingId)}
                      onClick={() => void selectProduct(product)}
                      className="mt-3 w-full rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
                      data-testid={`support-product-select-${product.id}`}
                    >
                      {selectingId === product.id ? '发送中...' : '发送该商品'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-xs text-slate-500">第 {page} / {totalPages} 页，共 {total} 件商品</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => void loadProducts(page - 1, query)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40"
              data-testid="support-product-page-previous"
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </button>
            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => void loadProducts(page + 1, query)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40"
              data-testid="support-product-page-next"
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};
