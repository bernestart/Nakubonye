import { supabase } from './supabase'

export function publicPhotoUrl(storagePath) {
  if (!storagePath) return ''
  const { data } = supabase.storage
    .from('profile-photos')
    .getPublicUrl(storagePath)
  return data?.publicUrl || ''
}

export function calcAge(dob) {
  if (!dob) return null
  const b = new Date(dob)
  const t = new Date()
  let a = t.getFullYear() - b.getFullYear()
  const m = t.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--
  return a
}
