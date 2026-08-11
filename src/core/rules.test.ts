import { CardId, MatchPhase } from './cards'
import { defaultConfig } from './state'
import {
  createMatch,
  canPlayDistance,
  canPlayHazard,
  tryApply,
  playMove,
  coupMove,
  drawDeckMove,
  drawDiscardMove,
} from './rules'
import { describe, expect, it } from 'vitest'

describe('RulesEngine', () => {
  it('deals six plus draw on current', () => {
    const state = createMatch(['Alice', 'Bob'], [true, true], defaultConfig(42))
    expect(state.players[0]!.hand.length).toBe(7)
    expect(state.players[1]!.hand.length).toBe(6)
    expect(state.phase).toBe(MatchPhase.Playing)
  })

  it('distance requires Drive', () => {
    const state = createMatch(['Alice', 'Bob'], [true, true], defaultConfig(7))
    const alice = state.players[0]!
    alice.hand = [CardId.Miles25]
    alice.battlePile = []
    const res = tryApply(state, playMove(0, 0, CardId.Miles25))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/Drive/)
  })

  it('exact goal wins', () => {
    const state = createMatch(['Alice', 'Bob'], [true, true], defaultConfig(9))
    const alice = state.players[0]!
    alice.hand = [CardId.Miles25]
    alice.battlePile = [CardId.Drive]
    alice.miles = 975
    expect(tryApply(state, playMove(0, 0, CardId.Miles25)).ok).toBe(true)
    expect(alice.miles).toBe(1000)
    expect(state.phase).toBe(MatchPhase.Finished)
    expect(state.winnerIndex).toBe(0)
  })

  it('speed limit blocks high miles', () => {
    const state = createMatch(['Alice', 'Bob'], [true, true], defaultConfig(11))
    const alice = state.players[0]!
    alice.battlePile = [CardId.Drive]
    alice.speedPile = [CardId.SpeedLimit]
    expect(canPlayDistance(state, 0, CardId.Miles100)).toBe(false)
    expect(canPlayDistance(state, 0, CardId.Miles50)).toBe(true)
  })

  it('emergency vehicle removes need for Drive', () => {
    const state = createMatch(['Alice', 'Bob'], [true, true], defaultConfig(13))
    state.players[0]!.safeties = [CardId.EmergencyVehicle]
    state.players[0]!.battlePile = []
    expect(canPlayDistance(state, 0, CardId.Miles25)).toBe(true)
  })

  it('coup fourre cancels hazard', () => {
    const state = createMatch(['Alice', 'Bob'], [true, true], defaultConfig(15))
    const alice = state.players[0]!
    const bob = state.players[1]!
    alice.hand = [CardId.FlatTire]
    bob.battlePile = [CardId.Drive]
    bob.hand = [CardId.PunctureProof, CardId.Miles25]
    expect(tryApply(state, playMove(0, 0, CardId.FlatTire, 1)).ok).toBe(true)
    expect(state.phase).toBe(MatchPhase.AwaitingCoupFourre)
    expect(tryApply(state, coupMove(1, 0, CardId.PunctureProof)).ok).toBe(true)
    expect(state.currentPlayer).toBe(1)
    expect(bob.safeties).toContain(CardId.PunctureProof)
    expect(state.coupFourreCount).toBe(1)
    // Discard has the cancelled hazard → Bob must choose a pile.
    expect(state.phase).toBe(MatchPhase.AwaitingDraw)
  })

  it('immune player cannot be hit', () => {
    const state = createMatch(['Alice', 'Bob'], [true, true], defaultConfig(17))
    state.players[1]!.safeties = [CardId.PunctureProof]
    state.players[1]!.battlePile = [CardId.Drive]
    expect(canPlayHazard(state, 0, 1, CardId.FlatTire)).toBe(false)
  })

  it('max two 200 mile cards', () => {
    const state = createMatch(['Alice', 'Bob'], [true, true], defaultConfig(19))
    state.players[0]!.battlePile = [CardId.Drive]
    state.players[0]!.miles200Played = 2
    expect(canPlayDistance(state, 0, CardId.Miles200)).toBe(false)
  })

  it('safety grants extra turn', () => {
    const state = createMatch(['Alice', 'Bob'], [true, true], defaultConfig(21))
    const alice = state.players[0]!
    const before = state.currentPlayer
    alice.hand = [CardId.DrivingAce]
    state.discardPile = []
    const drawBefore = state.drawPile.length
    expect(tryApply(state, playMove(0, 0, CardId.DrivingAce)).ok).toBe(true)
    expect(state.currentPlayer).toBe(before)
    expect(alice.safeties).toContain(CardId.DrivingAce)
    // Empty discard → auto-draw for bonus turn.
    expect(state.phase).toBe(MatchPhase.Playing)
    expect(state.drawPile.length).toBeLessThan(drawBefore)
  })

  it('battle remedy restores GO for miles', () => {
    const state = createMatch(['Alice', 'Bob'], [true, true], defaultConfig(23))
    const alice = state.players[0]!
    alice.battlePile = [CardId.SpareTire]
    alice.hand = [CardId.Miles25]
    expect(canPlayDistance(state, 0, CardId.Miles25)).toBe(true)
    expect(tryApply(state, playMove(0, 0, CardId.Miles25)).ok).toBe(true)
    expect(alice.miles).toBe(25)
  })

  it('hazard can hit a player showing a fix remedy', () => {
    const state = createMatch(['Alice', 'Bob'], [true, true], defaultConfig(25))
    state.players[1]!.battlePile = [CardId.Gasoline]
    expect(canPlayHazard(state, 0, 1, CardId.FlatTire)).toBe(true)
  })

  it('reshuffles discard into draw when draw pile is empty', () => {
    const state = createMatch(['Alice', 'Bob'], [true, true], defaultConfig(27))
    const alice = state.players[0]!
    const bob = state.players[1]!
    state.drawPile = []
    state.discardPile = [CardId.Miles25, CardId.Miles50, CardId.Drive, CardId.Miles100]
    alice.hand = [CardId.Miles25]
    alice.battlePile = [CardId.Drive]
    bob.hand = []
    expect(tryApply(state, playMove(0, 0, CardId.Miles25)).ok).toBe(true)
    expect(state.currentPlayer).toBe(1)
    expect(state.phase).toBe(MatchPhase.AwaitingDraw)
    expect(tryApply(state, drawDeckMove(1)).ok).toBe(true)
    expect(bob.hand.length).toBe(1)
    expect(state.lastMessage).toMatch(/shuffled|drew from the deck/i)
  })

  it('can take the top discard instead of drawing', () => {
    const state = createMatch(['Alice', 'Bob'], [true, true], defaultConfig(29))
    state.phase = MatchPhase.AwaitingDraw
    state.currentPlayer = 0
    state.discardPile = [CardId.Drive]
    state.drawPile = [CardId.Miles25, CardId.Miles50]
    const before = state.players[0]!.hand.length
    expect(tryApply(state, drawDiscardMove(0)).ok).toBe(true)
    expect(state.phase).toBe(MatchPhase.Playing)
    expect(state.players[0]!.hand.length).toBe(before + 1)
    expect(state.players[0]!.hand).toContain(CardId.Drive)
    expect(state.discardPile.length).toBe(0)
  })
})
