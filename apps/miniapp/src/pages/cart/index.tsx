import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Navbar from '@taroify/core/navbar'
import Tabs from '@taroify/core/tabs'
import Progress from '@taroify/core/progress'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import Button from '@taroify/core/button'
import Grid from '@taroify/core/grid'
import Image from '@taroify/core/image'
import Flex from '@taroify/core/flex'
import FixedView from '@taroify/core/fixed-view'
import QuestionOutlined from '@taroify/icons/QuestionOutlined'
import WarningOutlined from '@taroify/icons/WarningOutlined'
import AppTabbar from '../../components/app-tabbar'
import { getNavbarStyle } from '../../utils/navbar'

export default function ExcelImportConfirmation() {
  const [activeTab, setActiveTab] = useState('to-confirm')
  const navbarStyle = getNavbarStyle()

  const pendingItems = [
    {
      id: 1,
      name: 'M10 Bolt 50mm Zinc',
      issue: 'Ambiguous match: 4 sizes available',
      row: 4
    },
    {
      id: 2,
      name: 'Industrial Adhesive G9',
      issue: 'Volume not specified',
      row: 12
    },
    {
      id: 3,
      name: 'Steel Washers (Box 100)',
      issue: 'Multiple material grades',
      row: 25
    }
  ]

  const confirmedItems = [
    { id: 101, name: 'Pneumatic Hose 10m', qty: '25 units' },
    { id: 102, name: 'Safety Gloves XL', qty: '50 pairs' },
    { id: 103, name: 'Industrial Tape Pack', qty: '12 boxes' },
    { id: 104, name: 'Valve Seals', qty: '100 pcs' }
  ]

  return (
    <View className='page page-compact-navbar'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle}>
      </Navbar>

      <View className='page-content'>
        <Flex justify='space-between' align='end'>
          <View>
            <Text className='section-title'>15 Items Found</Text>
            <Text className='section-subtitle'>Ready for your review</Text>
          </View>
          <Tag size='small' color='primary'>
            12/15 Identified
          </Tag>
        </Flex>

        <Progress percent={80} color='primary' />

        <Flex align='center' gutter={6} className='section-notice'>
          <WarningOutlined />
          <Text className='section-subtitle'>3 items require specification choice</Text>
        </Flex>
      </View>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(String(value))}>
        <Tabs.TabPane value='to-confirm' title='To Confirm (3)'>
          <Cell.Group inset>
            {pendingItems.map((item) => (
              <Cell
                key={item.id}
                icon={<QuestionOutlined />}
                title={item.name}
                brief={`${item.issue} · Row ${item.row}`}
                rightIcon={<Button size='small' color='primary'>Select Spec</Button>}
              />
            ))}
          </Cell.Group>
        </Tabs.TabPane>

        <Tabs.TabPane value='confirmed' title='Confirmed (12)'>
          <View className='page-content'>
            <Grid columns={2} gutter={12}>
              {confirmedItems.map((item) => (
                <Grid.Item key={item.id}>
                  <View className='confirm-card'>
                    <Image width='100%' height={120} src='https://lh3.googleusercontent.com/aida-public/AB6AXuDGj0LySxxnfLRBsNvxC-nPykQ5urTBjIfVH6fpVr8Mq6q86Eoc900uHrsM4CWGhiTa9mh1Hjt_59YVZA8IA8o2egRuHhPMh4OOTNdFLPyy2z65oun7A7T75qdtMxB9Gx2g6hdqG7a6CoFl7wbFQ5OqSxcViSThFyQsbrrOF2K3eSm2S5yLloAGrV9xlvJmEFK-mPaQa76VxZBF-w06tpKTQ_Ecu_J9NqQcflv5Lxn_pdg9JpuXZou5PV-r29n5aUgmxkh1RVsTN382' />
                    <View className='confirm-card-body'>
                      <Text className='confirm-card-title'>{item.name}</Text>
                      <Text className='confirm-card-qty'>{item.qty}</Text>
                    </View>
                  </View>
                </Grid.Item>
              ))}
            </Grid>
          </View>
        </Tabs.TabPane>
      </Tabs>

      <FixedView position='bottom' safeArea='bottom' placeholder>
        <Flex justify='space-between' gutter={12} className='action-bar'>
          <Button block variant='outlined'>Save Draft</Button>
          <Button block color='primary'>Confirm & Add to Cart</Button>
        </Flex>
        <AppTabbar value='cart' fixed={false} placeholder={false} />
      </FixedView>
    </View>
  )
}
