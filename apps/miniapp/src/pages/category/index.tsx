import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Navbar from '@taroify/core/navbar'
import Search from '@taroify/core/search'
import SearchIcon from '@taroify/icons/Search'
import NotesOutlined from '@taroify/icons/NotesOutlined'
import SettingOutlined from '@taroify/icons/SettingOutlined'
import DesktopOutlined from '@taroify/icons/DesktopOutlined'
import BrushOutlined from '@taroify/icons/BrushOutlined'
import ShieldOutlined from '@taroify/icons/ShieldOutlined'
import HotOutlined from '@taroify/icons/HotOutlined'
import type { ITouchEvent } from '@tarojs/components/types/common'
import AppTabbar from '../../components/app-tabbar'
import { getNavbarStyle } from '../../utils/navbar'

import './index.scss'

type CategoryItem = {
  name: string
  img: string
}

type CategorySection = {
  title: string
  items: CategoryItem[]
}

type CategoryEntry = {
  title: string
  subtitle: string
  bannerImage: string
  sections: CategorySection[]
}

type CategoryKey = 'office' | 'industrial' | 'electronics' | 'janitorial' | 'safety' | 'breakroom'

type SidebarEntry = {
  key: CategoryKey
  label: string
  icon: ReactNode
}

const SIDEBAR_ENTRIES: SidebarEntry[] = [
  { key: 'office', label: '办公用品', icon: <NotesOutlined /> },
  { key: 'industrial', label: '工业', icon: <SettingOutlined /> },
  { key: 'electronics', label: '电子产品', icon: <DesktopOutlined /> },
  { key: 'janitorial', label: '清洁用品', icon: <BrushOutlined /> },
  { key: 'safety', label: '安全防护', icon: <ShieldOutlined /> },
  { key: 'breakroom', label: '茶水间', icon: <HotOutlined /> }
]

