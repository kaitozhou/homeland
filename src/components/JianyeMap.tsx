import { useEffect, useMemo, useRef, useState } from 'react'
import { load as loadAMap } from '@amap/amap-jsapi-loader'
import { Building, Hospital, Landmark, MapPinned, ShoppingBag, Trees } from 'lucide-react'
import type { AMapGeocoder, AMapMap, AMapNamespace, AMapOverlay, AMapPlaceSearch, AMapPoi } from '../types/amap'
import type { CatalogCommunityView, LngLat, Poi, PoiType } from '../types/domain'
import { formatPrice } from '../lib/filters'

interface JianyeMapProps {
  pois: Poi[]
  communities: CatalogCommunityView[]
  highlightedCommunityIds: string[]
  hasActiveFilters: boolean
  onLocationStatsChange: (locatedCount: number) => void
}

interface LocatedCommunity {
  community: CatalogCommunityView
  position: LngLat
}

const poiMeta: Record<PoiType, { label: string; className: string; icon: string }> = {
  commercial: { label: '商业', className: 'map-marker--commercial', icon: 'shop' },
  hospital: { label: '医院', className: 'map-marker--hospital', icon: 'cross' },
  park: { label: '公园', className: 'map-marker--park', icon: 'tree' },
  civic: { label: '文体', className: 'map-marker--civic', icon: 'hall' },
}

const geocodeCacheKey = 'homeland:jianye-community-position:v2'
const geocodeBatchSize = 6
const geocodeTimeoutMs = 5000

function getMapEnv() {
  return {
    key: import.meta.env.VITE_AMAP_KEY as string | undefined,
    securityCode: import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined,
  }
}

function markerContent(className: string, label: string, icon: string, name: string): string {
  return `<div class="map-marker ${className}" title="${name}" aria-label="${label}：${name}"><span class="map-marker__icon map-marker__icon--${icon}"></span><span class="map-marker__label">${label}</span></div>`
}

function readGeocodeCache(): Record<string, LngLat | null> {
  try {
    const cached = window.localStorage.getItem(geocodeCacheKey)
    return cached ? JSON.parse(cached) as Record<string, LngLat | null> : {}
  } catch {
    return {}
  }
}

function writeGeocodeCache(cache: Record<string, LngLat | null>) {
  try {
    window.localStorage.setItem(geocodeCacheKey, JSON.stringify(cache))
  } catch {
    // localStorage may be unavailable in strict browser modes; map still works for the session.
  }
}

function isJianyeLngLat(position: LngLat): boolean {
  const [lng, lat] = position
  return lng >= 118.55 && lng <= 118.85 && lat >= 31.9 && lat <= 32.15
}

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/[·・•]/g, '')
    .replace(/[\s.（）()【】[\]\-—_]/g, '')
    .toLocaleLowerCase('zh-CN')
}

function toLngLat(location: unknown): LngLat | null {
  if (!location || typeof location !== 'object') {
    return null
  }

  const candidate = location as { lng?: number; lat?: number; getLng?: () => number; getLat?: () => number }
  const lng = typeof candidate.getLng === 'function' ? candidate.getLng() : candidate.lng
  const lat = typeof candidate.getLat === 'function' ? candidate.getLat() : candidate.lat

  if (Number.isFinite(lng) && Number.isFinite(lat)) {
    const position: LngLat = [lng as number, lat as number]
    return isJianyeLngLat(position) ? position : null
  }

  return null
}

function createGeocodeQueries(community: CatalogCommunityView): string[] {
  const queries = [
    ['南京市建邺区', community.name],
    ['南京市', community.name],
    ['南京市建邺区', community.name, community.address],
    ['南京市建邺区', community.name, community.address, community.submarket],
  ].map((parts) => parts.filter(Boolean).join(' '))

  return Array.from(new Set(queries))
}

function isResidentialPoi(poi: AMapPoi): boolean {
  const type = `${poi.type ?? ''} ${poi.typecode ?? ''}`
  return /商务住宅|住宅区|小区|住宅|120/.test(type)
}

function scorePoi(community: CatalogCommunityView, poi: AMapPoi): number {
  const position = toLngLat(poi.location)

  if (!position) {
    return -1
  }

  const communityName = normalizeSearchText(community.name)
  const poiName = normalizeSearchText(poi.name)
  const poiAddress = normalizeSearchText(poi.address)
  const communityAddress = normalizeSearchText(community.address)
  const submarket = normalizeSearchText(community.submarket)
  let score = 0

  if (poiName === communityName) {
    score += 120
  } else if (poiName.includes(communityName)) {
    score += 85
  } else if (communityName.includes(poiName) && poiName.length >= 4) {
    score += 60
  }

  if ((poi.adname ?? '').includes('建邺')) {
    score += 45
  }

  if (isResidentialPoi(poi)) {
    score += 30
  }

  if (communityAddress && poiAddress && (poiAddress.includes(communityAddress) || communityAddress.includes(poiAddress))) {
    score += 12
  }

  if (submarket && poiAddress.includes(submarket)) {
    score += 6
  }

  return score
}

