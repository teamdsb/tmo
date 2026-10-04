import { buildAppHref } from '../../../lib/env';
import { AdminTopbar } from '../../layout/AdminTopbar';

export const QuoteWorkflowPage = () => (
  <>
    <AdminTopbar title="报价审批" />
    <main className="flex flex-1 items-center justify-center bg-background-light p-8 dark:bg-background-dark">
      <section className="w-full max-w-2xl rounded-2xl border border-border-light bg-white p-8 text-center dark:border-border-dark dark:bg-surface-dark">
        <span aria-hidden="true" className="material-symbols-outlined text-5xl text-slate-400">construction</span>
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">报价审批暂未开放</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">报价版本、审批及协商记录尚未接入。请通过在线客服跟进客户需求。</p>
        <a className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white" href={buildAppHref('/inquiries.html')}>返回在线客服</a>
      </section>
    </main>
  </>
);
