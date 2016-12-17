import React, { PropTypes } from 'react'
import keycode from 'keycode'
import styles from './popover.css'

import KeyListener from '../keyboard/key-listener.jsx'
import Portal from './portal.jsx'
import WindowListener from '../dom/window-listener.jsx'
import { fastOutSlowIn } from '../material/curve-constants.css'

const ESCAPE = keycode('esc')
const OPEN_DELAY = 125
const OPEN_DURATION = 175
const CLOSE_DURATION = 100

export default class Popover extends React.Component {
  static propTypes = {
    open: PropTypes.bool.isRequired,
    onDismiss: PropTypes.func.isRequired,
    children: PropTypes.func.isRequired,
    anchor: PropTypes.object,
    anchorOffsetVertical: PropTypes.number,
    anchorOffsetHorizontal: PropTypes.number,
    anchorOriginVertical: PropTypes.oneOf(['top', 'bottom']),
    anchorOriginHorizontal: PropTypes.oneOf(['left', 'right']),
    targetOriginVertical: PropTypes.oneOf(['top', 'bottom']),
    targetOriginHorizontal: PropTypes.oneOf(['left', 'right']),
  };

  static defaultProps = {
    anchorOffsetVertical: 0,
    anchorOffsetHorizontal: 0,
    anchorOriginVertical: 'top',
    anchorOriginHorizontal: 'left',
    targetOriginVertical: 'top',
    targetOriginHorizontal: 'left'
  }

  state = {
    open: this.props.open,
    transitioning: false,
    popoverPosition: null,
    scaleHorizontalStyle: {
      transform: 'scaleX(0.3)',
      transformOrigin: 'right top',
    },
    scaleVerticalStyle: {
      transform: 'scaleY(0.3)',
      transformOrigin: 'right top',
    },
    backgroundStyle: {
      opacity: 0.1,
    },
  };
  animationId = null;
  openTimer = null;
  closeTimer = null;

  get opening() {
    return this.state.transitioning && this.props.open
  }

  get closing() {
    return this.state.transitioning && !this.props.open
  }

  onKeyDown = event => {
    if (event.keyCode !== ESCAPE) return false

    if (this.props.onDismiss && this.state.open && !this.closing) {
      this.props.onDismiss()
      return true
    }

    return false
  };

  animateOnOpen = () => {
    this.setState({
      scaleHorizontalStyle: {
        transform: 'scaleX(1)',
        transformOrigin: 'right top',
        transition: `transform 200ms ${fastOutSlowIn}`,
      },
      scaleVerticalStyle: {
        transform: 'scaleY(1)',
        transformOrigin: 'right top',
        transition: `transform 200ms ${fastOutSlowIn} 50ms`,
      },
      backgroundStyle: {
        opacity: 1,
        transition: `opacity 150ms ${fastOutSlowIn}`,
      },
    })
  };

