import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8')
}

function expect(condition, message, failures) {
  if (!condition) {
    failures.push(message)
  }
}

const failures = []
const packageJson = JSON.parse(await read('package.json'))
const dataset = JSON.parse(await read('public/data/jianye-real-estate.json'))
const catalog = JSON.parse(await read('public/data/jianye-communities-catalog.json'))
const xhsResearch = JSON.parse(await read('public/data/xhs-nanjing-community-calibration.json'))
const app = await read('src/App.tsx')
const catalogPanel = await read('src/components/CatalogPanel.tsx')
const map = await read('src/components/JianyeMap.tsx')
const filters = await read('src/components/FilterPanel.tsx')
const filterLogic = await read('src/lib/filters.ts')
const css = await read('src/App.css')

expect(packageJson.dependencies?.react, 'React dependency is missing', failures)
expect(packageJson.devDependencies?.vite, 'Vite dependency is missing', failures)
expect(map.includes("viewMode: '3D'"), 'AMap 3D viewMode is missing', failures)
expect(map.includes('zooms: [10, 18]'), 'AMap zoom range is missing', failures)
expect(map.includes('AMap.ToolBar') && map.includes('AMap.ControlBar'), 'AMap zoom/3D controls are missing', failures)
expect(map.includes('AMap.PlaceSearch') && map.includes('searchCommunityPoi'), 'POI-first community positioning is missing', failures)
expect(map.includes('AMap.Geocoder') && map.includes('geocodeCommunity'), 'Geocoder fallback is missing', failures)
expect(map.includes('mouseover') && map.includes('hover-card'), 'Residential hover detail behavior is missing', failures)
expect(map.includes('map-marker--home') && map.includes('map-marker--commercial') && map.includes('map-marker--hospital') && map.includes('map-marker--park'), 'Distinct map marker classes are incomplete', failures)
expect(!map.includes('new AMap.Polygon'), 'Block polygon highlight should be removed', failures)
expect(css.includes('.map-marker__icon--home') && css.includes('.map-marker__icon--shop') && css.includes('.map-marker__icon--cross') && css.includes('.map-marker__icon--tree'), 'Logo-like marker icon styles are incomplete', failures)
expect(filterLogic.includes('filterCommunities') && filterLogic.includes('getBuildingTypeOptions') && filterLogic.includes('buildingTypeMatches'), 'All-community filtering logic is missing', failures)
expect(filters.includes('最高单价') && filters.includes('最早建成') && filters.includes('公开楼型') && filters.includes('筛选所有小区'), 'Expected filter controls are missing', failures)
expect(app.includes('qualityReport.excludedCommunities'), 'Data quality report summary is missing from UI', failures)
expect(app.includes('loadCommunityCatalog') && app.includes('highlightedCommunityIds') && catalogPanel.includes('筛选小区目录'), 'Full community catalog UI is missing', failures)
expect(app.includes('loadXhsCommunityCalibration') && filterLogic.includes('xhsExcluded') && catalogPanel.includes('getXhsStatusLabel'), 'XHS calibration status is not wired into filtering and catalog UI', failures)
expect(css.includes('@media (max-width: 900px)'), 'Responsive layout breakpoint is missing', failures)
expect(css.includes('box-shadow') && css.includes('backdrop-filter') && css.includes('--radius-card') && css.includes('map-shell__status'), 'Visual polish tokens/styles are missing', failures)

const poiTypes = new Set(dataset.pois.map((poi) => poi.type))
for (const type of ['commercial', 'hospital', 'park', 'civic']) {
  expect(poiTypes.has(type), `POI type ${type} is missing from dataset`, failures)
}

const forms = new Set(dataset.communities.map((community) => community.buildingForm))
expect(forms.has('高层') && forms.has('小高层'), 'Residential building forms do not cover high-rise and small high-rise', failures)
expect(dataset.blocks.length >= 6, 'Jianye block/street dataset is incomplete', failures)
expect(dataset.communities.length >= 7, 'Post-2010 residential community dataset is too small for the current prototype', failures)
expect(dataset.communities.every((community) => community.builtYear >= 2010), 'Residential community dataset contains known pre-2010 communities', failures)
expect(catalog.communities.length >= 200, 'Post-2010 community catalog has too few entries', failures)
expect(catalog.communities.every((community) => community.builtYear === null || community.builtYear >= 2010), 'Community catalog contains known pre-2010 communities', failures)
expect(catalog.communities.every((community) => Object.prototype.hasOwnProperty.call(community, 'publicBuildingType')), 'Community catalog must include public building type field', failures)
expect(Array.isArray(xhsResearch.records), 'XHS community calibration JSON is missing records array', failures)
expect(Array.isArray(xhsResearch.excludedRecords), 'XHS community calibration JSON must keep excludedRecords array', failures)
expect(xhsResearch.records.length === catalog.communities.length, 'XHS community calibration JSON must cover every current catalog community', failures)
expect(xhsResearch.records.every((community) => typeof community.query?.queried === 'boolean' && community.query?.status), 'XHS query flags must be present for every community', failures)
expect(xhsResearch.excludedRecords.every((community) => !catalog.communities.some((catalogCommunity) => catalogCommunity.id === community.communityId)), 'XHS excluded communities must not appear in active catalog', failures)

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Implementation audit passed: Vite, AMap 3D, markers, filters, hover detail, data report, and responsive styling are present.')
