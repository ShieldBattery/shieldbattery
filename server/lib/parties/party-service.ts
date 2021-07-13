import cuid from 'cuid'
import { singleton } from 'tsyringe'
import { NotificationType } from '../../../common/notifications'
import {
  MAX_PARTY_SIZE,
  PartyEvent,
  PartyInitEvent,
  PartyPayload,
  PartyUser,
} from '../../../common/parties'
import logger from '../logging/logger'
import filterChatMessage from '../messaging/filter-chat-message'
import NotificationService from '../notifications/notification-service'
import { Clock } from '../time/clock'
import { ClientSocketsGroup, ClientSocketsManager } from '../websockets/socket-groups'
import { TypedPublisher } from '../websockets/typed-publisher'

export interface PartyRecord {
  id: string
  invites: Map<number, PartyUser>
  members: Map<number, PartyUser>
  leader: PartyUser
}

export enum PartyServiceErrorCode {
  NotFoundOrNotInvited,
  NotFoundOrNotInParty,
  InsufficientPermissions,
  PartyFull,
  UserOffline,
  InvalidAction,
  NotificationFailure,
}

export class PartyServiceError extends Error {
  constructor(readonly code: PartyServiceErrorCode, message: string) {
    super(message)
  }
}

export function getPartyPath(partyId: string): string {
  return `/parties/${partyId}`
}

export function toPartyJson(party: PartyRecord): PartyPayload {
  return {
    id: party.id,
    invites: Array.from(party.invites.values()),
    members: Array.from(party.members.values()),
    leader: party.leader,
  }
}

@singleton()
export default class PartyService {
  /**
   * Maps party ID -> record representing that party. Party is created as soon as someone is invited
   * and removed once the last person in a party leaves.
   */
  private parties = new Map<string, PartyRecord>()
  /** Maps client sockets group -> party ID. Only one client sockets group can be in a party. */
  private clientSocketsToPartyId = new Map<ClientSocketsGroup, string>()
  /** Maps user ID -> client ID. The client ID is the one that user used to join the party. */
  private userIdToClientId = new Map<number, string>()

  constructor(
    private publisher: TypedPublisher<PartyEvent>,
    private clientSocketsManager: ClientSocketsManager,
    private notificationService: NotificationService,
    private clock: Clock,
  ) {}

  async invite(
    leader: PartyUser,
    leaderClientId: string,
    invitedUser: PartyUser,
  ): Promise<PartyRecord> {
    const leaderClientSockets = this.getClientSockets(leader.id, leaderClientId)

    if (invitedUser.id === leader.id) {
      throw new PartyServiceError(
        PartyServiceErrorCode.InvalidAction,
        "Can't invite yourself to the party",
      )
    }

    let party = this.getClientParty(leaderClientSockets)
    if (party) {
      if (party.leader.id !== leader.id) {
        throw new PartyServiceError(
          PartyServiceErrorCode.InsufficientPermissions,
          'Only party leader can invite people',
        )
      }

      if (party.members.has(invitedUser.id)) {
        throw new PartyServiceError(
          PartyServiceErrorCode.InvalidAction,
          'This user is already a member of this party',
        )
      }

      // An invite might already exist for a user, but we don't treat that as an error as that would
      // reveal to the inviter that the person has declined their first invite, which should be
      // treated as private information.
      if (party.invites.has(invitedUser.id)) {
        return party
      }

      party.invites.set(invitedUser.id, invitedUser)
      this.publisher.publish(getPartyPath(party.id), {
        type: 'invite',
        invitedUser,
        time: this.clock.now(),
        userInfo: {
          id: invitedUser.id,
          name: invitedUser.name,
        },
      })
    } else {
      const partyId = cuid()
      party = {
        id: partyId,
        invites: new Map([[invitedUser.id, invitedUser]]),
        members: new Map([[leader.id, leader]]),
        leader,
      }

      this.parties.set(partyId, party)
      this.clientSocketsToPartyId.set(leaderClientSockets, partyId)
      this.subscribeToParty(leaderClientSockets, party)
    }

    try {
      await this.notificationService.addNotification({
        userId: invitedUser.id,
        data: {
          type: NotificationType.PartyInvite,
          from: leader.name,
          partyId: party.id,
        },
      })
    } catch (err) {
      // The invite doesn't make much sense unless the notification has been successfully sent to
      // the user, so in case of an error, we remove the invited user from the party.
      party!.invites.delete(invitedUser.id)

      throw new PartyServiceError(
        PartyServiceErrorCode.NotificationFailure,
        'Error creating the notification',
      )
    }

    return party
  }

