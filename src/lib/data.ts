import type { CommunityCatalog, JianyeDataset, QualityReport, XhsCommunityCalibration } from '../types/domain'

const datasetUrl = '/data/jianye-real-estate.json'
const qualityReportUrl = '/data/data-quality-report.json'
const communityCatalogUrl = '/data/jianye-communities-catalog.json'
const xhsCommunityCalibrationUrl = '/data/xhs-nanjing-community-calibration.json'

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`数据加载失败：${response.status} ${response.statusText}`)
  }

  return (await response.json()) as T
}

export async function loadDataset(): Promise<JianyeDataset> {
  return fetchJson<JianyeDataset>(datasetUrl)
}

export async function loadQualityReport(): Promise<QualityReport> {
  return fetchJson<QualityReport>(qualityReportUrl)
}

export async function loadCommunityCatalog(): Promise<CommunityCatalog> {
  return fetchJson<CommunityCatalog>(communityCatalogUrl)
}

export async function loadXhsCommunityCalibration(): Promise<XhsCommunityCalibration> {
  return fetchJson<XhsCommunityCalibration>(xhsCommunityCalibrationUrl)
}
