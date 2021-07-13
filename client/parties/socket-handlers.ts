import type { NydusClient, RouteHandler, RouteInfo } from 'nydus-client'
import { TypedIpcRenderer } from '../../common/ipc'
import { PartyEvent } from '../../common/parties'
import { dispatch, Dispatchable } from '../dispatch-registry'
import { openSnackbar } from '../snackbars/action-creators'
import { navigateToParty } from './action-creators'

const ipcRenderer = new TypedIpcRenderer()

type EventToActionMap = {
  [E in PartyEvent['type']]?: (
    partyId: string,
    event: Extract<PartyEvent, { type: E }>,
  ) => Dispatchable
}

const eventToAction: EventToActionMap = {
  init: (partyId, event) => (dispatch, getState) => {
    const { party, time, userInfos } = event
    const selfUser = getState().auth.user

    dispatch({
      type: '@parties/init',
      payload: {
        party,
        time,
        userInfos,
      },
    })

    if (selfUser.id !== party.leader.id) {
      // If we have joined someone else's party, navigate to the party view immediately. Party
      // leaders are not navigated as they might want to invite more people from wherever they are.
      navigateToParty(party.id)
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

  kick: (partyId, event) => (dispatch, getState) => {
    const { target, time } = event
    const selfUser = getState().auth.user
    if (selfUser.id === target.id) {
      // It was us who has been kicked from the party
      dispatch(openSnackbar({ message: 'You have been kicked from the party.' }))
      dispatch({
        type: '@parties/updateKickSelf',
        payload: {
          partyId,
          time,
        },
      })
    } else {
      dispatch({
        type: '@parties/updateKick',
        payload: {
          partyId,
          target,
          time,
        },
      })
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
