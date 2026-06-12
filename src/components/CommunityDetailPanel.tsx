import { AlertTriangle, CheckCircle2, ClipboardList, ExternalLink } from 'lucide-react'
import { formatPrice } from '../lib/filters'
import type { CatalogCommunityView, XhsQueryStatus, XhsSourceNote } from '../types/domain'

interface CommunityDetailPanelProps {
  community: CatalogCommunityView
}

function formatValue(value: string | number | null | undefined, fallback = '待补充'): string {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  return String(value)
}

function formatCatalogPrice(community: CatalogCommunityView): string {
  if (!community.unitPrice) {
    return '暂无公开均价'
  }

  return `${formatPrice(community.unitPrice)} ${community.priceUnit}`
}

function formatRange(community: CatalogCommunityView): string {
  const range = community.xhsUnitPriceRange

  if (!range) {
    return '暂无真实成交区间'
  }

  if (range.min === range.max) {
    return `${formatPrice(range.min)} ${range.unit}`
  }

  return `${formatPrice(range.min)}-${formatPrice(range.max)} ${range.unit}`
}

function getStatusText(status: XhsQueryStatus, hasRealCase: boolean): string {
  if (hasRealCase) {
    return '已取得本小区真实成交案例'
  }

  if (status === 'partial') {
    return '仅有参考信息，缺本小区真实成交案例'
  }

  if (status === 'hit') {
    return '有命中记录，但缺本小区成交案例'
  }

  if (status === 'no_hit') {
    return '已查无有效真实案例'
  }

  if (status === 'risk_blocked') {
    return '检索中断，缺真实案例'
  }

  return '未经过真实案例处理'
}

function hasReviewOnlyEvidence(community: CatalogCommunityView): boolean {
  return (
    community.xhsSourceNotes.some((source) => {
      const scope = source.scope ?? ''
      return scope.includes('price_hidden') || scope.includes('reference_price') || scope.includes('name_review')
    }) ||
    community.xhsTransactionCases.some((item) => {
      return [item.totalPrice, item.unitPrice, item.features, item.source]
        .filter(Boolean)
        .some((value) => String(value).includes('未公开') || String(value).includes('隐藏') || String(value).includes('参考价'))
    })
  )
}

function getSourceLabel(source: XhsSourceNote): string {
  const parts = [source.sourceName, source.title].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '未命名来源'
}

export function CommunityDetailPanel({ community }: CommunityDetailPanelProps) {
  const hasRealCase = community.xhsRealCaseProcessed
  const reviewOnlyEvidence = hasReviewOnlyEvidence(community)
  const statusText = reviewOnlyEvidence && hasRealCase ? '已补网络来源，成交价口径需复核' : getStatusText(community.xhsStatus, hasRealCase)
  const shownCases = community.xhsTransactionCases.slice(0, 8)
  const shownSources = community.xhsSourceNotes.slice(-6)

  return (
    <section className="community-detail" aria-label="小区结构化详情">
      <div className={hasRealCase && !reviewOnlyEvidence ? 'case-banner case-banner--ok' : 'case-banner case-banner--warning'}>
        {hasRealCase ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        <div>
          <strong>{statusText}</strong>
          {!hasRealCase ? (
            <span>当前价格展示以公开 catalog 或参考信息为主，不能视为本小区真实成交校准。</span>
          ) : reviewOnlyEvidence ? (
            <span>部分记录为价格隐藏成交、新房参考价或需复核分期口径，详情以来源记录为准。</span>
          ) : (
            <span>成交案例来自已记录的截图或笔记证据，详情如下。</span>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-cell">
          <span>板块</span>
          <strong>{formatValue(community.submarket)}</strong>
        </div>
        <div className="detail-cell">
          <span>建成年代</span>
          <strong>{formatValue(community.xhsBuiltYear ?? community.builtYear)}</strong>
        </div>
        <div className="detail-cell">
          <span>楼型</span>
          <strong>{formatValue(community.publicBuildingType ?? community.buildingForm)}</strong>
        </div>
        <div className="detail-cell">
          <span>公开挂牌均价</span>
          <strong>{formatCatalogPrice(community)}</strong>
        </div>
        <div className="detail-cell">
          <span>真实成交单价区间</span>
          <strong>{formatRange(community)}</strong>
        </div>
        <div className="detail-cell">
          <span>真实案例数</span>
          <strong>{community.xhsTransactionCases.length} 条</strong>
        </div>
      </div>

      {shownCases.length > 0 ? (
        <div className="case-table" role="table" aria-label="真实成交案例">
          <div className="case-table__row case-table__row--head" role="row">
            <span>时间</span>
            <span>面积</span>
            <span>成交价</span>
            <span>单价</span>
            <span>备注</span>
          </div>
          {shownCases.map((item, index) => (
            <div className="case-table__row" role="row" key={`${item.time ?? 'case'}-${index}`}>
              <span>{formatValue(item.time, '-')}</span>
              <span>{formatValue(item.area, '-')}</span>
              <span>{formatValue(item.totalPrice, '-')}</span>
              <span>{formatValue(item.unitPrice, '-')}</span>
              <span title={item.source}>{formatValue(item.features || item.source, '-')}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-cases">
          <ClipboardList size={18} />
          <span>暂无本小区真实成交案例。后续可用成交表截图批量回填成交价、面积、总价和楼层备注。</span>
        </div>
      )}

      {(community.xhsJudgments.length > 0 || community.xhsQueryKeywords.length > 0) && (
        <div className="detail-notes">
          {community.xhsQueryKeywords.length > 0 && (
            <span>处理关键词：{community.xhsQueryKeywords.join(' / ')}</span>
          )}
          {community.xhsJudgments.slice(0, 2).map((judgment) => (
            <span key={judgment}>{judgment}</span>
          ))}
        </div>
      )}

      {shownSources.length > 0 && (
        <div className="source-note-list" aria-label="案例来源">
          <span className="source-note-list__title">来源记录</span>
          {shownSources.map((source, index) => {
            const label = getSourceLabel(source)
            const meta = [source.noteDate, source.accessedAt ? `访问 ${source.accessedAt}` : null, source.scope]
              .filter(Boolean)
              .join(' · ')

            return (
              <div className="source-note" key={`${source.type ?? 'source'}-${source.url ?? source.title ?? index}`}>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer" title={label}>
                    <span>{label}</span>
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <span>{label}</span>
                )}
                {meta && <em>{meta}</em>}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
