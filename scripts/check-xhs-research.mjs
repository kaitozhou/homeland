import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const catalogPath = path.join(root, 'public/data/jianye-communities-catalog.json')
const researchPath = path.join(root, 'public/data/xhs-nanjing-community-calibration.json')
const requireComplete = process.argv.includes('--complete')
const validStatuses = new Set(['todo', 'hit', 'no_hit', 'risk_blocked', 'partial'])

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

const catalog = await readJson(catalogPath)
const research = await readJson(researchPath)
const errors = []
const catalogIds = new Set(catalog.communities.map((community) => community.id))
const researchIds = new Set(research.records.map((community) => community.communityId))

catalogIds.forEach((id) => {
  if (!researchIds.has(id)) {
    errors.push(`missing research record: ${id}`)
  }
})

const missingFlags = research.records.filter((community) => {
  return typeof community.query?.queried !== 'boolean' || !community.query?.status
})
const invalidStatuses = research.records.filter((community) => !validStatuses.has(community.query?.status))
const pending = research.records.filter((community) => community.query?.status === 'todo')

if (missingFlags.length > 0) {
  errors.push(`records with empty xhs query flag: ${missingFlags.map((community) => community.communityName).join(', ')}`)
}

if (invalidStatuses.length > 0) {
  errors.push(`records with invalid query.status: ${invalidStatuses.map((community) => `${community.communityName}:${community.query?.status}`).join(', ')}`)
}

if (requireComplete && pending.length > 0) {
  errors.push(`xhs research is incomplete: ${pending.length} communities pending`)
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  if (pending.length > 0) {
    console.error(`Next pending: ${pending.slice(0, 20).map((community) => community.communityName).join(', ')}`)
  }
  process.exit(1)
}

const counts = research.records.reduce((acc, community) => {
  acc[community.query.status] = (acc[community.query.status] ?? 0) + 1
  return acc
}, {})

console.log(JSON.stringify({
  total: research.records.length,
  catalogTotal: catalog.communities.length,
  missingFlags: missingFlags.length,
  pending: pending.length,
  counts,
  nextPending: pending.slice(0, 20).map((community) => community.communityName),
}, null, 2))
