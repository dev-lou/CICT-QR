import assert from 'node:assert/strict'

function enqueueOffline(queue, uuid, mode) {
  const alreadyQueued = queue.some((entry) => {
    const queuedUuid = typeof entry === 'string' ? entry.trim() : (entry?.uuid || '').trim()
    const queuedMode = typeof entry === 'string' ? mode : (entry?.mode || mode)
    return queuedUuid === uuid && queuedMode === mode
  })

  if (!alreadyQueued) {
    queue.push({
      uuid,
      name: 'Pending verification',
      mode,
      queued_at: new Date().toISOString()
    })
  }

  return { alreadyQueued, queue }
}

async function flushQueueLikeScanner({ queue, backendConnected, processScanBatch, mode }) {
  if (queue.length === 0) {
    return { status: 'empty', queue }
  }

  if (!backendConnected) {
    return { status: 'offline', queue }
  }

  const batch = queue.splice(0)

  try {
    const results = await processScanBatch(batch, mode)

    const failedStatuses = new Set(['error'])
    const failedItems = results
      .filter((result) => failedStatuses.has(result.status))
      .map((result) => (typeof result.item === 'string' ? { uuid: result.uuid } : result.item))

    if (failedItems.length > 0) {
      queue.unshift(...failedItems)
      return { status: 'partial', queue, results }
    }

    return { status: 'ok', queue, results }
  } catch (error) {
    queue.unshift(...batch)
    return { status: 'error', queue, error }
  }
}

async function run() {
  // 1) Dedupe behavior for same uuid+mode
  {
    const queue = []
    const first = enqueueOffline(queue, 'abc-uuid', 'time-in')
    const second = enqueueOffline(queue, 'abc-uuid', 'time-in')

    assert.equal(first.alreadyQueued, false)
    assert.equal(second.alreadyQueued, true)
    assert.equal(queue.length, 1)
  }

  // 2) Same uuid but different mode should be queued separately
  {
    const queue = []
    enqueueOffline(queue, 'abc-uuid', 'time-in')
    enqueueOffline(queue, 'abc-uuid', 'time-out')
    assert.equal(queue.length, 2)
  }

  // 3) Flush while offline keeps queue intact
  {
    const queue = [{ uuid: 'u1', mode: 'time-in' }]
    const result = await flushQueueLikeScanner({
      queue,
      backendConnected: false,
      processScanBatch: async () => [],
      mode: 'time-in'
    })

    assert.equal(result.status, 'offline')
    assert.equal(queue.length, 1)
  }

  // 4) Partial sync re-queues only failed(error) items
  {
    const queue = [{ uuid: 'u1', mode: 'time-in' }, { uuid: 'u2', mode: 'time-in' }, { uuid: 'u3', mode: 'time-in' }]
    const result = await flushQueueLikeScanner({
      queue,
      backendConnected: true,
      processScanBatch: async (batch) => [
        { item: batch[0], uuid: 'u1', status: 'ok' },
        { item: batch[1], uuid: 'u2', status: 'error' },
        { item: batch[2], uuid: 'u3', status: 'ok' }
      ],
      mode: 'time-in'
    })

    assert.equal(result.status, 'partial')
    assert.equal(queue.length, 1)
    assert.equal(queue[0].uuid, 'u2')
  }

  // 5) Full sync clears queue
  {
    const queue = [{ uuid: 'u1', mode: 'time-in' }, { uuid: 'u2', mode: 'time-in' }]
    const result = await flushQueueLikeScanner({
      queue,
      backendConnected: true,
      processScanBatch: async (batch) => batch.map((item) => ({ item, uuid: item.uuid, status: 'ok' })),
      mode: 'time-in'
    })

    assert.equal(result.status, 'ok')
    assert.equal(queue.length, 0)
  }

  console.log('PASS: offline queue + sync smoke tests succeeded')
}

run().catch((error) => {
  console.error('FAIL: offline queue + sync smoke tests failed')
  console.error(error)
  process.exit(1)
})
