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
  { id: 'cat-fasteners', name: 'Fasteners', sort: 1 },
  { id: 'cat-electrical', name: 'Electrical', sort: 2 },
  { id: 'cat-ppe', name: 'Safety & PPE', sort: 3 }
]

export const mockProducts: ProductSummary[] = [
  {
    id: 'spu-bolt-a2',
    name: 'Stainless Hex Bolt A2',
    categoryId: 'cat-fasteners',
    tags: ['DIN933', 'A2'],
    coverImageUrl: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a'
  },
  {
    id: 'spu-anchor-m10',
    name: 'Concrete Anchor M10',
    categoryId: 'cat-fasteners',
    tags: ['Anchor'],
    coverImageUrl: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef'
  },
  {
    id: 'spu-screw-t25',
    name: 'Torx Screw T25',
    categoryId: 'cat-fasteners',
    tags: ['Torx'],
    coverImageUrl: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4'
  },
  {
    id: 'spu-nut-m12',
    name: 'Lock Nut M12',
    categoryId: 'cat-fasteners',
    tags: ['Nyloc'],
    coverImageUrl: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a'
  },
  {
    id: 'spu-cable-3x2',
    name: 'Power Cable 3x2.5mm',
    categoryId: 'cat-electrical',
    tags: ['Cable'],
    coverImageUrl: 'https://images.unsplash.com/photo-1509395176047-4a66953fd231'
  },
  {
    id: 'spu-relay-24v',
    name: 'Industrial Relay 24V',
    categoryId: 'cat-electrical',
    tags: ['Relay'],
    coverImageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475'
  },
  {
    id: 'spu-sensor-pt100',
    name: 'PT100 Temperature Sensor',
    categoryId: 'cat-electrical',
    tags: ['Sensor'],
    coverImageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475'
  },
  {
    id: 'spu-led-panel',
    name: 'LED Panel Light 600x600',
    categoryId: 'cat-electrical',
    tags: ['Lighting'],
    coverImageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085'
  },
  {
    id: 'spu-gloves-cut5',
    name: 'Cut Resistant Gloves',
    categoryId: 'cat-ppe',
    tags: ['EN388'],
    coverImageUrl: 'https://images.unsplash.com/photo-1581579186899-1b1b5f1c0f50'
  },
  {
    id: 'spu-helmet-pro',
    name: 'Safety Helmet Pro',
    categoryId: 'cat-ppe',
    tags: ['Helmet'],
    coverImageUrl: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a'
  },
  {
    id: 'spu-vest-reflect',
    name: 'Reflective Safety Vest',
    categoryId: 'cat-ppe',
    tags: ['Hi-Vis'],
    coverImageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee'
  },
  {
    id: 'spu-mask-n95',
    name: 'N95 Respirator Mask',
    categoryId: 'cat-ppe',
    tags: ['Mask'],
    coverImageUrl: 'https://images.unsplash.com/photo-1581579186899-1b1b5f1c0f50'
  }
]

