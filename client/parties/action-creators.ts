import {
  AcceptPartyInviteServerBody,
  InviteToPartyServerBody,
  SendChatMessageServerBody,
} from '../../common/parties'
import { ThunkAction } from '../dispatch-registry'
import { clientId } from '../network/client-id'
import fetch from '../network/fetch'
import { apiUrl } from '../network/urls'
import { openSnackbar } from '../snackbars/action-creators'
import { ActivateParty, DeactivateParty } from './actions'

export function inviteToParty(targetId: number): ThunkAction {
  return dispatch => {
    const params = { clientId, targetId }
    dispatch({
      type: '@parties/inviteToPartyBegin',
      payload: params,
    })

    const requestBody: InviteToPartyServerBody = { clientId, targetId }
    dispatch({
      type: '@parties/inviteToParty',
      payload: fetch<void>(apiUrl`parties/invites`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }).catch(err => {
        dispatch(
          openSnackbar({
            message: 'An error occurred while sending an invite',
          }),
        )
        throw err
      }),
      meta: params,
    })
  }
}

export function removePartyInvite(partyId: string, targetId: number): ThunkAction {
  return dispatch => {
    const params = { partyId, targetId }
    dispatch({
      type: '@parties/removePartyInviteBegin',
      payload: params,
    })

    dispatch({
      type: '@parties/removePartyInvite',
      payload: fetch<void>(apiUrl`parties/invites/${partyId}/${targetId}`, {
        method: 'DELETE',
      }).catch(err => {
        dispatch(
          openSnackbar({
            message: 'An error occurred while removing an invite',
          }),
        )
        throw err
      }),
      meta: params,
    })
  }
}

export function declinePartyInvite(partyId: string): ThunkAction {
  return dispatch => {
    const params = { partyId }
    dispatch({
      type: '@parties/declinePartyInviteBegin',
      payload: params,
    })

    dispatch({
      type: '@parties/declinePartyInvite',
      payload: fetch<void>(apiUrl`parties/invites/${partyId}`, {
        method: 'DELETE',
      }).catch(err => {
        // TODO(2Pac): Show an actual reason why the this failed (e.g. party doesn't exist anymore)
        dispatch(
          openSnackbar({
            message: 'An error occurred while declining an invite',
          }),
        )
        throw err
      }),
      meta: params,
    })
  }
}

export function acceptPartyInvite(partyId: string): ThunkAction {
  return dispatch => {
    const params = { partyId, clientId }
    dispatch({
      type: '@parties/acceptPartyInviteBegin',
      payload: params,
    })

    const requestBody: AcceptPartyInviteServerBody = { clientId }
    dispatch({
      type: '@parties/acceptPartyInvite',
      payload: fetch<void>(apiUrl`parties/${partyId}`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }).catch(err => {
        // TODO(2Pac): Show an actual reason why the this failed (e.g. party doesn't exist anymore)
        dispatch(
          openSnackbar({
            message: 'An error occurred while accepting an invite',
          }),
        )
        throw err
      }),
      meta: params,
    })
  }
}

export function leaveParty(partyId: string): ThunkAction {
  return dispatch => {
    const params = { partyId, clientId }
    dispatch({
      type: '@parties/leavePartyBegin',
      payload: params,
    })

    dispatch({
      type: '@parties/leaveParty',
      payload: fetch<void>(apiUrl`parties/${partyId}/${clientId}?type=leave`, {
        method: 'DELETE',
      }).catch(err => {
        dispatch(
          openSnackbar({
            message: 'An error occurred while leaving the party',
          }),
        )
        throw err
      }),
      meta: params,
    })
  }
}

export function sendChatMessage(partyId: string, message: string): ThunkAction {
  return dispatch => {
    const params = { partyId, message }
    dispatch({
      type: '@parties/sendChatMessageBegin',
      payload: params,
    })

    const requestBody: SendChatMessageServerBody = { message }
    dispatch({
      type: '@parties/sendChatMessage',
      payload: fetch<void>(apiUrl`parties/${partyId}/messages`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }),
      meta: params,
    })
  }
}

export function kickPlayer(partyId: string, targetId: number): ThunkAction {
  return dispatch => {
    const params = { partyId, targetId }
    dispatch({
      type: '@parties/kickFromPartyBegin',
      payload: params,
    })

    dispatch({
      type: '@parties/kickFromParty',
      payload: fetch<void>(apiUrl`parties/${partyId}/${targetId}?type=kick`, {
        method: 'DELETE',
      }).catch(err => {
        dispatch(
          openSnackbar({
            message: 'An error occurred while kicking the player',
          }),
        )
        throw err
      }),
      meta: params,
    })
  }
}

export function activateParty(partyId: string): ActivateParty {
  return {
    type: '@parties/activateParty',
    payload: { partyId },
  }
}

export function deactivateParty(partyId: string): DeactivateParty {
  return {
    type: '@parties/deactivateParty',
    payload: { partyId },
  }
}