function searchPlace(placeSearch: AMapPlaceSearch, keyword: string): Promise<AMapPoi[] | undefined> {
  return new Promise((resolve) => {
    let settled = false
    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        settled = true
        resolve(undefined)
      }
    }, geocodeTimeoutMs)

    placeSearch.search(keyword, (status, result) => {
      if (settled) {
        return
      }

      settled = true
      window.clearTimeout(timeoutId)

      if (status !== 'complete' || !Array.isArray(result.poiList?.pois)) {
        resolve([])
        return
      }

      resolve(result.poiList.pois)
    })
  })
}

async function searchCommunityPoi(placeSearch: AMapPlaceSearch, community: CatalogCommunityView): Promise<LngLat | null | undefined> {
  let timedOut = false
  const keywords = Array.from(new Set([
    community.name,
    `${community.name} 建邺`,
    `${community.name} 南京`,
  ]))

  for (const keyword of keywords) {
    const pois = await searchPlace(placeSearch, keyword)

    if (pois === undefined) {
      timedOut = true
      continue
    }

    const best = pois
      .map((poi) => ({ poi, score: scorePoi(community, poi) }))
      .filter((candidate) => candidate.score >= 120)
      .sort((left, right) => right.score - left.score)[0]

    const position = best ? toLngLat(best.poi.location) : null

    if (position) {
      return position
    }
  }

  return timedOut ? undefined : null
}

function isLowPrecisionGeocode(level: string | undefined): boolean {
  return ['国家', '省', '市', '区县', '乡镇', '村庄'].includes(level ?? '')
}

function toGeocodePosition(community: CatalogCommunityView, geocode: { location?: unknown; formattedAddress?: string; level?: string }): LngLat | null {
  const position = toLngLat(geocode.location)

  if (!position) {
    return null
  }

  const formattedAddress = normalizeSearchText(geocode.formattedAddress)
  const communityName = normalizeSearchText(community.name)

  if (isLowPrecisionGeocode(geocode.level) && !formattedAddress.includes(communityName)) {
    return null
  }

  return position
}

function geocodeQuery(geocoder: AMapGeocoder, community: CatalogCommunityView, query: string): Promise<LngLat | null | undefined> {
  return new Promise((resolve) => {
    let settled = false
    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        settled = true
        resolve(undefined)
      }
    }, geocodeTimeoutMs)

    geocoder.getLocation(query, (status, result) => {
      if (settled) {
        return
      }

      settled = true
      window.clearTimeout(timeoutId)

      if (status !== 'complete' || !Array.isArray(result.geocodes) || result.geocodes.length === 0) {
        resolve(null)
        return
      }

      const position = result.geocodes
        .map((geocode) => toGeocodePosition(community, geocode))
        .find((candidate): candidate is LngLat => candidate !== null)

      resolve(position ?? null)
    })
  })
}

async function geocodeCommunity(geocoder: AMapGeocoder, community: CatalogCommunityView): Promise<LngLat | null | undefined> {
  let timedOut = false

  for (const query of createGeocodeQueries(community)) {
    const position = await geocodeQuery(geocoder, community, query)

    if (position) {
      return position
    }

    if (position === undefined) {
      timedOut = true
    }
  }

  return timedOut ? undefined : null
}

