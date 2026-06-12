import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const baseUrl = 'https://nanjing.esf.fang.com'
const firstPagePath = '/housing/267___3_0%2C3%2C2%2C4%2C1%2C2%2C4%2C0_0%2C2.5%2C4.5%2C1_1_0_0_0/'
const pagedPath = (page) => `/housing/267__0_3_0,3,2,4,1,2,4,0_0,2.5,4.5,1_${page}_0_0_0/`
const outputJsonPath = path.join(root, 'public/data/jianye-communities-catalog.json')
const outputCsvPath = path.join(root, 'public/data/jianye-communities-catalog.csv')
const outputRawJsonPath = path.join(root, 'public/data/jianye-raw-catalog.json')
const xhsCalibrationPath = path.join(root, 'public/data/xhs-nanjing-community-calibration.json')
const gotohuiBaseUrl = 'https://m.gotohui.com'
const gotohuiDetailConcurrency = 6
const minimumIncludedBuiltYear = 2010
const unknownBuildingFormStatus = '公开源未提供洋房/小高层/高层等住宅形态，标记为待补充'

function stripTags(value) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeName(value) {
  return value
    .replace(/[·•\s()（）\-—_]/g, '')
    .replace(/小区$/, '')
    .trim()
}

function normalizeSubmarketText(value) {
  return stripTags(value ?? '')
    .replace(/^南京市/, '')
    .replace(/^建邺区?/, '')
    .replace(/^建邺/, '')
    .split(/[，,、；;]/)[0]
    .trim()
}

function deriveSubmarket(address) {
  const text = normalizeSubmarketText(address)

  if (!text) {
    return null
  }

  const rules = [
    ['江心洲', /江心洲|环洲|葡园/],
    ['河西南部', /河西南|鱼嘴|平良大街|高庙路|保双街|友谊街|吴侯街|龙王大街|邺城路|新梗街|新河路|元前路|双闸/],
    ['奥体', /奥体|梦都大街|乐山路|月安街|庐山路|恒山路|嘉陵江|新安江|嵩山路|燕山路|苍山路|丹桂|奥南/],
    ['河西中部', /河西中部|河西大街|江东中路|江东南路|万达|中央商务区|云龙山路|集庆门|黄山路/],
    ['南湖', /南湖|湖西街|文体路|育英街/],
    ['水西门', /水西门|茶亭|茶南|福园街|汉中门|北圩|长虹路|莫愁湖|巴山路/],
    ['应天西路', /应天西路|应天大街/],
    ['兴隆', /兴隆大街|兴隆/],
    ['南苑', /南苑|怡康街/],
    ['沙洲', /沙洲|科技园|莲池路|青石埂路/],
  ]

  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? null
}

function normalizeListSubmarket(submarket, address) {
  return deriveSubmarket([submarket, address].filter(Boolean).join(' '))
    ?? normalizeSubmarketText(submarket)
    ?? null
}

function getSubmarketSource(submarket) {
  return submarket ? '公开地址归并板块' : null
}

function inferBuildingForm(text) {
  const forms = ['洋房', '小高层', '高层'].filter((form) => text.includes(form))

  if (forms.length > 1) {
    return '混合'
  }

  return forms[0] ?? null
}

function getMatch(input, pattern) {
  return input.match(pattern)?.[1]?.trim() ?? ''
}

function normalizeOptional(value) {
  const normalized = stripTags(value ?? '')
  return normalized || null
}

