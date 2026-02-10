import type { Category, PriceTier, ProductDetail, ProductSummary, Sku } from '@tmo/api-client'

const makeTier = (minQty: number, maxQty: number | null, unitPriceFen: number): PriceTier => ({
  minQty,
  maxQty,
  unitPriceFen
})

const makeSku = (spuId: string, id: string, name: string, spec: string, basePriceFen: number): Sku => ({
  id,
  spuId,
  name,
  spec,
  priceTiers: [
    makeTier(1, 9, basePriceFen),
    makeTier(10, 49, Math.max(1, basePriceFen - 800)),
    makeTier(50, null, Math.max(1, basePriceFen - 1600))
  ],
  isActive: true
})

export const mockCategories: Category[] = [
  { id: 'cat-fasteners', name: '紧固件', sort: 1 },
  { id: 'cat-electrical', name: '电气', sort: 2 },
  { id: 'cat-ppe', name: '安全防护', sort: 3 }
]

export const mockProducts: ProductSummary[] = [
  {
    id: 'spu-bolt-a2',
    name: '不锈钢六角螺栓 A2',
    categoryId: 'cat-fasteners',
    tags: ['DIN933', 'A2'],
    coverImageUrl: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a'
  },
  {
    id: 'spu-anchor-m10',
    name: '混凝土锚栓 M10',
    categoryId: 'cat-fasteners',
    tags: ['锚栓'],
    coverImageUrl: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef'
  },
  {
    id: 'spu-screw-t25',
    name: '梅花螺钉 T25',
    categoryId: 'cat-fasteners',
    tags: ['梅花'],
    coverImageUrl: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4'
  },
  {
    id: 'spu-nut-m12',
    name: '防松螺母 M12',
    categoryId: 'cat-fasteners',
    tags: ['尼龙防松'],
    coverImageUrl: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a'
  },
  {
    id: 'spu-cable-3x2',
    name: '电力电缆 3x2.5mm',
    categoryId: 'cat-electrical',
    tags: ['电缆'],
    coverImageUrl: 'https://images.unsplash.com/photo-1509395176047-4a66953fd231'
  },
  {
    id: 'spu-relay-24v',
    name: '工业继电器 24V',
    categoryId: 'cat-electrical',
    tags: ['继电器'],
    coverImageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475'
  },
  {
    id: 'spu-sensor-pt100',
    name: 'PT100 温度传感器',
    categoryId: 'cat-electrical',
    tags: ['传感器'],
    coverImageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475'
  },
  {
    id: 'spu-led-panel',
    name: 'LED 面板灯 600x600',
    categoryId: 'cat-electrical',
    tags: ['照明'],
    coverImageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085'
  },
  {
    id: 'spu-gloves-cut5',
    name: '防割手套',
    categoryId: 'cat-ppe',
    tags: ['EN388'],
    coverImageUrl: 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a'
  },
  {
    id: 'spu-helmet-pro',
    name: '专业安全帽',
    categoryId: 'cat-ppe',
    tags: ['安全帽'],
    coverImageUrl: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a'
  },
  {
    id: 'spu-vest-reflect',
    name: '反光安全背心',
    categoryId: 'cat-ppe',
    tags: ['高可视'],
    coverImageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee'
  },
  {
    id: 'spu-mask-n95',
    name: 'N95 呼吸防护口罩',
    categoryId: 'cat-ppe',
    tags: ['口罩'],
    coverImageUrl: 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a'
  }
]

