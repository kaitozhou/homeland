import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const datasetPath = path.join(root, 'public/data/jianye-real-estate.json')
const reportPath = path.join(root, 'public/data/data-quality-report.json')
const catalogPath = path.join(root, 'public/data/jianye-communities-catalog.json')
const xhsResearchPath = path.join(root, 'public/data/xhs-nanjing-community-calibration.json')
const allowedForms = new Set(['洋房', '小高层', '高层', '混合'])
const minimumIncludedBuiltYear = 2010
const validXhsStatuses = new Set(['todo', 'hit', 'no_hit', 'risk_blocked', 'partial'])
const validExcludedXhsStatuses = new Set(['excluded_pre_2010'])

function isLngLat(value) {
  return Array.isArray(value)
    && value.length === 2
    && Number.isFinite(value[0])
    && Number.isFinite(value[1])
    && value[0] >= 118
    && value[0] <= 119
    && value[1] >= 31
    && value[1] <= 33
}

function requireField(record, field, context, errors) {
  if (record[field] === undefined || record[field] === null || record[field] === '') {
    errors.push(`${context}: missing ${field}`)
  }
}

function requireKey(record, field, context, errors) {
  if (!Object.prototype.hasOwnProperty.call(record, field)) {
    errors.push(`${context}: missing key ${field}`)
  }
}

function normalizeName(name) {
  return String(name ?? '').replace(/[\s·.・•（）()\-—_]/g, '').replace(/２/g, '2')
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8')
  return JSON.parse(content)
}

const errors = []
const dataset = await readJson(datasetPath)
const report = await readJson(reportPath)
const catalog = await readJson(catalogPath)
const xhsResearch = await readJson(xhsResearchPath)

if (!Array.isArray(dataset.blocks) || dataset.blocks.length === 0) {
  errors.push('blocks must not be empty')
}

if (!Array.isArray(dataset.communities) || dataset.communities.length === 0) {
  errors.push('communities must not be empty')
}

const blockIds = new Set(dataset.blocks.map((block) => block.id))

dataset.blocks.forEach((block) => {
  const context = `block ${block.id ?? '(unknown)'}`
  ;['id', 'name', 'marketName', 'avgPrice'].forEach((field) => requireField(block, field, context, errors))

  if (!isLngLat(block.center)) {
    errors.push(`${context}: center must be a valid Nanjing lng/lat`)
  }

  if (!Array.isArray(block.polygon) || block.polygon.length < 4 || !block.polygon.every(isLngLat)) {
    errors.push(`${context}: polygon must have valid lng/lat points`)
  }
})

dataset.communities.forEach((community) => {
  const context = `community ${community.id ?? '(unknown)'}`
  ;['id', 'name', 'blockId', 'marketName', 'buildingForm', 'builtYear', 'unitPrice', 'priceType', 'source', 'detailSource', 'updatedAt'].forEach((field) => {
    requireField(community, field, context, errors)
  })

  if (!blockIds.has(community.blockId)) {
    errors.push(`${context}: blockId does not exist`)
  }

  if (!isLngLat(community.position)) {
    errors.push(`${context}: position must be a valid Nanjing lng/lat`)
  }

  if (!allowedForms.has(community.buildingForm)) {
    errors.push(`${context}: buildingForm must be one of ${Array.from(allowedForms).join(', ')}`)
  }

  if (!Number.isInteger(community.builtYear) || community.builtYear < 1900 || community.builtYear > 2026) {
    errors.push(`${context}: builtYear is outside allowed range`)
  }

  if (community.builtYear < minimumIncludedBuiltYear) {
    errors.push(`${context}: builtYear must be ${minimumIncludedBuiltYear} or later`)
  }

  if (!Number.isFinite(community.unitPrice) || community.unitPrice <= 0) {
    errors.push(`${context}: unitPrice must be positive`)
  }

  if (!String(community.source).startsWith('https://') || !String(community.detailSource).startsWith('https://')) {
    errors.push(`${context}: source URLs must be https`)
  }
})

if (!Array.isArray(report.excludedCommunities)) {
  errors.push('quality report must include excludedCommunities')
}

if (!Array.isArray(catalog.communities) || catalog.communities.length < 200) {
  errors.push('community catalog must include at least 200 Jianye community candidates after built-year pruning')
}

if (catalog.metadata?.catalogDefinition !== '住宅=小区；已知建成年代早于2010年的小区从候选目录剔除，建成年代缺失的小区保留待补充。') {
  errors.push('community catalog metadata must state the current definition and 2010 built-year floor')
}

if (catalog.metadata?.total !== catalog.communities?.length) {
  errors.push('community catalog metadata.total must match communities length')
}

