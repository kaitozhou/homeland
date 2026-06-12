export type LngLat = [number, number]

export type PoiType = 'commercial' | 'hospital' | 'park' | 'civic'

export type BuildingForm = '洋房' | '小高层' | '高层' | '混合'

export interface DataSource {
  name: string
  url: string
}

export interface DatasetMetadata {
  district: string
  updatedAt: string
  priceUnit: string
  coordinateSystem: string
  notes: string[]
  sources: DataSource[]
}

export interface Block {
  id: string
  name: string
  marketName: string
  center: LngLat
  polygon: LngLat[]
  communityCount: number
  avgPrice: number
}

export interface Poi {
  id: string
  name: string
  type: PoiType
  blockId: string
  position: LngLat
  source: string
}

export interface Community {
  id: string
  name: string
  blockId: string
  marketName: string
  position: LngLat
  buildingForm: BuildingForm
  builtYear: number
  unitPrice: number
  priceType: string
  source: string
  detailSource: string
  updatedAt: string
}

export interface JianyeDataset {
  metadata: DatasetMetadata
  blocks: Block[]
  pois: Poi[]
  communities: Community[]
}

export interface QualityReport {
  updatedAt: string
  rule: string
  blockedSources: Array<{
    name: string
    reason: string
    impact: string
  }>
  excludedCommunities: Array<{
    name: string
    missing: string[]
    candidateSource: string
  }>
}

export interface CommunityCatalogRecord {
  id: string
  name: string
  district: string
  submarket: string
  submarketSource?: string | null
  address: string
  propertyType: string
  publicBuildingType: string | null
  buildingForm: BuildingForm | null
  buildingFormStatus: string
  buildingFormSource?: string | null
  builtYear: number | null
  builtYearSource?: string | null
  unitPrice: number | null
  unitPriceSource?: string | null
  priceUnit: string
  priceType: string
  sellCount: number
  source: string
  sourcePage: string
  sourceName: string
  detailStatus?: string
}

export interface CatalogCommunityView {
  id: string
  name: string
  district: string
  submarket: string
  address: string
  propertyType: string
  publicBuildingType: string | null
  buildingForm: BuildingForm | null
  buildingFormStatus: string
  builtYear: number | null
  unitPrice: number | null
  priceUnit: string
  priceType: string
  sellCount: number
  source: string
  sourcePage: string
  sourceName: string
  position: LngLat | null
  detailSource: string
  updatedAt: string
  xhsStatus: XhsQueryStatus
  xhsQueried: boolean
  xhsNeedsReview: boolean
  xhsExcluded: boolean
  xhsBuiltYear: number | null
  xhsUnitPriceRange: XhsUnitPriceRange | null
  xhsTransactionCases: XhsTransactionCase[]
  xhsJudgments: string[]
  xhsSourceNotes: XhsSourceNote[]
  xhsQueryKeywords: string[]
  xhsQueriedAt: string | null
  xhsRealCaseProcessed: boolean
}

export interface CommunityCatalog {
  metadata: {
    district: string
    generatedAt: string
    source: string
    sourceUrl: string
    lastPage: number
    total: number
    rawTotal: number
    gotohuiTotal: number
    gotohuiDetailFetched?: number
    fangCatalogTotal: number
    fieldCoverage?: {
      submarket: number
      builtYear: number
      buildingForm: number
      unitPrice: number
    }
    catalogDefinition: string
    includedPropertyTypes: string[]
    excludedPropertyTypes: string[]
    caveats: string[]
  }
  communities: CommunityCatalogRecord[]
}

export type XhsQueryStatus = 'todo' | 'hit' | 'no_hit' | 'risk_blocked' | 'partial' | 'excluded_pre_2010'

export interface XhsUnitPriceRange {
  min: number
  max: number
  unit: string
  sourceType?: string
  confidence?: string
  note?: string
}

export interface XhsTransactionCase {
  time?: string
  area?: string
  totalPrice?: string
  unitPrice?: string
  features?: string
  source?: string
}

export interface XhsSourceNote {
  type?: string
  title?: string
  noteId?: string
  author?: string
  noteDate?: string
  scope?: string
}

export interface XhsCalibrationRecord {
  communityId: string
  communityName: string
  aliases?: string[]
  query: {
    status: XhsQueryStatus
    queried: boolean
    queriedAt?: string
    keywords?: string[]
  }
  calibration?: {
    builtYear?: {
      value: number | null
      sourceType?: string
      confidence?: string
      note?: string
    } | null
    unitPriceRange?: XhsUnitPriceRange | null
    transactionCases?: XhsTransactionCase[]
    judgments?: string[]
    sourceNotes?: XhsSourceNote[]
  }
  review?: {
    confidence?: string
    needsHumanReview?: boolean
    notes?: string[]
  }
}

export interface XhsExcludedRecord extends XhsCalibrationRecord {
  excludedAt?: string
  exclusionReason?: string
}

export interface XhsCommunityCalibration {
  schemaVersion: number
  metadata: {
    minimumIncludedBuiltYear: number
    counts?: Record<string, number>
  }
  records: XhsCalibrationRecord[]
  excludedRecords?: XhsExcludedRecord[]
}

export interface Filters {
  keyword: string
  submarket: string
  forms: BuildingForm[]
  buildingTypes: string[]
  minPrice: number
  maxPrice: number
  minYear: number
  maxYear: number
}
