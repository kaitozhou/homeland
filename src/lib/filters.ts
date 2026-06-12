import type {
  CatalogCommunityView,
  Community,
  CommunityCatalogRecord,
  Filters,
  XhsCalibrationRecord,
  XhsCommunityCalibration,
} from '../types/domain'

export const defaultFilters: Filters = {
  keyword: '',
  submarket: 'all',
  forms: [],
  buildingTypes: [],
  minPrice: 0,
  maxPrice: 70000,
  minYear: 2010,
  maxYear: 2026,
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function normalizeCommunityName(name: string): string {
  return name.replace(/[\s·.・•（）()\-—_]/g, '').replace(/２/g, '2')
}

function buildingTypeMatches(publicBuildingType: string | null, selectedType: string): boolean {
  if (!publicBuildingType) {
    return false
  }

  if (selectedType === '高层') {
    return /(^|[|,，、])高层(?:\(|$|[|,，、])/.test(publicBuildingType)
  }

  if (selectedType === '别墅') {
    return publicBuildingType.includes('别墅')
  }

  return publicBuildingType.includes(selectedType)
}

export function createCatalogCommunityViews(
  catalogCommunities: CommunityCatalogRecord[],
  mappedCommunities: Community[],
  xhsCalibration?: XhsCommunityCalibration,
): CatalogCommunityView[] {
  const mappedByName = new Map<string, Community>()
  const xhsById = new Map<string, XhsCalibrationRecord>()
  const excludedIds = new Set<string>()
  const excludedNames = new Set<string>()

  mappedCommunities.forEach((community) => {
    mappedByName.set(normalizeCommunityName(community.name), community)
  })

  xhsCalibration?.records.forEach((record) => {
    xhsById.set(record.communityId, record)
  })

  xhsCalibration?.excludedRecords?.forEach((record) => {
    excludedIds.add(record.communityId)
    excludedNames.add(normalizeCommunityName(record.communityName))
    record.aliases?.forEach((alias) => excludedNames.add(normalizeCommunityName(alias)))
  })

  return catalogCommunities.map((community) => {
    const mapped = mappedByName.get(normalizeCommunityName(community.name))
    const xhsRecord = xhsById.get(community.id)
    const xhsExcluded = excludedIds.has(community.id) || excludedNames.has(normalizeCommunityName(community.name))

    return {
      id: community.id,
      name: community.name,
      district: community.district,
      submarket: community.submarket || mapped?.marketName || '',
      address: community.address,
      propertyType: community.propertyType,
      publicBuildingType: community.publicBuildingType,
      buildingForm: community.buildingForm ?? mapped?.buildingForm ?? null,
      buildingFormStatus: community.buildingFormStatus,
      builtYear: community.builtYear ?? mapped?.builtYear ?? null,
      unitPrice: community.unitPrice ?? mapped?.unitPrice ?? null,
      priceUnit: community.priceUnit,
      priceType: community.priceType || mapped?.priceType || '',
      sellCount: community.sellCount,
      source: community.source,
      sourcePage: community.sourcePage,
      sourceName: community.sourceName,
      position: mapped?.position ?? null,
      detailSource: mapped?.detailSource ?? community.source,
      updatedAt: mapped?.updatedAt ?? '',
      xhsStatus: xhsExcluded ? 'excluded_pre_2010' : xhsRecord?.query.status ?? 'todo',
      xhsQueried: xhsExcluded || (xhsRecord?.query.queried ?? false),
      xhsNeedsReview: xhsRecord?.review?.needsHumanReview ?? xhsExcluded,
      xhsExcluded,
      xhsBuiltYear: xhsRecord?.calibration?.builtYear?.value ?? null,
      xhsUnitPriceRange: xhsRecord?.calibration?.unitPriceRange ?? null,
      xhsTransactionCases: xhsRecord?.calibration?.transactionCases ?? [],
      xhsJudgments: xhsRecord?.calibration?.judgments ?? [],
      xhsSourceNotes: xhsRecord?.calibration?.sourceNotes ?? [],
      xhsQueryKeywords: xhsRecord?.query.keywords ?? [],
      xhsQueriedAt: xhsRecord?.query.queriedAt ?? null,
      xhsRealCaseProcessed: (xhsRecord?.calibration?.transactionCases?.length ?? 0) > 0,
    }
  })
}

export function filterCommunities(communities: CatalogCommunityView[], filters: Filters): CatalogCommunityView[] {
  const priceFilterActive = filters.minPrice !== defaultFilters.minPrice || filters.maxPrice !== defaultFilters.maxPrice
  const yearFilterActive = filters.minYear !== defaultFilters.minYear || filters.maxYear !== defaultFilters.maxYear
  const keyword = filters.keyword.trim().toLocaleLowerCase('zh-CN')

  return communities.filter((community) => {
    const searchable = `${community.name} ${community.submarket} ${community.address} ${community.publicBuildingType ?? ''}`.toLocaleLowerCase('zh-CN')
    const effectiveBuiltYear = community.xhsBuiltYear ?? community.builtYear
    const keywordMatched = keyword.length === 0 || searchable.includes(keyword)
    const submarketMatched = filters.submarket === 'all' || community.submarket === filters.submarket
    const systemYearMatched =
      !community.xhsExcluded && (effectiveBuiltYear === null || effectiveBuiltYear >= defaultFilters.minYear)
    const formMatched =
      filters.forms.length === 0 || (community.buildingForm !== null && filters.forms.includes(community.buildingForm))
    const buildingTypeMatched =
      filters.buildingTypes.length === 0 ||
      filters.buildingTypes.some((buildingType) => buildingTypeMatches(community.publicBuildingType, buildingType))
    const priceMatched =
      !priceFilterActive ||
      (community.unitPrice !== null && community.unitPrice >= filters.minPrice && community.unitPrice <= filters.maxPrice)
    const yearMatched =
      !yearFilterActive ||
      (effectiveBuiltYear !== null && effectiveBuiltYear >= filters.minYear && effectiveBuiltYear <= filters.maxYear)

    return systemYearMatched && keywordMatched && submarketMatched && formMatched && buildingTypeMatched && priceMatched && yearMatched
  })
}

export function getSubmarketOptions(communities: CatalogCommunityView[]): string[] {
  const submarketCounts = new Map<string, number>()

  communities.forEach((community) => {
    if (community.submarket) {
      submarketCounts.set(community.submarket, (submarketCounts.get(community.submarket) ?? 0) + 1)
    }
  })

  return Array.from(submarketCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN'))
    .slice(0, 18)
    .map(([submarket]) => submarket)
}

export function getBuildingTypeOptions(communities: CatalogCommunityView[]): string[] {
  const preferredTypes = ['板塔结合', '板楼', '塔楼', '多层', '小高层', '高层', '别墅']

  return preferredTypes.filter((buildingType) => {
    return communities.some((community) => buildingTypeMatches(community.publicBuildingType, buildingType))
  })
}

export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.keyword !== defaultFilters.keyword ||
    filters.submarket !== defaultFilters.submarket ||
    filters.forms.length > 0 ||
    filters.buildingTypes.length > 0 ||
    filters.minPrice !== defaultFilters.minPrice ||
    filters.maxPrice !== defaultFilters.maxPrice ||
    filters.minYear !== defaultFilters.minYear ||
    filters.maxYear !== defaultFilters.maxYear
  )
}
