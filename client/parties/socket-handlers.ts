import type { NydusClient, RouteHandler, RouteInfo } from 'nydus-client'
import { TypedIpcRenderer } from '../../common/ipc'
import { PartyEvent } from '../../common/parties'
import { dispatch, Dispatchable } from '../dispatch-registry'

const ipcRenderer = new TypedIpcRenderer()

type EventToActionMap = {
  [E in PartyEvent['type']]?: (
    partyId: string,
    event: Extract<PartyEvent, { type: E }>,
  ) => Dispatchable
}

const eventToAction: EventToActionMap = {
  init: (partyId, event) => {
    const { party, time, userInfos } = event
    return {
      type: '@parties/init',
      payload: {
        party,
        time,
        userInfos,
      },
    }
  },

  invite: (partyId, event) => {
    const { invitedUser, time, userInfo } = event
    return {
      type: '@parties/updateInvite',
      payload: {
        partyId,
        invitedUser,
        time,
        userInfo,
      },
    }
  },

  uninvite: (partyId, event) => {
    const { target, time } = event
    return {
      type: '@parties/updateUninvite',
      payload: {
        partyId,
        target,
        time,
      },
    }
  },

  decline: (partyId, event) => {
    const { target, time } = event
    return {
      type: '@parties/updateDecline',
      payload: {
        partyId,
        target,
        time,
      },
    }
  },

  join: (partyId, event) => {
    const { user, time } = event
    return {
      type: '@parties/updateJoin',
      payload: {
        partyId,
        user,
        time,
      },
    }
  },

  leave: (partyId, event) => (dispatch, getState) => {
    const { user, time } = event
    const selfUser = getState().auth.user
    if (selfUser.id === user.id) {
      // It was us who left the party
      dispatch({
        type: '@parties/updateLeaveSelf',
        payload: {
          partyId,
          time,
        },
      })
    } else {
      dispatch({
        type: '@parties/updateLeave',
        payload: {
          partyId,
          user,
          time,
        },
      })
    }
  },

  leaderChange: (partyId, event) => {
    const { leader, time } = event
    return {
      type: '@parties/updateLeaderChange',
      payload: {
        partyId,
        leader,
        time,
      },
    }
  },

  chatMessage(partyId, event) {
    const { from, time, text } = event

    // Notify the main process of the new message, so it can display an appropriate notification
    ipcRenderer.send('chatNewMessage', { user: event.from.name, message: event.text })

    return {
      type: '@parties/updateChatMessage',
      payload: {
        partyId,
        from,
        time,
        text,
      },
    }
  },
}

export default function registerModule({ siteSocket }: { siteSocket: NydusClient }) {
  const partiesHandler: RouteHandler = (route: RouteInfo, event: PartyEvent) => {
    if (!eventToAction[event.type]) return

    const action = eventToAction[event.type]!(route.params.partyId, event as any)
    if (action) dispatch(action)
  }

  siteSocket.registerRoute('/parties/:partyId', partiesHandler)
  siteSocket.registerRoute('/parties/invites/:partyId/:userId', partiesHandler)
}