  decline(partyId: string, target: PartyUser) {
    this.clearInviteNotification(partyId, target)

    const party = this.parties.get(partyId)
    if (!party || !party.invites.has(target.id)) {
      throw new PartyServiceError(
        PartyServiceErrorCode.NotFoundOrNotInvited,
        "Party not found or you're not invited to it",
      )
    }

    party.invites.delete(target.id)
  }

  removeInvite(partyId: string, removingUser: PartyUser, target: PartyUser) {
    this.clearInviteNotification(partyId, target)

    const party = this.parties.get(partyId)
    if (!party || !party.members.has(removingUser.id)) {
      throw new PartyServiceError(
        PartyServiceErrorCode.NotFoundOrNotInParty,
        "Party not found or you're not in it",
      )
    }

    if (removingUser.id !== party.leader.id) {
      throw new PartyServiceError(
        PartyServiceErrorCode.InsufficientPermissions,
        'Only party leaders can remove invites to other people',
      )
    }

    // If an invite doesn't exist for a user it most likely means that the user has already declined
    // it. We don't throw an error here so we don't divulge that information to the party. However,
    // we still publish the 'uninvite' event to the party so the party members can clean up their
    // state on the client.

    party.invites.delete(target.id)
    this.publisher.publish(getPartyPath(party.id), {
      type: 'uninvite',
      target,
      time: this.clock.now(),
    })
  }

  acceptInvite(partyId: string, user: PartyUser, clientId: string) {
    this.clearInviteNotification(partyId, user)

    const party = this.parties.get(partyId)
    if (!party || !party.invites.has(user.id)) {
      throw new PartyServiceError(
        PartyServiceErrorCode.NotFoundOrNotInvited,
        "Party not found or you're not invited to it",
      )
    }

    if (party.members.size >= MAX_PARTY_SIZE) {
      throw new PartyServiceError(PartyServiceErrorCode.PartyFull, 'Party is full')
    }

    const clientSockets = this.getClientSockets(user.id, clientId)
    if (clientSockets.clientType !== 'electron') {
      throw new PartyServiceError(PartyServiceErrorCode.InvalidAction, 'Invalid client')
    }

    const oldParty = this.getClientParty(clientSockets)

    // TODO(2Pac): Maybe display a confirmation dialog first to the user if they were already in an
    // existing party, instead of uncoditionally moving them to a new party?

    party.invites.delete(user.id)
    party.members.set(user.id, user)
    this.clientSocketsToPartyId.set(clientSockets, partyId)

    this.publisher.publish(getPartyPath(party.id), {
      type: 'join',
      user,
      time: this.clock.now(),
    })
    this.subscribeToParty(clientSockets, party)

    if (oldParty) {
      // NOTE(2Pac): We're removing the user from an old party *after* we subscribe them to a new
      // one, to better represent a party change. This way the client won't have a brief period of
      // being in no party, which can change the UI in unexpected ways.
      this.removeClientFromParty(clientSockets, oldParty)
    }
  }

  leaveParty(partyId: string, userId: number, clientId: string) {
    const party = this.parties.get(partyId)
    if (!party || !party.members.has(userId)) {
      throw new PartyServiceError(
        PartyServiceErrorCode.NotFoundOrNotInParty,
        "Party not found or you're not in it",
      )
    }

    const clientSockets = this.getClientSockets(userId, clientId)
    this.removeClientFromParty(clientSockets, party)
  }

  sendChatMessage(partyId: string, userId: number, message: string) {
    const party = this.parties.get(partyId)
    if (!party || !party.members.has(userId)) {
      throw new PartyServiceError(
        PartyServiceErrorCode.NotFoundOrNotInParty,
        "Party not found or you're not in it",
      )
    }

    const user = party.members.get(userId)!
    const text = filterChatMessage(message)

    this.publisher.publish(getPartyPath(partyId), {
      type: 'chatMessage',
      from: user,
      time: this.clock.now(),
      text,
    })
  }

