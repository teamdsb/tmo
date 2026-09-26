import * as XLSX from 'xlsx';
import { formatSpecPath, validateProductSpecs } from '@tmo/shared';
import { buildMockProducts, normalizeProduct } from '../react/pages/admin/products-data';
import { getMockProductImportJob, loadImportedMockProducts, loadMockProductImportJobs, parseMockProductImport, saveMockProductImportJob, upsertImportedMockProducts } from './product-import';
const PREVIEWS = 'admin-web-mock-import-previews';
const REVIEWS = 'admin-web-mock-import-reviews';
const SOURCES = 'admin-web-mock-import-sources';
const JOBS = 'admin-web-mock-import-jobs';
const read = (key, fallback) => { try {
    return JSON.parse(localStorage.getItem(key) || 'null') || fallback;
}
catch {
    return fallback;
} };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const text = value => String(value ?? '').trim();
const issue = (code, message, severity = 'WARNING') => ({ code, message, severity });
const completedImport = job => job?.type === 'PRODUCT_IMPORT' && job.phase === 'COMPLETED';
function pendingReviewTargets(preview, reviews) {
    const targets = new Set();
    const productIds = new Set();
    for (const review of reviews) {
        if (review.status !== 'PENDING') continue;
        const matches = review.jobId === preview.jobId || preview.items.some(group =>
            (group.productId || group.productData?.id) === review.productId &&
            (!review.skuId || group.rows.some(row => row.modelId === review.skuId)));
        if (!matches) continue;
        targets.add(JSON.stringify([review.productId, review.skuId || null]));
        productIds.add(review.productId);
    }
    return { count: targets.size, productIds };
}
function syncCompletedReviewCounts() {
    const jobs = loadMockProductImportJobs();
    const previews = read(PREVIEWS, {});
    const reviews = read(REVIEWS, []);
    for (const job of jobs.filter(completedImport)) {
        const preview = previews[job.id];
        if (!preview) continue;
        const { count } = pendingReviewTargets(preview, reviews);
        job.summary = { ...job.summary, reviewCount: count };
        preview.summary = { ...preview.summary, reviewCount: count };
    }
    // Updating review counts must not reorder the history or erase original issues.
    write(JOBS, jobs);
    write(PREVIEWS, previews);
}
const clone = value => JSON.parse(JSON.stringify(value));
const catalog = () => { const imported = loadImportedMockProducts(); const ids = new Set(imported.map(product => product.id)); return [...read('admin-web-mock-products', buildMockProducts()).filter(product => !ids.has(product.id)), ...imported].map(normalizeProduct); };
const stableKey = async (value) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
const normalizeHeader = value => text(value).toLowerCase().replace(/[\s_-]+/g, '').replace(/\(fen\)$/, '');
const aliases = { 商品分组: 'Group Key', 商品分组键: 'Group Key', 分组键: 'Group Key', 商品ID: 'Product ID', 'SKU ID': 'SKU ID', 商品名称: 'Product Name', 商品状态: 'Product Status', 分类ID: 'Category ID', 'SKU编码': 'SKU Code', 'SKU名称': 'SKU Name', 规格: 'Spec', 规格摘要: 'Spec', 规格层级: 'Filter Dimensions', 单位: 'Unit', 商品说明: 'Description', 商品描述: 'Description', 商品主图: 'Cover Image', 封面图片: 'Cover Image', 商品图片: 'Images', 标签: 'Tags', 扩展属性: 'Attributes', 是否启用: 'Is Active', SKU启用: 'Is Active', '阶梯价格（分）': 'Price Tiers (Fen)', '一级规格名称': 'Spec 1 Name', '一级规格值': 'Spec 1 Value', '二级规格名称': 'Spec 2 Name', '二级规格值': 'Spec 2 Value', '三级规格名称': 'Spec 3 Name', '三级规格值': 'Spec 3 Value' };
const table = (workbook, name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet)
        return [];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    for (const merge of sheet['!merges'] || [])
        for (let row = merge.s.r; row <= merge.e.r; row += 1)
            for (let col = merge.s.c; col <= merge.e.c; col += 1) {
                rows[row] ||= [];
                rows[row][col] ||= rows[merge.s.r]?.[merge.s.c] || '';
            }
    return rows;
};
const objects = (workbook, name) => { const rows = table(workbook, name); return rows.slice(1).filter(row => row.some(text)).map((row, index) => ({ values: Object.fromEntries(rows[0].map((header, col) => [text(header), text(row[col])])), row: index + 2, sheet: name })); };
const dimensionsFor = (name, attrs) => {
    const profiles = [
        [/螺母/, ['螺纹直径']], [/螺钉|螺栓|螺丝/, ['螺纹直径', '长度', '螺距']], [/法兰/, ['公称通径', '连接管外径']],
        [/珍珠棉|EPE/i, ['宽度', '厚度', '卷长']], [/魔术贴|粘扣带/, ['宽度', '颜色', '勾毛面']], [/包边带/, ['宽度', '纱线规格标识', '颜色']],
        [/管钳/, ['标称尺寸原文']], [/内六角扳手/, ['标称规格']], [/胶带/, ['宽度', '卷长']], [/笔记本/, ['幅面']]
    ];
    const requested = profiles.find(([pattern]) => pattern.test(name))?.[1];
    if (requested)
        return requested;
    return Object.keys(attrs).filter(key => !/备注|来源|品牌/.test(key)).slice(0, 3);
};
const categoryFor = raw => {
    const categories = read('admin-web-products-categories', []);
    const path = [raw['一级分类'], raw['二级分类'], raw['三级分类']].filter(Boolean).join('/');
    const categoryPath = (category, visited = new Set()) => { if (!category || visited.has(category.id))
        return ''; visited.add(category.id); const parent = categories.find(item => item.id === category.parentId); return parent ? `${categoryPath(parent, visited)}/${category.name}` : category.name; };
    const matches = categories.filter(category => (category.path || categoryPath(category)) === path);
    return matches.length === 1 ? matches[0].id : '';
};
async function sourceRows(workbook) {
    if (workbook.Sheets['商品'] && workbook.Sheets['SKU规格'] && workbook.Sheets['独立属性']) {
        const products = new Map(objects(workbook, '商品').map(row => [row.values['商品编号'], row.values]));
        const attrsBySku = new Map();
        for (const row of objects(workbook, '独立属性')) {
            const raw = row.values;
            const key = `${raw['商品编号']}\0${raw['SKU编号']}`;
            if (!attrsBySku.has(key))
                attrsBySku.set(key, {});
            const value = raw['文本值'] || raw['数值'];
            attrsBySku.get(key)[raw['属性名称']] = `${value}${raw['单位'] && !value.endsWith(raw['单位']) ? raw['单位'] : ''}`;
        }
        const rows = [];
        for (const source of objects(workbook, 'SKU规格')) {
            const raw = source.values;
            const product = products.get(raw['商品编号']) || {};
            const attrs = attrsBySku.get(`${raw['商品编号']}\0${raw['SKU编号']}`) || {};
            const name = product['规范商品名称'] || raw['规范商品名称'];
            const dimensions = dimensionsFor(name, attrs);
            const warnings = [];
            const categoryId = categoryFor({ ...raw, ...product });
            if (!categoryId)
                warnings.push(issue('CATEGORY_UNMATCHED', '分类路径未匹配，已保留为未分类草稿，请核实分类。'));
            const unit = raw['销售单位'] || raw['需求数量单位'] || raw['原采购单位'] || '';
            let missing = !dimensions.length || dimensions.some(dimension => !attrs[dimension]);
            if (missing)
                warnings.push(issue('SPEC_UNRECOGNIZED', '规格层级无法可靠识别，已独立创建草稿并保留完整型号。'));
            if (dimensions.some(dimension => /长度|宽度|厚度|卷长|外径|螺距/.test(dimension) && attrs[dimension] && !/(?:mm|cm|m|毫米|厘米|米|英寸|寸|inch|in|ft|um|μm)$/i.test(attrs[dimension]))) {
                missing = true;
                warnings.push(issue('DIMENSION_UNIT_MISSING', '物理尺寸缺少明确单位，已保留原文为独立草稿。'));
            }
            if (!unit) {
                missing = true;
                warnings.push(issue('UNIT_MISSING', '缺少计量单位，请复核。'));
            }
            if (['GK', 'ge', '9'].includes(unit)) {
                missing = true;
                warnings.push(issue('UNIT_UNRECOGNIZED', `原始单位“${unit}”无法确定，未自动替换。`));
            }
            if (raw['销售单价'] && !/^\d+(?:\.\d{1,2})?$/.test(raw['销售单价']))
                warnings.push(issue('INVALID_PRICE', '销售单价必须是非负的两位小数金额。', 'ERROR'));
            const sourceKey = `master:${raw['商品编号']}:${raw['SKU编号']}`;
            const recognized = missing ? ['规格'] : dimensions;
            if (missing)
                attrs['规格'] = raw['SKU显示名称'] || raw['原始规格描述'] || raw['SKU编号'];
            const fingerprintProduct = { ...product };
            delete fingerprintProduct['规格数'];
            rows.push({ ...source, values: { ...raw, sourceProduct: JSON.stringify(product), sourceAttributes: JSON.stringify(attrs) }, sourceKey, fingerprint: await stableKey(JSON.stringify({ product: fingerprintProduct, raw, attrs })), groupKey: missing ? sourceKey : `master:${raw['商品编号']}`, productName: name, skuCode: raw['SKU编号'], skuName: raw['SKU显示名称'], unit, dimensions: recognized, attributes: attrs, categoryId, description: product['商品说明'], warnings, split: missing, priceTiers: raw['销售单价'] && /^\d+(?:\.\d{1,2})?$/.test(raw['销售单价']) ? [{ minQty: 1, maxQty: null, unitPriceFen: Math.round(Number(raw['销售单价']) * 100) }] : undefined });
        }
        return { format: 'TRIAL_MASTER', rows };
    }
    const sheet = workbook.SheetNames[0];
    const rows = table(workbook, sheet);
    const headerIndex = rows.findIndex(row => row.some(value => /^(物资|商品名称|名称|品名)$/.test(text(value))) && row.some(value => /^(规格型号|型号|规格)$/.test(text(value))));
    if (headerIndex < 0)
        return null;
    const headers = rows[headerIndex].map(text);
    if (headers.some(value => /分组键|商品ID|一级规格|Spec 1/i.test(value)))
        return null;
    const result = [];
    for (let index = headerIndex + 1; index < rows.length; index += 1) {
        if (!rows[index].some(text))
            continue;
        const raw = Object.fromEntries(headers.map((header, col) => [header, text(rows[index][col])]));
        const name = raw['物资'] || raw['商品名称'] || raw['名称'] || raw['品名'];
        const spec = raw['规格型号'] || raw['型号'] || raw['规格'];
        const unit = raw['单位'] || raw['计量单位'] || '';
        const sourceKey = `legacy:${await stableKey(JSON.stringify([name, spec, raw['商品分类'] || raw['分类'] || raw['类别'] || '', unit]))}`;
        const dimensions = ['型号'];
        const attributes = { 型号: spec || name };
        const warnings = [];
        let split = !name || !spec;
        const triples = /^(?:长)?\s*(\d+(?:\.\d+)?)\s*[*xX×]\s*(?:宽)?\s*(\d+(?:\.\d+)?)\s*[*xX×]\s*(?:高)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|毫米|厘米|米)?$/i.exec(spec);
        if (triples?.[4] && /纸箱|箱子/.test(name)) {
            const suffix = triples[4].toLowerCase();
            dimensions.splice(0, 1, '长度', '宽度', '高度');
            for (let level = 0; level < 3; level += 1)
                attributes[dimensions[level]] = `${triples[level + 1]}${suffix}`;
            delete attributes['型号'];
        }
        if (triples && !triples[4]) {
            split = true;
            warnings.push(issue('DIMENSION_UNIT_MISSING', '尺寸缺少明确单位，保留完整型号为独立草稿，请确认单位。'));
        }
        if (!name || !spec)
            warnings.push(issue('SPEC_UNRECOGNIZED', '商品名称或规格不完整，已独立创建草稿。'));
        if (!unit)
            warnings.push(issue('UNIT_MISSING', '缺少计量单位，请复核。'));
        if (/^(辅料|材料|配件|物资|其他)$/.test(name)) {
            split = true;
            warnings.push(issue('GENERIC_PRODUCT_NAME', '物资名称过于宽泛，已保留为独立商品。'));
        }
        if (/填写|见备注|待定/.test(spec)) {
            split = true;
            warnings.push(issue('SPEC_UNRECOGNIZED', '原始规格是待补说明，需要复核。'));
        }
        if (triples?.[4] && !/纸箱|箱子/.test(name)) {
            split = true;
            warnings.push(issue('SPEC_AMBIGUOUS', '尺寸组合的属性含义不明确，需要复核。'));
        }
        if (unit === 'GK') {
            split = true;
            warnings.push(issue('UNIT_UNRECOGNIZED', '采购单位 GK 无法识别，请复核。'));
        }
        if (split) {
            dimensions.splice(0, dimensions.length, '规格');
            for (const key of Object.keys(attributes))
                delete attributes[key];
            attributes['规格'] = spec || name || '待补充';
        }
        warnings.push(issue('CATEGORY_UNMATCHED', '分类路径未匹配，已保留为未分类草稿，请核实分类。'));
        result.push({ values: raw, row: index + 1, sheet, sourceKey, fingerprint: await stableKey(JSON.stringify([name, spec, unit, raw['分类'] || raw['类别'] || ''])), groupKey: split ? sourceKey : `legacy-group:${name}:${unit}:${raw['分类'] || raw['类别'] || ''}`, productName: name || spec || `未识别商品 ${index + 1}`, skuCode: '', skuName: spec || name, unit, dimensions, attributes, categoryId: '', description: '', warnings, split });
    }
    return { format: 'LEGACY_FIVE_COLUMN', rows: result };
}
function validateGroups(groups) {
    for (const group of groups) {
        group.issues = group.issues.filter(item => item.code !== 'SPEC_VALIDATION');
        const included = group.rows.filter(row => row.action !== 'SKIP');
        if (!included.length || !group.productData) continue;
        const models = clone(group.productData.models || []);
        for (const row of included.filter(item => item.modelData)) {
            const model = { ...row.modelData, attributes: row.attributes };
            const index = models.findIndex(item => item.id === row.modelId);
            if (index < 0) models.push(model); else models[index] = model;
        }
        const problems = validateProductSpecs(group.dimensions, models);
        if (problems.length) group.issues.push(issue('SPEC_VALIDATION', problems[0].message, 'ERROR'));
    }
}
function summarize(items) {
    const summary = { totalRows: 0, successRows: 0, failedRows: 0, skippedRows: 0, splitProducts: 0, reviewCount: 0, productCreates: 0, productUpdates: 0, skuCreates: 0, skuUpdates: 0 };
    for (const group of items) {
        const included = group.rows.filter(row => row.action !== 'SKIP');
        summary.totalRows += group.rows.length;
        summary.skippedRows += group.rows.length - included.length;
        const failed = included.filter(row => [...group.issues, ...row.issues].some(item => item.severity === 'ERROR')).length;
        summary.failedRows += failed;
        summary.successRows += included.length - failed;
        summary.reviewCount += group.issues.filter(item => item.severity === 'WARNING').length + included.reduce((n, row) => n + row.issues.filter(item => item.severity === 'WARNING').length, 0);
        if (!included.length || failed)
            continue;
        if (group.action === 'SPLIT')
            summary.splitProducts += 1;
        if (group.productId)
            summary.productUpdates += 1;
        else
            summary.productCreates += 1;
        for (const row of included)
            if (row.action === 'UPDATE')
                summary.skuUpdates += 1;
            else
                summary.skuCreates += 1;
    }
    return summary;
}
export async function createMockImportPreview({ excelFile, imagesZipFile, imageBaseUrl }) {
    const workbook = XLSX.read(await excelFile.arrayBuffer(), { type: 'array' });
    const source = await sourceRows(workbook);
    const current = catalog();
    const refs = read(SOURCES, {});
    const groups = new Map();
    if (source) {
        const combinations = new Map();
        for (const row of source.rows.filter(item => !item.split)) {
            const key = JSON.stringify([row.groupKey, row.dimensions.map(name => row.attributes[name])]);
            if (!combinations.has(key))
                combinations.set(key, []);
            combinations.get(key).push(row);
        }
        for (const collisions of combinations.values())
            if (new Set(collisions.map(row => row.sourceKey)).size > 1)
                for (const row of collisions) {
                    row.split = true;
                    row.groupKey = row.sourceKey;
                    row.dimensions = ['规格'];
                    row.attributes['规格'] = row.skuName || row.sourceKey;
                    row.warnings.push(issue('DUPLICATE_SPEC_COMBINATION', '不同来源 SKU 的规格组合重复，已分别保留为独立草稿。'));
                }
        const seenSourceKeys = new Set();
        for (const input of source.rows) {
            const ref = refs[input.sourceKey];
            const related = ref || (!input.split ? Object.values(refs).find(candidate => candidate.groupKey === input.groupKey) : undefined);
            const existing = related ? current.find(product => product.id === related.productId) : undefined;
            const key = existing ? existing.id : input.groupKey;
            if (!groups.has(key))
                groups.set(key, { key, productName: existing?.name || input.productName, productId: existing?.id || '', categoryId: existing?.categoryId || input.categoryId, dimensions: existing?.filterDimensions || input.dimensions, action: existing ? 'UPDATE' : input.split ? 'SPLIT' : 'CREATE', rows: [], issues: [], productData: existing ? clone(existing) : { id: `mock-import-${await stableKey(key)}`, name: input.productName, status: 'DRAFT', categoryId: input.categoryId, description: input.description || '', images: [], coverImageUrl: '', tags: [], inventory: 0, filterDimensions: input.dimensions, models: [], tierPricing: [] } });
            const group = groups.get(key);
            const original = existing?.models.find(model => model.id === ref?.skuId);
            const unchanged = (original && ref.fingerprint === input.fingerprint) || seenSourceKeys.has(input.sourceKey);
            seenSourceKeys.add(input.sourceKey);
            const model = unchanged && original ? clone(original) : { ...original, id: original?.id || crypto.randomUUID(), code: input.skuCode, name: input.skuName, unit: input.unit || original?.unit || '', spec: formatSpecPath(input.dimensions.map(name => input.attributes[name])), attributes: input.attributes, isActive: true, priceTiers: input.priceTiers || original?.priceTiers || [], basePrice: input.priceTiers ? input.priceTiers[0].unitPriceFen / 100 : original?.basePrice || 0 };
            const warnings = unchanged ? [] : input.warnings;
            group.rows.push({ rowId: crypto.randomUUID(), sourceSheet: input.sheet, sourceRow: input.row, skuCode: model.code, skuName: model.name, spec: model.spec, attributes: model.attributes, unit: model.unit || '', action: unchanged ? 'SKIP' : original ? 'UPDATE' : input.split ? 'SPLIT' : 'CREATE', issues: warnings, rawValues: input.values, modelId: model.id, modelData: model, sourceKey: input.sourceKey, sourceGroupKey: input.groupKey, fingerprint: input.fingerprint });
        }
    }
    else {
        const first = table(workbook, workbook.SheetNames[0]);
        first[0] = first[0].map(header => aliases[text(header)] || header);
        const rewritten = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(rewritten, XLSX.utils.aoa_to_sheet(first), 'Products');
        const parsed = await parseMockProductImport({ excelFile: new File([XLSX.write(rewritten, { type: 'array', bookType: 'xlsx' })], excelFile.name), imagesZipFile, imageBaseUrl });
        const headerMap = new Map(first[0].map((header, index) => [normalizeHeader(header), index]));
        const rawRows = first.slice(1).map((values, index) => ({ values, sourceRow: index + 2, rawValues: Object.fromEntries(first[0].map((key, col) => [key, text(values[col])])) }));
        const cell = (row, key) => text(row.values[headerMap.get(key)]);
        for (const product of parsed.products) {
            const existing = current.find(item => item.id === product.id);
            const modelRows = [];
            const belongs = row => cell(row, 'productid') === product.id || (!cell(row, 'productid') && (product.id === `mock-import-${cell(row, 'groupkey').toUpperCase().replace(/\s+/g, '-')}` || product.models.some(model => (cell(row, 'skuid') && model.id === cell(row, 'skuid')) || (cell(row, 'skucode') && model.code === cell(row, 'skucode')))));
            for (const raw of rawRows.filter(belongs)) {
                const rowSpec = [1, 2, 3].map(level => cell(raw, `spec${level}value`)).filter(Boolean);
                const model = product.models.find(item => (cell(raw, 'skuid') && item.id === cell(raw, 'skuid')) || (cell(raw, 'skucode') && item.code === cell(raw, 'skucode'))) || product.models.find(item => rowSpec.length ? item.spec === formatSpecPath(rowSpec) : item.spec === cell(raw, 'spec')) || product.models.find(item => item.name === (cell(raw, 'skuname') || product.name));
                if (!model && product.models.length)
                    continue;
                const oldModel = existing?.models.find(item => item.id === model?.id);
                if (model && oldModel) {
                    if (!cell(raw, 'unit'))
                        model.unit = oldModel.unit;
                    if (!cell(raw, 'pricetiers')) {
                        model.priceTiers = oldModel.priceTiers;
                        model.basePrice = oldModel.basePrice;
                    }
                }
                modelRows.push({ rowId: crypto.randomUUID(), sourceSheet: workbook.SheetNames[0], sourceRow: raw.sourceRow, skuCode: model?.code || '', skuName: model?.name || '', spec: model?.spec || '', attributes: model?.attributes || {}, unit: model?.unit || '', action: oldModel ? 'UPDATE' : 'CREATE', issues: [], rawValues: raw.rawValues, modelId: model?.id, modelData: model });
            }
            if (existing)
                for (const [field, header] of [['categoryId', 'categoryid'], ['description', 'description'], ['images', 'images'], ['coverImageUrl', 'coverimage'], ['tags', 'tags']]) {
                    if (!rawRows.filter(belongs).some(row => cell(row, header)))
                        product[field] = existing[field];
                }
            groups.set(product.id, { key: product.id, productName: product.name, productId: existing?.id || '', categoryId: product.categoryId, dimensions: product.filterDimensions, action: existing ? 'UPDATE' : 'CREATE', rows: modelRows, issues: [], productData: product });
        }
        for (const row of parsed.failedRows) {
            const key = `error:${row.groupKey}`;
            if (!groups.has(key))
                groups.set(key, { key, productName: row.productName, productId: row.productId, categoryId: row.categoryId, dimensions: row.filterDimensions || ['规格'], action: 'ERROR', rows: [], issues: [], productData: null });
            groups.get(key).rows.push({ rowId: crypto.randomUUID(), sourceSheet: workbook.SheetNames[0], sourceRow: row.rowNumber, skuCode: row.skuCode, skuName: row.skuName, spec: row.spec || '', attributes: row.attributes || {}, unit: row.unit || '', action: 'ERROR', issues: [issue('VALIDATION_ERROR', row.error, 'ERROR')], rawValues: row.rawValues });
        }
    }
    const id = `mock-product-${crypto.randomUUID()}`;
    const items = [...groups.values()];
    validateGroups(items);
    const summary = summarize(items);
    const preview = { jobId: id, revision: 1, sourceFormat: source?.format || 'STANDARD', summary, items };
    const job = { id, type: 'PRODUCT_IMPORT', status: 'AWAITING_CONFIRMATION', phase: 'AWAITING_CONFIRMATION', progress: 100, createdAt: new Date().toISOString(), fileName: excelFile.name, sourceFormat: preview.sourceFormat, revision: 1, summary };
    write(PREVIEWS, { ...read(PREVIEWS, {}), [id]: preview });
    saveMockProductImportJob(job);
    return job;
}
export function getMockImportPreview(jobId, { page = 1, pageSize = 20, needsReview = false } = {}) {
    const preview = read(PREVIEWS, {})[jobId];
    if (!preview)
        throw new Error('未找到预检数据。');
    const completed = completedImport(getMockProductImportJob(jobId));
    const pending = completed ? pendingReviewTargets(preview, read(REVIEWS, [])) : null;
    if (pending) preview.summary = { ...preview.summary, reviewCount: pending.count };
    const items = preview.items.filter(group => !needsReview || (pending
        ? pending.productIds.has(group.productId || group.productData?.id)
        : [...group.issues, ...group.rows.flatMap(row => row.issues)].some(item => item.severity === 'WARNING')));
    return { ...preview, items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}
export function resolveMockImportPreview(jobId, payload) {
    const all = read(PREVIEWS, {});
    const preview = all[jobId];
    const job = getMockProductImportJob(jobId);
    if (!preview || job?.status !== 'AWAITING_CONFIRMATION' || preview.revision !== payload.expectedRevision)
        throw new Error('预览已更新，请刷新后重试。');
    for (const patch of payload.groups) {
        const group = preview.items.find(item => item.key === patch.key);
        if (!group)
            throw new Error('商品分组不存在。');
        if (patch.productName !== undefined)
            group.productName = patch.productName;
        if (patch.categoryId !== undefined)
            group.categoryId = patch.categoryId === '00000000-0000-0000-0000-000000000000' ? '' : patch.categoryId;
        if (patch.dimensions)
            group.dimensions = patch.dimensions;
        if (group.categoryId)
            for (const row of group.rows)
                row.issues = row.issues.filter(item => item.code !== 'CATEGORY_UNMATCHED');
        for (const change of patch.rows || []) {
            const row = group.rows.find(item => item.rowId === change.rowId);
            if (!row)
                throw new Error('源数据行不存在。');
            if (change.unit !== undefined)
                row.unit = change.unit;
            if (change.attributes !== undefined)
                row.attributes = change.attributes;
            if (change.clearFields !== undefined)
                row.clearFields = change.clearFields;
            if (change.ignored !== undefined)
                row.action = change.ignored ? 'SKIP' : row.modelId && group.productId ? 'UPDATE' : 'CREATE';
            row.issues = row.issues.filter(item => !((item.code === 'UNIT_MISSING' && row.unit) || (item.code === 'CATEGORY_UNMATCHED' && group.categoryId)));
            if (change.groupKey && change.groupKey !== group.key) {
                let target = preview.items.find(item => item.key === change.groupKey);
                if (!target) {
                    target = { ...clone(group), key: change.groupKey, productId: '', action: 'CREATE', rows: [], productData: { ...clone(group.productData), id: `mock-import-${crypto.randomUUID()}`, models: [] } };
                    preview.items.push(target);
                }
                group.rows = group.rows.filter(item => item.rowId !== row.rowId);
                target.rows.push(row);
            }
        }
    }
    preview.items = preview.items.filter(group => group.rows.length);
    validateGroups(preview.items);
    preview.revision += 1;
    preview.summary = summarize(preview.items);
    write(PREVIEWS, all);
    const next = { ...job, revision: preview.revision, summary: preview.summary };
    saveMockProductImportJob(next);
    return next;
}
export function confirmMockImport(jobId, expectedRevision, idempotencyKey) {
    const job = getMockProductImportJob(jobId);
    if (job?.confirmKey === idempotencyKey && job.status === 'SUCCEEDED')
        return job;
    const preview = read(PREVIEWS, {})[jobId];
    if (!preview || job?.status !== 'AWAITING_CONFIRMATION' || preview.revision !== expectedRevision)
        throw new Error('预览版本已变化，请重新检查。');
    if (preview.summary.failedRows)
        throw new Error('存在阻断错误，请修正或跳过后重试。');
    const products = [];
    const refs = read(SOURCES, {});
    const reviews = read(REVIEWS, []);
    for (const group of preview.items) {
        const included = group.rows.filter(row => row.action !== 'SKIP');
        if (!included.length)
            continue;
        const product = clone(group.productData);
        if (!product)
            throw new Error('商品数据未通过校验。');
        product.name = group.productName;
        product.categoryId = group.categoryId;
        product.filterDimensions = group.dimensions;
        for (const row of included) {
            if (row.modelData) {
                const complete = group.dimensions.every(name => row.attributes[name]);
                const model = { ...row.modelData, unit: row.unit, attributes: row.attributes, spec: row.modelData.isActive !== false || complete ? formatSpecPath(group.dimensions.map(name => row.attributes[name] || '')) : row.modelData.spec };
                for (const field of row.clearFields || [])
                    if (['description', 'images', 'tags'].includes(field))
                        product[field] = field === 'description' ? '' : [];
                    else if (field === 'priceTiers') {
                        model.priceTiers = [];
                        model.basePrice = 0;
                    }
                    else if (field === 'unit')
                        model.unit = '';
                const index = product.models.findIndex(item => item.id === model.id);
                if (index < 0)
                    product.models.push(model);
                else
                    product.models[index] = model;
            }
            if (row.sourceKey)
                refs[row.sourceKey] = { productId: product.id, skuId: row.modelId, groupKey: row.sourceGroupKey, fingerprint: row.fingerprint };
            for (const warning of [...group.issues, ...row.issues].filter(item => item.severity === 'WARNING'))
                reviews.push({ id: crypto.randomUUID(), jobId, productId: product.id, skuId: row.modelId, productName: product.name, sourceSheet: row.sourceSheet, sourceRow: row.sourceRow, code: warning.code, message: warning.message, status: 'PENDING', rawValues: row.rawValues, createdAt: new Date().toISOString(), resolvedAt: null });
        }
        if (group.action === 'SPLIT' || reviews.some(review => review.productId === product.id && review.status === 'PENDING'))
            product.status = 'DRAFT';
        group.productId = product.id;
        products.push(product);
    }
    upsertImportedMockProducts(products);
    write(SOURCES, refs);
    write(REVIEWS, reviews);
    write(PREVIEWS, { ...read(PREVIEWS, {}), [jobId]: preview });
    const next = { ...job, status: 'SUCCEEDED', phase: 'COMPLETED', progress: 100, summary: preview.summary, confirmKey: idempotencyKey };
    saveMockProductImportJob(next);
    syncCompletedReviewCounts();
    return getMockProductImportJob(jobId);
}
export function cancelMockImport(jobId) { const job = getMockProductImportJob(jobId); if (job?.status !== 'AWAITING_CONFIRMATION')
    throw new Error('当前任务不能取消。'); const next = { ...job, status: 'CANCELLED', phase: 'CANCELLED' }; saveMockProductImportJob(next); return next; }
export function listMockImportReviews({ page = 1, pageSize = 20, status = 'PENDING', productId = '' } = {}) { const items = read(REVIEWS, []).filter(item => (!status || item.status === status) && (!productId || item.productId === productId)); return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize }; }
export function resolveMockImportReview(reviewId) { const reviews = read(REVIEWS, []); const item = reviews.find(review => review.id === reviewId); if (!item)
    throw new Error('复核项目不存在。'); item.status = 'RESOLVED'; item.resolvedAt = new Date().toISOString(); write(REVIEWS, reviews); syncCompletedReviewCounts(); return item; }
