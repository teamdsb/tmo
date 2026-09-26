import { useEffect, useState } from 'react';
import { AlertCircle, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { importStatusLabels, type ImportGroup, type ImportIssue, type ImportJob, type ImportSummary } from './import-types';
export const inputClass = 'min-w-0 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
export const buttonClass = 'inline-flex min-h-9 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
export const primaryClass = `${buttonClass} !border-primary !bg-primary !text-white hover:!bg-primary/90`;
export const nilID = '00000000-0000-0000-0000-000000000000';
export const actionLabels: Record<string, string> = { CREATE: '新建', UPDATE: '更新', SKIP: '跳过', SPLIT: '独立草稿', ERROR: '无法导入' };
export const Status = ({ job }: {
    job: ImportJob;
}) => <span data-testid="latest-import-job-status" className={`whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${job.status === 'FAILED' ? 'bg-red-50 text-red-700' : job.status === 'AWAITING_CONFIRMATION' || job.status === 'PARTIALLY_SUCCEEDED' || Boolean(job.summary?.reviewCount) ? 'bg-amber-50 text-amber-800' : job.status === 'SUCCEEDED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{importStatusLabels[job.status] || job.status}{job.status === 'SUCCEEDED' && job.summary?.reviewCount ? ' · 有待复核' : ''}</span>;
export const Issues = ({ items = [] }: {
    items?: ImportIssue[];
}) => <>{items.map((issue, index) => <div key={`${issue.code}-${index}`} className={`flex items-start gap-1.5 text-xs leading-5 ${issue.severity === 'ERROR' ? 'text-red-700' : 'text-amber-800'}`}><AlertCircle size={14} className="mt-1 shrink-0"/><span>{issue.message}</span></div>)}</>;
export const Pager = ({ page, total, pageSize, onChange }: {
    page: number;
    total: number;
    pageSize: number;
    onChange: (page: number) => void;
}) => <div className="flex items-center justify-between gap-3 py-3 text-sm text-slate-600"><span>共 {total} 项 · 第 {page} / {Math.max(1, Math.ceil(total / pageSize))} 页</span><div className="flex gap-2"><button type="button" aria-label="上一页" className={buttonClass} disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16}/></button><button type="button" aria-label="下一页" className={buttonClass} disabled={page * pageSize >= total} onClick={() => onChange(page + 1)}><ChevronRight size={16}/></button></div></div>;
export const Summary = ({ value }: {
    value?: ImportSummary;
}) => value ? <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-slate-200 py-4 sm:grid-cols-4 lg:grid-cols-6">{[['源数据行', value.totalRows], ['新建商品', value.productCreates], ['更新商品', value.productUpdates], ['SKU 新建 / 更新', `${value.skuCreates || 0} / ${value.skuUpdates || 0}`], ['独立草稿', value.splitProducts], ['待复核 / 失败', `${value.reviewCount || 0} / ${value.failedRows || 0}`]].map(([label, count]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-lg font-semibold text-slate-900">{count || 0}</dd></div>)}</dl> : null;
export function GroupEditor({ group, editable, categories, busy, onSave }: {
    group: ImportGroup;
    editable: boolean;
    categories: Array<{
        id: string;
        name: string;
    }>;
    busy: boolean;
    onSave: (group: any) => Promise<void>;
}) {
    const [draft, setDraft] = useState(group);
    const [page, setPage] = useState(1);
    const [overrides, setOverrides] = useState<Record<string, {
        groupKey?: string;
        ignored?: boolean;
        clearFields?: string[];
    }>>({});
    useEffect(() => { setDraft(group); setOverrides({}); }, [group]);
    const updateRow = (id: string, patch: Record<string, unknown>) => setDraft(current => ({ ...current, rows: current.rows.map(row => row.rowId === id ? { ...row, ...patch } : row) }));
    return <form className="space-y-4 border-t border-slate-200 bg-slate-50 px-4 py-4" onSubmit={event => { event.preventDefault(); void onSave({ key: group.key, productName: draft.productName, categoryId: draft.categoryId || nilID, dimensions: draft.dimensions, rows: draft.rows.map(row => ({ rowId: row.rowId, unit: row.unit, attributes: row.attributes, ...overrides[row.rowId] })) }); }}>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs text-slate-600">商品名称<input className={`${inputClass} mt-1 w-full`} aria-label="预览商品名称" disabled={!editable} value={draft.productName} onChange={e => setDraft({ ...draft, productName: e.target.value })}/></label>
      <label className="text-xs text-slate-600">分类<select className={`${inputClass} mt-1 w-full`} aria-label="预览商品分类" disabled={!editable} value={draft.categoryId === nilID ? '' : draft.categoryId || ''} onChange={e => setDraft({ ...draft, categoryId: e.target.value })}><option value="">未分类</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <div className="sm:col-span-2"><div className="flex items-center justify-between text-xs text-slate-600"><span>规格层级</span>{editable ? <div className="flex gap-3"><button type="button" className="text-primary disabled:opacity-50" disabled={draft.dimensions.length >= 3} onClick={() => setDraft({ ...draft, dimensions: [...draft.dimensions, ''] })}>新增层级</button><button type="button" className="disabled:opacity-50" disabled={draft.dimensions.length <= 1} onClick={() => setDraft({ ...draft, dimensions: draft.dimensions.slice(0, -1) })}>删除末级</button></div> : null}</div><div className="mt-1 grid grid-cols-3 gap-2">{draft.dimensions.map((name, index) => <input key={index} className={inputClass} aria-label={`预览第 ${index + 1} 级名称`} disabled={!editable} value={name} onChange={e => { const nextName = e.target.value; setDraft(current => ({ ...current, dimensions: current.dimensions.map((item, level) => level === index ? nextName : item), rows: current.rows.map(row => ({ ...row, attributes: Object.fromEntries([...Object.entries(row.attributes).filter(([key]) => key !== name), [nextName, row.attributes[name] || '']]) })) })); }}/>)}</div></div>
    </div>
    <Issues items={group.issues}/>
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-y border-slate-200 text-xs text-slate-500"><tr><th className="py-2 pr-3">来源 / SKU</th>{draft.dimensions.map((dimension, index) => <th className="px-2 py-2" key={index}>{dimension || `第 ${index + 1} 级`}</th>)}<th className="px-2 py-2">单位</th><th className="px-2 py-2">分组 / 操作</th></tr></thead><tbody>{draft.rows.slice((page - 1) * 10, page * 10).map(row => <tr key={row.rowId} className="border-b border-slate-200 align-top">
      <td className="max-w-64 py-3 pr-3"><div className="font-medium break-words">{row.skuName || row.spec || row.skuCode || '空 SKU 行'}</div><div className="mt-1 text-xs text-slate-500">{row.sourceSheet} · 第 {row.sourceRow} 行 · {actionLabels[row.action] || row.action}</div><div className="mt-2"><Issues items={row.issues}/></div><details className="mt-2 text-xs"><summary className="cursor-pointer text-slate-500">源数据</summary><dl className="mt-2 space-y-1">{Object.entries(row.rawValues || {}).filter(([, value]) => value).map(([key, value]) => <div key={key} className="break-all"><dt className="inline text-slate-500">{key}：</dt><dd className="inline">{value}</dd></div>)}</dl></details></td>
      {draft.dimensions.map((dimension, level) => <td key={level} className="px-2 py-3"><input className={`${inputClass} w-28`} aria-label={`第 ${row.sourceRow} 行 ${dimension} 规格值`} disabled={!editable} value={row.attributes?.[dimension] || ''} onChange={e => updateRow(row.rowId, { attributes: { ...row.attributes, [dimension]: e.target.value } })}/></td>)}
      <td className="px-2 py-3"><input className={`${inputClass} w-20`} aria-label={`第 ${row.sourceRow} 行单位`} disabled={!editable} value={row.unit || ''} onChange={e => updateRow(row.rowId, { unit: e.target.value })}/></td>
      <td className="px-2 py-3">{editable ? <div className="space-y-2"><input className={`${inputClass} w-36`} aria-label={`第 ${row.sourceRow} 行目标分组`} placeholder={group.key} value={overrides[row.rowId]?.groupKey || ''} onChange={e => setOverrides(current => ({ ...current, [row.rowId]: { ...current[row.rowId], groupKey: e.target.value || undefined } }))}/><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={overrides[row.rowId]?.ignored ?? row.action === 'SKIP'} onChange={e => setOverrides(current => ({ ...current, [row.rowId]: { ...current[row.rowId], ignored: e.target.checked } }))}/>跳过此行</label><details className="text-xs"><summary className="cursor-pointer text-slate-500">清空字段</summary>{[['unit', '单位'], ['description', '商品说明'], ['images', '商品图片'], ['tags', '标签'], ['priceTiers', '阶梯价格']].map(([field, label]) => <label key={field} className="mt-2 flex items-center gap-2"><input type="checkbox" checked={(overrides[row.rowId]?.clearFields ?? row.clearFields ?? []).includes(field)} onChange={e => setOverrides(current => ({ ...current, [row.rowId]: { ...current[row.rowId], clearFields: e.target.checked ? [...(current[row.rowId]?.clearFields ?? row.clearFields ?? []), field] : (current[row.rowId]?.clearFields ?? row.clearFields ?? []).filter(item => item !== field) } }))}/>{label}</label>)}</details></div> : actionLabels[row.action] || row.action}</td>
    </tr>)}</tbody></table></div>
    <Pager page={page} total={draft.rows.length} pageSize={10} onChange={setPage}/>{editable ? <button type="submit" className={primaryClass} disabled={busy}><Check size={16}/>保存修正并重新校验</button> : null}
  </form>;
}