  kickPlayer(partyId: string, kickingUser: PartyUser, target: PartyUser) {
    const party = this.parties.get(partyId)
    if (!party || !party.members.has(kickingUser.id)) {
      throw new PartyServiceError(
        PartyServiceErrorCode.NotFoundOrNotInParty,
        "Party not found or you're not in it",
      )
    }

    if (kickingUser.id !== party.leader.id) {
      throw new PartyServiceError(
        PartyServiceErrorCode.InsufficientPermissions,
        'Only party leaders can kick other people',
      )
    }

    if (!party.members.has(target.id)) {
      throw new PartyServiceError(
        PartyServiceErrorCode.InvalidAction,
        "Can't kick player who is not in your party",
      )
    }

    if (kickingUser.id === target.id) {
      throw new PartyServiceError(PartyServiceErrorCode.InvalidAction, "Can't kick yourself")
    }

    this.publisher.publish(getPartyPath(party.id), {
      type: 'kick',
      target,
      time: this.clock.now(),
    })

    const clientId = this.userIdToClientId.get(target.id)!
    const clientSockets = this.getClientSockets(target.id, clientId)
    this.removeClientFromParty(clientSockets, party)
  }

  private clearInviteNotification(partyId: string, user: PartyUser) {
    this.notificationService
      .retrieveNotifications({ userId: user.id, type: NotificationType.PartyInvite })
      .then(async userInviteNotifications => {
        const notification = userInviteNotifications.filter(n => n.data.partyId === partyId)[0]
        if (notification) {
          await this.notificationService.clearById(user.id, notification.id)
        }
      })
      .catch(err => {
        logger.error({ err }, 'error clearing the invite notification')
      })
  }

  private subscribeToParty(clientSockets: ClientSocketsGroup, party: PartyRecord) {
    this.userIdToClientId.set(clientSockets.userId, clientSockets.clientId)
    clientSockets.subscribe<PartyInitEvent>(
      getPartyPath(party.id),
      () => ({
        type: 'init',
        party: toPartyJson(party),
        time: this.clock.now(),
        // TODO(2Pac): This will have to be done differently once we start sending more information
        // for the users.
        userInfos: [
          ...Array.from(party.invites.values()),
          ...Array.from(party.members.values()),
        ].map(u => ({
          id: u.id,
          name: u.name,
        })),
      }),
      sockets => this.removeClientFromParty(sockets),
    )
  }

  private removeClientFromParty(
    clientSockets: ClientSocketsGroup,
    party = this.getClientParty(clientSockets),
  ) {
    if (!party) {
      const err = new Error('Party not found')
      logger.error({ err }, 'error while handling client quitting')
      return
    }

    const user = party.members.get(clientSockets.userId)
    if (user) {
      party.members.delete(user.id)
      this.publisher.publish(getPartyPath(party.id), {
        type: 'leave',
        user,
        time: this.clock.now(),
      })
    }

    const clientPartyId = this.clientSocketsToPartyId.get(clientSockets)!
    // Client's party can change when switching parties, so we must check if they're actually
    // leaving the party, or have simply switched to a new one.
    if (clientPartyId === party.id) {
      this.clientSocketsToPartyId.delete(clientSockets)
      this.userIdToClientId.delete(clientSockets.userId)
    }

    clientSockets.unsubscribe(getPartyPath(party.id))

    // If the last person in a party leaves, the party is removed. All outstanding invites to this,
    // now non-existing party, should fail.
    if (party.members.size < 1) {
      this.parties.delete(party.id)
    } else if (clientSockets.userId === party.leader.id) {
      // If the leader has left the party, we assign a new leader, generally the person who has
      // joined the party the earliest. However, there is no robust solution implemented to ensure
      // that the earliest member becomes a new leader, since the order in which the users accept
      // their invites is pretty arbitrary already.
      const newLeader = party.members.values().next().value
      party.leader = newLeader
      this.publisher.publish(getPartyPath(party.id), {
        type: 'leaderChange',
        leader: newLeader,
        time: this.clock.now(),
      })
    }
  }

  private getClientSockets(userId: number, clientId: string): ClientSocketsGroup {
    const clientSockets = this.clientSocketsManager.getById(userId, clientId)
    if (!clientSockets) {
      throw new PartyServiceError(PartyServiceErrorCode.UserOffline, 'Client could not be found')
    }

    return clientSockets
  }

  private getClientParty(clientSockets: ClientSocketsGroup): PartyRecord | undefined {
    const partyId = this.clientSocketsToPartyId.get(clientSockets)
    return this.parties.get(partyId as string)
  }
}
