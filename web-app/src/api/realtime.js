import { pb } from './pocketbase.js'

export function subscribeChannels(showId, { onUpsert, onDelete }) {
  pb.collection('channels').subscribe('*', (e) => {
    if (e.record.show !== showId) return
    if (e.action === 'create' || e.action === 'update') onUpsert(e.record)
    if (e.action === 'delete') onDelete(e.record.id)
  })
  return () => pb.collection('channels').unsubscribe('*')
}
