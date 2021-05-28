import sql, { SQLStatement } from 'sql-template-strings'
import db, { DbClient } from '../db'
import transact from '../db/transaction'

export interface ChannelPermissions {
  kick: boolean
  ban: boolean
  changeTopic: boolean
  togglePrivate: boolean
  editPermissions: boolean
}

export interface Channel {
  name: string
  private: boolean
  highTraffic: boolean
  topic: string
  password: string
}

function convertChannelFromDb(props: {
  /* eslint-disable camelcase */
  name: string
  private: boolean
  high_traffic: boolean
  topic: string
  password: string
  /* eslint-enable camelcase */
}): Channel {
  return {
    name: props.name,
    private: props.private,
    highTraffic: props.high_traffic,
    topic: props.topic,
    password: props.password,
  }
}

export interface JoinedChannel {
  userId: number
  channelName: string
  joinDate: Date
  channelPermissions: ChannelPermissions
}

export interface UserChannelsEntry {
  channelName: string
  joinDate: Date
}

export interface ChatMessageData {
  // TODO(tec27): this can be more strongly typed
  type: string
  text: string
}

export interface DbChatMessage {
  msgId: string
  userName: string
  channelName: string
  sent: Date
  data: ChatMessageData
}

export async function getChannelsForUser(userId: number): Promise<UserChannelsEntry[]> {
  const { client, done } = await db()
  try {
    const result = await client.query(sql`
      SELECT channel_name, join_date
      FROM joined_channels
      WHERE user_id = ${userId}
      ORDER BY join_date`)
    return result.rows.map(row => ({ channelName: row.channel_name, joinDate: row.join_date }))
  } finally {
    done()
  }
}

export interface ChannelUsersEntry {
  userName: string
  joinDate: Date
}

export async function getUsersForChannel(channelName: string): Promise<ChannelUsersEntry[]> {
  const { client, done } = await db()
  try {
    const result = await client.query(sql`
      SELECT u.name, c.join_date
      FROM joined_channels as c INNER JOIN users as u ON c.user_id = u.id
      WHERE c.channel_name = ${channelName}
      ORDER BY c.join_date`)
    return result.rows.map(row => ({ userName: row.name, joinDate: row.join_date }))
  } finally {
    done()
  }
}

export async function addUserToChannel(
  userId: number,
  channelName: string,
  client?: DbClient,
): Promise<JoinedChannel> {
  const doIt = async (client: DbClient) => {
    const channelExists = await findChannel(channelName)
    await client.query(sql`INSERT INTO channels (name) SELECT ${channelName}
        WHERE NOT EXISTS (SELECT 1 FROM channels WHERE name=${channelName})`)

    let query: SQLStatement
    if (channelExists) {
      query = sql`
        INSERT INTO joined_channels
        (user_id, channel_name, join_date)
        VALUES (${userId}, ${channelName}, CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
        RETURNING *`
    } else {
      // Users joining a new channel get full permissions
      query = sql`
        INSERT INTO joined_channels
        (user_id, channel_name, join_date, kick, ban, change_topic, toggle_private,
          edit_permissions)
        VALUES (${userId}, ${channelName}, CURRENT_TIMESTAMP AT TIME ZONE 'UTC', true, true, true,
          true, true)
        RETURNING *`
    }

    const result = await client.query(query)
    if (result.rowCount < 1) {
      throw new Error('No rows returned')
    }

    const {
      user_id: userIdFromDb,
      channel_name: channelNameFromDb,
      join_date: joinDate,
      kick,
      ban,
      change_topic: changeTopic,
      toggle_private: togglePrivate,
      edit_permissions: editPermissions,
    } = result.rows[0]
    return {
      userId: userIdFromDb,
      channelName: channelNameFromDb,
      joinDate,
      channelPermissions: {
        kick,
        ban,
        changeTopic,
        togglePrivate,
        editPermissions,
      },
    }
  }

  if (client) {
    return doIt(client)
  } else {
    return transact(doIt)
  }
}

// TOOD(tec27): messageData can be more strongly typed
export async function addMessageToChannel(
  userId: number,
  channelName: string,
  messageData: Record<string, unknown>,
): Promise<DbChatMessage> {
  const { client, done } = await db()
  try {
    const result = await client.query(
      sql`
      WITH ins AS (
        INSERT INTO channel_messages (id, user_id, channel_name, sent, data)
        SELECT uuid_generate_v4(), ${userId}, ${channelName},
          CURRENT_TIMESTAMP AT TIME ZONE 'UTC', ${messageData}
        WHERE EXISTS (
          SELECT 1 FROM joined_channels WHERE user_id = ${userId} AND channel_name = ${channelName}
        )
        RETURNING id, user_id, channel_name, sent, data
      )
      SELECT ins.id, users.name, ins.channel_name, ins.sent, ins.data
      FROM ins INNER JOIN users ON ins.user_id = users.id`,
    )
    if (result.rows.length < 1) {
      throw new Error('No rows returned')
    }

    const row = result.rows[0]
    return {
      msgId: row.id,
      userName: row.name,
      channelName: row.channel_name,
      sent: row.sent,
      data: row.data,
    }
  } finally {
    done()
  }
}

