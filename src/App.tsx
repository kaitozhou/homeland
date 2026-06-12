import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Database, Home, MapPinned } from 'lucide-react'
import './App.css'
import { CatalogPanel } from './components/CatalogPanel'
import { CommunityDetailPanel } from './components/CommunityDetailPanel'
import { FilterPanel } from './components/FilterPanel'
import { JianyeMap } from './components/JianyeMap'
import { loadCommunityCatalog, loadDataset, loadQualityReport, loadXhsCommunityCalibration } from './lib/data'
import {
  createCatalogCommunityViews,
  defaultFilters,
  filterCommunities,
  formatPrice,
  getBuildingTypeOptions,
  getSubmarketOptions,
} from './lib/filters'
import type { CommunityCatalog, Filters, JianyeDataset, QualityReport, XhsCommunityCalibration } from './types/domain'

function App() {
  const [dataset, setDataset] = useState<JianyeDataset | null>(null)
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null)
  const [communityCatalog, setCommunityCatalog] = useState<CommunityCatalog | null>(null)
  const [xhsCalibration, setXhsCalibration] = useState<XhsCommunityCalibration | null>(null)
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [locatedCount, setLocatedCount] = useState(0)
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null)
  const [error, setError] = useState<string>('')
  const mapStageRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    Promise.all([loadDataset(), loadQualityReport(), loadCommunityCatalog(), loadXhsCommunityCalibration()])
      .then(([loadedDataset, loadedQualityReport, loadedCommunityCatalog, loadedXhsCalibration]) => {
        setDataset(loadedDataset)
        setQualityReport(loadedQualityReport)
        setCommunityCatalog(loadedCommunityCatalog)
        setXhsCalibration(loadedXhsCalibration)
      })
      .catch((caught: unknown) => {
        const message = caught instanceof Error ? caught.message : '数据加载失败'
        setError(message)
      })
  }, [])

  const catalogCommunities = useMemo(
    () =>
      dataset && communityCatalog
        ? createCatalogCommunityViews(communityCatalog.communities, dataset.communities, xhsCalibration ?? undefined)
        : [],
    [communityCatalog, dataset, xhsCalibration],
  )

  const filteredCommunities = useMemo(
    () => filterCommunities(catalogCommunities, filters),
    [catalogCommunities, filters],
  )

  const submarkets = useMemo(() => getSubmarketOptions(catalogCommunities), [catalogCommunities])
  const buildingTypes = useMemo(() => getBuildingTypeOptions(catalogCommunities), [catalogCommunities])
  const selectedCommunity = useMemo(
    () => catalogCommunities.find((community) => community.id === selectedCommunityId) ?? null,
    [catalogCommunities, selectedCommunityId],
  )
  const selectedMapCommunities = useMemo(() => (selectedCommunity ? [selectedCommunity] : []), [selectedCommunity])
  const selectedBuiltYear = selectedCommunity?.xhsBuiltYear ?? selectedCommunity?.builtYear ?? null
  const pricedCommunities = filteredCommunities.filter((community) => community.unitPrice !== null)
  const averagePrice = pricedCommunities.length
    ? Math.round(pricedCommunities.reduce((sum, community) => sum + (community.unitPrice ?? 0), 0) / pricedCommunities.length)
    : 0

  useEffect(() => {
    if (selectedCommunityId && !filteredCommunities.some((community) => community.id === selectedCommunityId)) {
      setSelectedCommunityId(null)
      setLocatedCount(0)
    }
  }, [filteredCommunities, selectedCommunityId])

  useEffect(() => {
    if (!selectedCommunityId) {
      return
    }

    window.requestAnimationFrame(() => {
      mapStageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [selectedCommunityId])

  function selectCommunity(communityId: string) {
    setLocatedCount(0)
    setSelectedCommunityId(communityId)
  }

  if (error) {
    return (
      <main className="app app--centered">
        <section className="error-card">
          <AlertTriangle size={32} />
          <h1>加载失败</h1>
          <p>{error}</p>
        </section>
      </main>
    )
  }

  if (!dataset || !qualityReport || !communityCatalog || !xhsCalibration) {
    return (
      <main className="app app--centered">
        <section className="loading-card">
          <MapPinned size={32} />
          <h1>正在准备建邺区地图数据</h1>
          <p>加载小区目录、精准坐标、POI 和数据质量报告。</p>
        </section>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Nanjing Jianye Real Estate Map</p>
          <h1>南京建邺区 3D 房产地图</h1>
        </div>
        <div className="topbar__stats">
          <div className="stat-pill">
            <Home size={17} />
            <span>{filteredCommunities.length} 个小区</span>
          </div>
          <div className="stat-pill">
            <Database size={17} />
            <span>{selectedCommunity ? `已定位 ${locatedCount} 个` : '未加载地图'}</span>
          </div>
          <div className="stat-pill">
            <Database size={17} />
            <span>均价 {averagePrice ? formatPrice(averagePrice) : '-'} 元/㎡</span>
          </div>
          <div className="stat-pill">
            <MapPinned size={17} />
            <span>{dataset.metadata.updatedAt}</span>
          </div>
        </div>
      </header>

      <section className="workspace">
        <FilterPanel
          buildingTypes={buildingTypes}
          filters={filters}
          resultCount={filteredCommunities.length}
          submarkets={submarkets}
          totalCount={catalogCommunities.length}
          onChange={setFilters}
        />
        <CatalogPanel
          communities={filteredCommunities}
          locatedCount={locatedCount}
          selectedCommunityId={selectedCommunityId}
          source={communityCatalog.metadata.source}
          totalCount={catalogCommunities.length}
          onSelectCommunity={selectCommunity}
        />
      </section>

      {selectedCommunity ? (
        <section className="map-stage" ref={mapStageRef} aria-label="选中小区地图定位">
          <div className="map-stage__header">
            <div>
              <p className="eyebrow">Focused Map</p>
              <h2>{selectedCommunity.name}</h2>
              <span>
                {selectedCommunity.submarket || '板块待补充'} · {selectedBuiltYear ? `${selectedBuiltYear} 建成` : '年代待补充'} · {selectedCommunity.publicBuildingType ?? selectedCommunity.buildingForm ?? '楼型待补充'}
              </span>
            </div>
            <a href={selectedCommunity.detailSource} target="_blank" rel="noreferrer">
              公开来源
            </a>
          </div>
          <CommunityDetailPanel community={selectedCommunity} />
          <JianyeMap
            communities={selectedMapCommunities}
            hasActiveFilters
            highlightedCommunityIds={[selectedCommunity.id]}
            pois={dataset.pois}
            onLocationStatsChange={setLocatedCount}
          />
        </section>
      ) : (
        <section className="map-deferred" aria-label="地图延迟加载提示">
          <MapPinned size={24} />
          <div>
            <strong>地图未加载</strong>
            <span>先筛选并选择一个小区，再加载 3D 地图并精准定位高亮。</span>
          </div>
        </section>
      )}

      <footer className="data-footer">
        <div>
          <strong>数据口径</strong>
          <span>
            筛选覆盖全量 catalog 小区；地图使用高德客户端地理编码按小区名和公开地址定位，并缓存到浏览器本地。
            {qualityReport.excludedCommunities.length} 个候选仍保留在质量报告中。
          </span>
        </div>
        <div className="source-links">
          {dataset.metadata.sources.map((source) => (
            <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
              {source.name}
            </a>
          ))}
        </div>
      </footer>
    </main>
  )
}

export default App