const CATEGORY_DATA: Record<CategoryKey, CategoryEntry> = {
  office: {
    title: '办公用品',
    subtitle: '装备团队提升效率',
    bannerImage: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2070&auto=format&fit=crop',
    sections: [
      {
        title: '书写工具',
        items: [
          { name: '笔', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCeAptxGiVytRJJxwVB_c_pGtQei8QlmZW8mnxZrDozg5YWUoqAS1T4bDRoxV0EZaq4GnXmbitcVmlb5P0kLi8kNDQQurSCed6ytShRYFaQCYGufuFaQhFcDu8_h7RewxUVqjQENV6N1kMXK-iMp9Vo5cJRCa-jIKiVZTEKVICysTwPZofCbCNXBWDykO3e0S14fupZIHR1J9SJU2GRwlU4vD-hyWYFYnsNvqMmPZFD2tda6efd_fVlNgxUASPxDPbCoGbhM2AaTZQ' },
          { name: '记号笔', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBuFkZxGwrJzfIzVQrdGZW37SZ6TNUvV_orBB1cDlJBKZ_wIuArnHWoZw0rmXFYZpxswInGuuz51U5ZFYdMQJ7hZqDdWx8iGui2Uk8nQQSoRGW0jT4bVySZHoXbmm5mnkuIw6J4Q_c1zT_6lS3bUAdKRqDOVDm8hjpARBP8tGQ38aZaqOhetqeAMBcanuCprfZopv6NU2zYT9HgQc31OkgK2HfdQr31SV5t6-cytJ09MTnnhyfn7kK47C3bM1Qhq5TlkEobKs5oG8M' },
          { name: '荧光笔', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBXvkmu0f1QaJCJ6WdqMPmlrK8wcAcglzJPT0w1buFDmfymFw65rghWUyIZRw17nNgsz2tT5rlQB3OiD6S8JOcrsAtb_lT122T02EBwD0JlffWJMbOYJtKZf5itTc4BEC9mz1MmTW5wQVH4CIi7lxQW4-jn1gE3lBiCPJ63d_y5db0YfKH2P6OSXppWkUY12n6mqRC3AV4EAvRcJDf3LT544xfN2lhNAaC9YyOhb4n1-7y2Fzg6EWqJzXcX51mywRlOyHOoHeBtocs' },
          { name: '铅笔', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBWwdMJcUXRLVcWkBNDKfJ8xazQhcyrlZXaelgix96Dr38_qL5Nu9FrYZvC35Ts9dI_h4VEEiiIox-AcpmLcO3YA13H_rtoF76JT9c-C-yMr4j2xau0NSKFFQxJe5fdS7SM92CQTd8Gb_7g7LMKXIPSJQ-wXMIFAgleSfS_UkDUfdM5LN7RuVvEXJ8oZIwl8IWYv8T4wJYG_6nsOURgtulZ26jHpOf7w4dku4BRqrc46nrbu_vJ0GyYAWq2j9jQf2MQubNueZ5A75I' }
        ]
      },
      {
        title: '纸品',
        items: [
          { name: '复印纸', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDYUiI9YgNGJ5AJP7E3XZTbsTa2ARfcwJftoPJTCnJ-jkC7RoRQ3enr4lqSlGgDnG4okUcDL8891dVirqZpaJhX36cLsUZooE4O_ifvfCTJp9GRVEIUQ-yvWcr63cxy6gsx1916YOdd99nEsGeWyR6aJCghfhZA6JVdk1jB1TLWudfhdeS_5UplOEhFYZf6OsOu4IYU4tbCva69yzEQANXzsBcxBPWe_aUA16cYh2dpWvOqxVhdu2G_iZqe2maMIYIg9PP7XPBWePY' },
          { name: '笔记本', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDr1Y_BZ80K2UNhI0MuThLhU9UfrzRtxbFFwOEoU3srs0bNelSgD5Ba8X1TmOKqDPhzbMeOPts5ngEkfaB9xjirUceFVggD0Pt1aMyHpj_09mTIy2INXj-uB9oVi_UqY68TV1FVAFDwDmEm2KRgzbCU0CBJaX9TdGSYjM8zUr81A4b5uWmhkPQOV7Lolz6KnlJRr_6Wk72P07xGJ93cLQiUCUqgZe6FhOkLvmT-lV6uWvLQB2lUUBlgChoGVbjg9KGwgZfkPROawjU' },
          { name: '便签', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDL268GSNJwTrCl2Ov-gH87kJhT2HJWOCE8iUFFWhghxht1UX-RP6Mnjlr0L0xdRTu_7DBn0tnmQdi0zxD4fke4gw8rAiUrGON9ePEh1to2FKZFu2a87srF1czEqtS_y4AtHP4VfbUhJpB5n1oPEG6WiVipMhlaqe_22oERxpCykEdlii_pQaSj5hJJws-p6d26heXgHlEB0cJVNRlHNcb2SKFHjcLxobJanP7ZckPb1XFB5C8vvwc7RTneeV0Jwg3uqe9kOXRvAuk' },
          { name: '信封', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuASFB39HJ1F0fDXAYsEmIIn1ud4MRYjY3Zgo1ovsVqdl0IgNtqZVH2yqpojFM_ec_I4O8ojY0pWLKuj5GpYrEem4vaTgJmuWf-F0ZwRxC2d4uN6Kl2I2xlRkrzltXqPE5TklClZ_YJSwpLO_4S2Jv0LNgFjKXOsUL3eZH7FgJmtCBqhTtR7nBuij4Y1UI5CGzoa2HnOj6MXs1ZAG_rx_kPFNGg0kbo08gRpW-Q5CPYDU45T5YazSW0MAcihEmKzbJHCsxl7wNdqdcc' }
        ]
      },
      {
        title: '桌面配件',
        items: [
          { name: '订书机', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAI15j_dQeovIH0H2A2nrHs5kO0T68Lf4aZFbxj-x3HP2qW8Q6igf_ajUQg6vEUWDdEJFo6a-9Znqpcj2Pq71ICCL39FjdFmk5ne39_Fq2kqQqD-TgNfmszBRnAAwSmsj10wvH_bnUAYeG9Qnh0_A-GPBUtdOsYP9TrSEsrl2P4Xqu0YXkTXC-mzRRgHUkVtgdTxgGx-7udx5RnX523k8CCyb1OfBTqtklixfT5g-yGjBQ2yiVLbo0KPWwvH6TqYHeRZNQCnISigLg' },
          { name: '收纳盒', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuABNVSKPik3rHPwDRLWIReBgMRzfb-4MY-KI1KSSlL_L7GUPzxB_SqLZ6_-hLQ9oyl3lBTcm9IBO-NDZAsx1Hw55P1CB2r0p6FHTxQwMoK9WKqumJscpOh7gRnZeOcQlS1m6BCovfPaF4MKXuK8kven6kPXtlvpuD5tNg2zpAOZlM8KmE1cxnuMCz0Vcq6LBZEKzZMyfAs-6JbFQE4qsv5DNSHxt3dQ1qkVnQ9g4424yW_Pq8xHDHl_4H0tWBuSkeQzeM5iZc-tZLw' }
        ]
      }
    ]
  },
  industrial: {
    title: '工业工具',
    subtitle: '为专业人士提供高强度解决方案',
    bannerImage: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=2070&auto=format&fit=crop',
    sections: [
      {
        title: '研磨材料',
        items: [
          { name: '砂纸', img: 'https://images.unsplash.com/photo-1622631557008-04285b546342?q=80&w=200&auto=format&fit=crop' },
          { name: '研磨', img: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=200&auto=format&fit=crop' }
        ]
      },
      {
        title: '五金',
        items: [
          { name: '螺栓和螺母', img: 'https://images.unsplash.com/photo-1588619461347-197e934a3666?q=80&w=200&auto=format&fit=crop' },
          { name: '紧固件', img: 'https://images.unsplash.com/photo-1534438097545-a2c22c57f01b?q=80&w=200&auto=format&fit=crop' },
          { name: '螺丝', img: 'https://images.unsplash.com/photo-1535063469032-475a840c4964?q=80&w=200&auto=format&fit=crop' },
          { name: '垫圈', img: 'https://images.unsplash.com/photo-1517524285303-d6fc683dddf8?q=80&w=200&auto=format&fit=crop' }
        ]
      }
    ]
  },
  electronics: {
    title: '电子产品',
    subtitle: '提升生产力',
    bannerImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop',
    sections: [
      {
        title: '计算机',
        items: [
          { name: '笔记本电脑', img: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=200&auto=format&fit=crop' },
          { name: '台式机', img: 'https://images.unsplash.com/photo-1547082299-de196ea013d6?q=80&w=200&auto=format&fit=crop' },
          { name: '显示器', img: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?q=80&w=200&auto=format&fit=crop' }
        ]
      },
      {
        title: '外设',
        items: [
          { name: '键盘', img: 'https://images.unsplash.com/photo-1587829741301-dc798b91add1?q=80&w=200&auto=format&fit=crop' },
          { name: '鼠标', img: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?q=80&w=200&auto=format&fit=crop' },
          { name: '线缆', img: 'https://images.unsplash.com/photo-1545127398-14699f92334b?q=80&w=200&auto=format&fit=crop' }
        ]
      }
    ]
  },
  janitorial: {
    title: '清洁用品',
    subtitle: '让工作空间保持整洁',
    bannerImage: 'https://images.unsplash.com/photo-1581578731117-104f25fb8b27?q=80&w=2070&auto=format&fit=crop',
    sections: [
      {
        title: '清洁剂',
        items: [
          { name: '消毒剂', img: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?q=80&w=200&auto=format&fit=crop' },
          { name: '洗涤剂', img: 'https://images.unsplash.com/photo-1528740561666-dc24705f08a7?q=80&w=200&auto=format&fit=crop' }
        ]
      },
      {
        title: '工具设备',
        items: [
          { name: '拖把', img: 'https://images.unsplash.com/photo-1527512860508-304cd5533b61?q=80&w=200&auto=format&fit=crop' },
          { name: '扫帚', img: 'https://images.unsplash.com/photo-1606213709087-259837a76c02?q=80&w=200&auto=format&fit=crop' }
        ]
      }
    ]
  },
  safety: {
    title: '安全防护',
    subtitle: '保护最重要的资产',
    bannerImage: 'https://images.unsplash.com/photo-1535581652167-3d6693c03185?q=80&w=2070&auto=format&fit=crop',
    sections: [
      {
        title: '个人防护装备',
        items: [
          { name: '安全帽', img: 'https://images.unsplash.com/photo-1584281722579-22db95846d0a?q=80&w=200&auto=format&fit=crop' },
          { name: '反光背心', img: 'https://images.unsplash.com/photo-1605218427360-36390f8552d7?q=80&w=200&auto=format&fit=crop' },
          { name: '手套', img: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?q=80&w=200&auto=format&fit=crop' }
        ]
      }
    ]
  },
  breakroom: {
    title: '茶水间',
    subtitle: '为团队准备零食与咖啡',
    bannerImage: 'https://images.unsplash.com/photo-1525610553991-2bede1a236e2?q=80&w=2070&auto=format&fit=crop',
    sections: [
      {
        title: '饮品',
        items: [
          { name: '咖啡', img: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=200&auto=format&fit=crop' },
          { name: '茶', img: 'https://images.unsplash.com/photo-1576092768241-dec231854f74?q=80&w=200&auto=format&fit=crop' }
        ]
      },
      {
        title: '电器',
        items: [
          { name: '咖啡机', img: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?q=80&w=200&auto=format&fit=crop' }
        ]
      }
    ]
  }
}

export default function CategoryPage() {
  const navbarStyle = getNavbarStyle()
  const [activeKey, setActiveKey] = useState<CategoryKey>('office')
  const [query, setQuery] = useState('')
  const [isTabbarVisible, setIsTabbarVisible] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeData = CATEGORY_DATA[activeKey]

  const filteredSections = useMemo(() => {
    if (!query.trim()) {
      return activeData.sections
    }
    const needle = query.trim().toLowerCase()
    return activeData.sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.name.toLowerCase().includes(needle))
      }))
      .filter((section) => section.items.length > 0)
  }, [activeData, query])

  const handleSidebarTap = (key: CategoryKey) => (_: ITouchEvent) => {
    if (key === activeKey) return
    setActiveKey(key)
  }

  const scheduleTabbarShow = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
    }
    hideTimerRef.current = setTimeout(() => {
      setIsTabbarVisible(true)
    }, 200)
  }, [])

  const handleScroll = useCallback(() => {
    if (isTabbarVisible) {
      setIsTabbarVisible(false)
    }
    scheduleTabbarShow()
  }, [isTabbarVisible, scheduleTabbarShow])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
    }
  }, [])

  return (
    <View className='page category-page'>
      <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--primary'></Navbar>

      <View className='category-search'>
        <Search
          value={query}
          shape='rounded'
          clearable
          icon={<SearchIcon />}
          placeholder='搜索 SKU 或商品...'
          onChange={(event) => setQuery(event.detail.value)}
        />
      </View>

      <View className='category-body'>
        <ScrollView className='category-sidebar' scrollY onScroll={handleScroll}>
          {SIDEBAR_ENTRIES.map((entry) => {
            const isActive = entry.key === activeKey
            return (
              <View
                key={entry.key}
                className={`category-sidebar-item ${isActive ? 'is-active' : ''}`}
                onClick={handleSidebarTap(entry.key)}
              >
                <View className='category-sidebar-indicator' />
                <View className='category-sidebar-icon'>{entry.icon}</View>
                <Text className='category-sidebar-label'>{entry.label}</Text>
              </View>
            )
          })}
        </ScrollView>

        <ScrollView className='category-content' scrollY onScroll={handleScroll}>
          <View key={activeKey} className='category-content-inner'>
            <View className='category-banner'>
              <View className='category-banner-image' style={{ backgroundImage: `url(${activeData.bannerImage})` }} />
              <View className='category-banner-text'>
                <Text className='category-banner-title'>{activeData.title}</Text>
                <Text className='category-banner-subtitle'>{activeData.subtitle}</Text>
              </View>
            </View>

            {filteredSections.map((section) => (
              <View key={section.title} className='category-section'>
                <View className='category-section-title'>
                  <View className='category-section-dot' />
                  <Text className='category-section-text'>{section.title}</Text>
                </View>
                <View className='category-grid'>
                  {section.items.map((item) => (
                    <View key={item.name} className='category-card'>
                      <View className='category-card-media'>
                        <Image className='category-card-image' src={item.img} mode='aspectFit' />
                      </View>
                      <Text className='category-card-label'>{item.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {filteredSections.length === 0 ? (
              <View className='category-empty'>
                <Text className='category-empty-title'>无结果</Text>
                <Text className='category-empty-subtitle'>试试其他关键词。</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>

      <View className={`category-tabbar ${isTabbarVisible ? '' : 'is-hidden'}`}>
        <AppTabbar value='category' />
      </View>
    </View>
  )
}
