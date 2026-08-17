import { describe, expect, it } from 'vitest'
import { MatchPhase } from '../core/cards'
import { createMatch, defaultConfig } from '../core/rules'
import { payloadsFromState } from './trackEvents'

function finishAt(miles: number[], winnerIndex: number) {
  const names = ['Ann', 'Bob', 'Cat', 'Dot'].slice(0, miles.length)
  const humans = names.map(() => true)
  const prev = createMatch(names, humans, defaultConfig(41))
  const next = structuredClone(prev)
  miles.forEach((m, i) => {
    next.players[i]!.miles = m
  })
  next.phase = MatchPhase.Finished
  next.winnerIndex = winnerIndex
  return payloadsFromState(prev, next, names.map((_, i) => i + 1))
}

describe('GAME_OVER places', () => {
  it('two tie for first → 1,1,3,4', () => {
    const pipes = finishAt([800, 800, 500, 200], -1)
    expect(pipes[0]).toBe('GAME_OVER|1|2|RANK|3|4|PLACES|1|1|3|4')
  })

  it('three tie for first → 1,1,1,4', () => {
    const pipes = finishAt([800, 800, 800, 200], -1)
    expect(pipes[0]).toBe('GAME_OVER|1|2|RANK|3|4|PLACES|1|1|1|4')
  })

  it('unique first and two tie for second → 1,2,2,4', () => {
    const pipes = finishAt([1000, 700, 700, 200], 0)
    expect(pipes[0]).toBe('GAME_OVER|1|2|RANK|3|4|PLACES|1|2|2|4')
  })
})
