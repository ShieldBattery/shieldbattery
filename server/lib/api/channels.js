import httpErrors from 'http-errors'
import { listChannels as dbListChannels, searchChannels } from '../models/chat-channels'
import { isValidChannelName } from '../../../app/common/constants'
import { MULTI_CHANNEL } from '../../../app/common/flags'
import { featureEnabled } from '../flags/feature-enabled'
import ensureLoggedIn from '../session/ensure-logged-in'

export default function(router) {
  router.get('/', featureEnabled(MULTI_CHANNEL), ensureLoggedIn, getChannels)
}

async function getChannels(ctx, next) {
  const { query, limit, page } = ctx.query

  limit = parseInt(limit, 10)
  if (!limit || isNaN(limit) || limit < 0 || limit > 100) {
    limit = 60
  }

  page = parseInt(page, 10)
  if (!page || isNaN(page) || page < 0) {
    page = 0
  }

  if (!query) {
    ctx.body = listChannels(limit, page)

    return
  }

  if (!isValidChannelName(query)) {
    throw new httpErrors.BadRequest('Query must be a valid channel name')
  }

  const channels = await searchChannels(query)
  ctx.body = {
    channels,
    limit,
    page,
  }
}

async function listChannels(limit, page) {
  const { channels } = await dbListChannels(limit, page)

  return {
    channels,
    limit,
    page,
  }
}
