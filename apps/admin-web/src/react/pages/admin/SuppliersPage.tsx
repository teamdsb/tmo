import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  fetchAdminSupplierById,
  fetchAdminSupplierContacts,
  fetchAdminSupplierScorecards,
  fetchAdminSuppliers,
  patchAdminSupplierById
} from '../../../lib/api';
import { isMockMode } from '../../../lib/env';
import { AdminTopbar } from '../../layout/AdminTopbar';

type SupplierStatus = 'ACTIVE' | 'PAUSED' | 'TERMINATED';

type Supplier = {
  id: string;
  supplierCode: string;
  name: string;
  country: string;
  city: string;
  categories: string[];
  status: SupplierStatus;
  score: number;
  lastQuoteAmountCents: number | null;
  lastQuoteAt: string | null;
  primaryContactName: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type SupplierContact = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  updatedAt: string;
};

type SupplierScorecard = {
  id: string;
  period: string;
  deliveryScore: number;
  qualityScore: number;
  priceScore: number;
  riskLevel: string;
  createdAt: string;
};

type SupplierFormState = {
  name: string;
  country: string;
  city: string;
  status: SupplierStatus;
  score: number;
  categoriesText: string;
  notes: string;
};

const mockSuppliers: Supplier[] = [
  {
    id: 'f0666f79-2f95-44e7-a0d1-6987ac0fd581',
    supplierCode: 'SUP-99102',
    name: '子午线物流',
    country: '德国',
    city: '汉堡',
    categories: ['运输', '货运'],
    status: 'ACTIVE',
    score: 92,
    lastQuoteAmountCents: 8500000,
    lastQuoteAt: '2026-03-04T09:30:00Z',
    primaryContactName: 'Hans Weber',
    notes: '欧洲线路主力物流合作方。',
    createdAt: '2026-01-20T08:00:00Z',
    updatedAt: '2026-03-04T09:30:00Z'
  },
  {
    id: '8f9f5137-a0d9-4134-a0f8-b18f4d0cda93',
    supplierCode: 'SUP-44210',
    name: '顶点高分子材料',
    country: '美国',
    city: '休斯敦',
    categories: ['原材料', '塑料'],
    status: 'PAUSED',
    score: 74,
    lastQuoteAmountCents: 420000,
    lastQuoteAt: '2026-02-15T11:12:00Z',
    primaryContactName: 'Mark Thomas',
    notes: '价格波动较大，阶段性暂停。',
    createdAt: '2025-12-18T03:00:00Z',
    updatedAt: '2026-02-15T11:12:00Z'
  }
];

const mockContacts: Record<string, SupplierContact[]> = {
  'f0666f79-2f95-44e7-a0d1-6987ac0fd581': [
    {
      id: '3a627d3a-524a-4dc8-abf8-a7ca8d07fd47',
      name: 'Hans Weber',
      title: '高级客户经理',
      email: 'hans.weber@meridian-logistics.example',
      phone: '+49 40 3389 1200',
      isPrimary: true,
      updatedAt: '2026-03-04T09:30:00Z'
    }
  ],
  '8f9f5137-a0d9-4134-a0f8-b18f4d0cda93': [
    {
      id: '0f4dc6ca-76a9-4899-b7f1-f8c988cb8f1a',
      name: 'Mark Thomas',
      title: '销售总监',
      email: 'mark.thomas@vertex-poly.example',
      phone: '+1 713 555 0132',
      isPrimary: true,
      updatedAt: '2026-02-15T11:12:00Z'
    }
  ]
};

const mockScorecards: Record<string, SupplierScorecard[]> = {
  'f0666f79-2f95-44e7-a0d1-6987ac0fd581': [
    {
      id: '2be197d2-e9df-4509-8404-e0666e7d4ab4',
      period: '2026-02',
      deliveryScore: 94,
      qualityScore: 91,
      priceScore: 89,
      riskLevel: 'LOW',
      createdAt: '2026-03-01T00:00:00Z'
    }
  ],
  '8f9f5137-a0d9-4134-a0f8-b18f4d0cda93': [
    {
      id: 'd3091f95-1948-49d7-bf45-b7828762d706',
      period: '2026-02',
      deliveryScore: 72,
      qualityScore: 78,
      priceScore: 66,
      riskLevel: 'MEDIUM',
      createdAt: '2026-03-01T00:00:00Z'
    }
  ]
};

