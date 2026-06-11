const KEY = 'cs_ticket_user'

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setCurrentUser(user) {
  localStorage.setItem(KEY, JSON.stringify(user))
}

export function clearCurrentUser() {
  localStorage.removeItem(KEY)
}

export function authHeaders() {
  const user = getCurrentUser()
  if (!user) return {}
  return {
    'X-User-Id': user.id,
    'X-Username': user.username,
    'X-Role': user.role,
    'X-Name': user.name,
  }
}
