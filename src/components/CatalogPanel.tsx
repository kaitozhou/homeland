import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatPrice } from '../lib/filters'
import type { CatalogCommunityView, XhsQueryStatus } from '../types/domain'

interface CatalogPanelProps {
  communities: CatalogCommunityView[]
  totalCount: number
  locatedCount: number
  selectedCommunityId: string | null
  source: string
  onSelectCommunity: (communityId: string) => void
}

function formatValue(value: string | number | null, fallback: string): string {
  if (value === null || value === '') {
    return fallback
  }

  return String(value)
}

function getEffectiveBuiltYear(community: CatalogCommunityView): number | null {
  return community.xhsBuiltYear ?? community.builtYear
}

function getXhsStatusLabel(status: XhsQueryStatus, needsReview: boolean, hasRealCase: boolean): string {
  if (status === 'hit') {
    if (hasRealCase) {
      return needsReview ? '真实案例·复核' : '真实案例'
    }

    return needsReview ? '参考命中·复核' : '参考命中'
  }

  if (status === 'partial') {
    return '部分参考'
  }

  if (status === 'no_hit') {
    return '未命中'
  }

  if (status === 'risk_blocked') {
    return '风控中断'
  }

  if (status === 'excluded_pre_2010') {
    return '2010前排除'
  }

  return '待查'
}

function getXhsStatusClass(status: XhsQueryStatus, needsReview: boolean): string {
  if (status === 'hit' && needsReview) {
    return 'xhs-status xhs-status--review'
  }

  return `xhs-status xhs-status--${status.replace(/_/g, '-')}`
}

export function CatalogPanel({
  communities,
  totalCount,
  locatedCount,
  selectedCommunityId,
  source,
  onSelectCommunity,
}: CatalogPanelProps) {
  const [keyword, setKeyword] = useState('')
  const visibleCommunities = useMemo(() => {
    const normalized = keyword.trim()

    if (!normalized) {
      return communities.slice(0, 80)
    }

    return communities
      .filter((community) => community.name.includes(normalized) || community.submarket.includes(normalized))
      .slice(0, 80)
  }, [communities, keyword])

  return (
    <section className="catalog-panel" aria-label="建邺区小区全量目录">
      <div className="catalog-panel__header">
        <div>
          <p className="eyebrow">Community Catalog</p>
          <h2>筛选小区目录 {communities.length} / {totalCount}</h2>
        </div>
        <div className="catalog-panel__coverage">
          小区=住宅 · {selectedCommunityId ? `地图已定位 ${locatedCount} 个` : '地图按需加载'} · 目录来源 {source}
        </div>
      </div>

      <label className="catalog-search">
        <Search size={16} />
        <input
          placeholder="搜索小区或板块"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </label>

      <div className="catalog-table" role="table" aria-label="小区目录">
        <div className="catalog-table__row catalog-table__row--head" role="row">
          <span>小区</span>
          <span>板块</span>
          <span>建成</span>
          <span>均价</span>
          <span>案例</span>
          <span>楼型</span>
          <span>操作</span>
        </div>
        {visibleCommunities.map((community) => (
          <button
            className={community.id === selectedCommunityId ? 'catalog-table__row catalog-table__row--selected' : 'catalog-table__row'}
            key={community.id}
            type="button"
            role="row"
            onClick={() => onSelectCommunity(community.id)}
          >
            <span>{community.name}</span>
            <span>{formatValue(community.submarket, '待补充')}</span>
            <span>{formatValue(getEffectiveBuiltYear(community), '待补充')}</span>
            <span>{community.unitPrice ? `${formatPrice(community.unitPrice)} 元/㎡` : '-'}</span>
            <span>
              <span className={getXhsStatusClass(community.xhsStatus, community.xhsNeedsReview)}>
                {getXhsStatusLabel(community.xhsStatus, community.xhsNeedsReview, community.xhsRealCaseProcessed)}
              </span>
            </span>
            <span>{community.publicBuildingType ?? community.buildingForm ?? '待补充'}</span>
            <span className="catalog-table__actions">
              <span className="map-status map-status--mapped">定位</span>
              <a href={community.source} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                来源
              </a>
            </span>
          </button>
        ))}
      </div>

      <p className="catalog-panel__note">
        当前列表展示前 80 条匹配结果；点击小区后才加载地图并定位该小区。地图坐标由高德客户端地理编码实时生成，
        缺板块、建成年代或楼型时显示待补充。
      </p>
    </section>
  )
}
