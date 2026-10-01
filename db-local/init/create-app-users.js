// Creates the app's least-privilege users: one per database, readWrite on that database only.
// Runs automatically on the first start of an empty volume (/docker-entrypoint-initdb.d).
// Safe to re-run against an existing volume: existing users get their password and roles reset.

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env variable: ${name}`)
  return value
}

const APP_USERS = [
  {
    user: requireEnv('MONGO_DEV_USERNAME'),
    pwd: requireEnv('MONGO_DEV_PASSWORD'),
    dbName: requireEnv('MONGO_DEV_DATABASE'),
  },
  {
    user: requireEnv('MONGO_TEST_USERNAME'),
    pwd: requireEnv('MONGO_TEST_PASSWORD'),
    dbName: requireEnv('MONGO_TEST_DATABASE'),
  },
]

// Users live in `admin`, matching `authSource=admin` in the backend URIs
const adminDb = db.getSiblingDB('admin')

for (const { user, pwd, dbName } of APP_USERS) {
  const roles = [{ role: 'readWrite', db: dbName }]
  if (adminDb.getUser(user)) {
    adminDb.updateUser(user, { pwd, roles })
    print(`Updated user ${user} (readWrite on ${dbName})`)
  } else {
    adminDb.createUser({ user, pwd, roles })
    print(`Created user ${user} (readWrite on ${dbName})`)
  }
}