export const mockProductDetails: Record<string, ProductDetail> = {
  'spu-bolt-a2': {
    product: {
      id: 'spu-bolt-a2',
      name: '不锈钢六角螺栓 A2',
      images: ['https://images.unsplash.com/photo-1520607162513-77705c0f0d4a'],
      categoryId: 'cat-fasteners',
      description: 'A2 不锈钢六角螺栓，DIN933 标准螺纹。'
    },
    skus: [
      makeSku('spu-bolt-a2', 'sku-bolt-a2-m8', 'M8 x 30', 'M8 x 30', 1350),
      makeSku('spu-bolt-a2', 'sku-bolt-a2-m10', 'M10 x 40', 'M10 x 40', 1850)
    ]
  },
  'spu-anchor-m10': {
    product: {
      id: 'spu-anchor-m10',
      name: '混凝土锚栓 M10',
      images: ['https://images.unsplash.com/photo-1489515217757-5fd1be406fef'],
      categoryId: 'cat-fasteners',
      description: '适用于结构混凝土安装的重型锚栓。'
    },
    skus: [
      makeSku('spu-anchor-m10', 'sku-anchor-m10-80', 'M10 x 80', 'M10 x 80', 2200),
      makeSku('spu-anchor-m10', 'sku-anchor-m10-100', 'M10 x 100', 'M10 x 100', 2600)
    ]
  },
  'spu-screw-t25': {
    product: {
      id: 'spu-screw-t25',
      name: '梅花螺钉 T25',
      images: ['https://images.unsplash.com/photo-1519710164239-da123dc03ef4'],
      categoryId: 'cat-fasteners',
      description: '适用于精密装配的梅花头螺钉。'
    },
    skus: [
      makeSku('spu-screw-t25', 'sku-screw-t25-20', 'T25 x 20', 'T25 x 20', 780),
      makeSku('spu-screw-t25', 'sku-screw-t25-35', 'T25 x 35', 'T25 x 35', 980)
    ]
  },
  'spu-nut-m12': {
    product: {
      id: 'spu-nut-m12',
      name: '防松螺母 M12',
      images: ['https://images.unsplash.com/photo-1520607162513-77705c0f0d4a'],
      categoryId: 'cat-fasteners',
      description: '适用于防振紧固的尼龙防松螺母。'
    },
    skus: [
      makeSku('spu-nut-m12', 'sku-nut-m12-plain', 'M12', 'M12', 550),
      makeSku('spu-nut-m12', 'sku-nut-m12-zinc', 'M12 镀锌', 'M12 镀锌', 620)
    ]
  },
  'spu-cable-3x2': {
    product: {
      id: 'spu-cable-3x2',
      name: '电力电缆 3x2.5mm',
      images: ['https://images.unsplash.com/photo-1509395176047-4a66953fd231'],
      categoryId: 'cat-electrical',
      description: '适用于工业配电的柔性铜电缆。'
    },
    skus: [
      makeSku('spu-cable-3x2', 'sku-cable-3x2-50', '50米/卷', '50m', 12800),
      makeSku('spu-cable-3x2', 'sku-cable-3x2-100', '100米/卷', '100m', 23800)
    ]
  },
  'spu-relay-24v': {
    product: {
      id: 'spu-relay-24v',
      name: '工业继电器 24V',
      images: ['https://images.unsplash.com/photo-1518770660439-4636190af475'],
      categoryId: 'cat-electrical',
      description: '适用于控制柜的 DIN 导轨继电器，24V 线圈。'
    },
    skus: [
      makeSku('spu-relay-24v', 'sku-relay-24v-10a', '10A', '10A', 8800),
      makeSku('spu-relay-24v', 'sku-relay-24v-16a', '16A', '16A', 10200)
    ]
  },
  'spu-sensor-pt100': {
    product: {
      id: 'spu-sensor-pt100',
      name: 'PT100 温度传感器',
      images: ['https://images.unsplash.com/photo-1518770660439-4636190af475'],
      categoryId: 'cat-electrical',
      description: '工业精度不锈钢 PT100 探头。'
    },
    skus: [
      makeSku('spu-sensor-pt100', 'sku-pt100-50', '50mm 探头', '50mm', 7800),
      makeSku('spu-sensor-pt100', 'sku-pt100-100', '100mm 探头', '100mm', 8800)
    ]
  },
  'spu-led-panel': {
    product: {
      id: 'spu-led-panel',
      name: 'LED 面板灯 600x600',
      images: ['https://images.unsplash.com/photo-1498050108023-c5249f4df085'],
      categoryId: 'cat-electrical',
      description: '适用于仓库与办公照明的超薄面板灯。'
    },
    skus: [
      makeSku('spu-led-panel', 'sku-led-40w', '40W', '40W', 16800),
      makeSku('spu-led-panel', 'sku-led-60w', '60W', '60W', 21000)
    ]
  },
  'spu-gloves-cut5': {
    product: {
      id: 'spu-gloves-cut5',
      name: '防割手套',
      images: ['https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a'],
      categoryId: 'cat-ppe',
      description: '适用于金属搬运的 5 级防割手套。'
    },
    skus: [
      makeSku('spu-gloves-cut5', 'sku-gloves-m', 'M 码', 'M', 3200),
      makeSku('spu-gloves-cut5', 'sku-gloves-l', 'L 码', 'L', 3200)
    ]
  },
  'spu-helmet-pro': {
    product: {
      id: 'spu-helmet-pro',
      name: '专业安全帽',
      images: ['https://images.unsplash.com/photo-1520607162513-77705c0f0d4a'],
      categoryId: 'cat-ppe',
      description: '可调节内衬的抗冲击安全帽。'
    },
    skus: [
      makeSku('spu-helmet-pro', 'sku-helmet-white', '白色', '白色', 5800),
      makeSku('spu-helmet-pro', 'sku-helmet-yellow', '黄色', '黄色', 5800)
    ]
  },
  'spu-vest-reflect': {
    product: {
      id: 'spu-vest-reflect',
      name: '反光安全背心',
      images: ['https://images.unsplash.com/photo-1500530855697-b586d89ba3ee'],
      categoryId: 'cat-ppe',
      description: '带反光条的高可视安全背心。'
    },
    skus: [
      makeSku('spu-vest-reflect', 'sku-vest-m', 'M 码', 'M', 2200),
      makeSku('spu-vest-reflect', 'sku-vest-l', 'L 码', 'L', 2200)
    ]
  },
  'spu-mask-n95': {
    product: {
      id: 'spu-mask-n95',
      name: 'N95 呼吸防护口罩',
      images: ['https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a'],
      categoryId: 'cat-ppe',
      description: '通过认证的工业防颗粒呼吸防护口罩。'
    },
    skus: [
      makeSku('spu-mask-n95', 'sku-mask-box', '20只/盒', '20只', 6400),
      makeSku('spu-mask-n95', 'sku-mask-case', '200只/箱', '200只', 56000)
    ]
  }
}

export const buildMockProductDetail = (spuId: string): ProductDetail | null => {
  const product = mockProducts.find((item) => item.id === spuId)
  if (!product) return null
  return {
    product: {
      id: product.id,
      name: product.name,
      images: product.coverImageUrl ? [product.coverImageUrl] : [],
      categoryId: product.categoryId,
      description: '离线预览用的商品详情。'
    },
    skus: [
      makeSku(product.id, `${product.id}-sku-a`, `${product.name} A款`, '标准', 9800),
      makeSku(product.id, `${product.id}-sku-b`, `${product.name} B款`, '增强', 11800)
    ]
  }
}
