export async function getAuthenticatedUserFromRequest(request, supabase) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim()
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (!error && user) {
        return user
      }
    }
  }

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return null
  }

  return user
}
