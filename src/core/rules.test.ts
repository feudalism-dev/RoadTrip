import { CardId, MatchPhase } from './cards'
import { defaultConfig, canDrive } from './state'
import {
  createMatch,
  canPlayDistance,
  canPlayHazard,
  tryApply,
  playMove,
  coupMove,
  drawDeckMove,
  drawDiscardMove,
  discardMove,
  autoClubAcceptMove,
  autoClubDeclineMove,
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

  it('counter attack cancels hazard', () => {
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

  it('skips Auto Club at 5 stuck turns if the driver has under 100 miles', () => {
    const state = stallUnderHazard(50, 4)
    expect(tryApply(state, discardMove(0, 0, CardId.Miles25)).ok).toBe(true)
    expect(state.players[0]!.stuckTurns).toBe(5)
    expect(state.phase).not.toBe(MatchPhase.AwaitingAutoClub)
    expect(state.currentPlayer).toBe(1)
  })

  it('offers a 100-mile Auto Club tow after 5 stuck turns', () => {
    const state = stallUnderHazard(200, 4)
    expect(tryApply(state, discardMove(0, 0, CardId.Miles25)).ok).toBe(true)
    expect(state.phase).toBe(MatchPhase.AwaitingAutoClub)
    expect(state.pendingAutoClub).toEqual({ playerIndex: 0, cost: 100 })
    expect(state.currentPlayer).toBe(0)
  })

  it('Auto Club yes subtracts miles and clears the hazard', () => {
    const state = stallUnderHazard(200, 4)
    expect(tryApply(state, discardMove(0, 0, CardId.Miles25)).ok).toBe(true)
    expect(tryApply(state, autoClubAcceptMove(0)).ok).toBe(true)
    expect(state.players[0]!.miles).toBe(100)
    expect(canDrive(state.players[0]!)).toBe(true)
    expect(state.players[0]!.stuckTurns).toBe(0)
    expect(state.phase).not.toBe(MatchPhase.AwaitingAutoClub)
    expect(state.currentPlayer).toBe(1)
  })

  it('Auto Club no leaves the hazard and waits for the next tier', () => {
    const state = stallUnderHazard(200, 4)
    expect(tryApply(state, discardMove(0, 0, CardId.Miles25)).ok).toBe(true)
    expect(tryApply(state, autoClubDeclineMove(0)).ok).toBe(true)
    expect(state.players[0]!.miles).toBe(200)
    expect(state.players[0]!.stuckTurns).toBe(5)
    expect(canDrive(state.players[0]!)).toBe(false)
    expect(state.currentPlayer).toBe(1)
  })

  it('offers a 50-mile tow at 10 stuck turns when 100 was unaffordable', () => {
    const state = stallUnderHazard(50, 9)
    expect(tryApply(state, discardMove(0, 0, CardId.Miles25)).ok).toBe(true)
    expect(state.phase).toBe(MatchPhase.AwaitingAutoClub)
    expect(state.pendingAutoClub?.cost).toBe(50)
  })

  it('Highway Patrol tows for free at 20 stuck turns', () => {
    const state = stallUnderHazard(80, 19)
    expect(tryApply(state, discardMove(0, 0, CardId.Miles25)).ok).toBe(true)
    expect(state.players[0]!.miles).toBe(80)
    expect(canDrive(state.players[0]!)).toBe(true)
    expect(state.phase).not.toBe(MatchPhase.AwaitingAutoClub)
    expect(state.lastMessage).toMatch(/Highway Patrol/)
    expect(state.currentPlayer).toBe(1)
  })

  it('a new battle hazard resets the stuck count', () => {
    const state = stallUnderHazard(200, 4)
    expect(tryApply(state, discardMove(0, 0, CardId.Miles25)).ok).toBe(true)
    expect(tryApply(state, autoClubAcceptMove(0)).ok).toBe(true)
    const bob = state.players[1]!
    bob.hand = [CardId.Accident]
    state.phase = MatchPhase.Playing
    state.currentPlayer = 1
    expect(tryApply(state, playMove(1, 0, CardId.Accident, 0)).ok).toBe(true)
    expect(state.players[0]!.stuckHazard).toBe(CardId.Accident)
    expect(state.players[0]!.stuckTurns).toBe(0)
  })

  it('does not offer Auto Club when the driver still holds the matching remedy', () => {
    const state = stallUnderHazard(200, 4)
    state.players[0]!.hand = [CardId.SpareTire, CardId.Miles25]
    expect(tryApply(state, discardMove(0, 1, CardId.Miles25)).ok).toBe(true)
    expect(state.phase).not.toBe(MatchPhase.AwaitingAutoClub)
    expect(state.players[0]!.stuckTurns).toBe(5)
  })
})

function stallUnderHazard(miles: number, stuckTurns: number) {
  const state = createMatch(['Alice', 'Bob'], [true, true], defaultConfig(31))
  const alice = state.players[0]!
  alice.battlePile = [CardId.Drive, CardId.FlatTire]
  alice.stuckHazard = CardId.FlatTire
  alice.stuckTurns = stuckTurns
  alice.miles = miles
  alice.hand = [CardId.Miles25]
  state.phase = MatchPhase.Playing
  state.currentPlayer = 0
  state.pendingAutoClub = null
  state.discardPile = []
  return state
}
