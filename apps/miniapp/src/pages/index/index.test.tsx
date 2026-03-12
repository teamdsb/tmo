import fs from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Taro from '@tarojs/taro';
import ProductCatalogApp from './index';
import { commerceServices } from '../../services/commerce';

const defaultProducts = [
  { id: 'prod-1001', name: 'A4 办公用纸', coverImageUrl: '', tags: ['办公'] },
  { id: 'prod-1002', name: '钢制螺栓套装', coverImageUrl: '', tags: ['工业'] },
  { id: 'prod-1003', name: '控制阀套件', coverImageUrl: '', tags: ['工业'] },
  { id: 'prod-1004', name: '封箱胶带', coverImageUrl: '', tags: ['办公'] }
];

const longTitleProducts = [
  {
    id: 'prod-long-1',
    name: 'Real Import Product 1772794846257 超长商品描述ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890无空格连续文本用于验证双列布局稳定性',
    coverImageUrl: '',
    tags: ['smoke']
  },
  {
    id: 'prod-long-2',
    name: 'Real Import Product 1772794337333 第二个超长商品名称ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890无空格连续文本用于验证双列布局稳定性',
    coverImageUrl: '',
    tags: ['smoke']
  }
];

const renderCatalog = async () => {
  render(<ProductCatalogApp />);
  await screen.findByText('紧固件');
};

const runSearchDebounce = async () => {
  await act(async () => {
    jest.advanceTimersByTime(300);
    await Promise.resolve();
  });
};