const emptyForm: SupplierFormState = {
  name: '',
  country: '',
  city: '',
  status: 'ACTIVE',
  score: 80,
  categoriesText: '',
  notes: ''
};

const safeText = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim();
  return normalized || fallback;
};

const normalizeStatus = (value: unknown): SupplierStatus => {
  const status = safeText(value, 'ACTIVE').toUpperCase();
  if (status === 'PAUSED') {
    return 'PAUSED';
  }
  if (status === 'TERMINATED') {
    return 'TERMINATED';
  }
  return 'ACTIVE';
};

const normalizeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
};

const normalizeSupplier = (item: unknown): Supplier | null => {
  const record = item as {
    id?: unknown;
    supplierCode?: unknown;
    name?: unknown;
    country?: unknown;
    city?: unknown;
    categories?: unknown;
    status?: unknown;
    score?: unknown;
    lastQuoteAmountCents?: unknown;
    lastQuoteAt?: unknown;
    primaryContactName?: unknown;
    notes?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
  };

  const id = safeText(record.id);
  if (!id) {
    return null;
  }

  const categories = Array.isArray(record.categories)
    ? record.categories.map((entry) => safeText(entry)).filter(Boolean)
    : [];

  const amountRaw = record.lastQuoteAmountCents;
  const amount = Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : null;

  const lastQuoteAt = safeText(record.lastQuoteAt, '');
  const createdAt = safeText(record.createdAt, '');
  const updatedAt = safeText(record.updatedAt, '');

  return {
    id,
    supplierCode: safeText(record.supplierCode, '-'),
    name: safeText(record.name, '未命名供应商'),
    country: safeText(record.country, '-'),
    city: safeText(record.city, '-'),
    categories,
    status: normalizeStatus(record.status),
    score: Math.max(0, Math.min(100, Math.round(normalizeNumber(record.score, 0)))),
    lastQuoteAmountCents: amount,
    lastQuoteAt: lastQuoteAt || null,
    primaryContactName: safeText(record.primaryContactName, '-'),
    notes: safeText(record.notes, ''),
    createdAt,
    updatedAt
  };
};

const normalizeSupplierList = (data: unknown): { items: Supplier[]; total: number } => {
  const payload = data as { items?: unknown[]; total?: unknown };
  const sourceItems = Array.isArray(payload?.items) ? payload.items : [];
  const items = sourceItems.map(normalizeSupplier).filter(Boolean) as Supplier[];
  const total = Number.isFinite(Number(payload?.total)) ? Number(payload?.total) : items.length;
  return { items, total };
};

const normalizeContacts = (data: unknown): SupplierContact[] => {
  const items = Array.isArray((data as { items?: unknown[] })?.items)
    ? (((data as { items?: unknown[] }).items as unknown[]) || [])
    : [];

  return items
    .map((item) => {
      const record = item as {
        id?: unknown;
        name?: unknown;
        title?: unknown;
        email?: unknown;
        phone?: unknown;
        isPrimary?: unknown;
        updatedAt?: unknown;
      };
      const id = safeText(record.id);
      if (!id) {
        return null;
      }
      return {
        id,
        name: safeText(record.name, '-'),
        title: safeText(record.title, '-'),
        email: safeText(record.email, '-'),
        phone: safeText(record.phone, '-'),
        isPrimary: Boolean(record.isPrimary),
        updatedAt: safeText(record.updatedAt, '')
      } satisfies SupplierContact;
    })
    .filter(Boolean) as SupplierContact[];
};

