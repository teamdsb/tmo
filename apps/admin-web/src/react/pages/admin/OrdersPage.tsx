import { useEffect, useMemo, useState } from 'react';

import {
  confirmOrderDelivery,
  fetchOrderAdminEvents,
  fetchOrders,
  fetchProducts,
  fetchStaffUsers,
  shipOrder,
  updateOrderFulfillment
} from '../../../lib/api';
import { ensureProtectedPage } from '../../../lib/guard';
import { hasPermission, normalizePermissionMap } from '../../../lib/permissions';
import { AdminTopbar } from '../../layout/AdminTopbar';
import {
  buildDevOrders,
  buildMockOrders,
  countByTab,
  formatAmount,
  getInitials,
  getStatusTone,
  ORDER_TABS,
  type AdminOrderRecord,
  type OrderLineItem,
  type OrderStatusTone,
  type OrderTabKey
} from './orders-data';
import {
  buildMockProducts,
  mergeImportedMockProducts,
  MOCK_PRODUCTS_STORAGE_KEY,
  normalizeProduct,
  readStoredJson,
  type ProductRecord
} from './products-data';

type PageContext = {
  mode: 'dev' | 'mock';
  session?: unknown;
} | null;

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type SalesUser = { id: string; displayName?: string; roles?: string[]; status?: string };
type AdminEvent = { id: string; action: string; note: string; createdAt: string; newOwnerSalesUserId: string };

const STATUS_BADGE_CLASS: Record<OrderStatusTone, { badge: string; dot: string }> = {
  blue: {
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-600 dark:bg-blue-400'
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-600 dark:bg-amber-400'
  },
  green: {
    badge: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
    dot: 'bg-green-600 dark:bg-green-400'
  },
  gray: {
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    dot: 'bg-gray-500'
  },
  red: {
    badge: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
    dot: 'bg-red-600 dark:bg-red-400'
  }
};

const cloneLineItems = (items: OrderLineItem[]): OrderLineItem[] => items.map((item) => ({ ...item }));

const cloneOrder = (order: AdminOrderRecord): AdminOrderRecord => ({
  ...order,
  customer: { ...order.customer },
  lineItems: cloneLineItems(order.lineItems),
  timeline: order.timeline.map((item) => ({ ...item }))
});

const buildSummaryText = (total: number, page: number, pageSize: number, visibleCount: number) => {
  if (total === 0 || visibleCount === 0) {
    return (
      <>
        显示第 <span className="font-medium text-text-main dark:text-text-main-dark">0</span> 到{' '}
        <span className="font-medium text-text-main dark:text-text-main-dark">0</span> 条，共{' '}
        <span className="font-medium text-text-main dark:text-text-main-dark">0</span> 条结果
      </>
    );
  }

  const from = (page - 1) * pageSize + 1;
  const to = from + visibleCount - 1;

  return (
    <>
      显示第 <span className="font-medium text-text-main dark:text-text-main-dark">{from}</span> 到{' '}
      <span className="font-medium text-text-main dark:text-text-main-dark">{to}</span> 条，共{' '}
      <span className="font-medium text-text-main dark:text-text-main-dark">{total}</span> 条结果
    </>
  );
};

