import type { LngLat } from './domain'

export interface AMapMap {
  add: (overlay: AMapOverlay | AMapOverlay[]) => void
  remove: (overlay: AMapOverlay | AMapOverlay[]) => void
  setFitView: (overlays?: AMapOverlay[], immediately?: boolean, avoid?: [number, number, number, number], maxZoom?: number) => void
  destroy: () => void
}

export interface AMapMarker {
  on: (eventName: 'mouseover' | 'mouseout' | 'click', handler: () => void) => void
}

export type AMapOverlay = AMapMarker

export interface AMapGeocoder {
  getLocation: (address: string, callback: (status: string, result: AMapGeocodeResult) => void) => void
}

export interface AMapPlaceSearch {
  search: (keyword: string, callback: (status: string, result: AMapPlaceSearchResult) => void) => void
}

export interface AMapGeocodeResult {
  geocodes?: AMapGeocode[]
  info?: string
}

export interface AMapGeocode {
  location?: AMapGeocodeLocation
  formattedAddress?: string
  level?: string
}

export interface AMapGeocodeLocation {
  lng?: number
  lat?: number
  getLng?: () => number
  getLat?: () => number
}

export interface AMapPlaceSearchResult {
  poiList?: {
    pois?: AMapPoi[]
  }
  info?: string
}

export interface AMapPoi {
  name?: string
  type?: string
  typecode?: string
  address?: string
  adname?: string
  location?: AMapGeocodeLocation
}

export interface AMapNamespace {
  Map: new (container: HTMLElement, options: AMapMapOptions) => AMapMap
  Marker: new (options: AMapMarkerOptions) => AMapMarker
  ToolBar: new (options?: Record<string, unknown>) => AMapOverlay
  ControlBar: new (options?: Record<string, unknown>) => AMapOverlay
  Geocoder: new (options?: AMapGeocoderOptions) => AMapGeocoder
  PlaceSearch: new (options?: AMapPlaceSearchOptions) => AMapPlaceSearch
}

export interface AMapMapOptions {
  center: LngLat
  zoom: number
  zooms: [number, number]
  pitch: number
  rotation: number
  viewMode: '2D' | '3D'
  resizeEnable: boolean
  pitchEnable: boolean
  rotateEnable: boolean
  mapStyle?: string
  features?: string[]
}

export interface AMapMarkerOptions {
  position: LngLat
  title?: string
  content?: string
  anchor?: 'center' | 'bottom-center'
  offset?: [number, number]
  zIndex?: number
}

export interface AMapGeocoderOptions {
  city?: string
  citylimit?: boolean
}

export interface AMapPlaceSearchOptions {
  city?: string
  citylimit?: boolean
  pageSize?: number
  pageIndex?: number
  type?: string
  extensions?: 'base' | 'all'
}

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode: string
    }
  }
}