const normalizeScorecards = (data: unknown): SupplierScorecard[] => {
  const items = Array.isArray((data as { items?: unknown[] })?.items)
    ? (((data as { items?: unknown[] }).items as unknown[]) || [])
    : [];

  return items
    .map((item) => {
      const record = item as {
        id?: unknown;
        period?: unknown;
        deliveryScore?: unknown;
        qualityScore?: unknown;
        priceScore?: unknown;
        riskLevel?: unknown;
        createdAt?: unknown;
      };
      const id = safeText(record.id);
      if (!id) {
        return null;
      }
      return {
        id,
        period: safeText(record.period, '-'),
        deliveryScore: Math.max(0, Math.min(100, Math.round(normalizeNumber(record.deliveryScore, 0)))),
        qualityScore: Math.max(0, Math.min(100, Math.round(normalizeNumber(record.qualityScore, 0)))),
        priceScore: Math.max(0, Math.min(100, Math.round(normalizeNumber(record.priceScore, 0)))),
        riskLevel: safeText(record.riskLevel, 'LOW'),
        createdAt: safeText(record.createdAt, '')
      } satisfies SupplierScorecard;
    })
    .filter(Boolean) as SupplierScorecard[];
};

const formatDate = (raw: string | null) => {
  if (!raw) {
    return '-';
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
};

const formatAmount = (amount: number | null) => {
  if (amount === null || !Number.isFinite(amount)) {
    return '-';
  }
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount / 100);
};

const supplierStatusLabel: Record<SupplierStatus, string> = {
  ACTIVE: '合作中',
  PAUSED: '暂停合作',
  TERMINATED: '已终止'
};

const supplierStatusBadge: Record<SupplierStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PAUSED: 'bg-amber-100 text-amber-700',
  TERMINATED: 'bg-red-100 text-red-700'
};

const riskLevelLabel = (value: string) => {
  const normalized = safeText(value, 'LOW').toUpperCase();
  if (normalized === 'HIGH') {
    return '高风险';
  }
  if (normalized === 'MEDIUM') {
    return '中风险';
  }
  return '低风险';
};

const toSupplierForm = (supplier: Supplier): SupplierFormState => ({
  name: supplier.name,
  country: supplier.country,
  city: supplier.city,
  status: supplier.status,
  score: supplier.score,
  categoriesText: supplier.categories.join(', '),
  notes: supplier.notes
});

