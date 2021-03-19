import React from 'react'
import { connect } from 'react-redux'
import { CSSTransition, TransitionGroup } from 'react-transition-group'

import EditAccount from '../auth/edit-account'
import Portal from '../material/portal'
import SimpleDialog from './simple-dialog'
import ReplayDialog from '../replays/replay-dialog'
import Settings from '../settings/settings'
import StarcraftHealthCheckupDialog from '../starcraft/starcraft-health'
import StarcraftPathDialog from '../settings/starcraft-path-dialog'
import JoinChannelDialog from '../chat/join-channel'
import CreateWhisperSessionDialog from '../whispers/create-whisper'
import ChangelogDialog from '../changelog/changelog-dialog'
import DownloadDialog from '../download/download-dialog'
import UpdateDialog from '../download/update-dialog'
import AcceptMatch from '../matchmaking/accept-match'
import MapDetailsDialog from '../maps/map-details'

import { closeDialog } from './action-creators'
import { isStarcraftHealthy } from '../starcraft/is-starcraft-healthy'

const transitionNames = {
  appear: 'enter',
  appearActive: 'enterActive',
  enter: 'enter',
  enterActive: 'enterActive',
  exit: 'exit',
  exitActive: 'exitActive',
}

@connect(state => ({ dialog: state.dialog, starcraft: state.starcraft }))
class ConnectedDialogOverlay extends React.Component {
  _focusable = null
  _setFocusable = elem => {
    this._focusable = elem
  }

  getDialog(dialogType) {
    switch (dialogType) {
      case 'acceptMatch':
        return { component: AcceptMatch, modal: true }
      case 'account':
        return { component: EditAccount, modal: false }
      case 'changelog':
        return { component: ChangelogDialog, modal: false }
      case 'channel':
        return { component: JoinChannelDialog, modal: false }
      case 'download':
        return { component: DownloadDialog, modal: false }
      case 'mapDetails':
        return { component: MapDetailsDialog, modal: false }
      case 'settings':
        return isStarcraftHealthy(this.props)
          ? { component: Settings, modal: false }
          : { component: StarcraftPathDialog, modal: false }
      case 'simple':
        return { component: SimpleDialog, modal: false }
      case 'replay':
        return { component: ReplayDialog, modal: false }
      case 'starcraftHealth':
        return { component: StarcraftHealthCheckupDialog, modal: false }
      case 'starcraftPath':
        return { component: StarcraftPathDialog, modal: false }
      case 'updateAvailable':
        return { component: UpdateDialog, modal: true }
      case 'whispers':
        return { component: CreateWhisperSessionDialog, modal: false }
      default:
        throw new Error('Unknown dialog type: ' + dialogType)
    }
  }

  renderDialog = () => {
    const { dialog } = this.props

    // Dialog content implementations should focus *something* when mounted, so that our focus traps
    // have the proper effect of keeping focus in the dialog
    let dialogComponent
    if (dialog.isDialogOpened) {
      const { component: DialogComponent } = this.getDialog(dialog.dialogType)
      dialogComponent = (
        <CSSTransition classNames={transitionNames} timeout={{ enter: 350, exit: 250 }}>
          <DialogComponent key='dialog' onCancel={this.onCancel} {...dialog.initData.toJS()} />
        </CSSTransition>
      )
    }

    return [
      <span key='topFocus' tabIndex={0} onFocus={this.onFocusTrap} />,
      <span key='mainFocus' ref={this._setFocusable} tabIndex={-1}>
        <TransitionGroup>{dialogComponent}</TransitionGroup>
      </span>,
      <span key='bottomFocus' tabIndex={0} onFocus={this.onFocusTrap} />,
    ]
  }

  render() {
    const { dialog } = this.props
    // We always render a dialog even if we don't have one, so that its always mounted (and
    // thus usable for TransitionGroup animations)
    return (
      <Portal
        onDismiss={this.onCancel}
        open={true}
        scrim={dialog.isDialogOpened}
        propagateClicks={true}>
        {this.renderDialog}
      </Portal>
    )
  }

  onCancel = () => {
    const { dialog } = this.props
    const { modal } = this.getDialog(dialog.dialogType)
    if (modal) return
    this.props.dispatch(closeDialog())
  }

  onFocusTrap = () => {
    // Focus was about to leave the dialog area, redirect it back to the dialog
    this._focusable.focus()
  }
}

export default ConnectedDialogOverlay
