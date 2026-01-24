import { View, Text } from '@tarojs/components';
import { Cell, Button, Image, Grid, Badge, Flex, SafeArea } from '@taroify/core';
import { 
  ServiceOutlined, 
  ChatOutlined, 
  OrdersOutlined, 
  Logistics, 
  TodoList, 
  Exchange, 
  Description, 
  LocationOutlined, 
  BarChartOutlined, 
  SettingOutlined, 
  AppsOutlined
} from '@taroify/icons';
import AppTabbar from '../../components/app-tabbar';
import { ROUTES } from '../../routes';
import { navigateTo, switchTabLike } from '../../utils/navigation';

export default function PersonalCenter() {
  const userInfo = {
    name: 'John Doe',
    company: 'TechFlow Solutions Corp',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6aMVVw542vMjqZUxZGYQDmSOyXCShOpx5kUCN61Wv6okrwKBUp-S_ZKLBYnnJqx_-Vx3-NhyPVZuH7gHkceoGBQajnU3ksD25p10yGt0-gT2HiURQNGy_gnhIX7OKre0UsPZyZOPchGKAqwzYVK1fBl081v0ZlwBlwVuv6RrLFj_h5OEIq0p_a7zFGn226VwTy0LMxL8E9P9LWcmgSTpQj6Tx-Th1qgUYfuhBUqvqiH9YIOAY249t69mZAho6SakEZO55UHrVJq2k'
  };

  return (
    <View className='page pb-24 text-gray-900 font-sans'>
      <SafeArea position='top' />
      {/* Header Section */}
      <View className='bg-white pt-12 pb-8 px-4 mb-3'>
        <Flex align='center' className='gap-4'>
          <Image 
            round 
            width={64} 
            height={64} 
            src={userInfo.avatar} 
          />
          <Flex direction='column' className='flex-1'>
            <Text className='text-xl font-bold text-gray-900'>
              {userInfo.name}
            </Text>
            <Text className='text-sm text-gray-500 mt-1'>
              {userInfo.company}
            </Text>
          </Flex>
        </Flex>
      </View>

      {/* Account Manager Card (Using Cell) */}
      <Cell.Group inset className='mb-3'>
        <Cell 
          title='Account Manager' 
          brief='Sarah Wang'
          icon={<ServiceOutlined className='text-gray-500' />}
          align='center'
          clickable
          onClick={() => navigateTo(ROUTES.support)}
        >
          <Button shape='round' size='small' color='primary'>
            <ChatOutlined />
          </Button>
        </Cell>
      </Cell.Group>

      {/* Order Tracking Section (Using Cell + Grid) */}
      <Cell.Group inset className='mb-3'>
        <Cell
          title='Order Tracking'
          isLink
          rightIcon={<Text className='text-xs text-gray-400'>View All</Text>}
          onClick={() => switchTabLike(ROUTES.orders)}
        />
        <Grid columns={4} bordered={false}>
          <Grid.Item
            icon={(
              <Badge content='2'>
                <OrdersOutlined />
              </Badge>
            )}
            text='Pending'
            onClick={() => switchTabLike(ROUTES.orders)}
          />
          <Grid.Item icon={<Logistics />} text='Shipped' onClick={() => switchTabLike(ROUTES.orders)} />
          <Grid.Item icon={<TodoList />} text='Delivered' onClick={() => switchTabLike(ROUTES.orders)} />
          <Grid.Item icon={<Exchange />} text='Returns' onClick={() => switchTabLike(ROUTES.orders)} />
        </Grid>
      </Cell.Group>

      {/* Menu List Group 1 (Using Cell) */}
      <Cell.Group inset className='mb-3'>
        <Cell 
          title='My Demand Requests' 
          icon={<Description className='text-gray-500' />} 
          isLink
          onClick={() => navigateTo(ROUTES.demandList)}
        />
        <Cell 
          title='Shipping Address' 
          icon={<LocationOutlined className='text-gray-500' />} 
          isLink
          onClick={() => navigateTo(ROUTES.addressList)}
        />
      </Cell.Group>

      {/* Menu List Group 2 */}
      <Cell.Group inset className='mb-3'>
        <Cell 
          title='Bulk Excel Import' 
          icon={<AppsOutlined className='text-gray-500' />} 
          isLink
          onClick={() => navigateTo(ROUTES.import)}
        />
        <Cell 
          title='Batch Tracking' 
          icon={<BarChartOutlined className='text-gray-500' />} 
          isLink
          onClick={() => navigateTo(ROUTES.trackingBatch)}
        />
      </Cell.Group>

      {/* Menu List Group 3 */}
      <Cell.Group inset className='mb-3'>
        <Cell 
          title='System Settings' 
          icon={<SettingOutlined className='text-gray-500' />} 
          isLink
          onClick={() => navigateTo(ROUTES.settings)}
        />
      </Cell.Group>

      {/* Logout Button */}
      <View className='px-4 mt-6'>
        <Button block shape='round' color='default' className='bg-white border-none text-gray-500'>
          Switch Account or Logout
        </Button>
      </View>

      {/* Bottom Navigation (Tabbar) */}
      <AppTabbar value='mine' />
    </View>
  );
}