catalog.communities.forEach((community) => {
  const context = `catalog community ${community.id ?? '(unknown)'}`
  ;['id', 'name', 'district', 'priceType', 'source', 'sourceName'].forEach((field) => {
    requireField(community, field, context, errors)
  })

  ;['submarket', 'builtYear', 'buildingForm', 'unitPrice'].forEach((field) => {
    requireKey(community, field, context, errors)
  })

  if (community.submarket !== null && community.submarket !== undefined && typeof community.submarket !== 'string') {
    errors.push(`${context}: submarket must be a string or null`)
  }

  if (community.builtYear !== null && community.builtYear !== undefined && (!Number.isInteger(community.builtYear) || community.builtYear < 1900 || community.builtYear > 2026)) {
    errors.push(`${context}: builtYear must be an integer year or null`)
  }

  if (community.builtYear !== null && community.builtYear !== undefined && community.builtYear < minimumIncludedBuiltYear) {
    errors.push(`${context}: builtYear must be ${minimumIncludedBuiltYear} or later`)
  }

  if (community.buildingForm !== null && community.buildingForm !== undefined && !allowedForms.has(community.buildingForm)) {
    errors.push(`${context}: buildingForm must be one of ${Array.from(allowedForms).join(', ')} or null`)
  }

  if ((community.buildingForm === null || community.buildingForm === undefined) && !String(community.buildingFormStatus ?? '').includes('待补充')) {
    errors.push(`${context}: null buildingForm must be marked 待补充`)
  }

  if (community.unitPrice !== null && community.unitPrice !== undefined && !Number.isFinite(community.unitPrice)) {
    errors.push(`${context}: unitPrice must be finite or null`)
  }

  if (community.unitPrice !== null && community.unitPrice !== undefined && community.unitPrice <= 0) {
    errors.push(`${context}: unitPrice must be positive or null`)
  }

  if (!String(community.source).startsWith('https://')) {
    errors.push(`${context}: source URL must be https`)
  }
})

if (xhsResearch.metadata?.minimumIncludedBuiltYear !== minimumIncludedBuiltYear) {
  errors.push('xhs research metadata must match the 2010 built-year floor')
}

const excludedXhsRecords = Array.isArray(xhsResearch.excludedRecords) ? xhsResearch.excludedRecords : []
const excludedXhsIds = new Set(excludedXhsRecords.map((community) => community.communityId))
const excludedXhsNames = new Set()

excludedXhsRecords.forEach((community) => {
  excludedXhsNames.add(normalizeName(community.communityName))
  if (Array.isArray(community.aliases)) {
    community.aliases.forEach((alias) => excludedXhsNames.add(normalizeName(alias)))
  }
})

if (xhsResearch.excludedRecords !== undefined && !Array.isArray(xhsResearch.excludedRecords)) {
  errors.push('xhs research excludedRecords must be an array when present')
}

catalog.communities.forEach((community) => {
  if (excludedXhsIds.has(community.id) || excludedXhsNames.has(normalizeName(community.name))) {
    errors.push(`catalog community ${community.id}: present in active catalog but excluded by xhs research`)
  }
})

excludedXhsRecords.forEach((community) => {
  const context = `xhs excluded community ${community.communityId ?? '(unknown)'}`

  ;['communityId', 'communityName', 'query', 'calibration'].forEach((field) => {
    requireKey(community, field, context, errors)
  })

  if (!validExcludedXhsStatuses.has(community.query?.status)) {
    errors.push(`${context}: query.status must be excluded_pre_2010`)
  }

  if (community.query?.queried !== true) {
    errors.push(`${context}: query.queried must be true`)
  }

  const builtYear = community.calibration?.builtYear?.value
  if (!Number.isInteger(builtYear) || builtYear >= minimumIncludedBuiltYear) {
    errors.push(`${context}: calibration.builtYear.value must be before ${minimumIncludedBuiltYear}`)
  }

  if (!Array.isArray(community.calibration?.sourceNotes) || community.calibration.sourceNotes.length === 0) {
    errors.push(`${context}: excluded records must include Xiaohongshu source notes`)
  }
})

if (!Array.isArray(xhsResearch.records)) {
  errors.push('xhs research must include records array')
} else {
  const catalogIds = new Set(catalog.communities.map((community) => community.id))
  const researchIds = new Set(xhsResearch.records.map((community) => community.communityId))

  catalogIds.forEach((id) => {
    if (!researchIds.has(id)) {
      errors.push(`xhs research missing catalog community ${id}`)
    }
  })

  xhsResearch.records.forEach((community) => {
    const context = `xhs research community ${community.communityId ?? '(unknown)'}`

    ;['communityId', 'communityName', 'query'].forEach((field) => {
      requireKey(community, field, context, errors)
    })

    if (!catalogIds.has(community.communityId)) {
      errors.push(`${context}: not present in current catalog`)
    }

    if (!validXhsStatuses.has(community.query?.status)) {
      errors.push(`${context}: xhsQueryStatus must be one of ${Array.from(validXhsStatuses).join(', ')}`)
    }

    if (typeof community.query?.queried !== 'boolean') {
      errors.push(`${context}: query.queried must be boolean`)
    }

    if ((community.query?.status === 'todo') !== (community.query?.queried === false)) {
      errors.push(`${context}: query.queried must match query.status`)
    }

    if (['hit', 'no_hit', 'risk_blocked', 'partial'].includes(community.query?.status) && !Array.isArray(community.query?.attempts)) {
      errors.push(`${context}: queried records must keep query attempts`)
    }

    if (community.query?.status === 'hit' && (!Array.isArray(community.calibration?.sourceNotes) || community.calibration.sourceNotes.length === 0)) {
      errors.push(`${context}: hit records must include Xiaohongshu source notes`)
    }
  })
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Data validation passed: ${dataset.blocks.length} blocks, ${dataset.communities.length} mapped communities, ${dataset.pois.length} POIs, ${catalog.communities.length} catalog communities.`)
