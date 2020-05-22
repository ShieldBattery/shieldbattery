import { List, Map, Record, Set } from 'immutable'
import cuid from 'cuid'

import pickServer from '../rally-point/pick-server'
import pingRegistry from '../rally-point/ping-registry'
import routeCreator from '../rally-point/route-creator'
import CancelToken from '../../../common/async/cancel-token'
import createDeferred from '../../../common/async/deferred'
import rejectOnTimeout from '../../../common/async/reject-on-timeout'

const GAME_LOAD_TIMEOUT = 30 * 1000

function generateSeed() {
  // BWChart and some other replay sites/libraries utilize the random seed as the date the game was
  // played, so we match BW's random seed method (time()) here
  return (Date.now() / 1000) | 0
}

function createRoutes(players) {
  // Generate all the pairings of players to figure out the routes we need
  const matchGen = []
  let rest = players
  while (!rest.isEmpty()) {
    const first = rest.first()
    rest = rest.rest()
    if (!rest.isEmpty()) {
      matchGen.push([first, rest])
    }
  }
  const needRoutes = matchGen.reduce((result, [p1, players]) => {
    players.forEach(p2 => result.push([p1, p2]))
    return result
  }, [])
  const pingsByPlayer = new Map(players.map(player => [player, pingRegistry.getPings(player.name)]))

  const routesToCreate = needRoutes.map(([p1, p2]) => ({
    p1,
    p2,
    server: pickServer(pingsByPlayer.get(p1), pingsByPlayer.get(p2)),
  }))

  return Promise.all(
    routesToCreate.map(({ p1, p2, server }) =>
      server === -1
        ? Promise.reject(new Error('No server match found'))
        : routeCreator.createRoute(pingRegistry.servers[server]).then(result => ({
            p1,
            p2,
            server: pingRegistry.servers[server],
            result,
          })),
    ),
  )
}

const LoadingData = new Record({
  players: new Set(),
  finishedPlayers: new Set(),
  cancelToken: null,
  deferred: null,
})

export const LoadingDatas = {
  isAllFinished(loadingData) {
    return loadingData.players.every(p => loadingData.finishedPlayers.has(p.id))
  },
}

export class GameLoader {
  constructor() {
    this.loadingGames = new Map()
    this.onGameSetup = null
    this.onRoutesSet = null
    this.onLoadingCanceled = null
    this.onGameLoaded = null
  }

  // A function that starts the process of loading a new game. The first argument is a list of
  // players, created as a human type slots. Requires at leat one player for things to work
  // properly. Besides players, a set of handlers can be sent, which will be called during various
  // phases of the loading process.
  loadGame(players, onGameSetup, onRoutesSet, onLoadingCanceled, onGameLoaded) {
    this.onGameSetup = onGameSetup
    this.onRoutesSet = onRoutesSet
    this.onLoadingCanceled = onLoadingCanceled
    this.onGameLoaded = onGameLoaded

    const cancelToken = new CancelToken()
    const gameId = cuid()
    const gameLoad = this._doGameLoad(gameId, cancelToken, players)

    rejectOnTimeout(gameLoad, GAME_LOAD_TIMEOUT).catch(() => {
      cancelToken.cancel()
      this.maybeCancelLoading(gameId)
    })

    return gameLoad
  }

  // A function which is called to register the (now loaded) game into the system for each player.
  // Currently, it only cleans up the loading game state, but in future it will be used to accept
  // the game results and perhaps registering the user to the gameplay activity registry, if not
  // already registered.
  registerGame(gameId, playerName) {
    let loadingData = this.loadingGames.get(gameId)
    const player = loadingData.players.find(p => p.name === playerName)
    loadingData = loadingData.set('finishedPlayers', loadingData.finishedPlayers.add(player.id))
    this.loadingGames = this.loadingGames.set(gameId, loadingData)

    if (LoadingDatas.isAllFinished(loadingData)) {
      // TODO(tec27): register this game in the DB for accepting results
      if (this.onGameLoaded) {
        this.onGameLoaded(loadingData.players)
      }

      this.loadingGames = this.loadingGames.delete(gameId)
      loadingData.deferred.resolve()
    }
  }

  // Cancels the loading state of the game if it was loading (no-op if it was not)
  maybeCancelLoading(gameId) {
    if (!this.loadingGames.has(gameId)) {
      return
    }

    const loadingData = this.loadingGames.get(gameId)
    this.loadingGames = this.loadingGames.delete(gameId)
    loadingData.cancelToken.cancel()
    loadingData.deferred.reject(new Error('Game loading cancelled'))

    if (this.onLoadingCanceled) {
      this.onLoadingCanceled()
    }
  }

  isLoading(gameId) {
    return this.loadingGames.has(gameId)
  }

  async _doGameLoad(gameId, cancelToken, players) {
    const gameLoaded = createDeferred()
    this.loadingGames = this.loadingGames.set(
      gameId,
      new LoadingData({
        players: new Set(players),
        cancelToken,
        deferred: gameLoaded,
      }),
    )
    if (this.onGameSetup) {
      this.onGameSetup({ gameId, seed: generateSeed() })
    }

    const hasMultipleHumans = players.size > 1
    const pingPromise = !hasMultipleHumans
      ? Promise.resolve()
      : Promise.all(players.map(p => pingRegistry.waitForPingResult(p.name)))

    await pingPromise
    cancelToken.throwIfCancelling()

    const routes = hasMultipleHumans ? await createRoutes(players) : []
    cancelToken.throwIfCancelling()

    // get a list of routes + player IDs per player, broadcast that to each player
    const routesByPlayer = routes.reduce((result, route) => {
      const {
        p1,
        p2,
        server,
        result: { routeId, p1Id, p2Id },
      } = route
      return result
        .update(p1, new List(), val => val.push({ for: p2.id, server, routeId, playerId: p1Id }))
        .update(p2, new List(), val => val.push({ for: p1.id, server, routeId, playerId: p2Id }))
    }, new Map())

    for (const [player, routes] of routesByPlayer.entries()) {
      if (this.onRoutesSet) {
        this.onRoutesSet(player.name, routes)
      }
    }
    if (!hasMultipleHumans) {
      if (this.onRoutesSet) {
        this.onRoutesSet(players.first().name, [])
      }
    }

    cancelToken.throwIfCancelling()
    await gameLoaded
  }
}

export default new GameLoader()
