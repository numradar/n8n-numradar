import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url)

function read(path: string): string {
  return readFileSync(new URL(path, root), 'utf8')
}

describe('n8n community-package manifest', () => {
  const pkg = JSON.parse(read('package.json')) as {
    name: string
    license: string
    keywords: string[]
    dependencies: Record<string, string>
    n8n: { n8nNodesApiVersion: number; credentials: string[]; nodes: string[] }
  }

  it('is named for n8n verification and carries the community keyword', () => {
    expect(pkg.name).toBe('n8n-nodes-numradar')
    expect(pkg.keywords).toContain('n8n-community-node-package')
    expect(pkg.license).toBe('MIT')
  })

  it('has empty runtime dependencies (verification rule since the no-deps check)', () => {
    expect(pkg.dependencies).toEqual({})
  })

  // The npm page links readers here, so it must be this public repository exactly: a link that
  // 404s, or one that names any other repository, is what a reader of the package page sees.
  it('names this public repository, and no other, as its source', () => {
    const manifest = pkg as unknown as { repository: { url: string }; bugs: { url: string } }
    expect(manifest.repository.url).toBe('git+https://github.com/numradar/n8n-numradar.git')
    expect(manifest.bugs.url).toBe('https://github.com/numradar/n8n-numradar/issues')
    expect(JSON.stringify(pkg).match(/github\.com\/[\w.-]+\/[\w.-]+/g)?.every((url) =>
      url.startsWith('github.com/numradar/n8n-numradar'))).toBe(true)
  })

  it('points the n8n manifest at compiled dist/, not source', () => {
    expect(pkg.n8n.n8nNodesApiVersion).toBe(1)
    expect(pkg.n8n.credentials).toEqual(['dist/credentials/NumRadarApi.credentials.js'])
    expect(pkg.n8n.nodes).toEqual(['dist/nodes/NumRadar/NumRadar.node.js'])
    for (const entry of [...pkg.n8n.credentials, ...pkg.n8n.nodes]) {
      expect(entry.startsWith('dist/')).toBe(true)
      expect(entry).not.toMatch(/nodes\/NumRadar\/.*\.ts$/)
    }
  })
})

describe('README', () => {
  const readme = read('README.md')

  it('has a worked example against the same URL as the docs curl', () => {
    expect(readme).toContain('https://api.numradar.app/v1/validate')
    expect(readme).toContain('Bearer nr_live_')
    expect(readme).not.toContain('api.numradar.com')
  })

  it('does not claim a verified listing exists', () => {
    expect(readme).toMatch(/self-hosted/i)
    expect(readme).not.toMatch(/listed in the n8n Cloud panel/i)
  })
})
