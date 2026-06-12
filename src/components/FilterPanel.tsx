import { Building2, Home, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import type { BuildingForm, Filters } from '../types/domain'
import { defaultFilters, formatPrice } from '../lib/filters'

const buildingForms: BuildingForm[] = ['洋房', '小高层', '高层', '混合']

interface FilterPanelProps {
  submarkets: string[]
  buildingTypes: string[]
  filters: Filters
  resultCount: number
  totalCount: number
  onChange: (filters: Filters) => void
}

function toggleForm(forms: BuildingForm[], form: BuildingForm): BuildingForm[] {
  return forms.includes(form) ? forms.filter((item) => item !== form) : [...forms, form]
}

function toggleBuildingType(buildingTypes: string[], buildingType: string): string[] {
  return buildingTypes.includes(buildingType)
    ? buildingTypes.filter((item) => item !== buildingType)
    : [...buildingTypes, buildingType]
}

export function FilterPanel({ submarkets, buildingTypes, filters, resultCount, totalCount, onChange }: FilterPanelProps) {
  return (
    <aside className="filter-panel" aria-label="建邺区小区筛选">
      <div className="filter-panel__header">
        <div>
          <p className="eyebrow">筛选所有小区</p>
          <h2>小区 {resultCount} / {totalCount}</h2>
          <span className="filter-panel__subline">住宅=小区，板块仅作为信息字段</span>
        </div>
        <button className="icon-button" type="button" onClick={() => onChange(defaultFilters)} aria-label="重置筛选">
          <RotateCcw size={18} />
        </button>
      </div>

      <label className="filter-search">
        <Search size={16} />
        <input
          placeholder="搜索小区名、板块、地址或楼型"
          value={filters.keyword}
          onChange={(event) => onChange({ ...filters, keyword: event.target.value })}
        />
      </label>

      <section className="filter-group">
        <div className="filter-group__title">
          <Building2 size={16} />
          <span>板块字段</span>
        </div>
        <div className="chip-grid">
          <button
            className={filters.submarket === 'all' ? 'chip chip--active' : 'chip'}
            type="button"
            onClick={() => onChange({ ...filters, submarket: 'all' })}
          >
            全部
          </button>
          {submarkets.map((submarket) => (
            <button
              className={filters.submarket === submarket ? 'chip chip--active' : 'chip'}
              key={submarket}
              type="button"
              onClick={() => onChange({ ...filters, submarket })}
            >
              {submarket}
            </button>
          ))}
        </div>
      </section>

      <section className="filter-group">
        <div className="filter-group__title">
          <SlidersHorizontal size={16} />
          <span>住宅形态</span>
        </div>
        <div className="chip-grid chip-grid--compact">
          {buildingForms.map((form) => (
            <button
              className={filters.forms.includes(form) ? 'chip chip--active' : 'chip'}
              key={form}
              type="button"
              onClick={() => onChange({ ...filters, forms: toggleForm(filters.forms, form) })}
            >
              {form}
            </button>
          ))}
        </div>
      </section>

      <section className="filter-group">
        <div className="filter-group__title">
          <Home size={16} />
          <span>公开楼型</span>
        </div>
        <div className="chip-grid chip-grid--compact">
          {buildingTypes.map((buildingType) => (
            <button
              className={filters.buildingTypes.includes(buildingType) ? 'chip chip--active' : 'chip'}
              key={buildingType}
              type="button"
              onClick={() => onChange({ ...filters, buildingTypes: toggleBuildingType(filters.buildingTypes, buildingType) })}
            >
              {buildingType}
            </button>
          ))}
        </div>
      </section>

      <section className="filter-group">
        <label className="range-row">
          <span>最高单价</span>
          <strong>{formatPrice(filters.maxPrice)} 元/㎡</strong>
        </label>
        <input
          aria-label="最高单价"
          max={70000}
          min={20000}
          step={1000}
          type="range"
          value={filters.maxPrice}
          onChange={(event) => onChange({ ...filters, maxPrice: Number(event.target.value) })}
        />
      </section>

      <section className="filter-group">
        <label className="range-row">
          <span>最早建成</span>
          <strong>{filters.minYear} 年后</strong>
        </label>
        <input
          aria-label="最早建成年代"
          max={2026}
          min={2010}
          step={1}
          type="range"
          value={filters.minYear}
          onChange={(event) => onChange({ ...filters, minYear: Number(event.target.value) })}
        />
      </section>

      <div className="filter-panel__hint">
        筛选对象为全量小区目录；先筛选并选择小区，再按需加载地图并高亮定位选中小区。
      </div>
    </aside>
  )
}