export const SuppliersPage = () => {
  const [items, setItems] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [scorecards, setScorecards] = useState<SupplierScorecard[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [form, setForm] = useState<SupplierFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (isMockMode) {
        const keyword = safeText(search).toLowerCase();
        const filtered = mockSuppliers.filter((supplier) => {
          if (statusFilter && supplier.status !== statusFilter) {
            return false;
          }
          if (!keyword) {
            return true;
          }
          return (
            supplier.name.toLowerCase().includes(keyword) ||
            supplier.supplierCode.toLowerCase().includes(keyword)
          );
        });
        setItems(filtered);
        setTotal(filtered.length);
        return;
      }

      const response = await fetchAdminSuppliers({
        q: search,
        status: statusFilter,
        page,
        pageSize
      });

      if (response.status !== 200) {
        throw new Error('加载供应商列表失败');
      }

      const normalized = normalizeSupplierList(response.data);
      setItems(normalized.items);
      setTotal(normalized.total);
    } catch (loadError) {
      setItems([]);
      setTotal(0);
      setError(loadError instanceof Error ? loadError.message : '加载供应商列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId('');
      return;
    }
    const found = items.some((item) => item.id === selectedId);
    if (!found) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const loadSupplierDetail = useCallback(async (supplierId: string) => {
    if (!supplierId) {
      setSelected(null);
      setContacts([]);
      setScorecards([]);
      setForm(emptyForm);
      setDetailError('');
      return;
    }

    setDetailLoading(true);
    setDetailError('');
    setSuccess('');

    try {
      if (isMockMode) {
        const supplier = mockSuppliers.find((item) => item.id === supplierId) || null;
        setSelected(supplier);
        setContacts(mockContacts[supplierId] || []);
        setScorecards(mockScorecards[supplierId] || []);
        setForm(supplier ? toSupplierForm(supplier) : emptyForm);
        return;
      }

      const [supplierRes, contactsRes, scorecardsRes] = await Promise.all([
        fetchAdminSupplierById(supplierId),
        fetchAdminSupplierContacts(supplierId),
        fetchAdminSupplierScorecards(supplierId)
      ]);

      if (supplierRes.status !== 200) {
        throw new Error('加载供应商详情失败');
      }

      const normalizedSupplier = normalizeSupplier(supplierRes.data);
      if (!normalizedSupplier) {
        throw new Error('供应商详情数据不完整');
      }

      setSelected(normalizedSupplier);
      setContacts(contactsRes.status === 200 ? normalizeContacts(contactsRes.data) : []);
      setScorecards(scorecardsRes.status === 200 ? normalizeScorecards(scorecardsRes.data) : []);
      setForm(toSupplierForm(normalizedSupplier));
    } catch (loadError) {
      setSelected(null);
      setContacts([]);
      setScorecards([]);
      setForm(emptyForm);
      setDetailError(loadError instanceof Error ? loadError.message : '加载供应商详情失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSupplierDetail(selectedId);
  }, [loadSupplierDetail, selectedId]);

  const activeCount = useMemo(() => items.filter((item) => item.status === 'ACTIVE').length, [items]);
  const pausedCount = useMemo(
    () => items.filter((item) => item.status === 'PAUSED' || item.status === 'TERMINATED').length,
    [items]
  );
  const avgScore = useMemo(() => {
    if (items.length === 0) {
      return 0;
    }
    return Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length);
  }, [items]);

  const handleSubmitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleSave = async () => {
    if (!selected) {
      return;
    }

    setSaving(true);
    setSuccess('');
    setDetailError('');

    try {
      if (isMockMode) {
        setSuccess('Mock 模式：已模拟保存供应商信息');
        return;
      }

      const payload = {
        name: form.name.trim(),
        country: form.country.trim(),
        city: form.city.trim(),
        status: form.status,
        score: Math.max(0, Math.min(100, Math.round(form.score))),
        categories: form.categoriesText
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        notes: form.notes.trim()
      };

      const response = await patchAdminSupplierById(selected.id, payload);
      if (response.status !== 200) {
        throw new Error('保存失败，请稍后重试');
      }

      const updated = normalizeSupplier(response.data);
      if (!updated) {
        throw new Error('保存后返回数据异常');
      }

      setSelected(updated);
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setForm(toSupplierForm(updated));
      setSuccess('保存成功，供应商资料已更新');
    } catch (saveError) {
      setDetailError(saveError instanceof Error ? saveError.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const canSave = Boolean(selected) && !saving && !detailLoading;

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden" data-testid="suppliers-page">
      <div className="flex h-full grow flex-col">
        <AdminTopbar
          searchPlaceholder="搜索供应商、订单或商品编号..."
          leftSlot={
            <>
              <div className="flex items-center gap-3 text-slate-900 dark:text-white">
                <div className="size-8 rounded bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined">inventory_2</span>
                </div>
                <h2 className="text-lg font-bold leading-tight tracking-tight">管理控制台</h2>
              </div>
              <nav className="hidden lg:flex items-center gap-6">
                <a className="text-slate-500 hover:text-primary text-sm font-medium transition-colors" href="/dashboard.html">仪表盘</a>
                <a className="text-primary text-sm font-medium bg-primary/5 px-3 py-1.5 rounded-full transition-colors" href="/suppliers.html">供应商</a>
                <a className="text-slate-500 hover:text-primary text-sm font-medium transition-colors" href="/orders.html">订单</a>
                <a className="text-slate-500 hover:text-primary text-sm font-medium transition-colors" href="/products.html">库存</a>
                <a className="text-slate-500 hover:text-primary text-sm font-medium transition-colors" href="/inquiries.html">分析</a>
              </nav>
            </>
          }
        />

        <main className="px-8 py-8 w-full max-w-[1600px] mx-auto flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h1 className="text-slate-900 text-3xl font-bold tracking-tight">供应商管理</h1>
              <p className="text-slate-500 text-sm mt-2">P1 里程碑：供应商列表、详情与关键字段编辑已接入真实接口</p>
            </div>
            <form className="flex flex-wrap items-center gap-3" onSubmit={handleSubmitSearch}>
              <input
                className="h-10 px-3 rounded-lg border border-slate-200 text-sm min-w-[260px]"
                placeholder="按名称或供应商编号搜索"
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <select
                className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
                value={statusFilter}
                onChange={(event) => {
                  setPage(1);
                  setStatusFilter(event.target.value);
                }}
              >
                <option value="">全部状态</option>
                <option value="ACTIVE">合作中</option>
                <option value="PAUSED">暂停合作</option>
                <option value="TERMINATED">已终止</option>
              </select>
              <button className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold" type="submit">
                搜索
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-slate-500 text-sm">供应商总数</p>
              <p className="text-slate-900 text-3xl font-bold mt-1">{total}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-slate-500 text-sm">活跃合作</p>
              <p className="text-slate-900 text-3xl font-bold mt-1">{activeCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-slate-500 text-sm">平均评分</p>
              <p className="text-slate-900 text-3xl font-bold mt-1">{avgScore}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-slate-500 text-sm">风险关注</p>
              <p className="text-slate-900 text-3xl font-bold mt-1">{pausedCount}</p>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3" data-testid="suppliers-error">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-6">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-slate-900 text-lg font-bold">供应商名录</h2>
                <p className="text-xs text-slate-500">第 {page} 页</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                      <th className="px-5 py-3">供应商</th>
                      <th className="px-5 py-3">状态</th>
                      <th className="px-5 py-3 text-center">评分</th>
                      <th className="px-5 py-3">最近报价</th>
                      <th className="px-5 py-3">联系人</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td className="px-5 py-6 text-sm text-slate-500" colSpan={5}>正在加载供应商数据...</td>
                      </tr>
                    ) : null}
                    {!loading && items.length === 0 ? (
                      <tr data-testid="suppliers-empty-state">
                        <td className="px-5 py-6 text-sm text-slate-500" colSpan={5}>暂无供应商数据</td>
                      </tr>
                    ) : null}
                    {!loading
                      ? items.map((supplier) => {
                          const isSelected = supplier.id === selectedId;
                          return (
                            <tr
                              className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                              data-testid={`supplier-row-${supplier.id}`}
                              key={supplier.id}
                              onClick={() => setSelectedId(supplier.id)}
                            >
                              <td className="px-5 py-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-semibold text-slate-900">{supplier.name}</span>
                                  <span className="text-xs text-slate-500">{supplier.country} · {supplier.city} · {supplier.supplierCode}</span>
                                  <span className="text-xs text-slate-400 mt-1">{supplier.categories.join(' / ') || '未分类'}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${supplierStatusBadge[supplier.status]}`}>
                                  {supplierStatusLabel[supplier.status]}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-center text-sm font-semibold text-slate-900">{supplier.score}%</td>
                              <td className="px-5 py-4">
                                <div className="flex flex-col text-xs text-slate-600">
                                  <span className="text-sm text-slate-900">{formatAmount(supplier.lastQuoteAmountCents)}</span>
                                  <span>{formatDate(supplier.lastQuoteAt)}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-sm text-slate-700">{supplier.primaryContactName || '-'}</td>
                            </tr>
                          );
                        })
                      : null}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between bg-slate-50">
                <p className="text-xs text-slate-500">共 {total} 条记录</p>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-50"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    type="button"
                  >
                    上一页
                  </button>
                  <button
                    className="px-3 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-50"
                    disabled={page * pageSize >= total}
                    onClick={() => setPage((prev) => prev + 1)}
                    type="button"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col gap-4" data-testid="supplier-detail">
              {detailLoading ? <p className="text-sm text-slate-500">正在加载供应商详情...</p> : null}
              {detailError ? <p className="text-sm text-red-600">{detailError}</p> : null}
              {!detailLoading && !selected ? <p className="text-sm text-slate-500">请选择供应商查看详情</p> : null}

              {selected ? (
                <>
                  <div>
                    <h3 className="text-slate-900 text-lg font-bold">供应商详情</h3>
                    <p className="text-xs text-slate-500 mt-1">最后更新：{formatDate(selected.updatedAt)}</p>
                  </div>

                  {success ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 text-sm" data-testid="suppliers-success">
                      {success}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3">
                    <label className="text-xs text-slate-500 flex flex-col gap-1">
                      名称
                      <input
                        className="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-900"
                        type="text"
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs text-slate-500 flex flex-col gap-1">
                        国家
                        <input
                          className="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-900"
                          type="text"
                          value={form.country}
                          onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
                        />
                      </label>
                      <label className="text-xs text-slate-500 flex flex-col gap-1">
                        城市
                        <input
                          className="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-900"
                          type="text"
                          value={form.city}
                          onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs text-slate-500 flex flex-col gap-1">
                        状态
                        <select
                          className="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-900"
                          value={form.status}
                          onChange={(event) => setForm((prev) => ({ ...prev, status: normalizeStatus(event.target.value) }))}
                        >
                          <option value="ACTIVE">合作中</option>
                          <option value="PAUSED">暂停合作</option>
                          <option value="TERMINATED">已终止</option>
                        </select>
                      </label>
                      <label className="text-xs text-slate-500 flex flex-col gap-1">
                        评分
                        <input
                          className="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-900"
                          max={100}
                          min={0}
                          type="number"
                          value={form.score}
                          onChange={(event) => setForm((prev) => ({ ...prev, score: normalizeNumber(event.target.value, prev.score) }))}
                        />
                      </label>
                    </div>
                    <label className="text-xs text-slate-500 flex flex-col gap-1">
                      业务分类（逗号分隔）
                      <input
                        className="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-900"
                        type="text"
                        value={form.categoriesText}
                        onChange={(event) => setForm((prev) => ({ ...prev, categoriesText: event.target.value }))}
                      />
                    </label>
                    <label className="text-xs text-slate-500 flex flex-col gap-1">
                      备注
                      <textarea
                        className="min-h-[88px] px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900"
                        value={form.notes}
                        onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                      />
                    </label>
                    <button
                      className="h-10 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-60"
                      data-testid="supplier-save-button"
                      disabled={!canSave}
                      onClick={() => void handleSave()}
                      type="button"
                    >
                      {saving ? '保存中...' : '保存变更'}
                    </button>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">联系人</h4>
                    {contacts.length === 0 ? <p className="text-xs text-slate-500">暂无联系人</p> : null}
                    <div className="flex flex-col gap-2">
                      {contacts.map((contact) => (
                        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2" key={contact.id}>
                          <p className="text-sm font-semibold text-slate-900">
                            {contact.name}
                            {contact.isPrimary ? <span className="ml-2 text-[10px] text-primary">主联系人</span> : null}
                          </p>
                          <p className="text-xs text-slate-500">{contact.title}</p>
                          <p className="text-xs text-slate-500">{contact.email} · {contact.phone}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">绩效评分</h4>
                    {scorecards.length === 0 ? <p className="text-xs text-slate-500">暂无评分记录</p> : null}
                    <div className="flex flex-col gap-2">
                      {scorecards.map((scorecard) => (
                        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2" key={scorecard.id}>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-900">{scorecard.period}</p>
                            <p className="text-xs text-slate-500">{riskLevelLabel(scorecard.riskLevel)}</p>
                          </div>
                          <p className="text-xs text-slate-600">
                            交付 {scorecard.deliveryScore} / 质量 {scorecard.qualityScore} / 价格 {scorecard.priceScore}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
