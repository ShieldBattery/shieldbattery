import { is, Map, Record } from 'immutable'
import { NydusServer } from 'nydus'
import { singleton } from 'tsyringe'
import { MatchmakingType } from '../../../common/matchmaking'
import log from '../logging/logger'
import { getCurrentMatchmakingTime, getMatchmakingSchedule } from '../models/matchmaking-times'
import { ClientSocketsManager } from '../websockets/socket-groups'

class StatusRecord extends Record({
  type: null as MatchmakingType | null,
  enabled: false,
  startDate: null as Date | null,
  nextStartDate: null as Date | null,
  nextEndDate: null as Date | null,
}) {}

@singleton()
export default class MatchmakingStatusService {
  private statusByType = Map<MatchmakingType, StatusRecord>()
  private timerByType = Map<MatchmakingType, ReturnType<typeof setTimeout>>()

  constructor(private nydus: NydusServer, private clientSockets: ClientSocketsManager) {
    clientSockets.on('newClient', client => {
      if (client.clientType === 'electron') {
        client.subscribe('/matchmakingStatus', () => {
          const statuses = []
          for (const type of Object.values(MatchmakingType)) {
            const status = this.statusByType.get(type)
            if (status) {
              statuses.push(status)
            }
          }
          return statuses
        })
      }
    })

    for (const type of Object.values(MatchmakingType)) {
      this.maybePublish(type)
    }
  }

  isEnabled(type: MatchmakingType): boolean {
    return !!this.statusByType.get(type)?.enabled
  }

  private async getStatus(type: MatchmakingType) {
    const current = await getCurrentMatchmakingTime(type)
    const schedule = await getMatchmakingSchedule(type, current?.startDate, !current?.enabled)

    return new StatusRecord({
      type,
      enabled: !!current?.enabled,
      startDate: current?.startDate,
      nextStartDate: schedule[0]?.startDate,
      nextEndDate: schedule[1]?.startDate,
    })
  }

  /**
   * Publishes the current matchmaking status to subscribed users, if the status or the schedule
   * has changed since the last cached value.
   *
   * If a change has occurred, a timeout will be set up for the next scheduled change to publish
   * that as well.
   */
  maybePublish(type: MatchmakingType) {
    this.getStatus(type)
      .then(status => {
        const oldStatus = this.statusByType.get(type)
        // If the status hasn't changed, no need to notify the users
        if (is(oldStatus, status)) return

        this.statusByType = this.statusByType.set(type, status)
        this.nydus.publish('/matchmakingStatus', [status])

        // If the `nextStartDate` hasn't changed, no need to update the timer
        if (oldStatus?.nextStartDate === status.nextStartDate) return

        const oldTimer = this.timerByType.get(type)
        if (oldTimer) {
          clearTimeout(oldTimer)
        }

        if (status.nextStartDate) {
          const timer = setTimeout(
            () => this.maybePublish(type),
            +status.nextStartDate - Date.now(),
          )
          this.timerByType = this.timerByType.set(type, timer)
        } else {
          this.timerByType = this.timerByType.delete(type)
        }
      })
      .catch(err => log.error({ err }, 'error getting matchmaking status'))
  }
}
