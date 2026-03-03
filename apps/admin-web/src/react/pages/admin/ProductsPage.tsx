type ProductStatusTone = 'active' | 'inactive' | 'draft';

type ProductRow = {
  imageAlt: string;
  imageUrl: string;
  name: string;
  sku: string;
  category: string;
  categoryClass: string;
  tierLabel: string;
  tierClass: string;
  inventory: string;
  inventoryClass?: string;
  inventoryHint?: string;
  inventoryHintClass?: string;
  statusLabel: string;
  statusTone: ProductStatusTone;
};

const productRows: readonly ProductRow[] = [
  {
    imageAlt: 'Abstract product image',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCQoEH4gfPeWzK1H0fbTKGpdPsPEiVMSPpMe3jLG-QgVaadYTF5qCKXGMjK_UTCXUpALUF4RYSCB-uwdUYyEqrynzyRupEFmfWY0O4Y55MSNjHpEcnbyyoMgg9bnSiWa-xAQg9jjGABk35lkIoQYRcnYbRoheyqYHOwhN_dwLyq9p73TGuxxF4apYmpLHY9xpto3PvnH_aZ0I9bo4tHrTLkleRHk2Dxhp9kINeVt8_ELlHoEiskagOOP2omXZCUmUVbFac5vdDDsIY',
    name: '经典纯棉 T 恤',
    sku: 'SKU-102-BLU-M',
    category: '服饰',
    categoryClass: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    tierLabel: '标准档',
    tierClass: 'text-sm text-slate-600 dark:text-slate-300',
    inventory: '1,240',
    statusLabel: '已上架',
    statusTone: 'active'
  },
  {
    imageAlt: 'Abstract electronic product image',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBEIgPW6ZBOTgr9Q108MfixPSYHRAYslI2QJq5jutI_I44OsmzXgS1DKgmv5bhUsoq8uj3sJsOGNsSVWTxV-MqVI5WZyd9Na0avk4Xb8Otkz0-SiSM9aoveA6AAYyaUAwwF7giqaUqikM6MKXWA62Lwkru6jttI92nQEEjAV7JrQewS4-8dgwyn_ivXI_iTPPk25_065zBjkvwThYjMA4WwJVvz0y9d0fZGYtJE111hzA0c9BL7tlLKI6GITyug2_lvbIU_qwqC5zs',
    name: '无线耳机 Pro',
    sku: 'SKU-505-BLK',
    category: '电子产品',
    categoryClass: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    tierLabel: '设置分层价格',
    tierClass: 'text-sm font-medium text-amber-600 dark:text-amber-400',
    inventory: '45',
    inventoryClass: 'text-red-600 dark:text-red-400',
    inventoryHint: '库存不足',
    inventoryHintClass: 'text-slate-400',
    statusLabel: '已下架',
    statusTone: 'inactive'
  },
  {
    imageAlt: 'Abstract leather product image',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAjfY9aErprDgMbNW85Bo1S8v946mPEkkDWaZzNHNBAYFo0m9XuCqFAv_SQv6LrE3AWOXealNtJiOQyGWyme10Dbf7sCna3NN2mr5lmmr9LG1DfWfVdbieVgjgFL9GHTkXi1tQJJdOYdR3YNQ8BM9KTCk0tuqJy0mtF_ha6Zar8OLDXFX51Fn6j7VCOSOmzIYgcuePgboazKpD8MCDDowKOK0VVUXHGHw50ztZCmTk1rfOmEFE_shi0E59oj3ZN72S3-T1R8lMP3TA',
    name: '真皮轻薄钱包',
    sku: 'SKU-303-BRN',
    category: '配件',
    categoryClass: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    tierLabel: '二档启用',
    tierClass: 'text-sm font-medium text-primary',
    inventory: '320',
    statusLabel: '已上架',
    statusTone: 'active'
  },
  {
    imageAlt: 'Abstract ceramic product image',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuATkU8VA_t7SGJYwPViJASvA_fn8uMFTdL9xTEl4WMsqfhxAvbR0nh2-_l1eL9GnV59mItV7WjLwXeKx6QdfbOXt-t02wb9ZDuQy7Ct-lJmuBaM2-N-eeAFCqQ_D-3lGfNZIyw5cdug2IE8WXiSN4Li-asDIj6cWCwM1GyC0Nq5xdNe1uaZ9zPdG0O57cR0GdpfWmpSfIaD3W3zsEa98n0M1GF0hB5VJGZMW3fESRS-sXsDmwHPEzklvk_cawQVRfgqmbWWeJSiV_s',
    name: '极简陶瓷花瓶',
    sku: 'SKU-889-WHT',
    category: '家居装饰',
    categoryClass: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    tierLabel: '标准',
    tierClass: 'text-sm text-slate-600 dark:text-slate-300',
    inventory: '15',
    inventoryHint: '紧急',
    inventoryHintClass: 'text-red-500 font-bold',
    statusLabel: '草稿',
    statusTone: 'draft'
  },
  {
    imageAlt: 'Abstract shoe product image',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA0dVU3CbsDZyVFNGcLshF6YPBJMXxeAkydfB9oG-gpqraaY3swuQGA6DlAzox0skc9W3gMDHpbOY7Ui6Dyfi72SLBagGUh5ASqADVL1jdp6k9txxiAxXeotx6YaP8KAeq_-eMws7k2lB-ugkiyFet-VpTh98336NktWjqnterKtgihC0oJOobwVBu322iP86hzYMstZBx7ItnBXjsjex5nGodo7N27yiGtEIvurLh64yG0d_g9NrQMb0bw9L9p4EHj3e2KWUbeq1c',
    name: '性能跑鞋',
    sku: 'SKU-774-GRY',
    category: '鞋履',
    categoryClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    tierLabel: '设置分层价格',
    tierClass: 'text-sm font-medium text-amber-600 dark:text-amber-400',
    inventory: '850',
    statusLabel: '已上架',
    statusTone: 'active'
  }
];

