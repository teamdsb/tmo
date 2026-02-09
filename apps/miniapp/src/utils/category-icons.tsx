import type { ReactNode } from 'react'
import AppsOutlined from '@taroify/icons/AppsOutlined'
import BrushOutlined from '@taroify/icons/BrushOutlined'
import DesktopOutlined from '@taroify/icons/DesktopOutlined'
import HotOutlined from '@taroify/icons/HotOutlined'
import NotesOutlined from '@taroify/icons/NotesOutlined'
import SettingOutlined from '@taroify/icons/SettingOutlined'
import ShieldOutlined from '@taroify/icons/ShieldOutlined'

export type CategoryIconKey = 'notes' | 'setting' | 'desktop' | 'shield' | 'brush' | 'hot' | 'apps'

const FALLBACK_ICON_SEQUENCE: CategoryIconKey[] = ['notes', 'setting', 'desktop', 'shield', 'brush', 'hot', 'apps']

const KEYWORD_ICON_RULES: { pattern: RegExp; iconKey: CategoryIconKey }[] = [
  { pattern: /办公|文具|office/i, iconKey: 'notes' },
  { pattern: /紧固|五金|工业|工具|fasten|bolt|hardware/i, iconKey: 'setting' },
  { pattern: /电|电子|electronics?|cable/i, iconKey: 'desktop' },
  { pattern: /安防|防护|安全|ppe|safety/i, iconKey: 'shield' },
  { pattern: /清洁|保洁|janitorial/i, iconKey: 'brush' },
  { pattern: /茶|休闲|食品|餐|breakroom|food/i, iconKey: 'hot' }
]

export const resolveCategoryIconKey = (name: string, index: number): CategoryIconKey => {
  const matchedRule = KEYWORD_ICON_RULES.find((rule) => rule.pattern.test(name))
  if (matchedRule) {
    return matchedRule.iconKey
  }
  return FALLBACK_ICON_SEQUENCE[index % FALLBACK_ICON_SEQUENCE.length]
}

export const renderCategoryIcon = (iconKey: CategoryIconKey): ReactNode => {
  switch (iconKey) {
    case 'notes':
      return <NotesOutlined />
    case 'setting':
      return <SettingOutlined />
    case 'desktop':
      return <DesktopOutlined />
    case 'shield':
      return <ShieldOutlined />
    case 'brush':
      return <BrushOutlined />
    case 'hot':
      return <HotOutlined />
    default:
      return <AppsOutlined />
  }
}
