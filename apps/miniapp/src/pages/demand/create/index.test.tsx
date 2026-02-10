import { act, fireEvent, render, screen } from '@testing-library/react';
import Taro from '@tarojs/taro';
import DemandCreate from './index';
import { commerceServices } from '../../../services/commerce';

const setRouterParams = (params: Record<string, string>) => {
  (globalThis as any).__setTaroRouterParams?.(params);
};

describe('DemandCreate', () => {
  beforeEach(() => {
    setRouterParams({});
    jest.clearAllMocks();
    (commerceServices.catalog.listCategories as jest.Mock).mockResolvedValue({ items: [] });
  });

  afterEach(() => {
    setRouterParams({});
  });

  it('prefills name from kw query', async () => {
    setRouterParams({ kw: encodeURIComponent('工业轴承') });

    render(<DemandCreate />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByPlaceholderText('例如：无线降噪耳机')).toHaveValue('工业轴承');
  });

  it('submits mapped payload with extended fields', async () => {
    (commerceServices.catalog.listCategories as jest.Mock).mockResolvedValueOnce({
      items: [{ id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', name: '工业耗材' }]
    });
    render(<DemandCreate />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByPlaceholderText('例如：无线降噪耳机'), {
      target: { value: '定制阀门' }
    });
    fireEvent.change(screen.getByPlaceholderText('输入类目 ID'), {
      target: { value: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }
    });
    fireEvent.change(screen.getByPlaceholderText('例如：500 件'), {
      target: { value: '600 件' }
    });
    fireEvent.change(screen.getByPlaceholderText('例如：塑料'), {
      target: { value: '金属' }
    });
    fireEvent.change(screen.getByPlaceholderText('例如：长 x 宽 x 高'), {
      target: { value: '20x30x40' }
    });
    fireEvent.change(screen.getByPlaceholderText('例如：黑色'), {
      target: { value: '黑色' }
    });
    fireEvent.change(screen.getByPlaceholderText('例如：蓝牙 5.3'), {
      target: { value: '304 不锈钢' }
    });
    fireEvent.change(screen.getByPlaceholderText('可填写交期、包装、验收标准等要求'), {
      target: { value: '希望两周交付' }
    });

    fireEvent.click(screen.getByText('提交需求'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(commerceServices.productRequests.create).toHaveBeenCalledWith({
      name: '定制阀门',
      categoryId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      material: '金属',
      dimensions: '20x30x40',
      color: '黑色',
      spec: '304 不锈钢',
      qty: '600 件',
      note: '希望两周交付',
      referenceImageUrls: undefined
    });
    expect(Taro.navigateTo).toHaveBeenCalled();
  });

  it('uploads reference image and appends url', async () => {
    (Taro.chooseImage as jest.Mock).mockResolvedValueOnce({ tempFilePaths: ['/tmp/demand.png'] });
    (commerceServices.productRequests.uploadAsset as jest.Mock).mockResolvedValueOnce({
      url: 'https://img.example.com/demand.png',
      contentType: 'image/png',
      size: 1024
    });

    render(<DemandCreate />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText('上传图片'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(commerceServices.productRequests.uploadAsset).toHaveBeenCalledWith('/tmp/demand.png');
    expect(screen.getByText('删除')).toBeInTheDocument();
  });

  it('shows toast when name is empty', async () => {
    render(<DemandCreate />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText('提交需求'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(Taro.showToast).toHaveBeenCalledWith({ title: '请输入产品名称', icon: 'none' });
    expect(commerceServices.productRequests.create).not.toHaveBeenCalled();
  });
});