const statusClassMap: Record<ProductStatusTone, { wrapper: string; dot: string }> = {
  active: {
    wrapper: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800',
    dot: 'bg-emerald-500'
  },
  inactive: {
    wrapper: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400'
  },
  draft: {
    wrapper: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-100 dark:border-amber-800',
    dot: 'bg-amber-500'
  }
};

type ProductStatusBadgeProps = {
  label: string;
  tone: ProductStatusTone;
};

const ProductStatusBadge = ({ label, tone }: ProductStatusBadgeProps) => {
  const styles = statusClassMap[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${styles.wrapper}`}>
      <span className={`size-1.5 rounded-full ${styles.dot}`}></span>
      {label}
    </span>
  );
};

type ProductTableRowProps = {
  row: ProductRow;
};

const ProductTableRow = ({ row }: ProductTableRowProps) => {
  return (
    <tr className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td className="px-6 py-4">
        <input
          className="rounded border-slate-300 bg-transparent text-primary focus:ring-primary dark:border-slate-600"
          type="checkbox"
        />
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-4">
          <div
            className="size-12 rounded bg-slate-200 bg-cover bg-center flex-shrink-0 dark:bg-slate-700"
            data-alt={row.imageAlt}
            style={{ backgroundImage: `url("${row.imageUrl}")` }}
          ></div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white">{row.name}</div>
            <div className="mt-0.5 text-xs font-mono text-slate-500">{row.sku}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${row.categoryClass}`}>
          {row.category}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="group/edit flex cursor-pointer items-center gap-2">
          <span className={row.tierClass}>{row.tierLabel}</span>
          <button
            className="rounded p-1 text-primary opacity-0 transition-all group-hover/edit:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700"
            title="编辑价格"
          >
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <span className={`font-medium text-slate-900 dark:text-white ${row.inventoryClass ?? ''}`}>{row.inventory}</span>
        {row.inventoryHint ? (
          <span className={`block text-[10px] ${row.inventoryHintClass ?? 'text-slate-400'}`}>{row.inventoryHint}</span>
        ) : null}
      </td>
      <td className="px-6 py-4 text-center">
        <ProductStatusBadge label={row.statusLabel} tone={row.statusTone} />
      </td>
      <td className="px-6 py-4 text-right">
        <button
          className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-primary"
          data-role="open-product-drawer"
          title="编辑商品"
        >
          <span className="material-symbols-outlined text-base">edit</span>
          <span className="hidden sm:inline">编辑</span>
        </button>
      </td>
    </tr>
  );
};

