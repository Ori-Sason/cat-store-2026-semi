* MongoDB transactions (multi-document)
  * **What:** like Postgres `BEGIN … COMMIT`. Several writes, across documents or collections, commit or roll back together. Each statement runs right away, but other connections don't see the changes until commit.
    ```ts
    const session = client.startSession()
    try {
      await session.withTransaction(async () => {
        await cats.deleteOne({ _id }, { session })
        await reviews.deleteMany({ catId: _id }, { session })
      }) // commits, or aborts both. Retries transient errors on its own
    } finally {
      await session.endSession()
    }
    ```
  * **Needs a replica set.** A standalone `mongod` can't run transactions.
    * Why: MongoDB builds transactions on the oplog, the replica set's change log that secondaries tail and replay. A committed transaction is one oplog entry, so it replicates all or nothing. Snapshot reads use oplog timestamps.
    * A standalone server has no oplog. WiredTiger has transactions internally, but MongoDB chose not to offer an oplog-free path.
    * Not the same as a K8s ReplicaSet: here `mongod` itself runs it (1 primary + N secondaries, each with its own copy of the data).
  * **How to config this feature in differnt environments?**
    * **Local: a single-node replica set.** One container, the primary of a set with no secondaries. No real replication, but it has an oplog, so transactions work. 3 steps, all needed:
      1. Server: `mongod --replSet rs0` (compose `command`, plus `--bind_ip_all`).
      2. Init once: `rs.initiate()` (e.g. in a healthcheck: `try { rs.status() } catch { rs.initiate() }`).
      3. Client: `?replicaSet=rs0` or `?directConnection=true` in the connection string.
    * **Prod (Atlas):** always a replica set, so transactions work with no config.
  * **Why cat-store doesn't use them (yet):** the cascade on cat delete is two plain deletes, cat first, then its reviews.
    * Junk only appears on a crash or a dropped connection between the two deletes. **That's rare**, so a few rows ever, not a growing pile. `$unwind` (inner join) hides those orphans in the UI.
    * A transaction on delete alone isn't complete: `reviewService.add` checks the cat exists and then inserts, so a delete in between still leaves an orphan. Full coverage means wrapping `add` too.
