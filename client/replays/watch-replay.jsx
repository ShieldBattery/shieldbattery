import React from 'react'
import { connect } from 'react-redux'
import path from 'path'
import { remote } from 'electron'

import BrowseFiles from '../file-browser/browse-files'
import { openDialog } from '../dialogs/action-creators'

import Replay from '../icons/material/ic_movie_black_24px.svg'

function getReplayFolder() {
  return path.join(remote.app.getPath('documents'), 'Starcraft', 'maps', 'replays')
}

@connect()
export default class Replays extends React.Component {
  render() {
    const fileTypes = {
      rep: { icon: <Replay />, onSelect: this.onOpenDialogReplay },
    }
    const defaultFolder = {
      id: 'default',
      name: 'Replays',
      path: getReplayFolder(),
    }
    const props = {
      browseId: 'replays',
      title: 'Local Replays',
      rootFolders: {
        [defaultFolder.id]: defaultFolder,
      },
      fileTypes,
    }
    return <BrowseFiles {...props} />
  }

  onOpenDialogReplay = replay => {
    this.props.dispatch(
      openDialog('replay', {
        replay,
        hasButton: true,
      }),
    )
  }
}