export async function getMessagesForChannel(
  channelName: string,
  userId: number,
  limit = 50,
  beforeDate?: Date,
): Promise<DbChatMessage[]> {
  const { client, done } = await db()

  const query = sql`WITH joined AS (
        SELECT join_date
        FROM joined_channels
        WHERE user_id = ${userId} AND channel_name = ${channelName}
      ), messages AS (
        SELECT m.id, u.name, m.channel_name, m.sent, m.data
        FROM channel_messages as m INNER JOIN users as u ON m.user_id = u.id, joined
        WHERE m.channel_name = ${channelName} AND m.sent >= joined.join_date `

  if (beforeDate !== undefined) {
    query.append(sql`AND m.sent < ${beforeDate}`)
  }

  query.append(sql`
        ORDER BY m.sent DESC
        LIMIT ${limit}
      ) SELECT * FROM messages ORDER BY sent ASC`)

  try {
    const result = await client.query(query)

    return result.rows.map(row => ({
      msgId: row.id,
      userName: row.name,
      channelName: row.channel_name,
      sent: row.sent,
      data: row.data,
    }))
  } finally {
    done()
  }
}

export interface LeaveChannelResult {
  /**
   * The new owner of the channel, or null if the channel ownership has been left unchanged.
   */
  newOwner: string | null
}

export async function leaveChannel(
  userId: number,
  channelName: string,
): Promise<LeaveChannelResult> {
  return transact(async function (client) {
    let result = await client.query(sql`
      DELETE FROM joined_channels
      WHERE user_id = ${userId} AND channel_name = ${channelName}
      RETURNING *`)
    if (result.rowCount < 1) {
      throw new Error('No rows returned')
    }

    result = await client.query(sql`
      DELETE FROM channels
      WHERE name = ${channelName} AND
        NOT EXISTS (SELECT 1 FROM joined_channels WHERE channel_name = ${channelName})
      RETURNING name`)
    if (result.rowCount > 0) {
      // Channel was deleted; meaning there is no one left in it so there is no one to transfer the
      // ownership to
      return { newOwner: null }
    }

    result = await client.query(sql`
      SELECT user_id FROM joined_channels
      WHERE channel_name = ${channelName} AND edit_permissions = true`)
    if (result.rowCount > 0) {
      // The channel still has someone who can edit permissions; no transfer of ownership necessary
      return { newOwner: null }
    }

    result = await client.query(sql`
      SELECT name FROM channels
      WHERE name = ${channelName} AND high_traffic = true`)
    if (result.rowCount > 0) {
      // Don't transfer ownership in "high traffic" channels
      return { newOwner: null }
    }

    result = await client.query(sql`
      SELECT u.name, c.user_id, c.join_date
      FROM joined_channels as c INNER JOIN users as u ON c.user_id = u.id
      WHERE c.channel_name = ${channelName} AND
        (c.kick = true OR c.ban = true OR c.change_topic = true OR toggle_private = true)
      ORDER BY c.join_date`)
    if (result.rowCount > 0) {
      // Transfer ownership to the user who has joined the channel earliest and has at least some
      // kind of a permission
      await client.query(sql`
        UPDATE joined_channels
        SET kick=true, ban=true, change_topic=true, toggle_private=true, edit_permissions=true
        WHERE user_id = ${result.rows[0].user_id} AND channel_name = ${channelName}`)
      return { newOwner: result.rows[0].name }
    }

    // Transfer ownership to the user who has joined the channel earliest
    result = await client.query(sql`
      SELECT u.name, c.user_id, c.join_date
      FROM joined_channels as c INNER JOIN users as u ON c.user_id = u.id
      WHERE c.channel_name = ${channelName}
      ORDER BY c.join_date`)

    await client.query(sql`
      UPDATE joined_channels
      SET kick=true, ban=true, change_topic=true, toggle_private=true, edit_permissions=true
      WHERE user_id = ${result.rows[0].user_id} AND channel_name = ${channelName}`)
    return { newOwner: result.rows[0].name }
  })
}

export async function findChannel(channelName: string): Promise<Channel | null> {
  const { client, done } = await db()
  try {
    const result = await client.query(sql`SELECT * FROM channels WHERE name = ${channelName}`)
    return result.rowCount < 1 ? null : convertChannelFromDb(result.rows[0])
  } finally {
    done()
  }
}