async function locateCommunity(
  placeSearch: AMapPlaceSearch,
  geocoder: AMapGeocoder,
  community: CatalogCommunityView,
): Promise<LngLat | null | undefined> {
  const poiPosition = await searchCommunityPoi(placeSearch, community)

  if (poiPosition || poiPosition === undefined) {
    return poiPosition
  }

  return geocodeCommunity(geocoder, community)
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function formatNullableNumber(value: number | null): string {
  return value === null ? '待补充' : formatPrice(value)
}

function CommunityCard({ community }: { community: CatalogCommunityView }) {
  const builtYear = community.xhsBuiltYear ?? community.builtYear

  return (
    <div className="hover-card">
      <p className="eyebrow">小区详情</p>
      <h3>{community.name}</h3>
      <div className="hover-card__meta">
        <span>{community.submarket || '板块待补充'}</span>
        <span>{community.publicBuildingType ?? community.buildingForm ?? '楼型待补充'}</span>
        <span>{builtYear ? `${builtYear} 建成` : '年代待补充'}</span>
      </div>
      <div className="price-line">
        <strong>{formatNullableNumber(community.unitPrice)}</strong>
        <span>元/㎡</span>
      </div>
      <p className="hover-card__source">
        {community.priceType || '价格口径待补充'}
        {community.updatedAt ? ` · 更新 ${community.updatedAt}` : ''}
      </p>
      <a href={community.detailSource} target="_blank" rel="noreferrer">
        查看公开来源
      </a>
    </div>
  )
}

export function JianyeMap({
  pois,
  communities,
  highlightedCommunityIds,
  hasActiveFilters,
  onLocationStatsChange,
}: JianyeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<AMapMap | null>(null)
  const amapRef = useRef<AMapNamespace | null>(null)
  const geocoderRef = useRef<AMapGeocoder | null>(null)
  const placeSearchRef = useRef<AMapPlaceSearch | null>(null)
  const geocodeCacheRef = useRef<Record<string, LngLat | null>>(readGeocodeCache())
  const overlaysRef = useRef<AMapOverlay[]>([])
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string>('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [geocodeVersion, setGeocodeVersion] = useState(0)
  const [geocodingCount, setGeocodingCount] = useState(0)

  const highlightedSet = useMemo(() => new Set(highlightedCommunityIds), [highlightedCommunityIds])
  const highlightedKey = useMemo(() => highlightedCommunityIds.join('|'), [highlightedCommunityIds])
  const hoveredCommunity = communities.find((community) => community.id === hoveredId)
  const locatedCommunities = useMemo<LocatedCommunity[]>(() => {
    void geocodeVersion
    return communities.flatMap((community) => {
      const position = community.position ?? geocodeCacheRef.current[community.id]
      return position ? [{ community, position }] : []
    })
  }, [communities, geocodeVersion])

  useEffect(() => {
    onLocationStatsChange(locatedCommunities.length)
  }, [locatedCommunities.length, onLocationStatsChange])

  useEffect(() => {
    const container = containerRef.current
    const { key, securityCode } = getMapEnv()

    if (!container) {
      return
    }

    if (!key || !securityCode) {
      setLoadState('error')
      setError('缺少 VITE_AMAP_KEY 或 VITE_AMAP_SECURITY_CODE，请检查 .env.local。')
      return
    }

    let cancelled = false
    setLoadState('loading')
    window._AMapSecurityConfig = { securityJsCode: securityCode }

    loadAMap({
      key,
      version: '2.0',
      plugins: ['AMap.ToolBar', 'AMap.ControlBar', 'AMap.PlaceSearch', 'AMap.Geocoder'],
    })
      .then((loaded) => {
        if (cancelled) {
          return
        }

        const AMap = loaded as AMapNamespace
        const map = new AMap.Map(container, {
          center: [118.7185, 32.004],
          zoom: 12.2,
          zooms: [10, 18],
          pitch: 55,
          rotation: -18,
          viewMode: '3D',
          resizeEnable: true,
          pitchEnable: true,
          rotateEnable: true,
          mapStyle: 'amap://styles/whitesmoke',
          features: ['bg', 'road', 'building', 'point'],
        })

        map.add([
          new AMap.ToolBar({ position: { right: '18px', top: '88px' } }),
          new AMap.ControlBar({ position: { right: '18px', top: '18px' } }),
        ])

        amapRef.current = AMap
        geocoderRef.current = new AMap.Geocoder({ city: '南京市', citylimit: true })
        placeSearchRef.current = new AMap.PlaceSearch({
          city: '南京市',
          citylimit: true,
          pageSize: 10,
          pageIndex: 1,
          type: '120000|120300',
          extensions: 'base',
        })
        mapRef.current = map
        setLoadState('ready')
      })
      .catch((caught: unknown) => {
        const message = caught instanceof Error ? caught.message : '高德地图加载失败'
        setLoadState('error')
        setError(message)
      })

    return () => {
      cancelled = true
      mapRef.current?.destroy()
      mapRef.current = null
      amapRef.current = null
      geocoderRef.current = null
      placeSearchRef.current = null
      overlaysRef.current = []
    }
  }, [])

  useEffect(() => {
    const geocoder = geocoderRef.current
    const placeSearch = placeSearchRef.current

    if (!geocoder || !placeSearch || loadState !== 'ready') {
      return
    }

    let cancelled = false
    const pendingCommunities = communities.filter((community) => {
      return !community.position && geocodeCacheRef.current[community.id] === undefined
    }).sort((left, right) => {
      if (!hasActiveFilters) {
        return 0
      }

      const leftHighlighted = highlightedSet.has(left.id)
      const rightHighlighted = highlightedSet.has(right.id)

      if (leftHighlighted === rightHighlighted) {
        return 0
      }

      return leftHighlighted ? -1 : 1
    })

    if (pendingCommunities.length === 0) {
      return
    }

    const activePlaceSearch = placeSearch

    async function runGeocoding() {
      setGeocodingCount(pendingCommunities.length)

      for (let index = 0; index < pendingCommunities.length; index += geocodeBatchSize) {
        if (cancelled || !geocoder) {
          break
        }

        const batch = pendingCommunities.slice(index, index + geocodeBatchSize)
        const positions = await Promise.all(batch.map((community) => locateCommunity(activePlaceSearch, geocoder, community)))

        positions.forEach((position, batchIndex) => {
          if (position !== undefined) {
            geocodeCacheRef.current[batch[batchIndex].id] = position
          }
        })

        writeGeocodeCache(geocodeCacheRef.current)
        setGeocodeVersion((version) => version + 1)
        setGeocodingCount(Math.max(pendingCommunities.length - index - batch.length, 0))

        await wait(120)
      }

      if (!cancelled) {
        writeGeocodeCache(geocodeCacheRef.current)
        setGeocodeVersion((version) => version + 1)
        setGeocodingCount(0)
      }
    }

    void runGeocoding()

    return () => {
      cancelled = true
    }
  }, [communities, hasActiveFilters, highlightedKey, highlightedSet, loadState])

  useEffect(() => {
    const AMap = amapRef.current
    const map = mapRef.current

    if (!AMap || !map || loadState !== 'ready') {
      return
    }

    if (overlaysRef.current.length > 0) {
      map.remove(overlaysRef.current)
      overlaysRef.current = []
    }

    const overlays: AMapOverlay[] = []
    const fitOverlays: AMapOverlay[] = []

    pois.forEach((poi) => {
      const meta = poiMeta[poi.type]
      overlays.push(new AMap.Marker({
        position: poi.position,
        title: poi.name,
        content: markerContent(meta.className, meta.label, meta.icon, poi.name),
        anchor: 'bottom-center',
        zIndex: 45,
      }))
    })

    locatedCommunities.forEach(({ community, position }) => {
      const isHighlighted = !hasActiveFilters || highlightedSet.has(community.id)
      const className = `map-marker--home ${isHighlighted ? 'map-marker--highlighted' : 'map-marker--dimmed'}`
      const marker = new AMap.Marker({
        position,
        title: community.name,
        content: markerContent(className, '小区', 'home', community.name),
        anchor: 'bottom-center',
        zIndex: isHighlighted ? 70 : 35,
      })
      marker.on('mouseover', () => setHoveredId(community.id))
      marker.on('mouseout', () => setHoveredId(null))
      overlays.push(marker)

      if (isHighlighted) {
        fitOverlays.push(marker)
      }
    })

    overlaysRef.current = overlays
    map.add(overlays)
    map.setFitView(fitOverlays.length > 0 ? fitOverlays : overlays, false, [80, 80, 80, 380], 13.4)
  }, [hasActiveFilters, highlightedSet, loadState, locatedCommunities, pois])

  const unresolvedCount = communities.length - locatedCommunities.length

  return (
    <section className="map-shell" aria-label="南京市建邺区 3D 地图">
      <div className="map-shell__toolbar">
        <div className="legend-item"><Building size={15} />小区</div>
        <div className="legend-item"><ShoppingBag size={15} />商业</div>
        <div className="legend-item"><Hospital size={15} />医院</div>
        <div className="legend-item"><Trees size={15} />公园</div>
        <div className="legend-item"><Landmark size={15} />文体</div>
      </div>

      <div className="map-shell__status">
        已定位 {locatedCommunities.length} / {communities.length} 个小区
        {geocodingCount > 0 ? ` · 正在定位 ${geocodingCount} 个` : unresolvedCount > 0 ? ` · 待定位 ${unresolvedCount} 个` : ''}
        {hasActiveFilters ? ` · 筛选命中 ${highlightedCommunityIds.length} 个` : ''}
      </div>

      <div ref={containerRef} className="map-canvas" />

      {loadState !== 'ready' && (
        <div className="map-state">
          <MapPinned size={28} />
          <strong>{loadState === 'error' ? '地图不可用' : '正在加载高德 3D 地图'}</strong>
          {error && <span>{error}</span>}
        </div>
      )}

      {hoveredCommunity && <CommunityCard community={hoveredCommunity} />}
    </section>
  )
}
