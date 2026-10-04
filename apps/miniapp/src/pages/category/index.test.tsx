import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useDidShow } from '@tarojs/taro';
import { commerceServices } from '../../services/commerce';
import CategoryPage from './index';

describe('CategoryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useDidShow as jest.Mock).mockImplementation(() => {});
    (commerceServices.catalog.listProducts as jest.Mock).mockResolvedValue({
      items: [
        { id: 'prod-1001', name: 'A4 办公用纸', coverImageUrl: '', tags: ['办公'] },
        { id: 'prod-1002', name: '钢制螺栓套装', coverImageUrl: '', tags: ['工业'] },
        { id: 'prod-1003', name: '控制阀套件', coverImageUrl: '', tags: ['工业'] },
        { id: 'prod-1004', name: '封箱胶带', coverImageUrl: '', tags: ['办公'] }
      ],
      total: 4
    });
  });
  it('renders category shell with backend categories', async () => {
    render(<CategoryPage />);

    const navbar = document.querySelector('.app-navbar.app-navbar--primary');
    expect(navbar).not.toBeNull();
    expect(screen.getByPlaceholderText('按 SKU 或名称搜索...')).toBeInTheDocument();
    expect(document.querySelector('.category-header-action')).toBeNull();

    expect((await screen.findAllByText('紧固件')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('电气')).length).toBeGreaterThan(0);
    expect(await screen.findByText('全部商品')).toBeInTheDocument();
    expect(await screen.findByText('A4 办公用纸')).toBeInTheDocument();
    expect(await screen.findAllByText('¥185.00 起')).toHaveLength(4);
  });

  it('adds top-level catalog categories missing from display configuration', async () => {
    (commerceServices.catalog.listDisplayCategories as jest.Mock).mockResolvedValue({
      items: [
        { id: 'cat-fasteners', name: '紧固件', iconKey: 'setting', sort: 1, enabled: true },
        { id: 'cat-electrical', name: '电气', iconKey: 'desktop', sort: 2, enabled: true }
      ]
    });
    (commerceServices.catalog.listCategories as jest.Mock).mockResolvedValue({
      items: [
        { id: 'fasteners', name: '紧固件', parentId: null, sort: 1 },
        { id: 'electrical', name: '电气', parentId: null, sort: 2 },
        { id: 'large-equipment', name: '大型设备', parentId: null, sort: 9 },
        { id: 'small-equipment', name: '小型设备', parentId: null, sort: 10 },
        { id: 'large-child', name: '大型设备配件', parentId: 'large-equipment', sort: 11 }
      ]
    });

    render(<CategoryPage />);

    expect((await screen.findAllByText('紧固件')).length).toBeGreaterThan(0);
    expect(await screen.findByText('大型设备')).toBeInTheDocument();
    expect(await screen.findByText('小型设备')).toBeInTheDocument();
    expect(screen.queryByText('大型设备配件')).toBeNull();
    expect(document.querySelectorAll('.category-primary-label')).toHaveLength(4);
  });

  it('keeps category product cards rendered for long titles', async () => {
    (commerceServices.catalog.listProducts as jest.Mock).mockResolvedValue({
      items: [
        { id: 'cat-long-1', name: 'Category Product ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890无空格超长标题用于验证双列布局稳定性', coverImageUrl: '', tags: ['工业'] },
        { id: 'cat-long-2', name: 'Another Category Product ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890无空格超长标题用于验证双列布局稳定性', coverImageUrl: '', tags: ['工业'] }
      ],
      total: 2
    });

    render(<CategoryPage />);

    expect((await screen.findAllByText(/Category Product ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/)).length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.category-product-card')).toHaveLength(2);
    expect(document.querySelectorAll('.category-product-image-shell')).toHaveLength(2);
  });

  it('switches active category from sidebar', async () => {
    render(<CategoryPage />);

    const electricalEntry = await screen.findByText('电气');
    fireEvent.click(electricalEntry);

    const categoryItem = electricalEntry.closest('.category-primary-item');
    expect(categoryItem).not.toBeNull();
    if (!categoryItem) {
      throw new Error('Expected category primary item');
    }
    expect(categoryItem).toHaveClass('is-active');
    expect(await screen.findByText('4 ITEMS')).toBeInTheDocument();
  });

  it('reuses home search input and queries products with q', async () => {
    render(<CategoryPage />);

    const input = screen.getByPlaceholderText('按 SKU 或名称搜索...');
    fireEvent.change(input, { target: { value: 'bolt' } });

    await waitFor(() => {
      expect(commerceServices.catalog.listProducts).toHaveBeenLastCalledWith({
        categoryId: 'fasteners',
        q: 'bolt',
        page: 1,
        pageSize: 40
      });
    });
  });

  it('filters fastener products through secondary chips', async () => {
    (commerceServices.catalog.listProducts as jest.Mock).mockResolvedValue({
      items: [
        { id: 'fastener-bolt-1', name: '不锈钢六角螺栓 A2', coverImageUrl: '', tags: ['紧固件'] },
        { id: 'fastener-nut-1', name: '304 法兰螺母', coverImageUrl: '', tags: ['紧固件'] },
        { id: 'fastener-washer-1', name: '304 平垫圈', coverImageUrl: '', tags: ['紧固件'] },
        { id: 'fastener-ring-1', name: '孔用弹性挡圈', coverImageUrl: '', tags: ['紧固件'] },
        { id: 'fastener-anchor-1', name: '镀锌膨胀螺栓', coverImageUrl: '', tags: ['紧固件'] },
        { id: 'fastener-anchor-2', name: '化学锚栓 M12', coverImageUrl: '', tags: ['紧固件'] },
        { id: 'fastener-rivet-1', name: '开口型抽芯铆钉', coverImageUrl: '', tags: ['紧固件'] }
      ],
      total: 7
    });

    render(<CategoryPage />);

    await screen.findByText('不锈钢六角螺栓 A2');

    fireEvent.click(screen.getByText('垫圈卡簧'));
    expect(screen.getByText('304 平垫圈')).toBeInTheDocument();
    expect(screen.getByText('孔用弹性挡圈')).toBeInTheDocument();
    expect(screen.queryByText('不锈钢六角螺栓 A2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('膨胀锚固'));
    expect(screen.getByText('镀锌膨胀螺栓')).toBeInTheDocument();
    expect(screen.getByText('化学锚栓 M12')).toBeInTheDocument();
    expect(screen.queryByText('304 平垫圈')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('铆接件'));
    expect(screen.getByText('开口型抽芯铆钉')).toBeInTheDocument();
    expect(screen.queryByText('镀锌膨胀螺栓')).not.toBeInTheDocument();
  });

  it('moves secondary filters with products before empty filters on category page only', async () => {
    (commerceServices.catalog.listProducts as jest.Mock).mockResolvedValue({
      items: [
        { id: 'fastener-washer-1', name: '304 平垫圈', coverImageUrl: '', tags: ['紧固件'] },
        { id: 'fastener-rivet-1', name: '开口型抽芯铆钉', coverImageUrl: '', tags: ['紧固件'] }
      ],
      total: 2
    });

    render(<CategoryPage />);

    await screen.findByText('304 平垫圈');

    const chipLabels = Array.from(document.querySelectorAll('.category-secondary-chip')).map((item) =>
      item.textContent?.trim()
    );

    expect(chipLabels).toEqual(['全部商品', '垫圈卡簧', '铆接件', '螺栓螺母', '膨胀锚固']);
  });

  it('does not move packaging box filter ahead for pearl cotton packing bags', async () => {
    (commerceServices.catalog.listDisplayCategories as jest.Mock).mockResolvedValue({
      items: [
        { id: 'packaging', name: '包装耗材', iconKey: 'apps', sort: 1, enabled: true }
      ]
    });
    (commerceServices.catalog.listCategories as jest.Mock).mockResolvedValue({
      items: [{ id: 'packaging', name: '包装耗材' }]
    });
    (commerceServices.catalog.listProducts as jest.Mock).mockResolvedValue({
      items: [
        { id: 'packaging-bag-1', name: '珍珠棉打包袋', coverImageUrl: '', tags: ['包装耗材'] }
      ],
      total: 1
    });

    render(<CategoryPage />);

    await screen.findByText('珍珠棉打包袋');

    const chipLabels = Array.from(document.querySelectorAll('.category-secondary-chip')).map((item) =>
      item.textContent?.trim()
    );

    expect(chipLabels).toEqual(['全部商品', '胶带打包', '纸箱箱袋', '标签标识', '容器周转']);
  });

  it('moves primary categories with products before empty sibling categories', async () => {
    (commerceServices.catalog.listDisplayCategories as jest.Mock).mockResolvedValue({
      items: [
        { id: 'fasteners', name: '紧固件', iconKey: 'setting', sort: 1, enabled: true },
        { id: 'electrical', name: '电气', iconKey: 'desktop', sort: 2, enabled: true },
        { id: 'packaging', name: '包装耗材', iconKey: 'apps', sort: 8, enabled: true }
      ]
    });
    (commerceServices.catalog.listCategories as jest.Mock).mockResolvedValue({
      items: [
        { id: 'fasteners', name: '紧固件' },
        { id: 'electrical', name: '电气' },
        { id: 'packaging', name: '包装耗材' }
      ]
    });
    (commerceServices.catalog.listProducts as jest.Mock).mockImplementation(async ({ categoryId } = {}) => {
      if (categoryId === 'packaging') {
        return {
          items: [{ id: 'packaging-bag-1', name: '珍珠棉打包袋', coverImageUrl: '', tags: ['包装耗材'] }],
          total: 1
        };
      }
      return { items: [], total: 0 };
    });

    render(<CategoryPage />);

    await waitFor(() => {
      const primaryLabels = Array.from(document.querySelectorAll('.category-primary-label')).map((item) =>
        item.textContent?.trim()
      );
      expect(primaryLabels).toEqual(['包装耗材', '紧固件', '电气']);
    });
    expect(await screen.findByText('珍珠棉打包袋')).toBeInTheDocument();
  });

  it('reloads category products when page is shown again', async () => {
    let didShowCallback: (() => void) | undefined;
    let categoryProductCalls = 0;
    (useDidShow as jest.Mock).mockImplementation((callback) => {
      didShowCallback = callback;
    });
    (commerceServices.catalog.listProducts as jest.Mock).mockImplementation(async ({ pageSize } = {}) => {
      if (pageSize === 1) {
        return {
          items: [{ id: 'category-availability-probe', name: '探测商品', coverImageUrl: '', tags: ['探测'] }],
          total: 1
        };
      }
      categoryProductCalls += 1;
      if (categoryProductCalls === 1) {
        return {
          items: [{ id: 'cat-before-show', name: '旧分类商品', coverImageUrl: '', tags: ['旧'] }],
          total: 1
        };
      }
      return {
        items: [{ id: 'cat-after-show', name: '刷新后分类商品', coverImageUrl: '', tags: ['新'] }],
        total: 1
      };
    });

    render(<CategoryPage />);

    expect(await screen.findByText('旧分类商品')).toBeInTheDocument();
    await waitFor(() => {
      expect(commerceServices.catalog.listDisplayCategories).toHaveBeenCalledTimes(1);
      expect(commerceServices.catalog.listCategories).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      didShowCallback?.();
      await Promise.resolve();
    });

    const requestsAfterInitialShow = (commerceServices.catalog.listProducts as jest.Mock).mock.calls.filter(
      ([params]) => params?.pageSize === 40
    );
    expect(requestsAfterInitialShow).toHaveLength(1);
    expect(commerceServices.catalog.listDisplayCategories).toHaveBeenCalledTimes(1);
    expect(commerceServices.catalog.listCategories).toHaveBeenCalledTimes(1);

    await act(async () => {
      didShowCallback?.();
      await Promise.resolve();
    });

    expect(await screen.findByText('刷新后分类商品')).toBeInTheDocument();
    const categoryProductRequests = (commerceServices.catalog.listProducts as jest.Mock).mock.calls.filter(
      ([params]) => params?.pageSize === 40
    );
    expect(categoryProductRequests).toHaveLength(2);
    expect(commerceServices.catalog.listDisplayCategories).toHaveBeenCalledTimes(2);
    expect(commerceServices.catalog.listCategories).toHaveBeenCalledTimes(2);
  });
});
