import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Navbar from '@taroify/core/navbar'
import Image from '@taroify/core/image'
import Tag from '@taroify/core/tag'
import Grid from '@taroify/core/grid'
import Cell from '@taroify/core/cell'
import Button from '@taroify/core/button'
import Flex from '@taroify/core/flex'
import FixedView from '@taroify/core/fixed-view'
import Tabbar from '@taroify/core/tabbar'
import Aim from '@taroify/icons/Aim'
import ArrowLeft from '@taroify/icons/ArrowLeft'
import ArrowRight from '@taroify/icons/ArrowRight'
import Like from '@taroify/icons/Like'
import Logistics from '@taroify/icons/Logistics'
import OrdersOutlined from '@taroify/icons/OrdersOutlined'
import Share from '@taroify/icons/Share'
import ShoppingCartOutlined from '@taroify/icons/ShoppingCartOutlined'
import Star from '@taroify/icons/Star'
import UserOutlined from '@taroify/icons/UserOutlined'
import WapHomeOutlined from '@taroify/icons/WapHomeOutlined'

export default function ProductDetail() {
  const [selectedMaterial, setSelectedMaterial] = useState('Stainless Steel')
  const [selectedSize, setSelectedSize] = useState('50mm')
  const [isFavorite, setIsFavorite] = useState(false)

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder>
        <Navbar.NavLeft>
          <Button variant='text' size='small' icon={<ArrowLeft />} />
        </Navbar.NavLeft>
        <Navbar.Title>Control Valve SKU-902</Navbar.Title>
        <Navbar.NavRight>
          <Flex align='center' gutter={8}>
            <Button
              variant='text'
              size='small'
              icon={<Like color={isFavorite ? '#ef4444' : undefined} />}
              onClick={() => setIsFavorite(!isFavorite)}
            />
            <Button variant='text' size='small' icon={<Share />} />
          </Flex>
        </Navbar.NavRight>
      </Navbar>

      <View className='page__content'>
        <View className='media'>
          <Image
            width='100%'
            height={200}
            mode='aspectFill'
            src='https://lh3.googleusercontent.com/aida-public/AB6AXuCspf7tkk3Cwf2GD5lYQaNodcqBkcYqB_ZBv1e2fVDNw0YMOKkHumvzpQ1mZEKdercQH0hJKeoDWuFaFd0qoHzNg0huzTlzC5-zZ7kBXvWE9Ib08FjC_NddG0UAEIhtDzvhKWIoHFuCHwDIbw0VxEiTfUHw5E2lSdd55A_492g3TzsAwCF8m_qM_vrA2FUIFmA556OMpdd6XsGANJE4w1E8t6cLo6tKrJi7WMOnV3ErcUQcrzM2zDWv12Q92-EVBL6NJcTileQoBmGI'
          />
          <Tag size='small' color='default' className='media__counter'>
            1/4
          </Tag>
        </View>

        <View className='product__header'>
          <Flex justify='between' align='start'>
            <Text className='product__title'>High-Precision Industrial Control Valve</Text>
            <View className='product__price'>
              <Text className='product__price-value'>$185.00</Text>
              <Text className='product__price-note'>Per Unit (Min 10)</Text>
            </View>
          </Flex>

          <Flex align='center' gutter={8} className='product__meta'>
            <Tag size='small' color='warning'>
              <Flex align='center' gutter={4}>
                <Star />
                <Text>4.8</Text>
              </Flex>
            </Tag>
            <Text className='product__meta-text'>1.2k+ Sold</Text>
            <Tag size='small' variant='outlined'>Verified</Tag>
          </Flex>
        </View>

        <View className='product__section'>
          <Flex justify='between' align='center'>
            <Text className='section__title'>Bulk Pricing</Text>
            <Text className='section__link'>Volume Discounts</Text>
          </Flex>

          <Grid columns={3} gutter={8}>
            <Grid.Item>
              <View className='tier-card'>
                <Text className='tier-card__range'>10-49</Text>
                <Text className='tier-card__price'>$245.00</Text>
              </View>
            </Grid.Item>
            <Grid.Item>
              <View className='tier-card tier-card--highlight'>
                <Text className='tier-card__range'>50-199</Text>
                <Text className='tier-card__price'>$210.00</Text>
                <Text className='tier-card__discount'>-14%</Text>
              </View>
            </Grid.Item>
            <Grid.Item>
              <View className='tier-card'>
                <Text className='tier-card__range'>200+</Text>
                <Text className='tier-card__price'>$185.00</Text>
                <Text className='tier-card__discount'>-24%</Text>
              </View>
            </Grid.Item>
          </Grid>
        </View>

        <View className='product__section'>
          <Text className='section__title'>Material</Text>
          <Flex wrap='wrap' gutter={8}>
            {['Stainless Steel', 'Carbon', 'Alloy X-40'].map((material) => (
              <Button
                key={material}
                size='small'
                color={selectedMaterial === material ? 'primary' : 'default'}
                variant={selectedMaterial === material ? 'contained' : 'outlined'}
                onClick={() => setSelectedMaterial(material)}
              >
                {material === 'Stainless Steel' ? 'Stainless' : material}
              </Button>
            ))}
          </Flex>
        </View>

        <View className='product__section'>
          <Text className='section__title'>Diameter</Text>
          <Flex wrap='wrap' gutter={8}>
            {['15mm', '25mm', '50mm', '75mm'].map((size) => (
              <Button
                key={size}
                size='small'
                color={selectedSize === size ? 'primary' : 'default'}
                variant={selectedSize === size ? 'contained' : 'outlined'}
                onClick={() => setSelectedSize(size)}
              >
                {size}
              </Button>
            ))}
          </Flex>
        </View>

        <Cell
          icon={<Logistics />}
          title='Standard Air Freight'
          brief='Arrives Sep 12 - Sep 18'
          rightIcon={<ArrowRight />}
        />
      </View>

      <FixedView position='bottom' safeArea='bottom' placeholder>
        <Flex gutter={12} className='action-bar'>
          <Button block variant='outlined'>Bargain</Button>
          <Button block color='primary'>Add to Cart</Button>
        </Flex>
        <Tabbar value='cart'>
          <Tabbar.TabItem value='home' icon={<WapHomeOutlined />}>
            Home
          </Tabbar.TabItem>
          <Tabbar.TabItem value='demand' icon={<Aim />}>
            Demand
          </Tabbar.TabItem>
          <Tabbar.TabItem value='cart' icon={<ShoppingCartOutlined />} badge='2'>
            Cart
          </Tabbar.TabItem>
          <Tabbar.TabItem value='orders' icon={<OrdersOutlined />}>
            Orders
          </Tabbar.TabItem>
          <Tabbar.TabItem value='mine' icon={<UserOutlined />}>
            Mine
          </Tabbar.TabItem>
        </Tabbar>
      </FixedView>
    </View>
  )
}