const ToneBadge = ({ statusLabel, tone }: { statusLabel: string; tone: OrderStatusTone }) => {
  const toneClass = STATUS_BADGE_CLASS[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass.badge}`}
    >
      <span className={`size-1.5 rounded-full ${toneClass.dot}`}></span>
      {statusLabel}
    </span>
  );
};

const StatusBadge = ({ statusKey, statusLabel }: { statusKey: string; statusLabel: string }) => {
  return <ToneBadge statusLabel={statusLabel} tone={getStatusTone(statusKey)} />;
};

const getPaymentMeta = (order: AdminOrderRecord): { statusLabel: string; tone: OrderStatusTone; transactionId: string } => {
  const transactionId = `TXN-${order.id.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`;
  const paymentStatus = String(order.paymentStatus || 'UNPAID').toUpperCase();
  if (paymentStatus === 'PAID') {
    return { statusLabel: '已支付', tone: 'green', transactionId };
  }
  if (paymentStatus === 'PAY_PENDING') {
    return { statusLabel: '待支付', tone: 'amber', transactionId };
  }
  if (paymentStatus === 'PAY_FAILED') {
    return { statusLabel: '支付失败', tone: 'red', transactionId };
  }
  return { statusLabel: '未支付', tone: 'gray', transactionId };
};

type OrderDetailDrawerProps = {
  onClose: () => void;
  onSave: (order: AdminOrderRecord) => void;
  order: AdminOrderRecord | null;
  products: ProductRecord[];
};

const OrderDetailDrawer = ({ onClose, onSave, order, products }: OrderDetailDrawerProps) => {
  const [draft, setDraft] = useState<AdminOrderRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [openProductPickerIndex, setOpenProductPickerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!order) {
      setDraft(null);
    } else {
      const nextOrder = cloneOrder(order);
      nextOrder.lineItems = nextOrder.lineItems.map((item) => {
        const matchedProduct = products.find((product) => (
          product.id === item.productId || product.name === item.name
        ));
        return matchedProduct
          ? { ...item, name: matchedProduct.name, productId: matchedProduct.id }
          : item;
      });
      setDraft(nextOrder);
    }
    setErrorMessage('');
    setOpenProductPickerIndex(null);
  }, [order, products]);

  if (!draft) {
    return null;
  }

  const updateLineItem = (index: number, patch: Partial<OrderLineItem>) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const nextItems = current.lineItems.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
      return { ...current, lineItems: nextItems };
    });
  };

  const removeLineItem = (index: number) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const remaining = current.lineItems.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        lineItems: remaining.length > 0 ? remaining : [{ name: '', productId: '', qty: 1, size: '默认' }]
      };
    });
  };

  const addLineItem = () => {
    setDraft((current) => (
      current
        ? { ...current, lineItems: [...current.lineItems, { name: '', productId: '', qty: 1, size: '默认' }] }
        : current
    ));
  };

  const productCount = draft.lineItems.reduce((sum, item) => sum + item.qty, 0);

  const handleSave = () => {
    const buyerName = draft.customer.name.trim();
    const buyerPhone = draft.customer.phone.trim();
    const buyerAddress = draft.customer.address.trim();
    const invalidProductIndex = draft.lineItems.findIndex((item) => !products.some((product) => (
      product.id === item.productId || (!item.productId && product.name === item.name.trim())
    )));
    const lineItems = draft.lineItems.map((item) => {
      const selectedProduct = products.find((product) => (
        product.id === item.productId || (!item.productId && product.name === item.name.trim())
      ));
      return {
        name: selectedProduct?.name || '',
        productId: selectedProduct?.id || '',
        qty: Number.isFinite(Number(item.qty)) && Number(item.qty) > 0 ? Number(item.qty) : 1,
        size: item.size.trim() || '默认'
      };
    });

    if (!buyerName || !buyerPhone || !buyerAddress) {
      setErrorMessage('请补全买家姓名、联系电话和地址。');
      return;
    }

    if (lineItems.length === 0 || invalidProductIndex >= 0) {
      setErrorMessage(`第 ${Math.max(0, invalidProductIndex) + 1} 条商品明细请选择现有商品。`);
      return;
    }

    onSave({
      ...draft,
      customer: {
        ...draft.customer,
        name: buyerName,
        phone: buyerPhone,
        address: buyerAddress
      },
      lineItems
    });
  };

  return (
    <>
      <button
        aria-label="关闭订单详情"
        className="fixed inset-0 z-[100] bg-slate-900/30"
        onClick={onClose}
        type="button"
      />
      <aside className="fixed right-0 top-0 z-[101] h-screen w-full max-w-lg overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">订单详情（只读）</h3>
            <p className="text-xs text-slate-500" data-role="detail-order-id">订单号：{draft.id}</p>
          </div>
          <button
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            data-role="close-detail-drawer"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <fieldset className="space-y-5" disabled>
          <section className="rounded-xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-900">买家信息</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-700">
              <label className="text-xs text-slate-500">
                姓名
                <input
                  className="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary"
                  data-role="detail-buyer-name"
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => current ? { ...current, customer: { ...current.customer, name: value } } : current);
                  }}
                  type="text"
                  value={draft.customer.name}
                />
              </label>
              <label className="text-xs text-slate-500">
                联系电话
                <input
                  className="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary"
                  data-role="detail-buyer-phone"
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => current ? { ...current, customer: { ...current.customer, phone: value } } : current);
                  }}
                  type="text"
                  value={draft.customer.phone}
                />
              </label>
              <label className="text-xs text-slate-500">
                邮箱
                <input
                  className="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary"
                  data-role="detail-buyer-email"
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => current ? { ...current, customer: { ...current.customer, email: value } } : current);
                  }}
                  type="email"
                  value={draft.customer.email}
                />
              </label>
              <label className="text-xs text-slate-500">
                地址
                <textarea
                  className="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary"
                  data-role="detail-buyer-address"
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => current ? { ...current, customer: { ...current.customer, address: value } } : current);
                  }}
                  rows={2}
                  value={draft.customer.address}
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-900">购买信息</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-700">
              <label className="text-xs text-slate-500">
                购买时间
                <input
                  className="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary"
                  data-role="detail-purchased-at"
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => current ? { ...current, purchasedAt: value } : current);
                  }}
                  type="text"
                  value={draft.purchasedAt}
                />
              </label>
              <p className="text-sm">
                <span className="text-slate-500">购买商品总数量：</span>
                <span data-role="detail-product-count">{productCount} 件</span>
              </p>
              <label className="text-xs text-slate-500">
                订单金额（只读）
                <input
                  className="mt-1 w-full rounded-md border-slate-300 bg-slate-50 text-sm text-slate-600"
                  data-role="detail-order-amount"
                  readOnly
                  type="text"
                  value={formatAmount(draft.amount)}
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">商品明细（数量 / 尺码）</h4>
              <button
                className="text-xs font-medium text-primary hover:text-primary-dark"
                data-role="detail-add-item"
                onClick={addLineItem}
                type="button"
              >
                新增商品
              </button>
            </div>
            <div className="mt-3 space-y-2" data-role="detail-line-items">
              {draft.lineItems.map((item, index) => (
                <div
                  className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                  data-role="detail-line-item-row"
                  key={`${draft.id}-line-item-${index}`}
                >
                  <div className="grid grid-cols-12 gap-2">
                    <label className="relative col-span-6 text-xs text-slate-500">
                      选择商品
                      <input
                        aria-autocomplete="list"
                        aria-expanded={openProductPickerIndex === index}
                        className="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary"
                        data-role="detail-item-product-search"
                        onChange={(event) => {
                          updateLineItem(index, { name: event.target.value, productId: '' });
                          setOpenProductPickerIndex(index);
                        }}
                        onFocus={() => setOpenProductPickerIndex(index)}
                        onBlur={() => {
                          window.setTimeout(() => {
                            setOpenProductPickerIndex((current) => current === index ? null : current);
                          }, 0);
                        }}
                        placeholder="搜索商品名称或 SPU 编号"
                        role="combobox"
                        type="search"
                        value={item.name}
                      />
                      {openProductPickerIndex === index ? (
                        <div
                          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
                          data-role="detail-product-options"
                          role="listbox"
                        >
                          {products.filter((product) => {
                            const query = item.name.trim().toLowerCase();
                            return !query || product.name.toLowerCase().includes(query) || product.id.toLowerCase().includes(query);
                          }).slice(0, 30).map((product) => (
                            <button
                              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-primary/5 hover:text-primary"
                              data-product-id={product.id}
                              data-role="detail-product-option"
                              key={product.id}
                              onClick={() => {
                                updateLineItem(index, { name: product.name, productId: product.id });
                                setOpenProductPickerIndex(null);
                                setErrorMessage('');
                              }}
                              onMouseDown={(event) => event.preventDefault()}
                              type="button"
                            >
                              <span className="min-w-0 truncate font-medium">{product.name}</span>
                              <span className="shrink-0 text-[10px] text-slate-400">{product.id}</span>
                            </button>
                          ))}
                          {products.length === 0 ? (
                            <p className="px-3 py-3 text-xs text-slate-500">暂无可选商品，请先在商品中心新增商品。</p>
                          ) : products.every((product) => {
                            const query = item.name.trim().toLowerCase();
                            return query && !product.name.toLowerCase().includes(query) && !product.id.toLowerCase().includes(query);
                          }) ? (
                            <p className="px-3 py-3 text-xs text-slate-500">没有匹配的现有商品。</p>
                          ) : null}
                        </div>
                      ) : null}
                    </label>
                    <label className="col-span-3 text-xs text-slate-500">
                      数量
                      <input
                        className="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary"
                        data-role="detail-item-qty"
                        min={1}
                        onChange={(event) => updateLineItem(index, { qty: Number(event.target.value) || 1 })}
                        type="number"
                        value={item.qty}
                      />
                    </label>
                    <label className="col-span-3 text-xs text-slate-500">
                      尺码
                      <input
                        className="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary"
                        data-role="detail-item-size"
                        onChange={(event) => updateLineItem(index, { size: event.target.value })}
                        type="text"
                        value={item.size}
                      />
                    </label>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                      data-role="detail-remove-item"
                      onClick={() => removeLineItem(index)}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          </fieldset>
          {errorMessage ? (
            <p className="text-sm text-red-600" data-role="detail-form-error">{errorMessage}</p>
          ) : null}

          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white py-3">
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              data-role="cancel-detail-save"
              onClick={onClose}
              type="button"
            >
              关闭
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

const OrdersSkeleton = () => (
  <div className="mx-auto max-w-7xl animate-pulse">
    <div className="mb-6 h-12 rounded-xl bg-slate-200 dark:bg-slate-800" />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 h-[520px] rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="h-[520px] rounded-xl bg-slate-200 dark:bg-slate-800" />
    </div>
  </div>
);

export const OrdersPage = () => {
  const [context, setContext] = useState<PageContext>(null);
  const [ready, setReady] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [activeTab, setActiveTab] = useState<OrderTabKey>('shipped');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [editingOrderId, setEditingOrderId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [ownerSalesUserId, setOwnerSalesUserId] = useState('');
  const [fulfillmentNote, setFulfillmentNote] = useState('');
  const [fulfillmentError, setFulfillmentError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shipCarrier, setShipCarrier] = useState('');
  const [shipWaybillNo, setShipWaybillNo] = useState('');
  const [shipError, setShipError] = useState('');
  const [isShipping, setIsShipping] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');
  const [isDelivering, setIsDelivering] = useState(false);

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

  useEffect(() => {
    if (!context) {
      return;
    }

    let cancelled = false;

    const loadOrders = async () => {
      setLoadState('loading');
      setErrorMessage('');

      try {
        const nextOrders = context.mode === 'dev'
          ? fetchOrders({ page: 1, pageSize: 20 }).then((response) => {
              if (response.status !== 200 || !response.data) {
                throw new Error('加载 /orders 失败');
              }
              return buildDevOrders(response.data as { items?: unknown[]; total?: number });
            })
          : Promise.resolve(buildMockOrders());
        const nextProducts = context.mode === 'dev'
          ? fetchProducts({ page: 1, pageSize: 200, status: 'ALL' }).then((response) => {
              if (response.status !== 200 || !Array.isArray(response.data?.items)) {
                throw new Error('加载现有商品失败');
              }
              return response.data.items.map((item, index) => normalizeProduct(item, index));
            })
          : Promise.resolve((() => {
              const storedProducts = readStoredJson<unknown[]>(MOCK_PRODUCTS_STORAGE_KEY);
              const baseProducts = Array.isArray(storedProducts) && storedProducts.length > 0
                ? storedProducts.map((item, index) => normalizeProduct(item, index))
                : buildMockProducts(30);
              return mergeImportedMockProducts(baseProducts);
            })());
        const nextSales = context.mode === 'dev'
          ? fetchStaffUsers({ role: 'SALES', status: 'active', page: 1, pageSize: 100 }).then((response) => {
              if (response.status !== 200) throw new Error('加载业务员失败');
              return ((response.data as { items?: SalesUser[] })?.items || []).filter((item) => item.status === 'active' && item.roles?.includes('SALES'));
            })
          : Promise.resolve([{ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', displayName: 'Mock 业务员', roles: ['SALES'], status: 'active' }]);

        const [resolvedOrders, resolvedProducts, resolvedSales] = await Promise.all([nextOrders, nextProducts, nextSales]);
        if (cancelled) {
          return;
        }

        setOrders(resolvedOrders);
        setProducts(resolvedProducts);
        setSalesUsers(resolvedSales);
        const defaultTab = resolvedOrders.some((order) => order.tab === 'shipped')
          ? 'shipped'
          : (ORDER_TABS.find((tab) => resolvedOrders.some((order) => order.tab === tab.key))?.key || 'submitted');
        setActiveTab(defaultTab);
        setPage(1);
        setSelectedId(resolvedOrders.find((order) => order.tab === defaultTab)?.id || resolvedOrders[0]?.id || '');
        setLoadState('ready');
      } catch (error) {
        if (cancelled) {
          return;
        }
        setOrders([]);
        setLoadState('error');
        setErrorMessage(error instanceof Error ? error.message : '订单加载失败');
      }
    };

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [context]);

  const pageSize = context?.mode === 'dev' ? 20 : 5;
  const filteredOrders = useMemo(() => orders.filter((order) => order.tab === activeTab), [activeTab, orders]);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, pageSize, safePage]);

  useEffect(() => {
    if (filteredOrders.some((order) => order.id === selectedId)) {
      return;
    }
    setSelectedId(pageItems[0]?.id || filteredOrders[0]?.id || '');
  }, [filteredOrders, pageItems, selectedId]);

  const selectedOrder = filteredOrders.find((order) => order.id === selectedId) || pageItems[0] || null;
  const editingOrder = orders.find((order) => order.id === editingOrderId) || null;
  const session = (context?.session || {}) as { currentRole?: string; permissions?: { items?: unknown[] } };
  const currentRole = String(session.currentRole || '').toUpperCase();
  const canManageOrders = ['BOSS', 'MANAGER', 'ADMIN'].includes(currentRole)
    && hasPermission(normalizePermissionMap(session.permissions), 'order:manage', 'ALL');
  const terminalOrder = selectedOrder ? ['SHIPPED', 'DELIVERED', 'CANCELLED', 'CLOSED', 'DISPATCHED', 'RETURNING', 'RETURNED'].includes(selectedOrder.statusKey.toUpperCase()) : true;
  const confirmOfflinePayment = selectedOrder?.paymentStatus !== 'PAID';
  const canShipOrder = Boolean(selectedOrder && selectedOrder.statusKey.toUpperCase() === 'CONFIRMED' && selectedOrder.paymentStatus === 'PAID');
  const canConfirmDelivery = Boolean(selectedOrder && ['SHIPPED', 'DISPATCHED', 'IN_TRANSIT'].includes(selectedOrder.statusKey.toUpperCase()));

  useEffect(() => {
    setOwnerSalesUserId(selectedOrder?.ownerSalesUserId || '');
    setFulfillmentNote('');
    setFulfillmentError('');
    setShipCarrier('');
    setShipWaybillNo(selectedOrder ? `MOCK-${selectedOrder.id.replace(/[^A-Za-z0-9]/g, '').slice(-10).toUpperCase()}` : '');
    setShipError('');
    setDeliveryError('');
    if (!selectedOrder || !canManageOrders) { setEvents([]); return; }
    if (context?.mode === 'mock') { return; }
    let cancelled = false;
    void fetchOrderAdminEvents(selectedOrder.id).then((response) => {
      if (!cancelled && response.status === 200) setEvents(((response.data as { items?: AdminEvent[] })?.items || []));
    });
    return () => { cancelled = true; };
  }, [canManageOrders, context?.mode, selectedOrder?.id]);

  const submitFulfillment = async () => {
    if (!selectedOrder || !ownerSalesUserId || !fulfillmentNote.trim()) { setFulfillmentError('请选择业务员并填写备注。'); return; }
    setIsSubmitting(true); setFulfillmentError('');
    try {
      if (context?.mode === 'mock') {
        const now = new Date().toISOString();
        setOrders((current) => current.map((order) => order.id === selectedOrder.id ? { ...order, statusKey: 'CONFIRMED', statusLabel: '已确认', tab: 'confirmed', paymentStatus: 'PAID', paymentChannel: confirmOfflinePayment ? 'OFFLINE' : order.paymentChannel, ownerSalesUserId } : order));
        setEvents((current) => [{ id: crypto.randomUUID(), action: confirmOfflinePayment ? 'OFFLINE_PAYMENT_AND_ASSIGN' : (selectedOrder.ownerSalesUserId ? 'REASSIGN' : 'ASSIGN'), note: fulfillmentNote.trim(), createdAt: now, newOwnerSalesUserId: ownerSalesUserId }, ...current]);
        setActiveTab('confirmed'); setFulfillmentNote(''); return;
      }
      const response = await updateOrderFulfillment(selectedOrder.id, { ownerSalesUserId, note: fulfillmentNote.trim(), confirmOfflinePayment }, crypto.randomUUID());
      if (response.status !== 200) throw new Error(String((response.data as { message?: string })?.message || '更新订单失败'));
      const refreshedResponse = await fetchOrders({ page: 1, pageSize: 20 });
      if (refreshedResponse.status !== 200) throw new Error('订单已更新，但刷新订单列表失败');
      const refreshedOrders = buildDevOrders(refreshedResponse.data as { items?: unknown[]; total?: number });
      const updated = refreshedOrders.find((order) => order.id === selectedOrder.id) || buildDevOrders({ items: [response.data] })[0];
      setOrders(refreshedOrders);
      setActiveTab(updated.tab); setSelectedId(updated.id); setFulfillmentNote('');
      const eventsResponse = await fetchOrderAdminEvents(updated.id);
      if (eventsResponse.status === 200) setEvents(((eventsResponse.data as { items?: AdminEvent[] })?.items || []));
    } catch (error) {
      setFulfillmentError(error instanceof Error ? error.message : '更新订单失败');
    } finally { setIsSubmitting(false); }
  };

  const submitShipment = async () => {
    if (!selectedOrder) {
      return;
    }
    const waybillNo = shipWaybillNo.trim();
    if (!waybillNo) {
      setShipError('请填写运单号。');
      return;
    }
    setIsShipping(true);
    setShipError('');
    try {
      if (context?.mode === 'mock') {
        const shippedAt = new Date().toISOString();
        setOrders((current) => current.map((order) => order.id === selectedOrder.id ? {
          ...order,
          statusKey: 'DISPATCHED',
          statusLabel: '已发出',
          tab: 'shipped',
          trackingNumber: waybillNo,
          shippingBadge: '已发出',
          timeline: [
            { title: '已发出', detail: `${shipCarrier.trim() || '平台配送'} • ${new Date(shippedAt).toLocaleString()}` },
            ...order.timeline
          ]
        } : order));
        setActiveTab('shipped');
        setShipCarrier('');
        setShipWaybillNo('');
        return;
      }
      const response = await shipOrder(selectedOrder.id, {
        carrier: shipCarrier.trim() || null,
        waybillNo,
        shippedAt: new Date().toISOString()
      });
      if (response.status !== 200) {
        throw new Error(String((response.data as { message?: string })?.message || '确认发货失败'));
      }
      const refreshedResponse = await fetchOrders({ page: 1, pageSize: 20 });
      if (refreshedResponse.status !== 200) {
        throw new Error('订单已发货，但刷新订单列表失败');
      }
      const refreshedOrders = buildDevOrders(refreshedResponse.data as { items?: unknown[]; total?: number });
      const updated = refreshedOrders.find((order) => order.id === selectedOrder.id) || buildDevOrders({ items: [response.data] })[0];
      const patchedOrders = refreshedOrders.map((order) => order.id === selectedOrder.id ? {
        ...order,
        trackingNumber: order.trackingNumber === '--' ? waybillNo : order.trackingNumber,
        timeline: order.timeline.length > 0 ? order.timeline : [
          { title: '已发出', detail: `${shipCarrier.trim() || '平台配送'} • ${new Date().toLocaleString()}` }
        ]
      } : order);
      setOrders(patchedOrders);
      setActiveTab(updated.tab);
      setSelectedId(updated.id);
      setShipCarrier('');
      setShipWaybillNo('');
    } catch (error) {
      setShipError(error instanceof Error ? error.message : '确认发货失败');
    } finally {
      setIsShipping(false);
    }
  };

  const submitDelivery = async () => {
    if (!selectedOrder) {
      return;
    }
    setIsDelivering(true);
    setDeliveryError('');
    try {
      if (context?.mode === 'mock') {
        setOrders((current) => current.map((order) => order.id === selectedOrder.id ? {
          ...order,
          statusKey: 'DELIVERED',
          statusLabel: '已送达',
          tab: 'delivered',
          shippingBadge: '配送完成',
          timeline: [
            { title: '已送达', detail: `管理员确认 • ${new Date().toLocaleString()}` },
            ...order.timeline
          ]
        } : order));
        setActiveTab('delivered');
        setSelectedId(selectedOrder.id);
        return;
      }
      const response = await confirmOrderDelivery(selectedOrder.id);
      if (response.status !== 200) {
        throw new Error(String((response.data as { message?: string })?.message || '确认送达失败'));
      }
      const refreshedResponse = await fetchOrders({ page: 1, pageSize: 20 });
      if (refreshedResponse.status !== 200) {
        throw new Error('订单已送达，但刷新订单列表失败');
      }
      const refreshedOrders = buildDevOrders(refreshedResponse.data as { items?: unknown[]; total?: number });
      const updated = refreshedOrders.find((order) => order.id === selectedOrder.id) || buildDevOrders({ items: [response.data] })[0];
      const patchedOrders = refreshedOrders.map((order) => order.id === selectedOrder.id ? {
        ...order,
        statusKey: 'DELIVERED',
        statusLabel: '已送达',
        tab: 'delivered',
        shippingBadge: '配送完成',
        timeline: order.timeline.length > 0 ? order.timeline : [
          { title: '已送达', detail: `管理员确认 • ${new Date().toLocaleString()}` }
        ]
      } : order);
      setOrders(patchedOrders);
      setActiveTab(updated.tab);
      setSelectedId(updated.id);
    } catch (error) {
      setDeliveryError(error instanceof Error ? error.message : '确认送达失败');
    } finally {
      setIsDelivering(false);
    }
  };

  const updateOrder = (nextOrder: AdminOrderRecord) => {
    setOrders((current) => current.map((order) => (order.id === nextOrder.id ? nextOrder : order)));
    setSelectedId(nextOrder.id);
    setEditingOrderId('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <AdminTopbar
        searchPlaceholder="搜索订单..."
        leftSlot={
          <div className="flex items-center gap-3">
            <div className="size-8 flex items-center justify-center rounded-lg bg-primary text-primary-content">
              <span className="material-symbols-outlined text-xl">local_shipping</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-text-main dark:text-text-main-dark">订单管理</h2>
          </div>
        }
      />

      <main className="flex-1 min-h-0 overflow-y-auto bg-background-light p-6 dark:bg-background-dark">
        {!ready || loadState === 'loading'
          ? <OrdersSkeleton />
          : loadState === 'error'
            ? (
              <div className="mx-auto max-w-7xl rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
                {errorMessage || '订单加载失败。'}
              </div>
              )
            : (
              <div className="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col gap-8">
                <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                  <div className="space-y-2">
                    <h1 className="text-3xl font-black tracking-tight text-text-main dark:text-text-main-dark md:text-4xl">订单履约</h1>
                  </div>
                  <a
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-content shadow-sm transition-colors hover:bg-primary-dark active:scale-95"
                    href="/import.html"
                  >
                    <span className="material-symbols-outlined text-[20px]">upload_file</span>
                    批量导入物流（Excel）
                  </a>
                </div>

                <div className="border-b border-border-light dark:border-border-dark">
                  <nav aria-label="Tabs" className="flex gap-8 overflow-x-auto" data-role="order-tabs">
                    {ORDER_TABS.map((tab) => {
                      const count = countByTab(orders, tab.key);
                      const isActive = activeTab === tab.key;
                      const activeClass = tab.isReturns
                        ? 'border-red-500 text-red-600'
                        : 'border-primary text-primary';
                      const inactiveClass = tab.isReturns
                        ? 'border-transparent text-red-500 hover:border-red-500 hover:text-red-600'
                        : 'border-transparent text-text-sub hover:border-text-sub hover:text-text-sub-dark dark:text-text-sub-dark dark:hover:text-text-main-dark';
                      const countClass = tab.isReturns
                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                        : isActive
                          ? 'bg-primary/10 text-primary'
                          : 'bg-background-light text-text-sub dark:bg-background-dark dark:text-text-sub-dark';

                      return (
                        <button
                          aria-current={isActive ? 'page' : undefined}
                          className={`border-b-2 py-4 px-1 text-sm font-medium whitespace-nowrap ${isActive ? activeClass : inactiveClass}`}
                          data-role="order-tab"
                          data-tab={tab.key}
                          key={tab.key}
                          onClick={() => {
                            setActiveTab(tab.key);
                            setPage(1);
                          }}
                          type="button"
                        >
                          {tab.label}
                          <span className={`ml-2 rounded-full py-0.5 px-2.5 text-xs font-medium ${countClass}`} data-role="order-tab-count">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </nav>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-8 lg:grid-cols-3">
                  <div className="flex min-h-0 flex-col gap-4 lg:col-span-2">
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark">
                      <div className="flex-1 overflow-x-auto">
                        <table className="w-full whitespace-nowrap text-left text-sm">
                          <thead className="border-b border-border-light bg-background-light dark:border-border-dark dark:bg-background-dark">
                            <tr>
                              <th className="px-6 py-4 font-semibold text-text-main dark:text-text-main-dark" scope="col">订单号</th>
                              <th className="px-6 py-4 font-semibold text-text-main dark:text-text-main-dark" scope="col">客户</th>
                              <th className="px-6 py-4 font-semibold text-text-main dark:text-text-main-dark" scope="col">日期</th>
                              <th className="px-6 py-4 font-semibold text-text-main dark:text-text-main-dark" scope="col">金额</th>
                              <th className="px-6 py-4 font-semibold text-text-main dark:text-text-main-dark" scope="col">状态</th>
                              <th className="px-6 py-4 font-semibold text-text-main dark:text-text-main-dark" scope="col">支付</th>
                              <th className="px-6 py-4 text-right font-semibold text-text-main dark:text-text-main-dark" scope="col">操作</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-light dark:divide-border-dark" data-role="orders-body">
                            {pageItems.length > 0 ? pageItems.map((order) => {
                              const isActive = selectedOrder?.id === order.id;
                              const paymentMeta = getPaymentMeta(order);
                              return (
                                <tr
                                  className={`group cursor-pointer transition-colors hover:bg-background-light dark:hover:bg-background-dark/50 ${isActive ? 'bg-primary-light/30 dark:bg-primary/5' : ''}`}
                                  data-order-id={order.id}
                                  key={order.id}
                                  onClick={() => setSelectedId(order.id)}
                                >
                                  <td className={`px-6 py-4 font-medium ${isActive ? 'text-primary' : 'text-text-main dark:text-text-main-dark'}`}>#{order.id}</td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                        {getInitials(order.customer.name)}
                                      </div>
                                      <div>
                                        <p className="font-medium text-text-main dark:text-text-main-dark">{order.customer.name}</p>
                                        <p className="text-xs text-text-sub dark:text-text-sub-dark">{order.customer.member}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-text-sub dark:text-text-sub-dark">{order.date}</td>
                                  <td className="px-6 py-4 font-medium text-text-main dark:text-text-main-dark">{formatAmount(order.amount)}</td>
                                  <td className="px-6 py-4">
                                    <StatusBadge statusKey={order.statusKey} statusLabel={order.statusLabel} />
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                      <ToneBadge statusLabel={paymentMeta.statusLabel} tone={paymentMeta.tone} />
                                      <a
                                        className="text-xs font-medium text-primary hover:text-primary-dark"
                                        href={`/payments.html?q=${encodeURIComponent(paymentMeta.transactionId)}`}
                                        onClick={(event) => event.stopPropagation()}
                                      >
                                        {paymentMeta.transactionId}
                                      </a>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <button
                                      className="text-sm font-medium text-primary hover:text-primary-dark"
                                      data-role="view-order"
                                      data-order-id={order.id}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setSelectedId(order.id);
                                        setEditingOrderId(order.id);
                                      }}
                                      type="button"
                                    >
                                      查看
                                    </button>
                                  </td>
                                </tr>
                              );
                            }) : (
                              <tr>
                                <td className="px-6 py-6 text-sm text-text-sub dark:text-text-sub-dark" colSpan={7}>
                                  当前状态下暂无订单。
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center justify-between border-t border-border-light bg-surface-light px-6 py-4 dark:border-border-dark dark:bg-surface-dark">
                        <p className="text-sm text-text-sub dark:text-text-sub-dark" data-role="orders-summary">
                          {buildSummaryText(filteredOrders.length, safePage, pageSize, pageItems.length)}
                        </p>
                        <div className="flex gap-2">
                          <button
                            className="rounded-lg border border-border-light px-3 py-1 text-sm font-medium text-text-sub hover:bg-background-light disabled:opacity-50 dark:border-border-dark dark:text-text-sub-dark dark:hover:bg-background-dark"
                            data-role="orders-prev-page"
                            disabled={safePage <= 1}
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                            type="button"
                          >
                            上一页
                          </button>
                          <button
                            className="rounded-lg border border-border-light px-3 py-1 text-sm font-medium text-text-sub hover:bg-background-light disabled:opacity-50 dark:border-border-dark dark:text-text-sub-dark dark:hover:bg-background-dark"
                            data-role="orders-next-page"
                            disabled={safePage >= totalPages}
                            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                            type="button"
                          >
                            下一页
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-col gap-6 lg:col-span-1">
                    {canManageOrders && selectedOrder ? (
                      <div className="rounded-xl border border-border-light bg-surface-light p-6 shadow-sm dark:border-border-dark dark:bg-surface-dark" data-role="order-fulfillment-panel">
                        <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark">订单派发</h3>
                        <p className="mt-1 text-xs text-text-sub">付款状态：{getPaymentMeta(selectedOrder).statusLabel} · 渠道：{selectedOrder.paymentChannel || '--'}</p>
                        {terminalOrder ? <p className="mt-4 text-sm text-amber-700">订单已进入终态或发货阶段，不能再派单。</p> : (
                          <div className="mt-4 space-y-3">
                            <label className="block text-xs text-text-sub">业务员
                              <select className="mt-1 w-full rounded-lg border-slate-300 text-sm" data-role="fulfillment-sales" onChange={(event) => setOwnerSalesUserId(event.target.value)} value={ownerSalesUserId}>
                                <option value="">请选择 active SALES</option>
                                {salesUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName || user.id}</option>)}
                              </select>
                            </label>
                            <label className="block text-xs text-text-sub">{confirmOfflinePayment ? '收款备注' : (selectedOrder.ownerSalesUserId ? '改派备注' : '派单备注')}
                              <textarea className="mt-1 w-full rounded-lg border-slate-300 text-sm" data-role="fulfillment-note" onChange={(event) => setFulfillmentNote(event.target.value)} rows={3} value={fulfillmentNote} />
                            </label>
                            {fulfillmentError ? <p className="text-sm text-red-600" data-role="fulfillment-error">{fulfillmentError}</p> : null}
                            <button className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" data-role="submit-fulfillment" disabled={isSubmitting} onClick={() => void submitFulfillment()} type="button">
                              {isSubmitting ? '提交中…' : confirmOfflinePayment ? '确认线下收款并派单' : selectedOrder.ownerSalesUserId ? '改派' : '派单'}
                            </button>
                          </div>
                        )}
                        <div className="mt-5 border-t border-slate-200 pt-4" data-role="order-admin-events">
                          <h4 className="text-sm font-semibold">审计时间线</h4>
                          {events.length ? events.map((event) => <div className="mt-3 text-xs text-text-sub" key={event.id}><p className="font-medium text-text-main">{event.action}</p><p>{event.note}</p><p>{new Date(event.createdAt).toLocaleString()}</p></div>) : <p className="mt-2 text-xs text-text-sub">暂无管理操作记录</p>}
                        </div>
                      </div>
                    ) : null}
                    {canManageOrders && selectedOrder ? (
                      <div className="rounded-xl border border-border-light bg-surface-light p-6 shadow-sm dark:border-border-dark dark:bg-surface-dark" data-role="order-shipment-panel">
                        <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark">订单推进</h3>
                        <p className="mt-1 text-xs text-text-sub">已确认订单可发货，已发货订单可确认送达。</p>
                        {canShipOrder ? (
                          <div className="mt-4 space-y-3">
                            <label className="block text-xs text-text-sub">承运商
                              <input
                                className="mt-1 w-full rounded-lg border-slate-300 text-sm"
                                data-role="shipment-carrier"
                                onChange={(event) => setShipCarrier(event.target.value)}
                                placeholder="例如：顺丰 / 德邦"
                                value={shipCarrier}
                              />
                            </label>
                            <label className="block text-xs text-text-sub">运单号
                              <input
                                className="mt-1 w-full rounded-lg border-slate-300 text-sm"
                                data-role="shipment-waybill"
                                onChange={(event) => setShipWaybillNo(event.target.value)}
                                value={shipWaybillNo}
                              />
                            </label>
                            {shipError ? <p className="text-sm text-red-600" data-role="shipment-error">{shipError}</p> : null}
                            <button
                              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                              data-role="submit-shipment"
                              disabled={isShipping}
                              onClick={() => void submitShipment()}
                              type="button"
                            >
                              {isShipping ? '提交中…' : '确认发货'}
                            </button>
                          </div>
                        ) : canConfirmDelivery ? (
                          <div className="mt-4 space-y-3">
                            <p className="text-sm text-text-sub">当前订单已发货，可由管理员确认进入已送达。</p>
                            {deliveryError ? <p className="text-sm text-red-600" data-role="delivery-error">{deliveryError}</p> : null}
                            <button
                              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                              data-role="submit-delivery"
                              disabled={isDelivering}
                              onClick={() => void submitDelivery()}
                              type="button"
                            >
                              {isDelivering ? '提交中…' : '确认已送达'}
                            </button>
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-amber-700">当前订单没有可执行的推进动作。</p>
                        )}
                      </div>
                    ) : null}
                    <div className="rounded-xl border border-border-light bg-surface-light p-6 shadow-sm dark:border-border-dark dark:bg-surface-dark">
                      <div className="mb-6 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark">物流详情</h3>
                        <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          {context?.mode === 'dev' ? '实时' : 'Mock'}
                        </span>
                      </div>
                      <div className="mb-8 flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border-light bg-gray-50 p-2 dark:border-border-dark dark:bg-gray-800">
                          <span className="material-symbols-outlined text-xl text-primary">local_shipping</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-sub dark:text-text-sub-dark">物流单号</p>
                          <p className="text-base font-bold text-text-main dark:text-text-main-dark" data-role="tracking-number">
                            {selectedOrder?.trackingNumber || '--'}
                          </p>
                        </div>
                      </div>

                      <div className="relative mb-8 h-32 w-full overflow-hidden rounded-lg border border-border-light bg-background-light dark:border-border-dark dark:bg-background-dark">
                        <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                          <div className="flex items-center gap-1 rounded-md bg-surface-light p-2 shadow-lg dark:bg-surface-dark">
                            <span className="material-symbols-outlined text-xl text-primary">local_shipping</span>
                            <span className="text-xs font-bold text-text-main dark:text-text-main-dark" data-role="shipping-badge-label">
                              {selectedOrder?.shippingBadge || '暂无状态'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="relative space-y-8 border-l-2 border-border-light pl-4 dark:border-border-dark" data-role="sorting-timeline">
                        {selectedOrder?.timeline?.length ? selectedOrder.timeline.map((item, index) => (
                          <div className="relative" key={`${selectedOrder.id}-timeline-${index}`}>
                            {index === 0 ? (
                              <span className="absolute -left-[21px] top-1 flex size-3.5 items-center justify-center rounded-full border-2 border-primary bg-surface-light dark:bg-surface-dark">
                                <span className="size-1.5 rounded-full bg-primary"></span>
                              </span>
                            ) : (
                              <span className="absolute -left-[21px] top-1 flex size-3.5 items-center justify-center rounded-full border-2 border-border-light bg-background-light dark:border-border-dark dark:bg-background-dark"></span>
                            )}
                            <div className="flex flex-col gap-1">
                              <p className={`text-sm ${index === 0 ? 'font-bold text-text-main dark:text-text-main-dark' : 'font-medium text-text-sub dark:text-text-sub-dark'}`}>
                                {item.title}
                              </p>
                              <p className="text-xs text-text-sub dark:text-text-sub-dark">{item.detail}</p>
                            </div>
                          </div>
                        )) : (
                          <div className="relative">
                            <span className="absolute -left-[21px] top-1 flex size-3.5 items-center justify-center rounded-full border-2 border-border-light bg-background-light dark:border-border-dark dark:bg-background-dark"></span>
                            <div className="flex flex-col gap-1">
                              <p className="text-sm font-medium text-text-sub dark:text-text-sub-dark">暂无分拣信息</p>
                              <p className="text-xs text-text-sub dark:text-text-sub-dark">当前状态暂无物流轨迹</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border-light bg-surface-light p-6 shadow-sm dark:border-border-dark dark:bg-surface-dark">
                      <h3 className="mb-4 text-sm font-bold tracking-wider text-text-sub uppercase dark:text-text-sub-dark">客户信息</h3>
                      <div className="flex items-start gap-4">
                        <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {selectedOrder ? getInitials(selectedOrder.customer.name) : '--'}
                        </div>
                        <div>
                          <p className="font-bold text-text-main dark:text-text-main-dark" data-role="customer-name">
                            {selectedOrder?.customer.name || '--'}
                          </p>
                          <p className="text-sm text-text-sub dark:text-text-sub-dark" data-role="customer-email">
                            {selectedOrder?.customer.email || '--'}
                          </p>
                          <p className="mt-1 text-sm text-text-sub dark:text-text-sub-dark" data-role="customer-phone">
                            {selectedOrder?.customer.phone || '--'}
                          </p>
                          <div className="mt-3 flex gap-2">
                            <span className="rounded bg-background-light px-2 py-1 text-xs font-medium text-text-sub dark:bg-background-dark dark:text-text-sub-dark" data-role="customer-order-count">
                              {selectedOrder ? `${selectedOrder.customer.orderCount} 个订单` : '--'}
                            </span>
                            <span className="rounded bg-background-light px-2 py-1 text-xs font-medium text-text-sub dark:bg-background-dark dark:text-text-sub-dark" data-role="customer-ltv">
                              {selectedOrder ? `客户累计下单金额 ${selectedOrder.customer.ltv}` : '--'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 border-t border-border-light pt-4 dark:border-border-dark">
                        <p className="mb-2 text-xs font-medium text-text-sub uppercase dark:text-text-sub-dark">配送备注</p>
                        <p className="text-sm italic text-text-main dark:text-text-main-dark" data-role="delivery-note">
                          {selectedOrder ? `“${selectedOrder.customer.note}”` : '暂无备注'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}
      </main>

      <OrderDetailDrawer
        onClose={() => setEditingOrderId('')}
        onSave={updateOrder}
        order={editingOrder}
        products={products}
      />
    </div>
  );
};
