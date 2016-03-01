import React from 'react'
import { connect } from 'react-redux'

export default function conditionalRedirect(conditionFn, actionFn) {
  return (
    @connect(state => ({ auth: state.auth }))
    class ConditionalRedirect extends React.Component {
      constructor(props) {
        super(props)

        this._conditionFn = conditionFn
        this._actionFn = actionFn
      }

      _ensureCondition(props) {
        if (!this._conditionFn(props.auth)) {
          props.dispatch(this._actionFn(props))
        }
      }

      componentWillMount() {
        this._ensureCondition(this.props)
      }

      componentWillReceiveProps(nextProps) {
        this._ensureCondition(nextProps)
      }

      render() {
        if (this._conditionFn(this.props.auth)) {
          const children = this.props.children
          return !Array.isArray(children) ? children : <div>children</div>
        } else {
          return <div></div>
        }
      }
    }
  )
}
