import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchAdminPaymentAuditLogs,
  fetchAdminPaymentTransaction,
  fetchAdminPaymentTransactions,
  fetchAdminPaymentWebhooks,
  replayAdminPaymentWebhook
} from '../../../lib/api';
import { isMockMode } from '../../../lib/env';
import { AdminTopbar } from '../../layout/AdminTopbar';

type PaymentsTab = 'transactions' | 'audit' | 'webhooks';

type TransactionItem = {
  id: string;
  orderId: string;
  userId: string;
  channel: string;
  status: string;
  amountFen: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
};

type AuditItem = {
  id: string;
  transactionId: string;
  action: string;
  actor: string;
  detail: string;
  createdAt: string;
};

type WebhookItem = {
  id: string;
  provider: string;
  eventType: string;
  transactionId: string;
  status: string;
  replayCount: number;
  receivedAt: string;
  lastReplayAt?: string;
};

const safeText = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
};

const safeNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const formatDateTime = (raw: string) => {
  if (!raw) {
    return '-';
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
};

const formatAmount = (amountFen: number, currency: string) => {
  return `${(amountFen / 100).toFixed(2)} ${currency || 'CNY'}`;
};

const normalizeTransactions = (data: unknown): { items: TransactionItem[]; total: number } => {
  const payload = data as { items?: unknown[]; total?: number };
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return {
    items: items
      .map((item) => {
        const record = item as {
          id?: string;
          orderId?: string;
          userId?: string;
          channel?: string;
          status?: string;
          amountFen?: number;
          currency?: string;
          createdAt?: string;
          updatedAt?: string;
          failureReason?: string;
        };
        if (!record.id) {
          return null;
        }
        return {
          id: record.id,
          orderId: safeText(record.orderId, '-'),
          userId: safeText(record.userId, '-'),
          channel: safeText(record.channel, '-'),
          status: safeText(record.status, '-'),
          amountFen: safeNumber(record.amountFen, 0),
          currency: safeText(record.currency, 'CNY'),
          createdAt: safeText(record.createdAt, ''),
          updatedAt: safeText(record.updatedAt, ''),
          failureReason: safeText(record.failureReason)
        } as TransactionItem;
      })
      .filter(Boolean) as TransactionItem[],
    total: safeNumber(payload?.total, 0)
  };
};

const normalizeAudits = (data: unknown): { items: AuditItem[]; total: number } => {
  const payload = data as { items?: unknown[]; total?: number };
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return {
    items: items
      .map((item) => {
        const record = item as {
          id?: string;
          transactionId?: string;
          action?: string;
          actor?: string;
          detail?: string;
          createdAt?: string;
        };
        if (!record.id) {
          return null;
        }
        return {
          id: record.id,
          transactionId: safeText(record.transactionId, '-'),
          action: safeText(record.action, '-'),
          actor: safeText(record.actor, '-'),
          detail: safeText(record.detail, '-'),
          createdAt: safeText(record.createdAt, '')
        } as AuditItem;
      })
      .filter(Boolean) as AuditItem[],
    total: safeNumber(payload?.total, 0)
  };
};

const normalizeWebhooks = (data: unknown): { items: WebhookItem[]; total: number } => {
  const payload = data as { items?: unknown[]; total?: number };
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return {
    items: items
      .map((item) => {
        const record = item as {
          id?: string;
          provider?: string;
          eventType?: string;
          transactionId?: string;
          transaction?: string;
          status?: string;
          replayCount?: number;
          receivedAt?: string;
          lastReplayAt?: string;
        };
        if (!record.id) {
          return null;
        }
        return {
          id: record.id,
          provider: safeText(record.provider, '-'),
          eventType: safeText(record.eventType, '-'),
          transactionId: safeText(record.transactionId || record.transaction, '-'),
          status: safeText(record.status, '-'),
          replayCount: safeNumber(record.replayCount, 0),
          receivedAt: safeText(record.receivedAt, ''),
          lastReplayAt: safeText(record.lastReplayAt)
        } as WebhookItem;
      })
      .filter(Boolean) as WebhookItem[],
    total: safeNumber(payload?.total, 0)
  };
};

export const PaymentsPage = () => {
  const [activeTab, setActiveTab] = useState<PaymentsTab>('transactions');
  const [queryInput, setQueryInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionItem | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      if (isMockMode) {
        const mockTransactions: TransactionItem[] = [
          {
            id: 'TXN-MOCK-001',
            orderId: 'ORD-MOCK-001',
            userId: 'mock-user-1',
            channel: 'wechat',
            status: 'paid',
            amountFen: 123400,
            currency: 'CNY',
            createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
            updatedAt: new Date().toISOString()
          }
        ];
        const mockAudits: AuditItem[] = [
          {
            id: 'AUD-MOCK-001',
            transactionId: 'TXN-MOCK-001',
            action: 'status_updated',
            actor: 'mock-system',
            detail: 'status changed to paid',
            createdAt: new Date().toISOString()
          }
        ];
        const mockWebhooks: WebhookItem[] = [
          {
            id: 'WH-MOCK-001',
            provider: 'wechat',
            eventType: 'payment.succeeded',
            transactionId: 'TXN-MOCK-001',
            status: 'processed',
            replayCount: 0,
            receivedAt: new Date().toISOString()
          }
        ];

        if (activeTab === 'transactions') {
          setTransactions(mockTransactions);
          setTotal(mockTransactions.length);
          setSelectedTransaction(mockTransactions[0] || null);
        } else if (activeTab === 'audit') {
          setAudits(mockAudits);
          setTotal(mockAudits.length);
        } else {
          setWebhooks(mockWebhooks);
          setTotal(mockWebhooks.length);
        }
        return;
      }

      if (activeTab === 'transactions') {
        const listResp = await fetchAdminPaymentTransactions({
          page,
          pageSize,
          q: appliedQuery || undefined
        });
        if (listResp.status !== 200) {
          setTransactions([]);
          setTotal(0);
          setErrorMessage('加载交易列表失败，请稍后重试。');
          return;
        }

        const normalized = normalizeTransactions(listResp.data);
        setTransactions(normalized.items);
        setTotal(normalized.total);

        if (normalized.items.length > 0) {
          const detailResp = await fetchAdminPaymentTransaction(normalized.items[0].id);
          if (detailResp.status === 200 && detailResp.data) {
            const detail = normalizeTransactions({ items: [detailResp.data], total: 1 }).items[0] || null;
            setSelectedTransaction(detail);
          } else {
            setSelectedTransaction(normalized.items[0]);
          }
        } else {
          setSelectedTransaction(null);
        }
        return;
      }

      if (activeTab === 'audit') {
        const listResp = await fetchAdminPaymentAuditLogs({
          page,
          pageSize,
          q: appliedQuery || undefined
        });
        if (listResp.status !== 200) {
          setAudits([]);
          setTotal(0);
          setErrorMessage('加载审计日志失败，请稍后重试。');
          return;
        }

        const normalized = normalizeAudits(listResp.data);
        setAudits(normalized.items);
        setTotal(normalized.total);
        return;
      }

      const webhookResp = await fetchAdminPaymentWebhooks({
        page,
        pageSize,
        q: appliedQuery || undefined
      });
      if (webhookResp.status !== 200) {
        setWebhooks([]);
        setTotal(0);
        setErrorMessage('加载回调事件失败，请稍后重试。');
        return;
      }
      const normalized = normalizeWebhooks(webhookResp.data);
      setWebhooks(normalized.items);
      setTotal(normalized.total);
    } catch {
      setErrorMessage('加载支付数据失败，请稍后重试。');
      setTotal(0);
      setTransactions([]);
      setAudits([]);
      setWebhooks([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, appliedQuery, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setAppliedQuery(queryInput.trim());
  };

  const handleReplayWebhook = async (webhook: WebhookItem) => {
    setErrorMessage('');
    setSuccessMessage('');

    if (isMockMode) {
      setWebhooks((current) =>
        current.map((item) =>
          item.id === webhook.id
            ? {
                ...item,
                replayCount: item.replayCount + 1,
                lastReplayAt: new Date().toISOString()
              }
            : item
        )
      );
      setSuccessMessage(`已提交重放：${webhook.id}`);
      return;
    }

    try {
      const response = await replayAdminPaymentWebhook(webhook.id);
      if (response.status !== 200) {
        setErrorMessage('重放 Webhook 失败，请稍后重试。');
        return;
      }
      setSuccessMessage(`已提交重放：${webhook.id}`);
      await loadData();
    } catch {
      setErrorMessage('重放 Webhook 失败，请稍后重试。');
    }
  };

  return (
    <main className="flex h-screen flex-1 flex-col overflow-hidden bg-background-light dark:bg-background-dark" data-testid="payments-page">
      <AdminTopbar
        leftSlot={<h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">支付与审计</h2>}
        searchPlaceholder="搜索交易号、订单号或事件 ID"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border-light bg-surface-light p-2 dark:border-border-dark dark:bg-surface-dark">
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'transactions' ? 'bg-primary text-white' : 'text-text-secondary-light hover:bg-gray-100 dark:text-text-secondary-dark dark:hover:bg-gray-800'}`}
            data-testid="payments-tab-transactions"
            onClick={() => setActiveTab('transactions')}
            type="button"
          >
            交易
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'audit' ? 'bg-primary text-white' : 'text-text-secondary-light hover:bg-gray-100 dark:text-text-secondary-dark dark:hover:bg-gray-800'}`}
            data-testid="payments-tab-audit"
            onClick={() => setActiveTab('audit')}
            type="button"
          >
            审计日志
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'webhooks' ? 'bg-primary text-white' : 'text-text-secondary-light hover:bg-gray-100 dark:text-text-secondary-dark dark:hover:bg-gray-800'}`}
            data-testid="payments-tab-webhooks"
            onClick={() => setActiveTab('webhooks')}
            type="button"
          >
            Webhooks
          </button>
        </div>

        <form className="mb-4 flex gap-2" onSubmit={handleSearch}>
          <input
            className="flex-1 rounded-lg border border-border-light bg-background-light px-3 py-2 text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
            onChange={(event) => setQueryInput(event.currentTarget.value)}
            placeholder="输入关键字搜索"
            value={queryInput}
          />
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={loading}
            type="submit"
          >
            {loading ? '查询中...' : '查询'}
          </button>
        </form>

        {errorMessage ? <p className="mb-3 text-sm text-red-600" data-testid="payments-error">{errorMessage}</p> : null}
        {successMessage ? <p className="mb-3 text-sm text-emerald-600" data-testid="payments-success">{successMessage}</p> : null}

        {activeTab === 'transactions' ? (
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
            <div className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark">
              <div className="border-b border-border-light px-4 py-3 text-sm font-semibold text-text-primary-light dark:border-border-dark dark:text-text-primary-dark">
                交易列表（共 {total} 条）
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-border-light bg-gray-50 text-xs font-semibold text-text-secondary-light dark:border-border-dark dark:bg-gray-800/60 dark:text-text-secondary-dark">
                    <tr>
                      <th className="px-4 py-3">交易号</th>
                      <th className="px-4 py-3">渠道</th>
                      <th className="px-4 py-3">金额</th>
                      <th className="px-4 py-3">状态</th>
                      <th className="px-4 py-3">更新时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-border-dark" data-testid="transactions-body">
                    {transactions.map((item) => (
                      <tr
                        className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30"
                        data-testid={`transaction-row-${item.id}`}
                        key={item.id}
                        onClick={() => setSelectedTransaction(item)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-text-primary-light dark:text-text-primary-dark">{item.id}</p>
                          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{item.orderId}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{item.channel}</td>
                        <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{formatAmount(item.amountFen, item.currency)}</td>
                        <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{item.status}</td>
                        <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{formatDateTime(item.updatedAt)}</td>
                      </tr>
                    ))}
                    {!loading && transactions.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark" colSpan={5} data-testid="transactions-empty-state">
                          暂无交易数据
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="rounded-xl border border-border-light bg-surface-light p-4 shadow-sm dark:border-border-dark dark:bg-surface-dark" data-testid="transaction-detail">
              <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">交易详情</h3>
              {selectedTransaction ? (
                <div className="mt-3 space-y-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  <p>交易号：{selectedTransaction.id}</p>
                  <p>订单号：{selectedTransaction.orderId}</p>
                  <p>用户：{selectedTransaction.userId}</p>
                  <p>渠道：{selectedTransaction.channel}</p>
                  <p>状态：{selectedTransaction.status}</p>
                  <p>金额：{formatAmount(selectedTransaction.amountFen, selectedTransaction.currency)}</p>
                  <p>创建时间：{formatDateTime(selectedTransaction.createdAt)}</p>
                  <p>更新时间：{formatDateTime(selectedTransaction.updatedAt)}</p>
                  {selectedTransaction.failureReason ? <p>失败原因：{selectedTransaction.failureReason}</p> : null}
                </div>
              ) : <p className="mt-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">请选择一条交易查看详情。</p>}
            </aside>
          </section>
        ) : null}

        {activeTab === 'audit' ? (
          <section className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark">
            <div className="border-b border-border-light px-4 py-3 text-sm font-semibold text-text-primary-light dark:border-border-dark dark:text-text-primary-dark">
              审计日志（共 {total} 条）
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border-light bg-gray-50 text-xs font-semibold text-text-secondary-light dark:border-border-dark dark:bg-gray-800/60 dark:text-text-secondary-dark">
                  <tr>
                    <th className="px-4 py-3">操作</th>
                    <th className="px-4 py-3">交易号</th>
                    <th className="px-4 py-3">执行者</th>
                    <th className="px-4 py-3">详情</th>
                    <th className="px-4 py-3">时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {audits.map((item) => (
                    <tr className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30" key={item.id}>
                      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{item.action}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{item.transactionId}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{item.actor}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{item.detail}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{formatDateTime(item.createdAt)}</td>
                    </tr>
                  ))}
                  {!loading && audits.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark" colSpan={5}>
                        暂无审计日志
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === 'webhooks' ? (
          <section className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark">
            <div className="border-b border-border-light px-4 py-3 text-sm font-semibold text-text-primary-light dark:border-border-dark dark:text-text-primary-dark">
              Webhook 事件（共 {total} 条）
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-border-light bg-gray-50 text-xs font-semibold text-text-secondary-light dark:border-border-dark dark:bg-gray-800/60 dark:text-text-secondary-dark">
                  <tr>
                    <th className="px-4 py-3">事件 ID</th>
                    <th className="px-4 py-3">渠道</th>
                    <th className="px-4 py-3">事件类型</th>
                    <th className="px-4 py-3">交易号</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">重放次数</th>
                    <th className="px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark" data-testid="webhooks-body">
                  {webhooks.map((item) => (
                    <tr className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30" data-testid={`webhook-row-${item.id}`} key={item.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary-light dark:text-text-primary-dark">{item.id}</p>
                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">接收于 {formatDateTime(item.receivedAt)}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{item.provider}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{item.eventType}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{item.transactionId}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{item.status}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{item.replayCount}</td>
                      <td className="px-4 py-3">
                        <button
                          className="rounded border border-primary px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                          data-testid={`webhook-replay-${item.id}`}
                          onClick={() => void handleReplayWebhook(item)}
                          type="button"
                        >
                          重放
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && webhooks.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark" colSpan={7} data-testid="webhooks-empty-state">
                        暂无 webhook 事件
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <div className="mt-4 flex items-center justify-between text-xs text-text-secondary-light dark:text-text-secondary-dark">
          <span>第 {page} / {totalPages} 页</span>
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
      </div>
    </main>
  );
};