function parsePositiveInteger(value) {
  const parsed = Number(String(value ?? '').replaceAll(',', '').match(/\d+/)?.[0] ?? NaN)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseBuiltYear(value) {
  const parsed = Number(String(value ?? '').match(/\d{4}/)?.[0] ?? NaN)
  return Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2026 ? parsed : null
}

function normalizeDetailLabel(value) {
  return stripTags(value)
    .replace(/[：:\s]/g, '')
}

function normalizeAbsoluteUrl(url) {
  if (url.startsWith('http')) {
    return url
  }

  return `${baseUrl}${url}`
}

function parseLastPage(html) {
  const match = html.match(/\/housing\/267__0_3_0,3,2,4,1,2,4,0_0,2\.5,4\.5,1_(\d+)_0_0_0\/">末页/)
  return match ? Number(match[1]) : 1
}

function parsePage(html, page) {
  return html
    .split(/<div id="houselist_B09_\d+"/)
    .slice(1)
    .map((segment) => {
      const id = getMatch(segment, /data-bgcomare='\{"newcode":"([^"]+)"\}'/)
      const detailPath = getMatch(segment, /<a href="([^"]+)" target="_blank" class="plotTit">/)
      const name = stripTags(getMatch(segment, /class="plotTit">([^<]+)<\/a>/))
      const propertyType = stripTags(getMatch(segment, /class="plotFangType">([^<]+)<\/span>/))
      const rawSubmarket = stripTags(getMatch(segment, /<a target="_blank" href="\/house-a0267-b[^"]+\/">([^<]+)<\/a>/))
      const builtYearText = getMatch(segment, /(\d{4})年建成/)
      const unitPriceText = getMatch(segment, /<p class="priceAverage"><span>\s*([\d,]+)\s*<\/span>/)
      const sellCountText = getMatch(segment, /\/chushou\/" target="_blank">\s*(\d+)\s*<\/a>套在售/)
      const addressLine = stripTags(getMatch(segment, /<p><a target="_blank" href="\/house-a0267\/">建邺<\/a>-[\s\S]*?<\/a>\s*([^<]+)<\/p>/))
      const submarket = normalizeListSubmarket(rawSubmarket, addressLine)

      if (!id || !name) {
        return null
      }

      return {
        id,
        name,
        district: '建邺',
        submarket,
        submarketSource: getSubmarketSource(submarket),
        address: addressLine || null,
        propertyType,
        buildingForm: null,
        publicBuildingType: null,
        buildingFormStatus: unknownBuildingFormStatus,
        buildingFormSource: null,
        builtYear: builtYearText ? Number(builtYearText) : null,
        builtYearSource: builtYearText ? '房天下建邺小区列表' : null,
        unitPrice: unitPriceText ? Number(unitPriceText.replaceAll(',', '')) : null,
        priceUnit: '元/㎡',
        priceType: unitPriceText ? '房天下小区参考均价' : '暂无公开均价',
        unitPriceSource: unitPriceText ? '房天下建邺小区列表' : null,
        sellCount: sellCountText ? Number(sellCountText) : 0,
        source: normalizeAbsoluteUrl(detailPath || `/loupan/${id}.htm`),
        sourcePage: `${baseUrl}${page === 1 ? firstPagePath : pagedPath(page)}`,
        sourceName: '房天下建邺小区列表',
      }
    })
    .filter(Boolean)
}

function parseGotohuiPage(html, page) {
  return [...html.matchAll(/<td><input type="checkbox" value="(\d+)" name="tid\[\]"><\/td>\s*<td><a href="https:\/\/m\.gotohui\.com\/xiaoqu\/\d+">([^<]+)<\/a><\/td>\s*<td>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/g)]
    .map((match) => {
      const [, id, rawName, rawPrice, ratio] = match
      const name = stripTags(rawName)
      const parsedPrice = Number(rawPrice.replaceAll(',', ''))
      const unitPrice = Number.isFinite(parsedPrice) ? parsedPrice : null

      return {
        id: `gotohui-${id}`,
        name,
        district: '建邺',
        submarket: null,
        submarketSource: null,
        address: null,
        propertyType: '小区',
        buildingForm: null,
        publicBuildingType: null,
        buildingFormStatus: unknownBuildingFormStatus,
        buildingFormSource: null,
        builtYear: null,
        builtYearSource: null,
        unitPrice,
        priceUnit: '元/㎡',
        priceType: unitPrice ? '聚汇数据小区参考均价' : '暂无公开均价',
        unitPriceSource: unitPrice ? '聚汇数据建邺区小区房价列表' : null,
        sellCount: 0,
        source: `${gotohuiBaseUrl}/xiaoqu/${id}`,
        sourcePage: page === 1 ? `${gotohuiBaseUrl}/house/1957` : `${gotohuiBaseUrl}/house/1957/${page}.html`,
        sourceName: '聚汇数据建邺区小区房价列表',
        detailStatus: '待抓取',
        ratio: stripTags(ratio),
      }
    })
}

function parseGotohuiDetail(html) {
  const fields = new Map()

  for (const match of html.matchAll(/<li[^>]*>\s*<span>([\s\S]*?)<\/span>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/g)) {
    fields.set(normalizeDetailLabel(match[1]), stripTags(match[2]))
  }

  const builtYear = parseBuiltYear(fields.get('建筑年代'))
  const propertyType = normalizeOptional(fields.get('物业类型'))
  const publicBuildingType = normalizeOptional(fields.get('建筑类型'))
  const address = normalizeOptional(fields.get('物业地址'))
  const unitPrice = parsePositiveInteger(getMatch(html, /挂牌均价：\s*<em>\s*([\d,]+)\s*元\/㎡\s*<\/em>/))
  const buildingFormFromType = inferBuildingForm(publicBuildingType ?? '')
  const buildingFormFromPropertyType = inferBuildingForm(propertyType ?? '')
  const buildingForm = buildingFormFromType ?? buildingFormFromPropertyType
  const submarket = deriveSubmarket(address)

  return {
    address,
    submarket,
    submarketSource: getSubmarketSource(submarket),
    propertyType: propertyType || '小区',
    publicBuildingType,
    buildingForm,
    buildingFormStatus: buildingForm ? '公开详情页明确提供住宅形态字段' : unknownBuildingFormStatus,
    buildingFormSource: buildingForm
      ? buildingFormFromType ? '聚汇数据小区详情页建筑类型' : '聚汇数据小区详情页物业类型'
      : null,
    builtYear,
    builtYearSource: builtYear ? '聚汇数据小区详情页建筑年代' : null,
    unitPrice,
    unitPriceSource: unitPrice ? '聚汇数据小区详情页挂牌均价' : null,
  }
}

async function enrichGotohuiRecords(records) {
  const enriched = []

  for (let index = 0; index < records.length; index += gotohuiDetailConcurrency) {
    const batch = records.slice(index, index + gotohuiDetailConcurrency)
    const results = await Promise.all(batch.map(async (record) => {
      try {
        const html = await fetchHtml(record.source)
        const detail = parseGotohuiDetail(html)

        return {
          ...record,
          ...detail,
          builtYear: detail.builtYear ?? record.builtYear,
          builtYearSource: detail.builtYearSource ?? record.builtYearSource,
          address: detail.address || record.address,
          submarket: detail.submarket || record.submarket,
          submarketSource: detail.submarketSource ?? record.submarketSource,
          unitPrice: detail.unitPrice ?? record.unitPrice,
          unitPriceSource: detail.unitPriceSource ?? record.unitPriceSource,
          priceType: detail.unitPrice ? '聚汇数据小区详情页挂牌均价' : record.priceType,
          sourceName: `${record.sourceName} + 聚汇数据小区详情页`,
          detailStatus: '已抓取',
        }
      } catch (error) {
        return {
          ...record,
          detailStatus: `抓取失败：${error.message}`,
        }
      }
    }))

    enriched.push(...results)
  }

  return enriched
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'accept-encoding': 'gzip, deflate, br',
      'user-agent': 'Mozilla/5.0 community-catalog-check',
    },
  })

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`)
  }

  return response.text()
}

function toCsv(records) {
  const headers = ['id', 'name', 'district', 'submarket', 'submarketSource', 'address', 'propertyType', 'publicBuildingType', 'buildingForm', 'buildingFormStatus', 'buildingFormSource', 'builtYear', 'builtYearSource', 'unitPrice', 'unitPriceSource', 'priceType', 'sellCount', 'source', 'sourceName', 'detailStatus']
  const rows = records.map((record) => headers.map((header) => {
    const value = record[header] ?? ''
    return `"${String(value).replaceAll('"', '""')}"`
  }).join(','))
  return `${headers.join(',')}\n${rows.join('\n')}\n`
}

