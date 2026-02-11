import { act, fireEvent, render, screen } from '@testing-library/react';
import Taro from '@tarojs/taro';
import DemandList from './index';
import { ROUTES } from '../../../routes';
import { commerceServices } from '../../../services/commerce';

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve));

describe('DemandList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders list data and create button', async () => {
    (commerceServices.productRequests.list as jest.Mock).mockResolvedValueOnce({
      items: [
        {
          id: 'pr-1',
          createdByUserId: 'u-1',
          createdAt: '2025-01-01T00:00:00Z',
          name: '工业胶带',
          qty: '10 箱',
          spec: '耐高温',
          note: 'test'
        }
      ]
    });

    render(<DemandList />);

    await act(async () => {
      await flushPromises();
    });

    expect(screen.getByText('创建新需求')).toBeInTheDocument();
    expect(screen.getByText('工业胶带')).toBeInTheDocument();
    expect(screen.getByText('数量：10 箱')).toBeInTheDocument();
  });

  it('navigates to demand create page', async () => {
    render(<DemandList />);

    await act(async () => {
      await flushPromises();
    });

    fireEvent.click(screen.getByText('创建新需求'));

    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: ROUTES.demandCreate });
  });
});
