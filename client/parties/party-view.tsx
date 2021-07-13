import { Range } from 'immutable'
import React, { useCallback, useEffect } from 'react'
import styled from 'styled-components'
import { MAX_PARTY_SIZE } from '../../common/parties'
import { SelfUserRecord } from '../auth/auth-records'
import Avatar from '../avatars/avatar'
import { openDialog } from '../dialogs/action-creators'
import { DialogType } from '../dialogs/dialog-type'
import InviteIcon from '../icons/material/group_add_black_24px.svg'
import CloseIcon from '../icons/material/ic_close_black_24px.svg'
import { Slot, SlotEmptyAvatar, SlotEmptyName, SlotName, SlotProfile } from '../lobbies/slot'
import { SlotActions } from '../lobbies/slot-actions'
import { TextButton } from '../material/button'
import Chat from '../messaging/chat'
import { Message } from '../messaging/message-records'
import { replace } from '../navigation/routing'
import { urlPath } from '../network/urls'
import { useAppDispatch, useAppSelector } from '../redux-hooks'
import { background700, background800 } from '../styles/colors'
import {
  activateParty,
  changeLeader,
  deactivateParty,
  kickPlayer,
  leaveParty,
  sendChatMessage,
} from './action-creators'
import {
  InviteToPartyMessage,
  JoinPartyMessage,
  KickFromPartyMessage,
  LeavePartyMessage,
  PartyLeaderChangeMessage,
  SelfJoinPartyMessage,
} from './party-message-layout'
import { PartyMessageType } from './party-message-records'
import { PartyRecord } from './party-reducer'

const UserListContainer = styled.div`
  width: 100%;
  flex-grow: 0;
  flex-shrink: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 16px;
  margin-bottom: 16px;

  background-color: ${background700};
`

const StyledAvatar = styled(Avatar)`
  flex-grow: 0;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  margin-right: 16px;
`

export function OpenSlot() {
  return (
    <Slot>
      <SlotProfile>
        <SlotEmptyAvatar />
        <SlotEmptyName as='span'>Empty</SlotEmptyName>
      </SlotProfile>
    </Slot>
  )
}

export function PlayerSlot({
  name,
  hasLeaderActions,
  onKickPlayer,
  onChangeLeader,
}: {
  name: string
  hasLeaderActions: boolean
  onKickPlayer: () => void
  onChangeLeader: () => void
}) {
  const slotActions: Array<[text: string, handler: () => void]> = []
  if (hasLeaderActions) {
    slotActions.push(['Make leader', onChangeLeader])
    slotActions.push(['Kick from party', onKickPlayer])
  }

  return (
    <Slot>
      <SlotProfile>
        <StyledAvatar user={name} />
        <SlotName as='span'>{name}</SlotName>
      </SlotProfile>
      {slotActions.length > 0 ? <SlotActions slotActions={slotActions} /> : <div />}
    </Slot>
  )
}

export function UserList({
  party,
  selfUser,
  onKickPlayer,
  onChangeLeader,
}: {
  party: PartyRecord
  selfUser: SelfUserRecord
  onKickPlayer: (userId: number) => void
  onChangeLeader: (userId: number) => void
}) {
  const playerSlots = party.members.map(u => (
    <PlayerSlot
      key={u.id}
      name={u.name}
      hasLeaderActions={selfUser.id === party.leader.id && selfUser.id !== u.id}
      onKickPlayer={() => onKickPlayer(u.id)}
      onChangeLeader={() => onChangeLeader(u.id)}
    />
  ))
  const emptySlots = Range(playerSlots.size, MAX_PARTY_SIZE).map(i => (
    <OpenSlot key={'empty-' + i} />
  ))

  return (
    <UserListContainer>
      {[...playerSlots.valueSeq().toArray(), ...emptySlots.toArray()]}
    </UserListContainer>
  )
}