export const mockProductDetails: Record<string, ProductDetail> = {
  'spu-bolt-a2': {
    product: {
      id: 'spu-bolt-a2',
      name: 'Stainless Hex Bolt A2',
      images: ['https://images.unsplash.com/photo-1520607162513-77705c0f0d4a'],
      categoryId: 'cat-fasteners',
      description: 'A2 stainless steel hex bolts with standard DIN933 threading.'
    },
    skus: [
      makeSku('spu-bolt-a2', 'sku-bolt-a2-m8', 'M8 x 30', 'M8 x 30', 1350),
      makeSku('spu-bolt-a2', 'sku-bolt-a2-m10', 'M10 x 40', 'M10 x 40', 1850)
    ]
  },
  'spu-anchor-m10': {
    product: {
      id: 'spu-anchor-m10',
      name: 'Concrete Anchor M10',
      images: ['https://images.unsplash.com/photo-1489515217757-5fd1be406fef'],
      categoryId: 'cat-fasteners',
      description: 'Heavy duty anchors for structural concrete installations.'
    },
    skus: [
      makeSku('spu-anchor-m10', 'sku-anchor-m10-80', 'M10 x 80', 'M10 x 80', 2200),
      makeSku('spu-anchor-m10', 'sku-anchor-m10-100', 'M10 x 100', 'M10 x 100', 2600)
    ]
  },
  'spu-screw-t25': {
    product: {
      id: 'spu-screw-t25',
      name: 'Torx Screw T25',
      images: ['https://images.unsplash.com/photo-1519710164239-da123dc03ef4'],
      categoryId: 'cat-fasteners',
      description: 'Torx head screws for precision assembly.'
    },
    skus: [
      makeSku('spu-screw-t25', 'sku-screw-t25-20', 'T25 x 20', 'T25 x 20', 780),
      makeSku('spu-screw-t25', 'sku-screw-t25-35', 'T25 x 35', 'T25 x 35', 980)
    ]
  },
  'spu-nut-m12': {
    product: {
      id: 'spu-nut-m12',
      name: 'Lock Nut M12',
      images: ['https://images.unsplash.com/photo-1520607162513-77705c0f0d4a'],
      categoryId: 'cat-fasteners',
      description: 'Nyloc lock nuts for vibration-resistant fastening.'
    },
    skus: [
      makeSku('spu-nut-m12', 'sku-nut-m12-plain', 'M12', 'M12', 550),
      makeSku('spu-nut-m12', 'sku-nut-m12-zinc', 'M12 Zinc', 'M12 Zinc', 620)
    ]
  },
  'spu-cable-3x2': {
    product: {
      id: 'spu-cable-3x2',
      name: 'Power Cable 3x2.5mm',
      images: ['https://images.unsplash.com/photo-1509395176047-4a66953fd231'],
      categoryId: 'cat-electrical',
      description: 'Flexible copper cable suitable for industrial distribution.'
    },
    skus: [
      makeSku('spu-cable-3x2', 'sku-cable-3x2-50', '50m Roll', '50m', 12800),
      makeSku('spu-cable-3x2', 'sku-cable-3x2-100', '100m Roll', '100m', 23800)
    ]
  },
  'spu-relay-24v': {
    product: {
      id: 'spu-relay-24v',
      name: 'Industrial Relay 24V',
      images: ['https://images.unsplash.com/photo-1518770660439-4636190af475'],
      categoryId: 'cat-electrical',
      description: 'DIN-rail relay with 24V coil for control cabinets.'
    },
    skus: [
      makeSku('spu-relay-24v', 'sku-relay-24v-10a', '10A', '10A', 8800),
      makeSku('spu-relay-24v', 'sku-relay-24v-16a', '16A', '16A', 10200)
    ]
  },
  'spu-sensor-pt100': {
    product: {
      id: 'spu-sensor-pt100',
      name: 'PT100 Temperature Sensor',
      images: ['https://images.unsplash.com/photo-1518770660439-4636190af475'],
      categoryId: 'cat-electrical',
      description: 'Stainless steel PT100 probe with industrial accuracy.'
    },
    skus: [
      makeSku('spu-sensor-pt100', 'sku-pt100-50', '50mm Probe', '50mm', 7800),
      makeSku('spu-sensor-pt100', 'sku-pt100-100', '100mm Probe', '100mm', 8800)
    ]
  },
  'spu-led-panel': {
    product: {
      id: 'spu-led-panel',
      name: 'LED Panel Light 600x600',
      images: ['https://images.unsplash.com/photo-1498050108023-c5249f4df085'],
      categoryId: 'cat-electrical',
      description: 'Ultra-slim panel for warehouse and office lighting.'
    },
    skus: [
      makeSku('spu-led-panel', 'sku-led-40w', '40W', '40W', 16800),
      makeSku('spu-led-panel', 'sku-led-60w', '60W', '60W', 21000)
    ]
  },
  'spu-gloves-cut5': {
    product: {
      id: 'spu-gloves-cut5',
      name: 'Cut Resistant Gloves',
      images: ['https://images.unsplash.com/photo-1581579186899-1b1b5f1c0f50'],
      categoryId: 'cat-ppe',
      description: 'Level 5 cut protection gloves for metal handling.'
    },
    skus: [
      makeSku('spu-gloves-cut5', 'sku-gloves-m', 'Size M', 'M', 3200),
      makeSku('spu-gloves-cut5', 'sku-gloves-l', 'Size L', 'L', 3200)
    ]
  },
  'spu-helmet-pro': {
    product: {
      id: 'spu-helmet-pro',
      name: 'Safety Helmet Pro',
      images: ['https://images.unsplash.com/photo-1520607162513-77705c0f0d4a'],
      categoryId: 'cat-ppe',
      description: 'Impact resistant helmet with adjustable suspension.'
    },
    skus: [
      makeSku('spu-helmet-pro', 'sku-helmet-white', 'White', 'White', 5800),
      makeSku('spu-helmet-pro', 'sku-helmet-yellow', 'Yellow', 'Yellow', 5800)
    ]
  },
  'spu-vest-reflect': {
    product: {
      id: 'spu-vest-reflect',
      name: 'Reflective Safety Vest',
      images: ['https://images.unsplash.com/photo-1500530855697-b586d89ba3ee'],
      categoryId: 'cat-ppe',
      description: 'High visibility vest with reflective stripes.'
    },
    skus: [
      makeSku('spu-vest-reflect', 'sku-vest-m', 'Size M', 'M', 2200),
      makeSku('spu-vest-reflect', 'sku-vest-l', 'Size L', 'L', 2200)
    ]
  },
  'spu-mask-n95': {
    product: {
      id: 'spu-mask-n95',
      name: 'N95 Respirator Mask',
      images: ['https://images.unsplash.com/photo-1581579186899-1b1b5f1c0f50'],
      categoryId: 'cat-ppe',
      description: 'Certified particulate respirator for industrial protection.'
    },
    skus: [
      makeSku('spu-mask-n95', 'sku-mask-box', 'Box of 20', '20 pcs', 6400),
      makeSku('spu-mask-n95', 'sku-mask-case', 'Case of 200', '200 pcs', 56000)
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
      description: 'Mock product detail for offline preview.'
    },
    skus: [
      makeSku(product.id, `${product.id}-sku-a`, `${product.name} A`, 'Standard', 9800),
      makeSku(product.id, `${product.id}-sku-b`, `${product.name} B`, 'Enhanced', 11800)
    ]
  }
}
