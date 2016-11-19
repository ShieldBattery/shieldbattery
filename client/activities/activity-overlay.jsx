import React from 'react'
import TransitionGroup from 'react-addons-css-transition-group'
import { connect } from 'react-redux'
import keycode from 'keycode'
import { closeOverlay } from './action-creators'
import styles from './activity-overlay.css'

import KeyListener from '../keyboard/key-listener.jsx'
import CreateLobby from '../lobbies/create-lobby.jsx'
import JoinLobby from '../lobbies/join-lobby.jsx'
import WatchReplays from '../replays/watch-replays.jsx'

const ESCAPE = keycode('escape')

const transitionNames = {
  enter: styles.enter,
  enterActive: styles.enterActive,
  leave: styles.leave,
  leaveActive: styles.leaveActive,
}

@connect(state => ({ activityOverlay: state.activityOverlay }))
export default class ActivityOverlay extends React.Component {
  getOverlayComponent() {
    switch (this.props.activityOverlay.overlayType) {
      case 'createLobby': return <CreateLobby />
      case 'joinLobby': return <JoinLobby />
      case 'watchReplays': return <WatchReplays />
      default: return <span/>
    }
  }

  renderOverlay() {
    if (!this.props.activityOverlay.isOverlayOpened) {
      return null
    }

    return (<div key={'overlay'}>
      <KeyListener onKeyDown={this.onKeyDown} />
      <div className={styles.scrim} onClick={this.onScrimClick}/>
      <div className={styles.overlay}>{ this.getOverlayComponent() }</div>
    </div>)
  }

  render() {
    return (
      <TransitionGroup transitionName={transitionNames}
          transitionEnterTimeout={350} transitionLeaveTimeout={250}>
        { this.renderOverlay() }
      </TransitionGroup>
    )
  }

  onScrimClick = () => {
    this.props.dispatch(closeOverlay())
  };

  onKeyDown = event => {
    if (event.keyCode === ESCAPE) {
      this.props.dispatch(closeOverlay())
      return true
    }

    return false
  };
}
