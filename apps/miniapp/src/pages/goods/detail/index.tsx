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
import ArrowRight from '@taroify/icons/ArrowRight'
import Logistics from '@taroify/icons/Logistics'
import Star from '@taroify/icons/Star'
import AppTabbar from '../../../components/app-tabbar'

export default function ProductDetail() {
  const [selectedMaterial, setSelectedMaterial] = useState('Stainless Steel')
  const [selectedSize, setSelectedSize] = useState('50mm')

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top'>
      </Navbar>

      <View className='page-content'>
        <View className='media'>
          <Image
            width='100%'
            height={200}
            mode='aspectFill'
            src='https://lh3.googleusercontent.com/aida-public/AB6AXuCspf7tkk3Cwf2GD5lYQaNodcqBkcYqB_ZBv1e2fVDNw0YMOKkHumvzpQ1mZEKdercQH0hJKeoDWuFaFd0qoHzNg0huzTlzC5-zZ7kBXvWE9Ib08FjC_NddG0UAEIhtDzvhKWIoHFuCHwDIbw0VxEiTfUHw5E2lSdd55A_492g3TzsAwCF8m_qM_vrA2FUIFmA556OMpdd6XsGANJE4w1E8t6cLo6tKrJi7WMOnV3ErcUQcrzM2zDWv12Q92-EVBL6NJcTileQoBmGI'
          />
          <Tag size='small' color='default' className='media-counter'>
            1/4
          </Tag>
        </View>

        <View className='product-header'>
          <Flex justify='space-between' align='start'>
            <Text className='product-title'>High-Precision Industrial Control Valve</Text>
            <View className='product-price'>
              <Text className='product-price-value'>$185.00</Text>
              <Text className='product-price-note'>Per Unit (Min 10)</Text>
            </View>
          </Flex>

          <Flex align='center' gutter={8} className='product-meta'>
            <Tag size='small' color='warning'>
              <Flex align='center' gutter={4}>
                <Star />
                <Text>4.8</Text>
              </Flex>
            </Tag>
            <Text className='product-meta-text'>1.2k+ Sold</Text>
            <Tag size='small' variant='outlined'>Verified</Tag>
          </Flex>
        </View>

        <View className='product-section'>
          <Flex justify='space-between' align='center'>
            <Text className='section-title'>Bulk Pricing</Text>
            <Text className='section-link'>Volume Discounts</Text>
          </Flex>

          <Grid columns={3} gutter={8}>
            <Grid.Item>
              <View className='tier-card'>
                <Text className='tier-card-range'>10-49</Text>
                <Text className='tier-card-price'>$245.00</Text>
              </View>
            </Grid.Item>
            <Grid.Item>
              <View className='tier-card tier-card-highlight'>
                <Text className='tier-card-range'>50-199</Text>
                <Text className='tier-card-price'>$210.00</Text>
                <Text className='tier-card-discount'>-14%</Text>
              </View>
            </Grid.Item>
            <Grid.Item>
              <View className='tier-card'>
                <Text className='tier-card-range'>200+</Text>
                <Text className='tier-card-price'>$185.00</Text>
                <Text className='tier-card-discount'>-24%</Text>
              </View>
            </Grid.Item>
          </Grid>
        </View>

        <View className='product-section'>
          <Text className='section-title'>Material</Text>
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

        <View className='product-section'>
          <Text className='section-title'>Diameter</Text>
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
        <AppTabbar value='cart' fixed={false} placeholder={false} />
      </FixedView>
    </View>
  )
}
