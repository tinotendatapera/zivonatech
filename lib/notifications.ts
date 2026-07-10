import { supabaseAdmin } from './supabase'

export async function createNotification({
  userId,
  type,
  title,
  body,
  payload,
}: {
  userId: string
  type: string
  title?: string
  body: string
  payload?: Record<string, any>
}) {
  if (!supabaseAdmin || !userId) {
    return null
  }

  const insertPayload: Record<string, any> = {
    user_id: userId,
    type,
    title: title ?? null,
    body,
    payload: payload ?? {},
    is_read: false,
    created_at: new Date().toISOString(),
  }

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert(insertPayload)
    .select('id, user_id, type, is_read, created_at')
    .single()

  if (error) {
    throw error
  }

  return data
}
