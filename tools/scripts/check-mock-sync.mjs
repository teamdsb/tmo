import {
  canonicalCategories,
  canonicalDisplayCategories,
  canonicalOrderFixtures,
  canonicalProductDetailsById,
  canonicalProducts,
  canonicalSkuById,
  canonicalTrackingByOrderId
} from '../../packages/shared/src/mock-data/index.js';

const fail = (message) => {
  throw new Error(message);
};

const assert = (condition, message) => {
  if (!condition) {
    fail(message);
  }
};

const unique = (items) => new Set(items);

const run = () => {
  assert(Array.isArray(canonicalCategories) && canonicalCategories.length > 0, 'canonicalCategories 不能为空');
  assert(Array.isArray(canonicalDisplayCategories) && canonicalDisplayCategories.length > 0, 'canonicalDisplayCategories 不能为空');
  assert(Array.isArray(canonicalProducts) && canonicalProducts.length > 0, 'canonicalProducts 不能为空');
  assert(Array.isArray(canonicalOrderFixtures) && canonicalOrderFixtures.length > 0, 'canonicalOrderFixtures 不能为空');

  const categoryIds = canonicalCategories.map((item) => item.id);
  assert(unique(categoryIds).size === categoryIds.length, '类目 id 存在重复');

  const categoryNames = canonicalCategories.map((item) => item.name);
  assert(unique(categoryNames).size === categoryNames.length, '类目名称存在重复');

  canonicalProducts.forEach((product) => {
    assert(categoryIds.includes(product.categoryId), `商品 ${product.id} 的 categoryId=${product.categoryId} 未命中类目`);
  });

  const detailIds = Object.keys(canonicalProductDetailsById);
  canonicalProducts.forEach((product) => {
    assert(detailIds.includes(product.id), `商品 ${product.id} 缺少详情`);
  });

  Object.entries(canonicalProductDetailsById).forEach(([spuId, detail]) => {
    assert(detail?.product?.id === spuId, `详情 ${spuId} 的 product.id 不一致`);
    assert(Array.isArray(detail?.skus) && detail.skus.length > 0, `详情 ${spuId} 的 SKU 为空`);
    detail.skus.forEach((sku) => {
      assert(sku.spuId === spuId, `SKU ${sku.id} 的 spuId=${sku.spuId} 与详情 ${spuId} 不一致`);
      assert(Array.isArray(sku.priceTiers) && sku.priceTiers.length > 0, `SKU ${sku.id} 缺少价格阶梯`);
    });
  });

  const skuIds = Object.keys(canonicalSkuById);
  assert(skuIds.length > 0, 'canonicalSkuById 为空');
  assert(unique(skuIds).size === skuIds.length, 'SKU id 存在重复');

  const orderIds = canonicalOrderFixtures.map((item) => item.id);
  assert(unique(orderIds).size === orderIds.length, '订单 id 存在重复');

  canonicalOrderFixtures.forEach((fixture) => {
    assert(Array.isArray(fixture.items) && fixture.items.length > 0, `订单 ${fixture.id} 没有商品项`);
    fixture.items.forEach((item) => {
      assert(Boolean(canonicalSkuById[item.skuId]), `订单 ${fixture.id} 引用未知 skuId=${item.skuId}`);
      assert(Number.isFinite(Number(item.qty)) && Number(item.qty) > 0, `订单 ${fixture.id} 的 sku=${item.skuId} qty 非法`);
      assert(Number.isFinite(Number(item.unitPriceFen)) && Number(item.unitPriceFen) >= 0, `订单 ${fixture.id} 的 sku=${item.skuId} unitPriceFen 非法`);
    });
  });

  const trackingKeys = Object.keys(canonicalTrackingByOrderId);
  assert(unique(trackingKeys).size === trackingKeys.length, 'trackingByOrderId 键存在重复');
  orderIds.forEach((orderId) => {
    assert(Boolean(canonicalTrackingByOrderId[orderId]), `订单 ${orderId} 缺少 tracking`);
  });

  console.log('[mock-sync] OK');
  console.log(`- categories: ${canonicalCategories.length}`);
  console.log(`- displayCategories: ${canonicalDisplayCategories.length}`);
  console.log(`- products: ${canonicalProducts.length}`);
  console.log(`- skus: ${skuIds.length}`);
  console.log(`- orders: ${canonicalOrderFixtures.length}`);
};

run();
