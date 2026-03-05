import { useEffect, useMemo, useState } from 'react';

import {
  batchTransferCustomers,
  batchUpdateCustomerTags,
  createAdminCustomerTag,
  fetchAdminCustomers,
  fetchAdminCustomerTags,
  fetchAdminSalesUsers,
  getAdminCustomerFinanceProfile,
  patchAdminCustomerFinanceProfile,
  patchAdminCustomerTag
} from '../../../lib/api';
import { isMockMode } from '../../../lib/env';
import { AdminTopbar } from '../../layout/AdminTopbar';

type SalesUser = {
  id: string;
  displayName: string;
  phone: string;
  status: string;
  roles: string[];
};

type CustomerTag = {
  id: string;
  name: string;
  color: string;
  sort: number;
  active: boolean;
};

type CustomerOwner = {
  id: string;
  displayName: string;
  phone: string;
};

type AdminCustomer = {
  id: string;
  displayName: string;
  phone: string;
  ownerSalesUserId: string;
  ownerSales: CustomerOwner | null;
  tags: CustomerTag[];
  createdAt: string;
};

const MAX_PAYMENT_TERM_REMARK_LENGTH = 500;
const DEFAULT_TAG_COLOR = '#64748B';

const mockSalesSeed: SalesUser[] = [
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    displayName: '张销售',
    phone: '13800138000',
    status: 'active',
    roles: ['SALES']
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    displayName: '李销售',
    phone: '13900139000',
    status: 'active',
    roles: ['SALES']
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    displayName: '王销售',
    phone: '13700137000',
    status: 'active',
    roles: ['SALES']
  }
];

const mockTagSeed: CustomerTag[] = [
  {
    id: '8ed6e30f-e4f4-49f9-a8f3-a9c4530f4f42',
    name: '重点客户',
    color: '#F97316',
    sort: 10,
    active: true
  },
  {
    id: 'c2215f84-089d-4329-b7b7-5ad3da4cb0a0',
    name: '待回访',
    color: '#2563EB',
    sort: 20,
    active: true
  }
];

const mockCustomerSeed: AdminCustomer[] = [
  {
    id: 'ab90d8ef-5de1-4f24-b4af-b3dde9e64610',
    displayName: '上海宏业贸易',
    phone: '13800138000',
    ownerSalesUserId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    ownerSales: {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      displayName: '张销售',
      phone: '13800138000'
    },
    tags: [mockTagSeed[0]],
    createdAt: '2026-02-22T09:10:11Z'
  },
  {
    id: '7ce1f6d1-4e6d-45bc-8c25-a27be9c98480',
    displayName: '苏州精工制造',
    phone: '13900139000',
    ownerSalesUserId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    ownerSales: {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      displayName: '李销售',
      phone: '13900139000'
    },
    tags: [mockTagSeed[1]],
    createdAt: '2026-02-24T09:10:11Z'
  },
  {
    id: '515eb8de-6457-48f0-9e91-227b55f667e9',
    displayName: '宁波远航供应链',
    phone: '13700137000',
    ownerSalesUserId: '',
    ownerSales: null,
    tags: [],
    createdAt: '2026-02-26T09:10:11Z'
  }
];

const safeText = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeSalesUsers = (data: unknown): SalesUser[] => {
  const items = (data as { items?: unknown[] })?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const record = item as {
        id?: string;
        displayName?: string;
        phone?: string | null;
        status?: string;
        roles?: unknown[];
      };
      if (!record.id) {
        return null;
      }
      const roles = Array.isArray(record.roles) ? record.roles.filter((role): role is string => typeof role === 'string') : [];
      return {
        id: record.id,
        displayName: safeText(record.displayName, '未命名业务员'),
        phone: safeText(record.phone, '-'),
        status: safeText(record.status, 'active').toLowerCase(),
        roles
      };
    })
    .filter(Boolean) as SalesUser[];
};