const Container = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
`

const StyledChat = styled(Chat)`
  max-width: 960px;
  margin-right: 16px;
  flex-grow: 1;

  background-color: ${background800};
`

const RightSide = styled.div`
  width: 256px;
  flex-shrink: 0;
  margin-top: 8px;
  margin-right: 16px;

  display: flex;
  flex-direction: column;
  align-items: center;
`

const StyledInviteIcon = styled(InviteIcon)`
  margin-right: calc(8px + 4px) /* 4px to account for lack of internal padding */;
`

const StyledCloseIcon = styled(CloseIcon)`
  margin-right: 8px;
`

function renderPartyMessage(msg: Message) {
  switch (msg.type) {
    case PartyMessageType.SelfJoinParty:
      return <SelfJoinPartyMessage key={msg.id} time={msg.time} leaderId={msg.leaderId} />
    case PartyMessageType.InviteToParty:
      return <InviteToPartyMessage key={msg.id} time={msg.time} userId={msg.userId} />
    case PartyMessageType.JoinParty:
      return <JoinPartyMessage key={msg.id} time={msg.time} userId={msg.userId} />
    case PartyMessageType.LeaveParty:
      return <LeavePartyMessage key={msg.id} time={msg.time} userId={msg.userId} />
    case PartyMessageType.LeaderChange:
      return <PartyLeaderChangeMessage key={msg.id} time={msg.time} userId={msg.userId} />
    case PartyMessageType.KickFromParty:
      return <KickFromPartyMessage key={msg.id} time={msg.time} userId={msg.userId} />
    default:
      return null
  }
}

interface PartyViewProps {
  params: { partyId: string }
}

export function PartyView(props: PartyViewProps) {
  const dispatch = useAppDispatch()
  const selfUser = useAppSelector(s => s.auth.user)
  const party = useAppSelector(s => s.party)
  const partyId = party.id
  const routePartyId = decodeURIComponent(props.params.partyId)

  useEffect(() => {
    const isInParty = !!partyId

    if (isInParty) {
      // The mismatch between the current URL and the party state can occur in a couple of ways. One
      // is when a user accepts an invite to a new party while already being a member of a different
      // party that is currently being rendered. Another way is that someone links to their own
      // party view while you're in a different party.
      if (routePartyId !== partyId) {
        replace(urlPath`/parties/${partyId}`)
      } else {
        dispatch(activateParty(partyId))
      }
    } else {
      replace('/')
    }

    return () => dispatch(deactivateParty(partyId))
  }, [partyId, routePartyId, dispatch])

  const onSendChatMessage = useCallback(
    (msg: string) => dispatch(sendChatMessage(partyId, msg)),
    [partyId, dispatch],
  )

  const onInviteClick = useCallback(() => dispatch(openDialog(DialogType.PartyInvite)), [dispatch])
  const onLeaveClick = useCallback(() => dispatch(leaveParty(partyId)), [partyId, dispatch])
  const onKickPlayerClick = useCallback(
    userId => dispatch(kickPlayer(partyId, userId)),
    [partyId, dispatch],
  )
  const onChangeLeaderClick = useCallback(
    userId => dispatch(changeLeader(partyId, userId)),
    [partyId, dispatch],
  )

  const listProps = {
    messages: party.messages,
    renderMessage: renderPartyMessage,
  }
  const inputProps = {
    onSendChatMessage,
  }

  return (
    <Container>
      <StyledChat listProps={listProps} inputProps={inputProps} />
      <RightSide>
        <UserList
          party={party}
          selfUser={selfUser}
          onKickPlayer={onKickPlayerClick}
          onChangeLeader={onChangeLeaderClick}
        />
        <TextButton
          label={
            <>
              <StyledInviteIcon /> Invite players
            </>
          }
          onClick={onInviteClick}
        />
        <TextButton
          label={
            <>
              <StyledCloseIcon /> Leave party
            </>
          }
          onClick={onLeaveClick}
        />
      </RightSide>
    </Container>
  )
}
