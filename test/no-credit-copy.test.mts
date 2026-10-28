import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * NumRadar sells monthly plans and nothing else, so nothing this node says may call the unit a
 * credit, or send someone to buy or top up one.
 *
 * The words reach people in two places a unit test of the logic never reads: the operation
 * descriptions n8n renders in the editor, and the 402 message a failed workflow run shows. The
 * second said "Out of credits. Top up" for months after packs stopped being sold, which is an
 * instruction no customer can follow — the Billing page offers plans, and the allowance renews on
 * its own. This package is published on its own cycle, so it is not covered by the web app's copy
 * guard or the MCP server's, and this is the same scan, run over what this one ships.
 *
 * A source scan rather than a render, because the 402 message is only reachable through a failed
 * request. Every string literal in nodes/ and credentials/ is read; comments and the `${...}` of a
 * template are code, not copy. The README is held to the same rule outside code blocks.
 */

const ROOT = new URL('..', import.meta.url)
const RETIRED = /\bcredits?\b|\btop[ -]?up\b|\bbuy more\b/i

function stringLiterals(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`])\/\/.*$/gm, '$1')
  return Array.from(code.matchAll(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g), (m) =>
    m[0].slice(1, -1).replace(/\$\{[^}]*\}/g, '${}'),
  )
}

/** Every .ts file under a directory of the package, relative to the package root. */
function sources(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(new URL(`${dir}/`, ROOT), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...sources(path))
    else if (entry.name.endsWith('.ts')) found.push(path)
  }
  return found
}

describe('n8n node copy', () => {
  it('never calls the unit a credit, or sends anyone to buy one, in anything it ships', () => {
    const hits: string[] = []
    for (const file of [...sources('nodes'), ...sources('credentials')]) {
      for (const literal of stringLiterals(readFileSync(new URL(file, ROOT), 'utf8'))) {
        if (RETIRED.test(literal)) hits.push(`${file}: ${JSON.stringify(literal)}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('says it in the README only inside code, if at all', () => {
    const prose = readFileSync(new URL('README.md', ROOT), 'utf8')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`\n]*`/g, '')
    expect(prose.split('\n').filter((line) => RETIRED.test(line))).toEqual([])
  })

  it('sees a literal split across lines, and not a comment (the guard\'s own check)', () => {
    expect(stringLiterals("'Out of ' +\n'credits. Top up'")).toContain('credits. Top up')
    expect(stringLiterals('// "Out of credits"\nconst a = 1')).toEqual([])
    expect(stringLiterals('`${credits} left`')).toEqual(['${} left'])
  })
})