function getFieldCoverage(records) {
  return {
    submarket: records.filter((record) => record.submarket).length,
    builtYear: records.filter((record) => record.builtYear).length,
    buildingForm: records.filter((record) => record.buildingForm).length,
    unitPrice: records.filter((record) => record.unitPrice).length,
  }
}

function isIncludedByBuiltYear(record) {
  return record.builtYear === null || record.builtYear >= minimumIncludedBuiltYear
}

async function loadXhsExclusions() {
  try {
    const content = await fs.readFile(xhsCalibrationPath, 'utf8')
    const calibration = JSON.parse(content)
    const excludedRecords = Array.isArray(calibration.excludedRecords) ? calibration.excludedRecords : []
    const ids = new Set()
    const names = new Set()

    excludedRecords.forEach((record) => {
      if (record.communityId) {
        ids.add(record.communityId)
      }

      if (record.communityName) {
        names.add(normalizeName(record.communityName))
      }

      if (Array.isArray(record.aliases)) {
        record.aliases.forEach((alias) => names.add(normalizeName(alias)))
      }
    })

    return { ids, names }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { ids: new Set(), names: new Set() }
    }

    throw error
  }
}

function isIncludedByXhsExclusion(record, xhsExclusions) {
  return !xhsExclusions.ids.has(record.id) && !xhsExclusions.names.has(normalizeName(record.name))
}

const xhsExclusions = await loadXhsExclusions()
const firstHtml = await fetchHtml(`${baseUrl}${firstPagePath}`)
const lastPage = parseLastPage(firstHtml)
const records = []
records.push(...parsePage(firstHtml, 1))

for (let page = 2; page <= lastPage; page += 1) {
  const html = await fetchHtml(`${baseUrl}${pagedPath(page)}`)
  records.push(...parsePage(html, page))
}

const deduped = Array.from(new Map(records.map((record) => [record.id, record])).values())
  .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
const gotohuiRecords = []

for (let page = 1; page <= 80; page += 1) {
  const url = page === 1 ? `${gotohuiBaseUrl}/house/1957` : `${gotohuiBaseUrl}/house/1957/${page}.html`
  const html = await fetchHtml(url)
  const parsed = parseGotohuiPage(html, page)

  if (parsed.length === 0) {
    break
  }

  gotohuiRecords.push(...parsed)
}

