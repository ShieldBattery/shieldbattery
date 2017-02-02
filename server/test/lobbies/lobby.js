import chai, { expect } from 'chai'
import chaiImmutable from 'chai-immutable'

chai.use(chaiImmutable)

import * as Lobbies from '../../lib/lobbies/lobby'
import * as Slots from '../../lib/lobbies/slot'
import {
  findSlotByName,
  findSlotById,
  humanSlotsCountPerLobby,
  hasOpposingSides,
} from '../../../app/common/lobbies'

const BOXER_LOBBY = Lobbies.create(
    '5v3 Comp Stomp Pros Only', 'Big Game Hunters.scm', 'melee', 0, 4, 'Slayers`Boxer')

describe('Lobbies - melee', () => {
  it('should create the lobby correctly', () => {
    const l = BOXER_LOBBY
    expect(l.teams).to.have.size(1)
    const team = l.teams.get(0)
    expect(team.slots).to.have.size(4)
    expect(humanSlotsCountPerLobby(l)).to.equal(1)
    expect(hasOpposingSides(l)).to.be.false
    const player = team.slots.get(0)
    expect(player.type).to.equal('human')
    expect(player.name).to.equal('Slayers`Boxer')
    expect(player.race).to.equal('r')
    expect(player).to.equal(l.host)
    expect(team.slots.get(1).type).to.equal('open')
    expect(team.slots.get(2).type).to.equal('open')
    expect(team.slots.get(3).type).to.equal('open')
  })

  it('should support summarized JSON serialization', () => {
    // stringifying and then parsing ensures that the structure has no circular references
    const json = JSON.stringify(Lobbies.toSummaryJson(BOXER_LOBBY))
    const parsed = JSON.parse(json)

    const host = BOXER_LOBBY.host.toJS()
    expect(parsed).to.eql({
      name: '5v3 Comp Stomp Pros Only',
      map: 'Big Game Hunters.scm',
      gameType: 'melee',
      gameSubType: 0,
      host,
      openSlots: 3,
    })
  })

  it('should find available slot', () => {
    const [t1, s1] = Lobbies.findAvailableSlot(BOXER_LOBBY)
    expect(t1).to.eql(0)
    expect(s1).to.eql(1)

    const fullLobby = Lobbies.create('Full', 'Lost Temple.scm', 'melee', 0, 1, 'pachi')
    const [t2, s2] = Lobbies.findAvailableSlot(fullLobby)
    expect(t2).to.eql(-1)
    expect(s2).to.eql(-1)
  })

  it('should support adding players', () => {
    const babo = Slots.createHuman('dronebabo', 'z')
    const pachi = Slots.createHuman('pachi', 'p')

    const orig = BOXER_LOBBY
    let lobby = orig

    const [t1, s1] = Lobbies.findAvailableSlot(lobby)
    lobby = Lobbies.addPlayer(lobby, t1, s1, babo)
    expect(lobby).to.not.equal(orig)
    const [, , p1] = findSlotById(lobby, babo.id)
    expect(p1).to.equal(babo)
    expect(humanSlotsCountPerLobby(lobby)).to.equal(2)
    expect(hasOpposingSides(lobby)).to.be.true

    const [t2, s2] = Lobbies.findAvailableSlot(lobby)
    lobby = Lobbies.addPlayer(lobby, t2, s2, pachi)
    expect(lobby).to.not.equal(orig)
    const [, , p2] = findSlotById(lobby, pachi.id)
    expect(p2).to.equal(pachi)
    expect(humanSlotsCountPerLobby(lobby)).to.equal(3)
  })

  it('should support removing players', () => {
    const orig = BOXER_LOBBY
    const [t1, s1, p1] = findSlotByName(orig, 'asdf')
    let lobby = Lobbies.removePlayer(orig, t1, s1, p1)
    expect(lobby).to.equal(orig)

    const babo = Slots.createHuman('dronebabo', 'z')
    const [t2, s2] = Lobbies.findAvailableSlot(lobby)
    lobby = Lobbies.addPlayer(lobby, t2, s2, babo)
    const beforeRemoval = lobby
    lobby = Lobbies.removePlayer(lobby, t2, s2, babo)

    expect(lobby).to.not.equal(beforeRemoval)
    expect(humanSlotsCountPerLobby(lobby)).to.equal(1)
    expect(lobby.teams.get(t2).slots.get(s2).type).to.equal('open')

    const [t3, s3, host] = findSlotByName(lobby, lobby.host.name)
    lobby = Lobbies.removePlayer(lobby, t3, s3, host)
    expect(lobby).to.be.null
  })

  it('should support setting the race of a player', () => {
    const computer = Slots.createComputer('t')
    const [t1, s1] = Lobbies.findAvailableSlot(BOXER_LOBBY)
    let lobby = Lobbies.addPlayer(BOXER_LOBBY, t1, s1, computer)

    lobby = Lobbies.setRace(lobby, t1, s1, 'z')

    expect(lobby.teams.get(t1).slots.get(s1).race).to.equal('z')
  })

  it('should support finding players by name', () => {
    const computer = Slots.createComputer('p')
    const [t1, s1] = Lobbies.findAvailableSlot(BOXER_LOBBY)
    const lobby = Lobbies.addPlayer(BOXER_LOBBY, t1, s1, computer)

    const [, , p1] = findSlotByName(lobby, 'asdf')
    expect(p1).to.be.undefined

    const [, , p2] = findSlotByName(lobby, computer.name)
    expect(p2).to.be.undefined

    const [, , p3] = findSlotByName(lobby, 'Slayers`Boxer')
    expect(p3).to.not.be.undefined
    expect(p3.type).to.equal('human')
    expect(p3.name).to.equal('Slayers`Boxer')
  })

  it('should support finding players by id', () => {
    const computer = Slots.createComputer('p')
    const [t1, s1] = Lobbies.findAvailableSlot(BOXER_LOBBY)
    const lobby = Lobbies.addPlayer(BOXER_LOBBY, t1, s1, computer)

    const [, , p1] = findSlotById(lobby, 10)
    expect(p1).to.be.undefined

    const [, , p2] = findSlotById(lobby, computer.id)
    expect(p2).to.not.be.undefined
    expect(p2.type).to.equal('computer')
    expect(p2.name).to.equal('Computer')
    expect(p2.race).to.equal('p')
  })

  it('should close the lobby if only computers are left', () => {
    const computer = Slots.createComputer('p')
    const [t1, s1] = Lobbies.findAvailableSlot(BOXER_LOBBY)
    let lobby = Lobbies.addPlayer(BOXER_LOBBY, t1, s1, computer)

    const [t2, s2, p1] = findSlotById(lobby, lobby.host.id)
    lobby = Lobbies.removePlayer(lobby, t2, s2, p1)

    expect(lobby).to.be.null
  })

  it('should support transferring host status to the next oldest player on host removal', () => {
    const computer = Slots.createComputer('p')
    const babo = Slots.createHuman('dronebabo', 'z')
    const pachi = Slots.createHuman('pachi', 't')
    const [t1, s1] = Lobbies.findAvailableSlot(BOXER_LOBBY)
    let lobby = Lobbies.addPlayer(BOXER_LOBBY, t1, s1, computer)
    const [t2, s2] = Lobbies.findAvailableSlot(lobby)
    lobby = Lobbies.addPlayer(lobby, t2, s2, babo)
    const [t3, s3] = Lobbies.findAvailableSlot(lobby)
    lobby = Lobbies.addPlayer(lobby, t3, s3, pachi)

    const [t4, s4, p1] = findSlotById(lobby, lobby.host.id)
    lobby = Lobbies.removePlayer(lobby, t4, s4, p1)

    expect(lobby.host).to.equal(babo)
  })

  it('should support moving players between slots', () => {
    const babo = Slots.createHuman('dronebabo', 'z')
    const [t1, s1] = Lobbies.findAvailableSlot(BOXER_LOBBY)
    let lobby = Lobbies.addPlayer(BOXER_LOBBY, t1, s1, babo)
    lobby = Lobbies.movePlayerToSlot(lobby, t1, s1, 0, 3)

    expect(humanSlotsCountPerLobby(lobby)).to.equal(2)
    expect(lobby.teams.get(0).slots.get(3)).to.equal(babo)
    expect(lobby.teams.get(t1).slots.get(s1).type).to.equal('open')
  })
})

