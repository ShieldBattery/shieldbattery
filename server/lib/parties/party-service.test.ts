import { NydusServer } from 'nydus'
import { NotificationType } from '../../../common/notifications'
import { PartyUser } from '../../../common/parties'
import NotificationService from '../notifications/notification-service'
import { createFakeNotificationService } from '../notifications/testing/notification-service'
import { FakeClock } from '../time/testing/fake-clock'
import { RequestSessionLookup } from '../websockets/session-lookup'
import { ClientSocketsManager } from '../websockets/socket-groups'
import {
  clearTestLogs,
  createFakeNydusServer,
  InspectableNydusClient,
  NydusConnector,
} from '../websockets/testing/websockets'
import { TypedPublisher } from '../websockets/typed-publisher'
import PartyService, { getPartyPath, PartyRecord, toPartyJson } from './party-service'

describe('parties/party-service', () => {
  const user1: PartyUser = { id: 1, name: 'pachi' }
  const user2: PartyUser = { id: 2, name: 'harem' }
  const user3: PartyUser = { id: 3, name: 'intrigue' }
  const user4: PartyUser = { id: 4, name: 'tec27' }
  const user5: PartyUser = { id: 5, name: 'heyoka' }
  const user6: PartyUser = { id: 6, name: 'hot_bid' }
  const user7: PartyUser = { id: 7, name: 'royo' }
  const user8: PartyUser = { id: 8, name: 'riptide' }
  const user9: PartyUser = { id: 9, name: 'manifesto7' }
  const offlineUser: PartyUser = { id: 10, name: 'tt1' }
  const webUser: PartyUser = { id: 11, name: 'nyoken' }

  const USER1_CLIENT_ID = 'USER1_CLIENT_ID'
  const USER2_CLIENT_ID = 'USER2_CLIENT_ID'
  const USER3_CLIENT_ID = 'USER3_CLIENT_ID'
  const USER4_CLIENT_ID = 'USER4_CLIENT_ID'
  const USER5_CLIENT_ID = 'USER5_CLIENT_ID'
  const USER6_CLIENT_ID = 'USER6_CLIENT_ID'
  const USER7_CLIENT_ID = 'USER7_CLIENT_ID'
  const USER8_CLIENT_ID = 'USER8_CLIENT_ID'
  const USER9_CLIENT_ID = 'USER9_CLIENT_ID'
  const WEB_USER_CLIENT_ID = 'WEB_USER_CLIENT_ID'

  let client1: InspectableNydusClient
  let client2: InspectableNydusClient
  let client3: InspectableNydusClient
  let client4: InspectableNydusClient
  let client5: InspectableNydusClient
  let client6: InspectableNydusClient
  let client7: InspectableNydusClient
  let client8: InspectableNydusClient
  let client9: InspectableNydusClient
  let webClient: InspectableNydusClient

  let nydus: NydusServer
  let partyService: PartyService
  let connector: NydusConnector
  let notificationService: NotificationService
  let clock: FakeClock

  const currentTime = Date.now()

  beforeEach(() => {
    nydus = createFakeNydusServer()
    const sessionLookup = new RequestSessionLookup()
    const clientSocketsManager = new ClientSocketsManager(nydus, sessionLookup)
    const publisher = new TypedPublisher(nydus)
    notificationService = createFakeNotificationService()
    clock = new FakeClock()
    clock.setCurrentTime(currentTime)

    partyService = new PartyService(publisher, clientSocketsManager, notificationService, clock)
    connector = new NydusConnector(nydus, sessionLookup)

    client1 = connector.connectClient(user1, USER1_CLIENT_ID)
    client2 = connector.connectClient(user2, USER2_CLIENT_ID)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    client3 = connector.connectClient(user3, USER3_CLIENT_ID)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    client4 = connector.connectClient(user4, USER4_CLIENT_ID)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    client5 = connector.connectClient(user5, USER5_CLIENT_ID)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    client6 = connector.connectClient(user6, USER6_CLIENT_ID)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    client7 = connector.connectClient(user7, USER7_CLIENT_ID)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    client8 = connector.connectClient(user8, USER8_CLIENT_ID)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    client9 = connector.connectClient(user9, USER9_CLIENT_ID)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    webClient = connector.connectClient(webUser, WEB_USER_CLIENT_ID, 'web')

    clearTestLogs(nydus)
  })

  describe('invite', () => {
    let leader: PartyUser
    let party: PartyRecord

    test('should throw if inviting yourself', async () => {
      await expect(
        partyService.invite(user2, USER2_CLIENT_ID, user2),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"Can't invite yourself to the party"`)
    })

    describe('when party exists', () => {
      beforeEach(async () => {
        leader = user1
        party = await partyService.invite(leader, USER1_CLIENT_ID, user2)
        partyService.acceptInvite(party.id, user2, USER2_CLIENT_ID)
      })

      test('should throw if invited by non-leader', async () => {
        await expect(
          partyService.invite(user2, USER2_CLIENT_ID, user3),
        ).rejects.toThrowErrorMatchingInlineSnapshot(`"Only party leader can invite people"`)
      })

      test('should not throw if invite already exists', async () => {
        await partyService.invite(leader, USER1_CLIENT_ID, user3)

        await expect(() => partyService.invite(leader, USER1_CLIENT_ID, user3)).not.toThrow()
      })

      test('should throw if invited user is already in the party', async () => {
        await partyService.invite(leader, USER1_CLIENT_ID, user3)
        partyService.acceptInvite(party.id, user3, USER3_CLIENT_ID)

        await expect(
          partyService.invite(leader, USER1_CLIENT_ID, user3),
        ).rejects.toThrowErrorMatchingInlineSnapshot(
          `"This user is already a member of this party"`,
        )
      })

      test('should update the party record', async () => {
        party = await partyService.invite(leader, USER1_CLIENT_ID, user3)

        expect(party.invites).toMatchObject(new Map([[user3.id, user3]]))
      })

      test('should publish "invite" message to the party path', async () => {
        party = await partyService.invite(leader, USER1_CLIENT_ID, user3)

        expect(nydus.publish).toHaveBeenCalledWith(getPartyPath(party.id), {
          type: 'invite',
          invitedUser: user3,
          time: currentTime,
          userInfo: {
            id: user3.id,
            name: user3.name,
          },
        })
      })
    })

    describe("when party doesn't exist", () => {
      beforeEach(() => {
        leader = user1
      })

      test('should create a party record', async () => {
        party = await partyService.invite(leader, USER1_CLIENT_ID, user2)
        party = await partyService.invite(leader, USER1_CLIENT_ID, user3)

        expect(party).toMatchObject({
          id: party.id,
          invites: new Map([
            [user2.id, user2],
            [user3.id, user3],
          ]),
          members: new Map([[leader.id, leader]]),
          leader,
        })
      })

      test('should subscribe leader to the party path', async () => {
        party = await partyService.invite(leader, USER1_CLIENT_ID, user2)
        party = await partyService.invite(leader, USER1_CLIENT_ID, user3)

        expect(client1.publish).toHaveBeenCalledWith(getPartyPath(party.id), {
          type: 'init',
          party: {
            id: party.id,
            // `init` event for the leader is only emitted when the party doesn't exist and the
            // first user is being invited.
            invites: [user2],
            members: [leader],
            leader,
          },
          time: currentTime,
          userInfos: [
            { id: user2.id, name: user2.name },
            { id: leader.id, name: leader.name },
          ],
        })
      })
    })

    test('should create the invite notification', async () => {
      leader = user1
      party = await partyService.invite(leader, USER1_CLIENT_ID, user2)

      expect(notificationService.addNotification).toHaveBeenCalledWith({
        userId: user2.id,
        data: {
          type: NotificationType.PartyInvite,
          from: leader.name,
          partyId: party.id,
        },
      })
    })

    test('should throw when notification creation fails', async () => {
      notificationService.addNotification = jest.fn().mockRejectedValue(undefined)

      await expect(
        partyService.invite(user1, USER1_CLIENT_ID, user2),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"Error creating the notification"`)
    })

    test('should invite an offline user', async () => {
      leader = user1
      party = await partyService.invite(leader, USER1_CLIENT_ID, offlineUser)

      expect(party.invites).toMatchObject(new Map([[offlineUser.id, offlineUser]]))
    })
  })

  describe('decline', () => {
    let party: PartyRecord

    beforeEach(async () => {
      party = await partyService.invite(user1, USER1_CLIENT_ID, user2)
      party = await partyService.invite(user1, USER1_CLIENT_ID, user3)
    })

    test('should clear the invite notification', async () => {
      const notificationId = 'NOTIFICATION_ID'
      notificationService.retrieveNotifications = jest.fn().mockResolvedValue([
        {
          id: notificationId,
          data: { partyId: party.id },
        },
      ])

      // This function is implicitly using the promise in its implementation, so we need to await it
      // before we can test if the function below was called.
      await partyService.decline(party.id, user2)

      expect(notificationService.clearById).toHaveBeenCalledWith(user2.id, notificationId)
    })

    test('should throw if the party is not found', () => {
      expect(() =>
        partyService.decline('INVALID_PARTY_ID', user2),
      ).toThrowErrorMatchingInlineSnapshot(`"Party not found or you're not invited to it"`)
    })

    test('should throw if not invited to the party', () => {
      expect(() => partyService.decline(party.id, user4)).toThrowErrorMatchingInlineSnapshot(
        `"Party not found or you're not invited to it"`,
      )
    })

    test('should update the party record when declined', () => {
      partyService.decline(party.id, user2)

      expect(party.invites).toMatchObject(new Map([[user3.id, user3]]))
    })
  })

  describe('removeInvite', () => {
    let leader: PartyUser
    let party: PartyRecord

    beforeEach(async () => {
      leader = user1
      party = await partyService.invite(leader, USER1_CLIENT_ID, user2)
      party = await partyService.invite(leader, USER1_CLIENT_ID, user3)
    })

    test('should clear the invite notification', async () => {
      const notificationId = 'NOTIFICATION_ID'
      notificationService.retrieveNotifications = jest.fn().mockResolvedValue([
        {
          id: notificationId,
          data: { partyId: party.id },
        },
      ])

      // This function is implicitly using the promise in its implementation, so we need to await it
      // before we can test if the function below was called.
      await partyService.removeInvite(party.id, leader, user2)

      expect(notificationService.clearById).toHaveBeenCalledWith(user2.id, notificationId)
    })

    test('should throw if the party is not found', () => {
      expect(() =>
        partyService.removeInvite('INVALID_PARTY_ID', leader, user2),
      ).toThrowErrorMatchingInlineSnapshot(`"Party not found or you're not in it"`)
    })

    test('should throw if not in party', () => {
      expect(() =>
        partyService.removeInvite(party.id, user2, user4),
      ).toThrowErrorMatchingInlineSnapshot(`"Party not found or you're not in it"`)
    })

    test('should throw if removed by non-leader', async () => {
      await partyService.acceptInvite(party.id, user2, USER2_CLIENT_ID)

      expect(() =>
        partyService.removeInvite(party.id, user2, user3),
      ).toThrowErrorMatchingInlineSnapshot(
        `"Only party leaders can remove invites to other people"`,
      )
    })

    test('should not throw if the user is not invited', () => {
      expect(() => partyService.removeInvite(party.id, leader, user4)).not.toThrow()
    })

    test('should update the party record when removed', () => {
      partyService.removeInvite(party.id, leader, user2)

      expect(party.invites).toMatchObject(new Map([[user3.id, user3]]))
    })

    test('should publish "uninvite" message to the party path', () => {
      partyService.removeInvite(party.id, leader, user2)

      expect(nydus.publish).toHaveBeenCalledWith(getPartyPath(party.id), {
        type: 'uninvite',
        target: user2,
        time: currentTime,
      })
    })
  })

  describe('acceptInvite', () => {
    let leader: PartyUser
    let party: PartyRecord

    beforeEach(async () => {
      leader = user1
      party = await partyService.invite(leader, USER1_CLIENT_ID, user2)
      party = await partyService.invite(leader, USER1_CLIENT_ID, user3)
    })

    test('should clear the invite notification', async () => {
      const notificationId = 'NOTIFICATION_ID'
      notificationService.retrieveNotifications = jest.fn().mockResolvedValue([
        {
          id: notificationId,
          data: { partyId: party.id },
        },
      ])

      // This function is implicitly using the promise in its implementation, so we need to await it
      // before we can test if the function below was called.
      await partyService.acceptInvite(party.id, user2, USER2_CLIENT_ID)

      expect(notificationService.clearById).toHaveBeenCalledWith(user2.id, notificationId)
    })

    test('should throw if the party is not found', () => {
      expect(() =>
        partyService.acceptInvite('INVALID_PARTY_ID', user2, USER2_CLIENT_ID),
      ).toThrowErrorMatchingInlineSnapshot(`"Party not found or you're not invited to it"`)
    })

    test('should throw if the user is not invited', () => {
      expect(() =>
        partyService.acceptInvite(party.id, user4, USER4_CLIENT_ID),
      ).toThrowErrorMatchingInlineSnapshot(`"Party not found or you're not invited to it"`)
    })

    test('should throw if the party is full', async () => {
      party = await partyService.invite(leader, USER1_CLIENT_ID, user4)
      party = await partyService.invite(leader, USER1_CLIENT_ID, user5)
      party = await partyService.invite(leader, USER1_CLIENT_ID, user6)
      party = await partyService.invite(leader, USER1_CLIENT_ID, user7)
      party = await partyService.invite(leader, USER1_CLIENT_ID, user8)
      partyService.acceptInvite(party.id, user2, USER2_CLIENT_ID)
      partyService.acceptInvite(party.id, user3, USER3_CLIENT_ID)
      partyService.acceptInvite(party.id, user4, USER4_CLIENT_ID)
      partyService.acceptInvite(party.id, user5, USER5_CLIENT_ID)
      partyService.acceptInvite(party.id, user6, USER6_CLIENT_ID)
      partyService.acceptInvite(party.id, user7, USER7_CLIENT_ID)
      partyService.acceptInvite(party.id, user8, USER8_CLIENT_ID)

      party = await partyService.invite(leader, USER1_CLIENT_ID, user9)

      expect(() =>
        partyService.acceptInvite(party.id, user9, USER9_CLIENT_ID),
      ).toThrowErrorMatchingInlineSnapshot(`"Party is full"`)
    })

    test('should throw if accepting on web client', async () => {
      party = await partyService.invite(leader, USER1_CLIENT_ID, webUser)

      expect(() =>
        partyService.acceptInvite(party.id, webUser, WEB_USER_CLIENT_ID),
      ).toThrowErrorMatchingInlineSnapshot(`"Invalid client"`)
    })

    test('should update the party record', () => {
      partyService.acceptInvite(party.id, user2, USER2_CLIENT_ID)

      expect(party.invites).toMatchObject(new Map([[user3.id, user3]]))
      expect(party.members).toMatchObject(
        new Map([
          [leader.id, leader],
          [user2.id, user2],
        ]),
      )
    })

    test('should publish "join" message to the party path', () => {
      partyService.acceptInvite(party.id, user2, USER2_CLIENT_ID)

      // TODO(2Pac): Test the order of this call? This should probably be ensured that it's called
      // before subscribing the user to the party path.
      expect(nydus.publish).toHaveBeenCalledWith(getPartyPath(party.id), {
        type: 'join',
        user: user2,
        time: currentTime,
      })
    })

    test('should subscribe user to the party path', () => {
      partyService.acceptInvite(party.id, user2, USER2_CLIENT_ID)

      expect(client2.publish).toHaveBeenCalledWith(getPartyPath(party.id), {
        type: 'init',
        party: toPartyJson(party),
        time: currentTime,
        userInfos: [
          { id: user3.id, name: user3.name },
          { id: leader.id, name: leader.name },
          { id: user2.id, name: user2.name },
        ],
      })
    })

    describe('when user was already in a party', () => {
      let oldLeader: PartyUser
      let oldParty: PartyRecord
      let newLeader: PartyUser
      let newParty: PartyRecord

      beforeEach(async () => {
        oldLeader = user4
        oldParty = await partyService.invite(oldLeader, USER4_CLIENT_ID, user6)
        await partyService.acceptInvite(oldParty.id, user6, USER6_CLIENT_ID)

        newLeader = user5
        newParty = await partyService.invite(newLeader, USER5_CLIENT_ID, user6)
      })

      test('should remove the user from the old party', async () => {
        await partyService.acceptInvite(newParty.id, user6, USER6_CLIENT_ID)

        expect(oldParty.members).toMatchObject(new Map([[oldLeader.id, oldLeader]]))
      })

      test('should remove the user from the new party on disconnect', async () => {
        await partyService.acceptInvite(newParty.id, user6, USER6_CLIENT_ID)
        client6.disconnect()

        expect(newParty.members).toMatchObject(new Map([[newLeader.id, newLeader]]))
      })

      test('should publish "leave" message to the old party path', async () => {
        await partyService.acceptInvite(newParty.id, user6, USER6_CLIENT_ID)

        expect(nydus.publish).toHaveBeenCalledWith(getPartyPath(oldParty.id), {
          type: 'leave',
          user: user6,
          time: currentTime,
        })
      })
    })
  })

  describe('leaveParty', () => {
    let leader: PartyUser
    let party: PartyRecord

    beforeEach(async () => {
      leader = user1
      party = await partyService.invite(leader, USER1_CLIENT_ID, user2)
      partyService.acceptInvite(party.id, user2, USER2_CLIENT_ID)
    })

    test('should throw if the party is not found', () => {
      expect(() =>
        partyService.leaveParty('INVALID_PARTY_ID', user2.id, USER2_CLIENT_ID),
      ).toThrowErrorMatchingInlineSnapshot(`"Party not found or you're not in it"`)
    })

    test('should throw if the user is not in party', () => {
      expect(() =>
        partyService.leaveParty(party.id, user3.id, USER3_CLIENT_ID),
      ).toThrowErrorMatchingInlineSnapshot(`"Party not found or you're not in it"`)
    })

    test('should throw if the client could not be found', () => {
      expect(() =>
        partyService.leaveParty(party.id, user2.id, 'UNKNOWN_CLIENT_ID'),
      ).toThrowErrorMatchingInlineSnapshot(`"Client could not be found"`)
    })

    test('should update the party record', () => {
      partyService.leaveParty(party.id, user2.id, USER2_CLIENT_ID)

      expect(party.members).toMatchObject(new Map([[leader.id, leader]]))
    })

    test('should publish "leave" message to the party path', () => {
      partyService.leaveParty(party.id, user2.id, USER2_CLIENT_ID)

      // TODO(2Pac): Test the order of this call? This should probably be ensured that it's called
      // before unsubscribing the user from the party path.
      expect(nydus.publish).toHaveBeenCalledWith(getPartyPath(party.id), {
        type: 'leave',
        user: user2,
        time: currentTime,
      })
    })

    test('should unsubscribe user from the party path', () => {
      partyService.leaveParty(party.id, user2.id, USER2_CLIENT_ID)

      expect(client2.unsubscribe).toHaveBeenCalledWith(getPartyPath(party.id))
    })

    test('should assign new leader when old leader leaves', () => {
      partyService.leaveParty(party.id, leader.id, USER1_CLIENT_ID)

      expect(party.leader).toMatchObject(user2)
    })

    test('should publish "leaderChange" message to the party path when leader leaves', () => {
      partyService.leaveParty(party.id, leader.id, USER1_CLIENT_ID)

      expect(nydus.publish).toHaveBeenCalledWith(getPartyPath(party.id), {
        type: 'leaderChange',
        leader: user2,
        time: currentTime,
      })
    })
  })

  describe('sendChatMessage', () => {
    let leader: PartyUser
    let party: PartyRecord

    beforeEach(async () => {
      leader = user1
      party = await partyService.invite(leader, USER1_CLIENT_ID, user2)
      partyService.acceptInvite(party.id, user2, USER2_CLIENT_ID)
    })

    test('should throw if the party is not found', () => {
      expect(() =>
        partyService.sendChatMessage('INVALID_PARTY_ID', user2.id, 'Hello World!'),
      ).toThrowErrorMatchingInlineSnapshot(`"Party not found or you're not in it"`)
    })

    test('should throw if the user is not in party', () => {
      expect(() =>
        partyService.sendChatMessage(party.id, user3.id, 'Hello World!'),
      ).toThrowErrorMatchingInlineSnapshot(`"Party not found or you're not in it"`)
    })

    test('should publish "chatMessage" event to the party path', () => {
      partyService.sendChatMessage(party.id, user2.id, 'Hello World!')

      expect(nydus.publish).toHaveBeenCalledWith(getPartyPath(party.id), {
        type: 'chatMessage',
        from: user2,
        time: currentTime,
        text: 'Hello World!',
      })
    })
  })

  describe('kickPlayer', () => {
    let leader: PartyUser
    let party: PartyRecord

    beforeEach(async () => {
      leader = user1
      party = await partyService.invite(leader, USER1_CLIENT_ID, user2)
      party = await partyService.invite(leader, USER1_CLIENT_ID, user3)
      partyService.acceptInvite(party.id, user2, USER2_CLIENT_ID)
      partyService.acceptInvite(party.id, user3, USER3_CLIENT_ID)
    })

    test('should throw if the party is not found', () => {
      expect(() =>
        partyService.kickPlayer('INVALID_PARTY_ID', leader, user2),
      ).toThrowErrorMatchingInlineSnapshot(`"Party not found or you're not in it"`)
    })

    test('should throw if not in party', () => {
      expect(() =>
        partyService.kickPlayer(party.id, user4, user3),
      ).toThrowErrorMatchingInlineSnapshot(`"Party not found or you're not in it"`)
    })

    test('should throw if kicked by non-leader', () => {
      expect(() =>
        partyService.kickPlayer(party.id, user2, user3),
      ).toThrowErrorMatchingInlineSnapshot(`"Only party leaders can kick other people"`)
    })

    test('should throw if the user is not in party', () => {
      expect(() =>
        partyService.kickPlayer(party.id, leader, user4),
      ).toThrowErrorMatchingInlineSnapshot(`"Can't kick player who is not in your party"`)
    })

    test('should throw if trying to kick yourself', () => {
      expect(() =>
        partyService.kickPlayer(party.id, leader, leader),
      ).toThrowErrorMatchingInlineSnapshot(`"Can't kick yourself"`)
    })

    test('should update the party record when kicked', () => {
      partyService.kickPlayer(party.id, leader, user2)

      expect(party.members).toMatchObject(
        new Map([
          [leader.id, leader],
          [user3.id, user3],
        ]),
      )
    })

    test('should publish "kick" message to the party path', () => {
      partyService.kickPlayer(party.id, leader, user2)

      expect(nydus.publish).toHaveBeenCalledWith(getPartyPath(party.id), {
        type: 'kick',
        target: user2,
        time: currentTime,
      })
    })

    test('should unsubscribe kicked user from the party path', () => {
      partyService.kickPlayer(party.id, leader, user2)

      expect(client2.unsubscribe).toHaveBeenCalledWith(getPartyPath(party.id))
    })
  })
})