describe('ProductCatalogApp', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (commerceServices.catalog.listProducts as jest.Mock).mockImplementation(async () => ({
      items: defaultProducts,
      total: defaultProducts.length
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders search and product grid', async () => {
    await renderCatalog();

    const navbar = document.querySelector('.app-navbar.app-navbar--primary');
    expect(navbar).not.toBeNull();
    const pageRoot = document.querySelector('.page.page-home');
    expect(pageRoot).not.toBeNull();

    expect(screen.getAllByTestId('home-showcase-card')).toHaveLength(3);
    expect(screen.getAllByTestId('home-showcase-dots')).toHaveLength(3);
    expect(screen.getByText('目录采购更快开始')).toBeInTheDocument();
    expect(screen.getByText('缺货或规格不清就提需求')).toBeInTheDocument();
    expect(screen.getByText('Excel 一次导入整单')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('按 SKU 或名称搜索...')).toBeInTheDocument();
    expect(await screen.findByText('紧固件')).toBeInTheDocument();
    expect(screen.getAllByTestId('home-category-item')).toHaveLength(8);
    expect(screen.getAllByText('敬请期待')).toHaveLength(6);
    expect(screen.queryByText('更多')).not.toBeInTheDocument();
    expect(screen.getByTestId('home-product-matrix')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(await screen.findAllByText('¥185.00 起')).toHaveLength(4);
  });

  it('opens v1 rescue actions from showcase cards', async () => {
    await renderCatalog();

    fireEvent.click(screen.getByText('发布需求'));
    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/demand/create/index' });

    fireEvent.click(screen.getByText('批量导入'));
    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/import/index' });
  });


  it('keeps rendering product cards for long unbroken titles', async () => {
    (commerceServices.catalog.listProducts as jest.Mock).mockResolvedValue({
      items: longTitleProducts,
      total: longTitleProducts.length
    });

    await renderCatalog();
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(screen.getAllByText('¥185.00 起')).toHaveLength(2);
    expect(screen.getByText(/Real Import Product 1772794846257/)).toBeInTheDocument();
    expect(screen.getByText(/Real Import Product 1772794337333/)).toBeInTheDocument();
    expect(document.querySelectorAll('.product-card')).toHaveLength(2);
  });


  it('uses multiline wrapping styles for product card titles', () => {
    const stylesheet = fs.readFileSync(path.resolve(__dirname, '../../app.scss'), 'utf8');

    expect(stylesheet).toContain('.product-card-title');
    expect(stylesheet).toContain('.product-card--home');
    expect(stylesheet).toContain('.product-card-image-shell');
    expect(stylesheet).toContain('.product-card-image-wrapper');
    expect(stylesheet).toContain('-webkit-line-clamp: 2;');
    expect(stylesheet).toContain('overflow-wrap: anywhere;');
    expect(stylesheet).toContain('word-break: break-word;');
  });

  it('uses a safe showcase height and clamps slide copy for miniapp', () => {
    const stylesheet = fs.readFileSync(path.resolve(__dirname, './index.scss'), 'utf8');

    expect(stylesheet).toContain('.home-search-shell');
    expect(stylesheet).toContain('.home-search-input');
    expect(stylesheet).toContain('.home-search-placeholder');
    expect(stylesheet).toContain('text-align: left;');
    expect(stylesheet).toContain('.home-showcase-swiper');
    expect(stylesheet).toContain('height: 320px;');
    expect(stylesheet).toContain('.home-showcase-title');
    expect(stylesheet).toContain('.home-showcase-title--demand');
    expect(stylesheet).toContain('.home-showcase-copy');
    expect(stylesheet).toContain('.home-showcase-decoration');
    expect(stylesheet).toContain('max-width: 400rpx;');
    expect(stylesheet).toContain('max-width: 520rpx;');
    expect(stylesheet).toContain('padding: 20px 20px 24px;');
    expect(stylesheet).toContain('padding-top: 24px;');
    expect(stylesheet).toContain('box-sizing: border-box;');
    expect(stylesheet).toContain('-webkit-line-clamp: 2;');
    expect(stylesheet).toContain('.home-product-matrix');
    expect(stylesheet).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(stylesheet).toContain('gap: 12px;');
    expect(stylesheet).toContain('.home-product-cell .product-card--home');
    expect(stylesheet).toContain('.home-category-panel');
  });

  it('updates search input value', async () => {
    await renderCatalog();

    const input = screen.getByPlaceholderText('按 SKU 或名称搜索...');
    fireEvent.change(input, { target: { value: 'bolt' } });

    expect(input).toHaveValue('bolt');
  });

  it('switches to category tab when clicking quick category', async () => {
    await renderCatalog();

    fireEvent.click(await screen.findByText('紧固件'));

    await waitFor(() => {
      expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/category/index' });
    });
  });

  it('does not navigate when clicking placeholder quick category', async () => {
    await renderCatalog();

    fireEvent.click(screen.getAllByText('敬请期待')[0]!);

    expect(Taro.switchTab).not.toHaveBeenCalled();
  });

  it('renders eight real quick categories without placeholders when backend returns enough items', async () => {
    (commerceServices.catalog.listDisplayCategories as jest.Mock).mockResolvedValue({
      items: [
        { id: 'fasteners', name: '紧固件', iconKey: 'setting', sort: 1, enabled: true },
        { id: 'electrical', name: '电气', iconKey: 'desktop', sort: 2, enabled: true },
        { id: 'safety', name: '安全防护', iconKey: 'shield', sort: 3, enabled: true },
        { id: 'tools', name: '工具', iconKey: 'setting', sort: 4, enabled: true },
        { id: 'instrumentation', name: '仪器仪表', iconKey: 'apps', sort: 5, enabled: true },
        { id: 'janitorial', name: '劳保清洁', iconKey: 'brush', sort: 6, enabled: true },
        { id: 'office', name: '办公文具', iconKey: 'notes', sort: 7, enabled: true },
        { id: 'packaging', name: '包装耗材', iconKey: 'apps', sort: 8, enabled: true }
      ]
    });

    await renderCatalog();

    expect(screen.getAllByTestId('home-category-item')).toHaveLength(8);
    expect(screen.queryByText('敬请期待')).not.toBeInTheDocument();
  });

  it('shows demand hint when home search has no result and navigates to demand create', async () => {
    (commerceServices.catalog.listProducts as jest.Mock).mockImplementation(async ({ q } = {}) => {
      if (q) {
        return { items: [], total: 0 };
      }
      return {
        items: [
          { id: 'prod-1001', name: 'A4 办公用纸', coverImageUrl: '', tags: ['办公'] }
        ],
        total: 1
      };
    });

    await renderCatalog();

    const input = screen.getByPlaceholderText('按 SKU 或名称搜索...');
    fireEvent.change(input, { target: { value: '123' } });

    await runSearchDebounce();

    expect(screen.getByText('未找到“123”？')).toBeInTheDocument();
    const action = screen.getByText('点击发布需求');
    expect(action).toHaveClass('home-empty-demand-action');

    fireEvent.click(action);

    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/demand/create/index?kw=123' });
  });

  it('does not show demand hint when home search has matched products', async () => {
    await renderCatalog();

    const input = screen.getByPlaceholderText('按 SKU 或名称搜索...');
    fireEvent.change(input, { target: { value: 'A4' } });

    await runSearchDebounce();

    expect(screen.queryByText('点击发布需求')).not.toBeInTheDocument();
  });
});