const TEAM_LOBBY = Lobbies.create(
    '2v6 BGH', 'Big Game Hunters.scm', 'topVBottom', 2, 8, 'Slayers`Boxer')

describe('Lobbies - Top vs bottom', () => {
  it('should create the lobby correctly', () => {
    const l = TEAM_LOBBY
    expect(l.teams).to.have.size(2)
    const team1 = l.teams.get(0)
    expect(team1.slots).to.have.size(2)
    const team2 = l.teams.get(1)
    expect(team2.slots).to.have.size(6)
    expect(humanSlotsCountPerLobby(l)).to.equal(1)
    expect(hasOpposingSides(l)).to.be.false
    const player = team1.slots.get(0)
    expect(player.type).to.equal('human')
    expect(player.name).to.equal('Slayers`Boxer')
    expect(player.race).to.equal('r')
    expect(player).to.equal(l.host)
    expect(team1.slots.get(1).type).to.equal('open')
    expect(team2.slots.get(0).type).to.equal('open')
    expect(team2.slots.get(1).type).to.equal('open')
    expect(team2.slots.get(2).type).to.equal('open')
    expect(team2.slots.get(3).type).to.equal('open')
    expect(team2.slots.get(4).type).to.equal('open')
    expect(team2.slots.get(5).type).to.equal('open')
  })

  it('should balance teams when adding new players', () => {
    expect(hasOpposingSides(TEAM_LOBBY)).to.be.false
    const [t1, s1] = Lobbies.findAvailableSlot(TEAM_LOBBY)
    expect(t1).to.eql(1)
    expect(s1).to.eql(0)
    const babo = Slots.createHuman('dronebabo', 'z')
    let l = Lobbies.addPlayer(TEAM_LOBBY, t1, s1, babo)
    expect(hasOpposingSides(l)).to.be.true

    const [t2, s2] = Lobbies.findAvailableSlot(l)
    expect(t2).to.eql(1)
    expect(s2).to.eql(1)
    const pachi = Slots.createHuman('pachi', 't')
    l = Lobbies.addPlayer(l, t2, s2, pachi)

    const [t3, s3] = Lobbies.findAvailableSlot(l)
    expect(t3).to.eql(1)
    expect(s3).to.eql(2)
    const computer1 = Slots.createComputer('p')
    l = Lobbies.addPlayer(l, t3, s3, computer1)

    const [t4, s4] = Lobbies.findAvailableSlot(l)
    expect(t4).to.eql(1)
    expect(s4).to.eql(3)
    const computer2 = Slots.createComputer('z')
    l = Lobbies.addPlayer(l, t4, s4, computer2)

    const [t5, s5] = Lobbies.findAvailableSlot(l)
    expect(t5).to.eql(1)
    expect(s5).to.eql(4)
    const computer3 = Slots.createComputer('z')
    l = Lobbies.addPlayer(l, t5, s5, computer3)

    const [t6, s6] = Lobbies.findAvailableSlot(l)
    expect(t6).to.eql(0)
    expect(s6).to.eql(1)
    const computer4 = Slots.createComputer('z')
    l = Lobbies.addPlayer(l, t6, s6, computer4)

    const [t7, s7] = Lobbies.findAvailableSlot(l)
    expect(t7).to.eql(1)
    expect(s7).to.eql(5)
    const computer5 = Slots.createComputer('z')
    l = Lobbies.addPlayer(l, t7, s7, computer5)

    const [t8, s8] = Lobbies.findAvailableSlot(l)
    expect(t8).to.eql(-1)
    expect(s8).to.eql(-1)
  })

  it('should support moving players between slots', () => {
    const [t1, s1] = Lobbies.findAvailableSlot(TEAM_LOBBY)
    const babo = Slots.createHuman('dronebabo', 'z')
    let lobby = Lobbies.addPlayer(TEAM_LOBBY, t1, s1, babo)
    lobby = Lobbies.movePlayerToSlot(lobby, t1, s1, 1, 3)

    expect(humanSlotsCountPerLobby(lobby)).to.equal(2)
    expect(lobby.teams.get(1).slots.get(3)).to.equal(babo)
    expect(lobby.teams.get(t1).slots.get(s1).type).to.equal('open')
  })
})