  calculatePopoverPosition() {
    const {
      anchor,
      anchorOffsetVertical,
      anchorOffsetHorizontal,
      anchorOriginVertical,
      anchorOriginHorizontal,
      targetOriginVertical,
      targetOriginHorizontal,
    } = this.props
    if (!anchor) {
      return null
    }
    const clientWidth = document.body.clientWidth
    const clientHeight = document.body.clientHeight
    const anchorElement = anchor.getBoundingClientRect()
    const rect = {
      top: anchorElement.top + anchorOffsetVertical,
      right: anchorElement.right + anchorOffsetHorizontal,
      bottom: anchorElement.bottom + anchorOffsetVertical,
      left: anchorElement.left + anchorOffsetHorizontal,
      width: anchorElement.width,
      height: anchorElement.height,
    }

    const popoverPosition = {}
    if (targetOriginVertical === 'top') {
      if (anchorOriginVertical === 'top') {
        popoverPosition.top = rect.top
      } else if (anchorOriginVertical === 'bottom') {
        popoverPosition.top = rect.top + rect.height
      }
    } else if (targetOriginVertical === 'bottom') {
      if (anchorOriginVertical === 'top') {
        popoverPosition.bottom = clientHeight - rect.top
      } else if (anchorOriginVertical === 'bottom') {
        popoverPosition.bottom = clientHeight - (rect.top + rect.height)
      }
    }

    if (targetOriginHorizontal === 'left') {
      if (anchorOriginHorizontal === 'left') {
        popoverPosition.left = rect.left
      } else if (anchorOriginHorizontal === 'right') {
        popoverPosition.left = rect.left + rect.width
      }
    } else if (targetOriginHorizontal === 'right') {
      if (anchorOriginHorizontal === 'left') {
        popoverPosition.right = clientWidth - rect.left
      } else if (anchorOriginHorizontal === 'right') {
        popoverPosition.right = clientWidth - (rect.left + rect.width)
      }
    }

    return popoverPosition
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.open !== this.state.open) {
      if (nextProps.open) {
        this.animationId = window.requestAnimationFrame(this.animateOnOpen)
        this.setState({
          open: true,
          transitioning: true,
          popoverPosition: this.calculatePopoverPosition(),
        })
        clearTimeout(this.openTimer)
        this.openTimer =
            setTimeout(() => this.setState({ transitioning: false }), OPEN_DELAY + OPEN_DURATION)
        clearTimeout(this.closeTimer)
        this.closeTimer = null
      } else {
        this.setState({
          transitioning: true,
          scaleHorizontalStyle: {
            transform: 'scaleX(0.3)',
            transformOrigin: 'right top',
            transition: `transform 200ms ${fastOutSlowIn} 75ms`,
          },
          scaleVerticalStyle: {
            transform: 'scaleY(0.3)',
            transformOrigin: 'right top',
            transition: `transform 200ms ${fastOutSlowIn} 25ms`,
          },
          backgroundStyle: {
            opacity: 0.1,
            transition: `opacity 175ms ${fastOutSlowIn} 100ms`,
          },
        })
        clearTimeout(this.closeTimer)
        this.closeTimer =
            setTimeout(() => this.setState({ open: false, transitioning: false }), CLOSE_DURATION)
      }
    }
  }

  componentWillUnmount() {
    window.cancelAnimationFrame(this.animationId)
    clearTimeout(this.openTimer)
    clearTimeout(this.closeTimer)
  }

  render() {
    const { onDismiss, children, anchor } = this.props
    const { open, popoverPosition: pos } = this.state

    if (!anchor) return null

    const renderContents = () => {
      if (!open && !this.closing) return null

      let state = 'opened'
      const timings = {
        openDelay: OPEN_DELAY,
        openDuration: OPEN_DURATION,
        closeDuration: CLOSE_DURATION,
      }
      if (this.opening) {
        state = 'opening'
      } else if (this.closing) {
        state = 'closing'
      }

      const popoverStyle = {
        top: pos.top,
        bottom: pos.bottom,
        left: pos.left,
        right: pos.right,
      }

      return (<span>
        <WindowListener event='resize' listener={this.recalcPopoverPosition} />
        <WindowListener event='scroll' listener={this.recalcPopoverPosition} />
        <KeyListener onKeyDown={this.onKeyDown}>
          {
            open ?
              <div key={'popover'} className={styles.popover} style={popoverStyle}>
                <div className={styles.scaleHorizontal} style={this.state.scaleHorizontalStyle}>
                  <div className={styles.scaleVertical} style={this.state.scaleVerticalStyle}>
                    <div className={styles.background} style={this.state.backgroundStyle} />
                  </div>
                </div>
                { children(state, timings) }
              </div> :
              null
          }
        </KeyListener>
      </span>)
    }

    return (<Portal onDismiss={onDismiss} open={open}>
      { renderContents }
    </Portal>)
  }

  recalcPopoverPosition = () => {
    this.setState({
      popoverPosition: this.calculatePopoverPosition(),
    })
  };
}