const normalizeTags = (data: unknown): CustomerTag[] => {
  const items = Array.isArray((data as { items?: unknown[] })?.items)
    ? ((data as { items?: unknown[] }).items as unknown[])
    : [];

  return items
    .map((item) => {
      const record = item as {
        id?: string;
        name?: string;
        color?: string;
        sort?: number;
        active?: boolean;
      };
      if (!record.id) {
        return null;
      }
      return {
        id: record.id,
        name: safeText(record.name, '未命名标签'),
        color: safeText(record.color, DEFAULT_TAG_COLOR),
        sort: Number.isFinite(record.sort) ? Number(record.sort) : 0,
        active: Boolean(record.active)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sort - b.sort) as CustomerTag[];
};

const normalizeCustomers = (data: unknown): { items: AdminCustomer[]; total: number } => {
  const payload = data as { items?: unknown[]; total?: number };
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return {
    items: items
      .map((item) => {
        const record = item as {
          id?: string;
          displayName?: string;
          phone?: string | null;
          ownerSalesUserId?: string | null;
          ownerSales?: { id?: string; displayName?: string; phone?: string | null } | null;
          tags?: unknown[];
          createdAt?: string;
        };
        if (!record.id) {
          return null;
        }
        const owner = record.ownerSales;
        const normalizedTags = Array.isArray(record.tags)
          ? normalizeTags({ items: record.tags })
          : [];

        return {
          id: record.id,
          displayName: safeText(record.displayName, '未命名客户'),
          phone: safeText(record.phone, '-'),
          ownerSalesUserId: safeText(record.ownerSalesUserId, ''),
          ownerSales: owner?.id
            ? {
                id: owner.id,
                displayName: safeText(owner.displayName, '未命名业务员'),
                phone: safeText(owner.phone, '-')
              }
            : null,
          tags: normalizedTags,
          createdAt: safeText(record.createdAt, '')
        } as AdminCustomer;
      })
      .filter(Boolean) as AdminCustomer[],
    total: Number.isFinite(payload?.total) ? Number(payload.total) : 0
  };
};

const createMockId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mock-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
};

const formatDateTime = (raw: string) => {
  if (!raw) {
    return '-';
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString('zh-CN', {
    hour12: false
  });
};

export const TransferPage = () => {
  const [queryInput, setQueryInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [ownerSalesFilter, setOwnerSalesFilter] = useState('');
  const [tagFilters, setTagFilters] = useState<string[]>([]);

  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [focusedCustomerId, setFocusedCustomerId] = useState('');

  const [targetSalesUserId, setTargetSalesUserId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const [addTagIds, setAddTagIds] = useState<string[]>([]);
  const [removeTagIds, setRemoveTagIds] = useState<string[]>([]);

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR);

  const [remarkInput, setRemarkInput] = useState('');
  const [mockRemarks, setMockRemarks] = useState<Record<string, string>>({
    'ab90d8ef-5de1-4f24-b4af-b3dde9e64610': '默认账期：月结30天，票到后5个工作日付款。'
  });

  const [mockSalesUsers] = useState<SalesUser[]>(mockSalesSeed);
  const [mockTags, setMockTags] = useState<CustomerTag[]>(mockTagSeed);
  const [mockCustomers, setMockCustomers] = useState<AdminCustomer[]>(mockCustomerSeed);

  const [salesLoading, setSalesLoading] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const clearFeedback = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const activeTags = useMemo(() => tags.filter((tag) => tag.active), [tags]);

  const selectedCount = selectedCustomerIds.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const focusedCustomer = useMemo(() => {
    return customers.find((customer) => customer.id === focusedCustomerId) || null;
  }, [customers, focusedCustomerId]);

  const selectedSalesUser = useMemo(() => {
    return salesUsers.find((sales) => sales.id === targetSalesUserId) || null;
  }, [salesUsers, targetSalesUserId]);

  const remarkLength = remarkInput.trim().length;

  const refreshSalesUsers = async () => {
    setSalesLoading(true);
    try {
      if (isMockMode) {
        setSalesUsers(mockSalesUsers.filter((item) => item.status === 'active' && item.roles.includes('SALES')));
        return;
      }

      const response = await fetchAdminSalesUsers({
        page: 1,
        pageSize: 200
      });
      if (response.status !== 200) {
        setErrorMessage('加载业务员列表失败，请稍后重试。');
        setSalesUsers([]);
        return;
      }
      setSalesUsers(normalizeSalesUsers(response.data));
    } catch {
      setErrorMessage('加载业务员列表失败，请稍后重试。');
      setSalesUsers([]);
    } finally {
      setSalesLoading(false);
    }
  };

  const refreshTags = async () => {
    setTagsLoading(true);
    try {
      if (isMockMode) {
        setTags([...mockTags].sort((a, b) => a.sort - b.sort));
        return;
      }

      const response = await fetchAdminCustomerTags({ includeInactive: true });
      if (response.status !== 200) {
        setErrorMessage('加载标签失败，请稍后重试。');
        setTags([]);
        return;
      }
      setTags(normalizeTags(response.data));
    } catch {
      setErrorMessage('加载标签失败，请稍后重试。');
      setTags([]);
    } finally {
      setTagsLoading(false);
    }
  };

  const refreshCustomers = async () => {
    setCustomersLoading(true);
    clearFeedback();

    try {
      if (isMockMode) {
        let nextItems = [...mockCustomers];

        if (appliedQuery) {
          const keyword = appliedQuery.toLowerCase();
          nextItems = nextItems.filter((customer) => {
            return (
              customer.displayName.toLowerCase().includes(keyword)
              || customer.phone.includes(keyword)
              || customer.id.toLowerCase().includes(keyword)
            );
          });
        }

        if (ownerSalesFilter) {
          nextItems = nextItems.filter((customer) => customer.ownerSalesUserId === ownerSalesFilter);
        }

        if (tagFilters.length > 0) {
          nextItems = nextItems.filter((customer) => customer.tags.some((tag) => tagFilters.includes(tag.id)));
        }

        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const pagedItems = nextItems.slice(start, end);

        setCustomers(pagedItems);
        setTotal(nextItems.length);
        setSelectedCustomerIds((current) => current.filter((id) => pagedItems.some((item) => item.id === id)));
        if (!pagedItems.some((item) => item.id === focusedCustomerId)) {
          setFocusedCustomerId(pagedItems[0]?.id || '');
        }
        return;
      }

      const response = await fetchAdminCustomers({
        page,
        pageSize,
        q: appliedQuery || undefined,
        ownerSalesUserId: ownerSalesFilter || undefined,
        tagIds: tagFilters.length > 0 ? tagFilters : undefined
      });

      if (response.status !== 200) {
        setErrorMessage('加载客户列表失败，请稍后重试。');
        setCustomers([]);
        setTotal(0);
        return;
      }

      const normalized = normalizeCustomers(response.data);
      setCustomers(normalized.items);
      setTotal(normalized.total);
      setSelectedCustomerIds((current) => current.filter((id) => normalized.items.some((item) => item.id === id)));
      if (!normalized.items.some((item) => item.id === focusedCustomerId)) {
        setFocusedCustomerId(normalized.items[0]?.id || '');
      }
    } catch {
      setErrorMessage('加载客户列表失败，请稍后重试。');
      setCustomers([]);
      setTotal(0);
    } finally {
      setCustomersLoading(false);
    }
  };

  const refreshFinanceRemark = async (customerId: string) => {
    if (!customerId) {
      setRemarkInput('');
      return;
    }

    setProfileLoading(true);
    try {
      if (isMockMode) {
        setRemarkInput(mockRemarks[customerId] || '');
        return;
      }

      const response = await getAdminCustomerFinanceProfile(customerId);
      if (response.status !== 200 || !response.data) {
        setErrorMessage('加载账期备注失败，请稍后重试。');
        setRemarkInput('');
        return;
      }

      const nextRemark = typeof response.data.paymentTermRemark === 'string' ? response.data.paymentTermRemark : '';
      setRemarkInput(nextRemark);
    } catch {
      setErrorMessage('加载账期备注失败，请稍后重试。');
      setRemarkInput('');
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    void refreshSalesUsers();
  }, [mockSalesUsers]);

  useEffect(() => {
    void refreshTags();
  }, [mockTags]);

  useEffect(() => {
    void refreshCustomers();
  }, [appliedQuery, ownerSalesFilter, tagFilters, page, pageSize, mockCustomers]);

  useEffect(() => {
    void refreshFinanceRemark(focusedCustomerId);
  }, [focusedCustomerId]);

  const handleApplySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setAppliedQuery(queryInput.trim());
  };

  const handleToggleSelectCustomer = (customerId: string) => {
    setSelectedCustomerIds((current) => {
      if (current.includes(customerId)) {
        return current.filter((id) => id !== customerId);
      }
      return [...current, customerId];
    });
  };

  const handleToggleSelectAllCurrentPage = () => {
    const currentPageIds = customers.map((customer) => customer.id);
    const isAllSelected = currentPageIds.every((id) => selectedCustomerIds.includes(id));

    setSelectedCustomerIds((current) => {
      if (isAllSelected) {
        return current.filter((id) => !currentPageIds.includes(id));
      }
      const next = new Set(current);
      currentPageIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const transferCustomerIds = (singleCustomerId?: string) => {
    if (singleCustomerId) {
      return [singleCustomerId];
    }
    if (selectedCustomerIds.length > 0) {
      return selectedCustomerIds;
    }
    return focusedCustomerId ? [focusedCustomerId] : [];
  };

  const handleTransferCustomers = async (singleCustomerId?: string) => {
    const customerIds = transferCustomerIds(singleCustomerId);
    if (customerIds.length === 0) {
      setErrorMessage('请先选择客户。');
      return;
    }
    if (!targetSalesUserId) {
      setErrorMessage('请选择目标业务员。');
      return;
    }

    clearFeedback();
    setSubmitting(true);

    try {
      if (isMockMode) {
        const targetSales = mockSalesUsers.find((sales) => sales.id === targetSalesUserId) || null;
        setMockCustomers((current) => {
          return current.map((customer) => {
            if (!customerIds.includes(customer.id)) {
              return customer;
            }
            return {
              ...customer,
              ownerSalesUserId: targetSalesUserId,
              ownerSales: targetSales
                ? {
                    id: targetSales.id,
                    displayName: targetSales.displayName,
                    phone: targetSales.phone
                  }
                : null
            };
          });
        });
        setSuccessMessage(`已转移 ${customerIds.length} 位客户（mock）。`);
        setSelectedCustomerIds([]);
        await refreshCustomers();
        return;
      }

      const response = await batchTransferCustomers({
        customerIds,
        toSalesUserId: targetSalesUserId,
        reason: transferReason.trim() || undefined
      });

      if (response.status !== 200) {
        setErrorMessage('客户转移失败，请稍后重试。');
        return;
      }

      setSuccessMessage(`已转移 ${customerIds.length} 位客户。`);
      setSelectedCustomerIds([]);
      await refreshCustomers();
    } catch {
      setErrorMessage('客户转移失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchTagUpdate = async () => {
    const customerIds = selectedCustomerIds.length > 0 ? selectedCustomerIds : (focusedCustomerId ? [focusedCustomerId] : []);
    if (customerIds.length === 0) {
      setErrorMessage('请先选择客户。');
      return;
    }
    if (addTagIds.length === 0 && removeTagIds.length === 0) {
      setErrorMessage('请选择要新增或移除的标签。');
      return;
    }

    clearFeedback();
    setSubmitting(true);

    try {
      if (isMockMode) {
        const addTags = mockTags.filter((tag) => addTagIds.includes(tag.id) && tag.active);
        const removeTagSet = new Set(removeTagIds);

        setMockCustomers((current) => {
          return current.map((customer) => {
            if (!customerIds.includes(customer.id)) {
              return customer;
            }

            const nextTags = customer.tags.filter((tag) => !removeTagSet.has(tag.id));
            addTags.forEach((tag) => {
              if (!nextTags.some((existing) => existing.id === tag.id)) {
                nextTags.push(tag);
              }
            });
            nextTags.sort((a, b) => a.sort - b.sort);

            return {
              ...customer,
              tags: nextTags
            };
          });
        });

        setSuccessMessage(`已更新 ${customerIds.length} 位客户标签（mock）。`);
        await refreshCustomers();
        return;
      }

      const response = await batchUpdateCustomerTags({
        customerIds,
        addTagIds: addTagIds.length > 0 ? addTagIds : undefined,
        removeTagIds: removeTagIds.length > 0 ? removeTagIds : undefined
      });

      if (response.status !== 200) {
        setErrorMessage('更新客户标签失败，请稍后重试。');
        return;
      }

      setSuccessMessage(`已更新 ${customerIds.length} 位客户标签。`);
      await refreshCustomers();
    } catch {
      setErrorMessage('更新客户标签失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTag = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = newTagName.trim();
    if (!name) {
      setErrorMessage('标签名称不能为空。');
      return;
    }

    clearFeedback();
    setSubmitting(true);

    try {
      if (isMockMode) {
        const nextTag: CustomerTag = {
          id: createMockId(),
          name,
          color: newTagColor.trim() || DEFAULT_TAG_COLOR,
          sort: mockTags.length * 10 + 10,
          active: true
        };
        setMockTags((current) => [...current, nextTag]);
        setSuccessMessage('标签已创建（mock）。');
        setNewTagName('');
        return;
      }

      const response = await createAdminCustomerTag({
        name,
        color: newTagColor.trim() || DEFAULT_TAG_COLOR
      });

      if (response.status !== 201) {
        setErrorMessage('创建标签失败，请稍后重试。');
        return;
      }

      setSuccessMessage('标签已创建。');
      setNewTagName('');
      await refreshTags();
    } catch {
      setErrorMessage('创建标签失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTagStatus = async (tag: CustomerTag) => {
    clearFeedback();
    setSubmitting(true);

    try {
      const nextActive = !tag.active;
      if (isMockMode) {
        setMockTags((current) => current.map((item) => (item.id === tag.id ? { ...item, active: nextActive } : item)));
        setSuccessMessage(`标签已${nextActive ? '启用' : '停用'}（mock）。`);
        return;
      }

      const response = await patchAdminCustomerTag(tag.id, {
        active: nextActive
      });

      if (response.status !== 200) {
        setErrorMessage('更新标签状态失败，请稍后重试。');
        return;
      }

      setSuccessMessage(`标签已${nextActive ? '启用' : '停用'}。`);
      await refreshTags();
      await refreshCustomers();
    } catch {
      setErrorMessage('更新标签状态失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveRemark = async () => {
    if (!focusedCustomerId) {
      setErrorMessage('请先选择客户。');
      return;
    }

    const trimmedRemark = remarkInput.trim();
    if (trimmedRemark.length > MAX_PAYMENT_TERM_REMARK_LENGTH) {
      setErrorMessage('账期备注最多 500 个字符。');
      return;
    }

    clearFeedback();
    setSubmitting(true);

    try {
      if (isMockMode) {
        setMockRemarks((current) => {
          const next = { ...current };
          if (trimmedRemark) {
            next[focusedCustomerId] = trimmedRemark;
          } else {
            delete next[focusedCustomerId];
          }
          return next;
        });
        setSuccessMessage('账期备注已保存（mock）。');
        return;
      }

      const response = await patchAdminCustomerFinanceProfile(focusedCustomerId, trimmedRemark);
      if (response.status !== 200) {
        setErrorMessage('保存账期备注失败，请稍后重试。');
        return;
      }

      const nextRemark = typeof response.data?.paymentTermRemark === 'string' ? response.data.paymentTermRemark : '';
      setRemarkInput(nextRemark);
      setSuccessMessage('账期备注已保存。');
    } catch {
      setErrorMessage('保存账期备注失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AdminTopbar
        searchPlaceholder="搜索客户、订单、业务员..."
        leftSlot={
          <div className="flex items-center gap-3 text-primary dark:text-blue-400">
            <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
            <h2 className="text-lg font-bold leading-tight tracking-tight text-text-primary-light dark:text-text-primary-dark">管理</h2>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 md:px-10 lg:px-20">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">客户转移</h1>
          <p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
            支持按业务员管理客户、批量转移归属、以及客户标签管理。
          </p>
        </div>

        <section className="mb-6 rounded-xl border border-border-light bg-surface-light p-5 shadow-sm dark:border-border-dark dark:bg-surface-dark">
          <form className="grid grid-cols-1 gap-3 md:grid-cols-4" onSubmit={handleApplySearch}>
            <input
              className="rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
              onChange={(event) => setQueryInput(event.currentTarget.value)}
              placeholder="客户名 / 手机 / 客户ID"
              value={queryInput}
            />
            <select
              className="rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
              onChange={(event) => {
                setOwnerSalesFilter(event.currentTarget.value);
                setPage(1);
              }}
              value={ownerSalesFilter}
            >
              <option value="">全部业务员</option>
              {salesUsers.map((sales) => (
                <option key={sales.id} value={sales.id}>{sales.displayName}</option>
              ))}
            </select>
            <select
              className="rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
              multiple
              onChange={(event) => {
                const values = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                setTagFilters(values);
                setPage(1);
              }}
              value={tagFilters}
            >
              {activeTags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={customersLoading}
              type="submit"
            >
              {customersLoading ? '查询中...' : '查询'}
            </button>
          </form>
        </section>

        {errorMessage ? <p className="mb-4 text-sm text-red-600">{errorMessage}</p> : null}
        {successMessage ? <p className="mb-4 text-sm text-green-600">{successMessage}</p> : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
          <section className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark">
            <div className="flex items-center justify-between border-b border-border-light px-4 py-3 dark:border-border-dark">
              <div>
                <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">客户列表</p>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">共 {total} 位客户，当前选中 {selectedCount} 位</p>
              </div>
              <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-primary dark:bg-blue-900/40 dark:text-blue-300">
                {isMockMode ? 'mock' : 'dev'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border-light bg-gray-50 text-xs font-semibold text-text-secondary-light dark:border-border-dark dark:bg-gray-800/60 dark:text-text-secondary-dark">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        checked={customers.length > 0 && customers.every((customer) => selectedCustomerIds.includes(customer.id))}
                        onChange={handleToggleSelectAllCurrentPage}
                        type="checkbox"
                      />
                    </th>
                    <th className="px-4 py-3">客户</th>
                    <th className="px-4 py-3">当前业务员</th>
                    <th className="px-4 py-3">标签</th>
                    <th className="px-4 py-3">创建时间</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {customers.map((customer) => {
                    const checked = selectedCustomerIds.includes(customer.id);
                    const focused = customer.id === focusedCustomerId;
                    return (
                      <tr
                        key={customer.id}
                        className={`cursor-pointer transition-colors ${focused ? 'bg-primary-light/40 dark:bg-primary/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'}`}
                        onClick={() => setFocusedCustomerId(customer.id)}
                      >
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          <input checked={checked} onChange={() => handleToggleSelectCustomer(customer.id)} type="checkbox" />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-text-primary-light dark:text-text-primary-dark">{customer.displayName}</p>
                          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{customer.phone || '-'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-text-primary-light dark:text-text-primary-dark">{customer.ownerSales?.displayName || '未分配'}</p>
                          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{customer.ownerSales?.phone || '-'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {customer.tags.length > 0 ? (
                              customer.tags.map((tag) => (
                                <span
                                  key={`${customer.id}-${tag.id}`}
                                  className="rounded px-2 py-0.5 text-xs font-medium text-white"
                                  style={{ backgroundColor: tag.color || DEFAULT_TAG_COLOR }}
                                >
                                  {tag.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">无标签</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{formatDateTime(customer.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            className="rounded border border-border-light px-2 py-1 text-xs text-text-primary-light hover:bg-gray-100 dark:border-border-dark dark:text-text-primary-dark dark:hover:bg-gray-800"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleTransferCustomers(customer.id);
                            }}
                            type="button"
                          >
                            转移该客户
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {!customersLoading && customers.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark" colSpan={6}>
                        暂无客户数据
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-border-light px-4 py-3 text-xs text-text-secondary-light dark:border-border-dark dark:text-text-secondary-dark">
              <span>
                第 {page} / {totalPages} 页
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="rounded border border-border-light px-2 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:hover:bg-gray-800"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  上一页
                </button>
                <button
                  className="rounded border border-border-light px-2 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:hover:bg-gray-800"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  type="button"
                >
                  下一页
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-xl border border-border-light bg-surface-light p-5 shadow-sm dark:border-border-dark dark:bg-surface-dark">
              <h3 className="mb-3 text-base font-semibold text-text-primary-light dark:text-text-primary-dark">客户归属转移</h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">目标业务员</label>
                  <select
                    className="w-full rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
                    disabled={salesLoading || submitting}
                    onChange={(event) => setTargetSalesUserId(event.currentTarget.value)}
                    value={targetSalesUserId}
                  >
                    <option value="">请选择业务员</option>
                    {salesUsers.map((sales) => (
                      <option key={sales.id} value={sales.id}>{sales.displayName}</option>
                    ))}
                  </select>
                  {selectedSalesUser ? (
                    <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      手机号：{selectedSalesUser.phone || '-'}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">转移原因（可选）</label>
                  <textarea
                    className="w-full rounded-lg border-border-light bg-background-light text-sm text-text-primary-light placeholder:text-text-secondary-light/50 focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
                    onChange={(event) => setTransferReason(event.currentTarget.value)}
                    placeholder="如：区域调整、人员离职..."
                    rows={3}
                    value={transferReason}
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={submitting || selectedCount === 0 || !targetSalesUserId}
                    onClick={() => void handleTransferCustomers()}
                    type="button"
                  >
                    转移选中客户
                  </button>
                  <button
                    className="rounded-lg border border-border-light px-3 py-2 text-sm font-medium text-text-primary-light hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:text-text-primary-dark dark:hover:bg-gray-800"
                    disabled={submitting || !focusedCustomerId || !targetSalesUserId}
                    onClick={() => void handleTransferCustomers(focusedCustomerId)}
                    type="button"
                  >
                    转移当前客户
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border-light bg-surface-light p-5 shadow-sm dark:border-border-dark dark:bg-surface-dark">
              <h3 className="mb-3 text-base font-semibold text-text-primary-light dark:text-text-primary-dark">客户标签操作</h3>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">新增标签（可多选）</label>
                  <select
                    className="w-full rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
                    multiple
                    onChange={(event) => {
                      const values = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                      setAddTagIds(values);
                    }}
                    value={addTagIds}
                  >
                    {activeTags.map((tag) => (
                      <option key={tag.id} value={tag.id}>{tag.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">移除标签（可多选）</label>
                  <select
                    className="w-full rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
                    multiple
                    onChange={(event) => {
                      const values = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                      setRemoveTagIds(values);
                    }}
                    value={removeTagIds}
                  >
                    {tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>{tag.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={submitting}
                  onClick={() => void handleBatchTagUpdate()}
                  type="button"
                >
                  应用到选中/当前客户
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border-light bg-surface-light p-5 shadow-sm dark:border-border-dark dark:bg-surface-dark">
              <h3 className="mb-3 text-base font-semibold text-text-primary-light dark:text-text-primary-dark">标签字典管理</h3>

              <div className="mb-4 max-h-44 space-y-2 overflow-y-auto pr-1">
                {tagsLoading ? (
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">加载标签中...</p>
                ) : null}
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between rounded border border-border-light px-3 py-2 dark:border-border-dark">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color || DEFAULT_TAG_COLOR }}></span>
                      <span className="text-sm text-text-primary-light dark:text-text-primary-dark">{tag.name}</span>
                      {!tag.active ? <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">（已停用）</span> : null}
                    </div>
                    <button
                      className="rounded border border-border-light px-2 py-1 text-xs hover:bg-gray-100 dark:border-border-dark dark:hover:bg-gray-800"
                      onClick={() => void handleToggleTagStatus(tag)}
                      type="button"
                    >
                      {tag.active ? '停用' : '启用'}
                    </button>
                  </div>
                ))}
              </div>

              <form className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={handleCreateTag}>
                <input
                  className="rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
                  onChange={(event) => setNewTagName(event.currentTarget.value)}
                  placeholder="新标签名称"
                  value={newTagName}
                />
                <input
                  className="h-10 rounded-lg border-border-light bg-background-light dark:border-border-dark dark:bg-background-dark"
                  onChange={(event) => setNewTagColor(event.currentTarget.value)}
                  type="color"
                  value={newTagColor}
                />
                <button
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={submitting}
                  type="submit"
                >
                  新建
                </button>
              </form>
            </div>

            <div className="rounded-xl border border-border-light bg-surface-light p-5 shadow-sm dark:border-border-dark dark:bg-surface-dark">
              <h3 className="mb-2 text-base font-semibold text-text-primary-light dark:text-text-primary-dark">客户账期备注</h3>
              <p className="mb-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                当前客户：{focusedCustomer?.displayName || '未选择客户'}
              </p>

              <textarea
                className="w-full rounded-lg border-border-light bg-background-light text-sm text-text-primary-light placeholder:text-text-secondary-light/50 focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
                disabled={!focusedCustomerId || profileLoading || submitting}
                onChange={(event) => setRemarkInput(event.currentTarget.value)}
                placeholder="例如：月结30天，票到后付款。"
                rows={5}
                value={remarkInput}
              ></textarea>

              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-text-secondary-light dark:text-text-secondary-dark">
                  {profileLoading ? '正在加载备注...' : '保存后同步到后端 finance profile'}
                </span>
                <span className={remarkLength > MAX_PAYMENT_TERM_REMARK_LENGTH ? 'font-semibold text-red-600' : 'text-text-secondary-light dark:text-text-secondary-dark'}>
                  {remarkLength}/{MAX_PAYMENT_TERM_REMARK_LENGTH}
                </span>
              </div>

              <button
                className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={!focusedCustomerId || profileLoading || submitting}
                onClick={() => void handleSaveRemark()}
                type="button"
              >
                保存账期备注
              </button>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};
