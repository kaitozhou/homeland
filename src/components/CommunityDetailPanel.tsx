import { AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react'
import { formatPrice } from '../lib/filters'
import type { CatalogCommunityView, XhsQueryStatus } from '../types/domain'

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

export function CommunityDetailPanel({ community }: CommunityDetailPanelProps) {
  const hasRealCase = community.xhsRealCaseProcessed
  const statusText = getStatusText(community.xhsStatus, hasRealCase)
  const shownCases = community.xhsTransactionCases.slice(0, 8)

  return (
    <section className="community-detail" aria-label="小区结构化详情">
      <div className={hasRealCase ? 'case-banner case-banner--ok' : 'case-banner case-banner--warning'}>
        {hasRealCase ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        <div>
          <strong>{statusText}</strong>
          {!hasRealCase ? (
            <span>当前价格展示以公开 catalog 或参考信息为主，不能视为本小区真实成交校准。</span>
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
    </section>
  )
}