const TEAM_MELEE_2 = Lobbies.create(
  '4v4 Team Melee', 'Lost Temple.scm', 'teamMelee', 2, 8, 'Slayers`Boxer')
const TEAM_MELEE_3 = Lobbies.create(
  '3v3v2 Team Melee', 'Lost Temple.scm', 'teamMelee', 3, 8, 'Slayers`Boxer')
const TEAM_MELEE_4 = Lobbies.create(
  '2v2v2v2 Team Melee', 'Blue Storm.scx', 'teamMelee', 4, 8, 'Slayers`Boxer')

describe('Lobbies - Team melee', () => {
  it('should create the lobby correctly', () => {
    const l2 = TEAM_MELEE_2
    expect(l2.teams).to.have.size(2)
    let team1 = l2.teams.get(0)
    expect(team1.slots).to.have.size(4)
    let team2 = l2.teams.get(1)
    expect(team2.slots).to.have.size(4)
    expect(humanSlotsCountPerLobby(l2)).to.equal(1)
    expect(hasOpposingSides(l2)).to.be.false
    let player = team1.slots.get(0)
    expect(player.type).to.equal('human')
    expect(player.name).to.equal('Slayers`Boxer')
    expect(player.race).to.equal('r')
    expect(player).to.equal(l2.host)
    let controlledOpen1 = team1.slots.get(1)
    expect(controlledOpen1.type).to.equal('controlledOpen')
    expect(controlledOpen1.race).to.equal(player.race)
    expect(controlledOpen1.controlledBy).to.equal(player.id)
    let controlledOpen2 = team1.slots.get(2)
    expect(controlledOpen2.type).to.equal('controlledOpen')
    expect(controlledOpen2.race).to.equal(player.race)
    expect(controlledOpen2.controlledBy).to.equal(player.id)
    const controlledOpen3 = team1.slots.get(3)
    expect(controlledOpen3.type).to.equal('controlledOpen')
    expect(controlledOpen3.race).to.equal(player.race)
    expect(controlledOpen3.controlledBy).to.equal(player.id)
    expect(team2.slots.get(0).type).to.equal('open')
    expect(team2.slots.get(1).type).to.equal('open')
    expect(team2.slots.get(2).type).to.equal('open')
    expect(team2.slots.get(3).type).to.equal('open')

    const l3 = TEAM_MELEE_3
    expect(l3.teams).to.have.size(3)
    team1 = l3.teams.get(0)
    expect(team1.slots).to.have.size(3)
    team2 = l3.teams.get(1)
    expect(team2.slots).to.have.size(3)
    let team3 = l3.teams.get(2)
    expect(team3.slots).to.have.size(2)
    expect(humanSlotsCountPerLobby(l3)).to.equal(1)
    expect(hasOpposingSides(l3)).to.be.false
    player = team1.slots.get(0)
    expect(player.type).to.equal('human')
    expect(player.name).to.equal('Slayers`Boxer')
    expect(player.race).to.equal('r')
    expect(player).to.equal(l3.host)
    controlledOpen1 = team1.slots.get(1)
    expect(controlledOpen1.type).to.equal('controlledOpen')
    expect(controlledOpen1.race).to.equal(player.race)
    expect(controlledOpen1.controlledBy).to.equal(player.id)
    controlledOpen2 = team1.slots.get(2)
    expect(controlledOpen2.type).to.equal('controlledOpen')
    expect(controlledOpen2.race).to.equal(player.race)
    expect(controlledOpen2.controlledBy).to.equal(player.id)
    expect(team2.slots.get(0).type).to.equal('open')
    expect(team2.slots.get(1).type).to.equal('open')
    expect(team2.slots.get(2).type).to.equal('open')
    expect(team3.slots.get(0).type).to.equal('open')
    expect(team3.slots.get(1).type).to.equal('open')

    const l4 = TEAM_MELEE_4
    expect(l4.teams).to.have.size(4)
    team1 = l4.teams.get(0)
    expect(team1.slots).to.have.size(2)
    team2 = l4.teams.get(1)
    expect(team2.slots).to.have.size(2)
    team3 = l4.teams.get(2)
    expect(team3.slots).to.have.size(2)
    const team4 = l4.teams.get(3)
    expect(team4.slots).to.have.size(2)
    expect(humanSlotsCountPerLobby(l4)).to.equal(1)
    expect(hasOpposingSides(l4)).to.be.false
    player = team1.slots.get(0)
    expect(player.type).to.equal('human')
    expect(player.name).to.equal('Slayers`Boxer')
    expect(player.race).to.equal('r')
    expect(player).to.equal(l4.host)
    controlledOpen1 = team1.slots.get(1)
    expect(controlledOpen1.type).to.equal('controlledOpen')
    expect(controlledOpen1.race).to.equal(player.race)
    expect(controlledOpen1.controlledBy).to.equal(player.id)
    expect(team2.slots.get(0).type).to.equal('open')
    expect(team2.slots.get(1).type).to.equal('open')
    expect(team3.slots.get(0).type).to.equal('open')
    expect(team3.slots.get(1).type).to.equal('open')
    expect(team4.slots.get(0).type).to.equal('open')
    expect(team4.slots.get(1).type).to.equal('open')
  })

  it('should fill team slots when a player is added to an empty team', () => {
    const babo = Slots.createHuman('dronebabo', 'z')
    const l = Lobbies.addPlayer(TEAM_MELEE_2, 1, 0, babo)
    expect(humanSlotsCountPerLobby(l)).to.equal(2)
    expect(hasOpposingSides(l)).to.be.true
    expect(l.teams.get(1).slots.get(0)).to.equal(babo)
    const controlledOpen = l.teams.get(1).slots.get(1)
    expect(controlledOpen.type).to.equal('controlledOpen')
    expect(controlledOpen.race).to.equal(babo.race)
    expect(controlledOpen.controlledBy).to.equal(babo.id)
  })

  it('should allow players to join slots that were previously controlled opens', () => {
    expect(TEAM_MELEE_4.teams.get(0).slots.get(1).type).to.equal('controlledOpen')
    const babo = Slots.createHuman('dronebabo', 'z')
    const l = Lobbies.addPlayer(TEAM_MELEE_4, 0, 1, babo)
    expect(humanSlotsCountPerLobby(l)).to.equal(2)
    expect(hasOpposingSides(l)).to.be.false
    expect(l.teams.get(0).slots.get(1)).to.equal(babo)
  })

  it('should fill team slots with computers when a computer is added to an empty team', () => {
    const comp = Slots.createComputer('z')
    const l = Lobbies.addPlayer(TEAM_MELEE_4, 1, 0, comp)
    expect(humanSlotsCountPerLobby(l)).to.equal(1)
    expect(hasOpposingSides(l)).to.be.true
    expect(l.teams.get(1).slots.get(0)).to.equal(comp)
    expect(l.teams.get(1).slots.get(1).type).to.equal('computer')
  })

  it('should balance teams when adding new players', () => {
    expect(hasOpposingSides(TEAM_MELEE_4)).to.be.false
    const [t1, s1] = Lobbies.findAvailableSlot(TEAM_MELEE_4)
    expect(t1).to.eql(1)
    expect(s1).to.eql(0)
    const babo = Slots.createHuman('dronebabo', 'z')
    let l = Lobbies.addPlayer(TEAM_MELEE_4, t1, s1, babo)
    expect(hasOpposingSides(l)).to.be.true

    const [t2, s2] = Lobbies.findAvailableSlot(l)
    expect(t2).to.eql(2)
    expect(s2).to.eql(0)
    const pachi = Slots.createHuman('pachi', 't')
    l = Lobbies.addPlayer(l, t2, s2, pachi)

    const [t3, s3] = Lobbies.findAvailableSlot(l)
    expect(t3).to.eql(3)
    expect(s3).to.eql(0)
    const computer1 = Slots.createComputer('p')
    l = Lobbies.addPlayer(l, t3, s3, computer1)

    const [t4, s4] = Lobbies.findAvailableSlot(l)
    expect(t4).to.eql(0)
    expect(s4).to.eql(1)
    const trozz = Slots.createHuman('trozz', 'p')
    l = Lobbies.addPlayer(l, t4, s4, trozz)

    const [t5, s5] = Lobbies.findAvailableSlot(l)
    expect(t5).to.eql(1)
    expect(s5).to.eql(1)
    const intothetest = Slots.createHuman('IntoTheTest', 'p')
    l = Lobbies.addPlayer(l, t5, s5, intothetest)

    const [t6, s6] = Lobbies.findAvailableSlot(l)
    expect(t6).to.eql(2)
    expect(s6).to.eql(1)
    const harem = Slots.createHuman('harem', 'p')
    l = Lobbies.addPlayer(l, t6, s6, harem)

    const [t7, s7] = Lobbies.findAvailableSlot(l)
    expect(t7).to.eql(-1)
    expect(s7).to.eql(-1)
  })

  it('should remove the controlled open slots when the last player on a team leaves', () => {
    const babo = Slots.createHuman('dronebabo', 'z')
    let l = Lobbies.addPlayer(TEAM_MELEE_4, 1, 0, babo)
    const controlledOpen = l.teams.get(1).slots.get(1)
    expect(controlledOpen.type).to.equal('controlledOpen')
    expect(controlledOpen.race).to.equal(babo.race)
    expect(controlledOpen.controlledBy).to.equal(babo.id)
    l = Lobbies.removePlayer(l, 1, 0, babo)

    expect(humanSlotsCountPerLobby(l)).to.equal(1)
    expect(hasOpposingSides(l)).to.be.false
    expect(l.teams.get(1).slots.get(0).type).to.equal('open')
    expect(l.teams.get(1).slots.get(1).type).to.equal('open')

    expect(Lobbies.removePlayer(l, 0, 0, l.host)).to.be.null
  })

  it('should remove all the computers in a team whenever one of the computers is removed', () => {
    const comp1 = Slots.createComputer('z')
    let l = Lobbies.addPlayer(TEAM_MELEE_4, 1, 0, comp1)
    const comp2 = l.teams.get(1).slots.get(1)
    expect(comp2.type).to.equal('computer')
    expect(comp2.race).to.equal(comp1.race)
    l = Lobbies.removePlayer(l, 1, 0, comp1)

    expect(humanSlotsCountPerLobby(l)).to.equal(1)
    expect(hasOpposingSides(l)).to.be.false
    expect(l.teams.get(1).slots.get(0).type).to.equal('open')
    expect(l.teams.get(1).slots.get(1).type).to.equal('open')

    expect(l.host.name).to.equal('Slayers`Boxer')
  })

  it('should reassign slot control if the controller leaves', () => {
    const babo = Slots.createHuman('dronebabo', 'z')
    let l = Lobbies.addPlayer(TEAM_MELEE_2, 0, 1, babo)
    l = Lobbies.removePlayer(l, 0, 0, l.host)

    expect(humanSlotsCountPerLobby(l)).to.equal(1)
    expect(hasOpposingSides(l)).to.be.false
    expect(l.host).to.equal(babo)
    expect(l.teams.get(0).slots.get(1)).to.equal(babo)
    const controlledOpen1 = l.teams.get(0).slots.get(0)
    expect(controlledOpen1.type).to.equal('controlledOpen')
    expect(controlledOpen1.race).to.equal('r')
    expect(controlledOpen1.controlledBy).to.equal(babo.id)
    // Ensure the player in the leaving player's slot got a new ID
    expect(controlledOpen1.id).to.not.equal(TEAM_MELEE_2.host.id)
    const controlledOpen2 = l.teams.get(0).slots.get(2)
    expect(controlledOpen2.type).to.equal('controlledOpen')
    expect(controlledOpen2.race).to.equal('r')
    expect(controlledOpen2.controlledBy).to.equal(babo.id)
    const controlledOpen3 = l.teams.get(0).slots.get(3)
    expect(controlledOpen3.type).to.equal('controlledOpen')
    expect(controlledOpen3.race).to.equal('r')
    expect(controlledOpen3.controlledBy).to.equal(babo.id)
  })

  it('should support moving players between slots in the same team', () => {
    const babo = Slots.createHuman('dronebabo', 'z')
    let l = Lobbies.addPlayer(TEAM_MELEE_2, 0, 1, babo)
    l = Lobbies.movePlayerToSlot(l, 0, 1, 0, 2)

    expect(humanSlotsCountPerLobby(l)).to.equal(2)
    expect(hasOpposingSides(l)).to.be.false

    const controlledOpen1 = l.teams.get(0).slots.get(1)
    expect(controlledOpen1.type).to.equal('controlledOpen')
    expect(controlledOpen1.race).to.equal('r')
    expect(controlledOpen1.controlledBy).to.equal(l.host.id)
    const controlledOpen2 = l.teams.get(0).slots.get(3)
    expect(controlledOpen2.type).to.equal('controlledOpen')
    expect(controlledOpen2.race).to.equal(l.host.race)
    expect(controlledOpen2.controlledBy).to.equal(l.host.id)
  })
})
