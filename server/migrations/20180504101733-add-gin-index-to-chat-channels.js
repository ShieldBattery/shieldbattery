exports.up = async function(db) {
  await db.runSql(`
    CREATE INDEX channels_name_index ON channels USING gin (name gin_trgm_ops);
  `)
}

exports.down = async function(db) {
  await db.runSql(`
    DROP INDEX channels_name_index;
  `)
}

exports._meta = {
  version: 1,
}
