import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import path from 'path'
import { remote } from 'electron'
import styled from 'styled-components'

import ActivityBackButton from '../activities/activity-back-button'
import BrowseFiles from '../file-browser/browse-files'
import LoadingIndicator from '../progress/dots'
import { openSnackbar, TIMING_LONG } from '../snackbars/action-creators'
import { selectLocalMap } from './action-creators'

import MapIcon from '../icons/material/ic_terrain_black_24px.svg'

const LoadingArea = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  height: 100%;
`

@connect(state => ({ localMaps: state.localMaps, settings: state.settings }))
export default class LocalMaps extends React.Component {
  static propTypes = {
    onMapSelect: PropTypes.func,
  }

  componentDidUpdate(prevProps) {
    const { localMaps: prevMaps } = prevProps
    const { localMaps: curMaps } = this.props

    if (!prevMaps.lastError && curMaps.lastError) {
      this.props.dispatch(
        openSnackbar({ message: 'There was a problem uploading the map', time: TIMING_LONG }),
      )
    }
  }

  render() {
    if (!this.props.settings.local.starcraftPath) {
      return null
    }

    if (this.props.localMaps.isUploading) {
      return (
        <LoadingArea>
          <LoadingIndicator />
        </LoadingArea>
      )
    }

    const fileTypes = {
      scm: { icon: <MapIcon />, onSelect: this.onMapSelect },
      scx: { icon: <MapIcon />, onSelect: this.onMapSelect },
    }
    const defaultFolder = {
      id: 'default',
      name: 'Default maps',
      path: path.join(this.props.settings.local.starcraftPath, 'Maps'),
    }
    const downloadsFolder = {
      id: 'downloads',
      name: 'Downloaded maps',
      path: path.join(remote.app.getPath('documents'), 'Starcraft', 'maps', 'Download'),
    }
    const props = {
      browseId: 'maps',
      title: 'Local Maps',
      titleButton: <ActivityBackButton />,
      rootFolders: {
        [defaultFolder.id]: defaultFolder,
        [downloadsFolder.id]: downloadsFolder,
      },
      fileTypes,
    }

    return <BrowseFiles {...props} />
  }

  onMapSelect = map => {
    this.props.dispatch(selectLocalMap(map.path, this.props.onMapSelect))
  }
}