export const ProductsPage = () => {
  return (
    <>
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 bg-surface-light px-6 py-4 transition-colors dark:border-slate-800 dark:bg-surface-dark">
        <div className="flex items-center gap-4">
          <div className="size-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-2xl">grid_view</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">商品中心</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button className="relative flex size-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 size-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-surface-dark"></span>
            </button>
            <button className="flex size-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              <span className="material-symbols-outlined">chat</span>
            </button>
          </div>
          <div className="mx-2 h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
          <button
            className="flex items-center gap-3 rounded-lg py-1 pl-1 pr-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
            id="logout-btn"
          >
            <div
              className="size-8 rounded-full bg-gradient-to-br from-primary to-blue-400 bg-cover bg-center ring-2 ring-white dark:ring-slate-700"
              data-alt="User profile avatar placeholder"
              style={{
                backgroundImage:
                  'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDpakJNH19xjsIFuArjABq9rauCwKTUSA9U41J1jHOMTfxF__17YHPQD9IjVoKlin7__oO98Sd9lpx9aSyo29yweXXNwoB3CuoDNNsKZFjuG93T2KmHlh_V9Fp-j6RF4luMKB89lpN3DN7c-2INXwM9vUVUsH-L0jo_9153PYyRM6CP2dbQsTdy9z6TbuOlWM9nwffqQ2Ru_ugaXI5c7iMo7HfwFpoqgn5dHAc0z6iiulTuwYJzjlbSyIdYXtv-dJiccblxPIJpTOc")'
              }}
            ></div>
            <div className="flex flex-col items-start">
              <span className="mb-1 text-sm leading-none font-semibold text-slate-900 dark:text-white" id="user-name">
                管理员用户
              </span>
              <span className="text-xs leading-none text-slate-500 dark:text-slate-400" id="user-role">
                管理员
              </span>
            </div>
            <span className="material-symbols-outlined text-lg text-slate-400">expand_more</span>
          </button>
        </div>
      </header>

      <main className="mx-auto flex-1 w-full max-w-[1400px] px-6 py-8 md:px-10 lg:px-12">
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white md:text-4xl">商品与 SKU 管理</h1>
            <p className="max-w-2xl text-lg text-slate-500 dark:text-slate-400">集中管理库存，定义分层价格，并监控各渠道库存水位。</p>
          </div>
          <div className="flex gap-3">
            <button
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-surface-light px-5 py-2.5 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-surface-dark dark:text-slate-200 dark:hover:bg-slate-800"
              id="export-products-btn"
            >
              <span className="material-symbols-outlined text-xl">file_upload</span>
              <span>导出</span>
            </button>
            <button
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-surface-light px-5 py-2.5 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-surface-dark dark:text-slate-200 dark:hover:bg-slate-800"
              id="manage-category-btn"
            >
              <span className="material-symbols-outlined text-xl">category</span>
              <span>类目管理</span>
            </button>
            <button
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-dark"
              id="create-product-btn"
            >
              <span className="material-symbols-outlined text-xl">add_circle</span>
              <span>新建商品</span>
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-surface-light p-4 shadow-sm dark:border-slate-800 dark:bg-surface-dark">
          <div className="flex flex-wrap items-center gap-4">
            <div className="mr-2 flex items-center gap-2 text-sm font-medium tracking-wider text-slate-500 uppercase dark:text-slate-400">
              <span className="material-symbols-outlined text-lg">filter_list</span>
              筛选
            </div>
            <div className="group relative">
              <select
                id="products-category-filter"
                defaultValue=""
                className="h-10 w-[160px] rounded-lg border border-slate-200 bg-slate-100 px-4 pr-9 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 focus:border-primary focus:bg-white focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:bg-slate-900"
              >
                <option value="">类目：全部</option>
              </select>
            </div>
            <div className="group relative">
              <select
                id="products-status-filter"
                defaultValue=""
                className="h-10 w-[160px] rounded-lg border border-slate-200 bg-slate-100 px-4 pr-9 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 focus:border-primary focus:bg-white focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:bg-slate-900"
              >
                <option value="">状态：全部</option>
                <option value="ACTIVE">状态：启用</option>
                <option value="INACTIVE">状态：停用</option>
                <option value="DRAFT">状态：草稿</option>
              </select>
            </div>
            <div className="relative min-w-[200px] flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                className="w-full rounded-lg border-transparent bg-slate-100 py-2 pl-10 pr-4 text-sm text-slate-900 transition-all placeholder-slate-400 focus:border-primary focus:bg-white focus:ring-0 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900"
                placeholder="按 SPU 名称或 SKU 编号搜索..."
                type="text"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface-light shadow-sm dark:border-slate-800 dark:bg-surface-dark">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                  <th className="w-[60px] px-6 py-4 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                    <input
                      className="rounded border-slate-300 bg-transparent text-primary focus:ring-primary dark:border-slate-600"
                      type="checkbox"
                    />
                  </th>
                  <th className="px-6 py-4 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                    商品信息（SPU/SKU）
                  </th>
                  <th className="px-6 py-4 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">类目</th>
                  <th className="px-6 py-4 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                    分层定价
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                    库存
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                    状态
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {productRows.map((row) => (
                  <ProductTableRow key={row.sku} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="text-sm text-slate-500 dark:text-slate-400" data-role="products-summary">
              显示第 <span className="font-semibold text-slate-900 dark:text-white">1</span> 到{' '}
              <span className="font-semibold text-slate-900 dark:text-white">5</span> 条，共{' '}
              <span className="font-semibold text-slate-900 dark:text-white">128</span> 条结果
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded p-2 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:hover:bg-slate-800"
                data-role="page-prev"
              >
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              <div className="flex items-center gap-2" data-role="page-numbers"></div>
              <button
                className="rounded p-2 text-slate-500 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800"
                data-role="page-next"
              >
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};