const enrichedGotohuiRecords = await enrichGotohuiRecords(gotohuiRecords)
const mergedByName = new Map()

for (const record of enrichedGotohuiRecords) {
  mergedByName.set(normalizeName(record.name), record)
}

for (const record of deduped) {
  const key = normalizeName(record.name)
  const existing = mergedByName.get(key)

  mergedByName.set(key, {
    ...(existing ?? {}),
    ...record,
    unitPrice: record.unitPrice ?? existing?.unitPrice ?? null,
    unitPriceSource: record.unitPriceSource ?? existing?.unitPriceSource ?? null,
    priceType: record.unitPrice ? record.priceType : existing?.priceType ?? record.priceType,
    submarket: record.submarket || existing?.submarket || null,
    submarketSource: record.submarketSource ?? existing?.submarketSource ?? null,
    builtYear: record.builtYear ?? existing?.builtYear ?? null,
    builtYearSource: record.builtYearSource ?? existing?.builtYearSource ?? null,
    buildingForm: record.buildingForm ?? existing?.buildingForm ?? null,
    buildingFormSource: record.buildingFormSource ?? existing?.buildingFormSource ?? null,
    buildingFormStatus: record.buildingForm ?? existing?.buildingForm
      ? record.buildingFormStatus ?? existing?.buildingFormStatus
      : unknownBuildingFormStatus,
    publicBuildingType: record.publicBuildingType ?? existing?.publicBuildingType ?? null,
    gotohuiSource: existing?.source,
    sourceName: existing ? `${record.sourceName} + ${existing.sourceName}` : record.sourceName,
  })
}

const mergedCommunityCatalog = Array.from(mergedByName.values())
  .filter(isIncludedByBuiltYear)
  .filter((record) => isIncludedByXhsExclusion(record, xhsExclusions))
  .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))

const catalog = {
  metadata: {
    district: '南京市建邺区',
    generatedAt: new Date().toISOString(),
    source: '聚汇数据建邺区小区房价列表 + 房天下建邺小区列表',
    sourceUrl: `${baseUrl}${firstPagePath}`,
    lastPage,
    total: mergedCommunityCatalog.length,
    rawTotal: deduped.length,
    gotohuiTotal: enrichedGotohuiRecords.length,
    gotohuiDetailFetched: enrichedGotohuiRecords.filter((record) => record.detailStatus === '已抓取').length,
    xhsExcludedTotal: xhsExclusions.ids.size,
    fangCatalogTotal: deduped.length,
    fieldCoverage: getFieldCoverage(mergedCommunityCatalog),
    catalogDefinition: '住宅=小区；已知建成年代早于2010年的小区从候选目录剔除，建成年代缺失的小区保留待补充。',
    includedPropertyTypes: Array.from(new Set(mergedCommunityCatalog.map((record) => record.propertyType).filter(Boolean))).sort(),
    excludedPropertyTypes: [],
    caveats: [
      '链家/贝壳列表页返回 CAPTCHA，本脚本不绕过验证码。',
      '高德 Web 服务接口需要 Web 服务 Key；当前 JS API Key 不能调用，返回 USERKEY_PLAT_NOMATCH。',
      '房天下后续分页可能跳转检查页，脚本保留可公开抓取部分，并合并聚汇数据公开分页。',
      '按用户确认口径：住宅=小区；聚汇数据小区目录整体纳入候选，不按物业类型剔除。',
      '已知建成年代早于2010年的小区已剔除；建成年代缺失的小区保留待补充，不推断年代。',
      '公开列表/详情页未稳定提供洋房/小高层/高层字段，本目录不做无依据推断；缺失时 buildingForm=null 且标记待补充。',
      'submarket 是弱化后的粗粒度片区标签，由公开板块或公开物业地址归并生成；原始地址保留在 address 字段。',
    ],
  },
  communities: mergedCommunityCatalog,
}

const rawCatalog = {
  metadata: {
    ...catalog.metadata,
    total: deduped.length,
    fieldCoverage: getFieldCoverage(deduped),
    sourcePurpose: '原始抓取快照，包含房天下可公开抓取的小区列表项。',
  },
  communities: deduped,
}

await fs.writeFile(outputRawJsonPath, `${JSON.stringify(rawCatalog, null, 2)}\n`, 'utf8')
await fs.writeFile(outputJsonPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
await fs.writeFile(outputCsvPath, toCsv(mergedCommunityCatalog), 'utf8')

console.log(`Collected ${mergedCommunityCatalog.length} Jianye community candidates; Gotohui: ${enrichedGotohuiRecords.length}; Gotohui details: ${catalog.metadata.gotohuiDetailFetched}; Fang catalog: ${deduped.length}.`)
