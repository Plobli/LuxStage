import { pb } from './pocketbase.js'

export async function fetchChannels(showId) {
  return await pb.collection('channels').getFullList({
    filter: `show = "${showId}"`,
    sort: 'position,channel_number',
  })
}

export async function updateChannel(id, data) {
  return await pb.collection('channels').update(id, data)
}

export async function createChannel(showId, data) {
  return await pb.collection('channels').create({ ...data, show: showId })
}

export async function bulkCreateChannels(showId, channels) {
  // PocketBase has no batch API — create sequentially
  const results = []
  for (const ch of channels) {
    results.push(
      await pb.collection('channels').create({ ...ch, show: showId })
    )
  }
  return results
}

export async function deleteChannel(id) {
  return await pb.collection('channels').delete(id)
}
