import { pb } from './pocketbase.js'

export async function fetchShows() {
  return await pb.collection('shows').getFullList({
    filter: 'archived = false',
    sort: '-created',
    expand: 'template',
  })
}

export async function fetchArchivedShows() {
  return await pb.collection('shows').getFullList({
    filter: 'archived = true',
    sort: '-created',
    expand: 'template',
  })
}

export async function fetchShow(id) {
  return await pb.collection('shows').getOne(id, {
    expand: 'template',
  })
}

export async function createShow(data) {
  return await pb.collection('shows').create(data)
}

export async function updateShow(id, data) {
  return await pb.collection('shows').update(id, data)
}

export async function archiveShow(id) {
  return await pb.collection('shows').update(id, { archived: true })
}

export async function unarchiveShow(id) {
  return await pb.collection('shows').update(id, { archived: false })
}

export async function deleteShow(id) {
  return await pb.collection('shows').delete(id)
}
