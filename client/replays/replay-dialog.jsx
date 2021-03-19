import fs from 'fs'
import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'
// import { SubheadingOld } from '../styles/typography'
import Dialog from '../material/dialog'
import FlatButton from '../material/flat-button'
import ReplayParser from 'jssuh'
import { startReplay } from './action-creators'
import RaisedButton from '../material/raised-button'
import { closeDialog } from '../dialogs/action-creators'
import { StyledRaceIcon } from '../lobbies/race-picker'

const Container = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 40px;
  width: 100%;
`

const Team = styled.ul`
  background-color: rgba(255, 255, 255, 0.1);
  padding: 20px;
  list-style-type: none;
`

const Player = styled.li``

// NOTE(coin²): Please do not make fun of me :D
const PlayerName = styled.span`
  padding-left: 20px;
  vertical-align: top;
  line-height: 2;
`

// TODO(coin²): Implement game type mapping in jssuh.
// This mapping is taken from my Python bot and goes from 0x00 to 0x10
const gameTypeMapping = [
  'None',
  'Custom',
  'Melee',
  'Free For All',
  'One on One',
  'Capture The Flag',
  'Greed',
  'Slaughter',
  'Sudden Death',
  'Ladder',
  'Use map settings',
  'Team Melee',
  'Team Free For All',
  'Team Capture The Flag',
  'Unknown',
  'Top vs Bottom',
  'Iron Man Ladder',
]

// TODO(coin²): Implement color mapping in jssuh (you will have to iterate through players)

const dateFormat = new Intl.DateTimeFormat(navigator.language, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: 'numeric',
  minute: '2-digit',
})

@connect()
export default class ReplayDialog extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      replay: this.props.replay,
    }
  }

  componentDidMount() {
    const header = this.parseReplay(this.props.replay.path)
    this.setState({ header })
  }

  // TODO(coin²): We should factorize some of this with getReplayHeader()
  //              from client\replays\action-creators.js
  parseReplay(filePath) {
    const reppi = fs.createReadStream(filePath).pipe(new ReplayParser())
    reppi.on('replayHeader', replayDetails => {
      const { players, durationFrames } = replayDetails
      const minutes = Math.floor(durationFrames / 24 / 60)
      const seconds = Math.floor(durationFrames / 24) % 60
      replayDetails.duration = `${minutes} min ${seconds} s`
      replayDetails.teamsMapping = {}
      replayDetails.playersMapping = {}
      for (const [idx, { name, id, race, team, isComputer }] of players.entries()) {
        if (isComputer) {
          console.log(`Computer ${name} (${id}): Race ${race}, team ${team}`)
        } else {
          console.log(`Player ${name} (${id}): Race ${race}, team ${team}`)
        }
        replayDetails.playersMapping[id] = idx
        if (team in replayDetails.teamsMapping) {
          replayDetails.teamsMapping[team].push(id)
        } else {
          replayDetails.teamsMapping[team] = [id]
        }
      }
      this.setState({ replayDetails })
    })
  }

  onStartReplay = replay => {
    this.props.dispatch(closeDialog())
    // NOTE(coin²): I think it's better not to close the overlay
    // this.props.dispatch(closeOverlay())
    this.props.dispatch(startReplay(replay))
  }

  renderTeams(players, playersMapping, teamsMapping) {
    const teamsContent = []
    console.log(players, teamsMapping)
    for (const [teamId, playerIds] of Object.entries(teamsMapping)) {
      const playersContent = []
      for (const id of playerIds) {
        const player = players[playersMapping[id]]
        // NOTE(coin²): Have a RACE_PICKER_SIZE_SMALL variable for StyledRaceIcon?
        playersContent.push(
          <Player key={id}>
            <StyledRaceIcon active={true} race={player.race[0]} size={'MEDIUM'} />
            <PlayerName>{player.name}</PlayerName>
          </Player>,
        )
      }
      teamsContent.push(<Team key={teamId}>{playersContent}</Team>)
    }
    return <Container>{teamsContent}</Container>
  }

  render() {
    const { replay, onCancel, hasButton } = this.props
    const buttons = hasButton
      ? [
          <FlatButton label={'Cancel'} key={'okay'} color={'accent'} onClick={onCancel} />,
          <RaisedButton
            key={'button'}
            onClick={() => this.onStartReplay(replay)}
            label={'Watch Replay'}
          />,
        ]
      : []

    // NOTE(coin²): Surely there are better way to do that
    // Only render content once we have replay details
    let content
    if (this.state.replayDetails !== undefined) {
      console.log('replay', replay)
      console.log('replayDetails', this.state.replayDetails)

      const {
        gameName,
        mapName,
        gameType,
        players,
        playersMapping,
        duration,
        teamsMapping,
      } = this.state.replayDetails
      content = (
        <div>
          <Container>
            <div>Map: {mapName}</div>
            <div>Type: {gameTypeMapping[gameType]}</div>
            <div>Length: {duration}</div>
            <div>Date: {dateFormat.format(replay.date)}</div>
            <div>File name: {gameName}</div>
          </Container>
          {this.renderTeams(players, playersMapping, teamsMapping)}
        </div>
      )
    }

    return (
      <Dialog
        title={'Replay ' + replay.name}
        onCancel={onCancel}
        showCloseButton={true}
        buttons={buttons}>
        {content}
      </Dialog>
    )
  }
}
