import { createSignal, createMemo } from 'solid-js'
import type { User, Statistics, OrderDetail } from './types'
import * as api from './api'

const [currentUser, setCurrentUser] = createSignal<User | null>(null)
const [token, setTokenInternal] = createSignal<string | null>(localStorage.getItem('token'))
const [selectedOrder, setSelectedOrder] = createSignal<OrderDetail | null>(null)
const [statistics, setStatistics] = createSignal<Statistics | null>(null)

function setToken(t: string | null) {
  if (t) {
    localStorage.setItem('token', t)
  } else {
    localStorage.removeItem('token')
  }
  setTokenInternal(t)
}

async function login(username: string, password: string) {
  const res = await api.login(username, password)
  if (res.code === 0) {
    setToken(res.data.token)
    setCurrentUser(res.data.user)
    return true
  }
  throw new Error(res.message)
}

async function logout() {
  setToken(null)
  setCurrentUser(null)
  setSelectedOrder(null)
  setStatistics(null)
}

async function loadUser() {
  try {
    const res = await api.getMe()
    if (res.code === 0) {
      setCurrentUser(res.data)
    }
  } catch {
    logout()
  }
}

async function loadStatistics() {
  try {
    const res = await api.getStatistics()
    if (res.code === 0) {
      setStatistics(res.data)
    }
  } catch {
    // ignore
  }
}

const isLoggedIn = createMemo(() => !!token())

const isKefu = createMemo(() => currentUser()?.role === '客服专员')
const isShifu = createMemo(() => currentUser()?.role === '师傅调度')
const isJingli = createMemo(() => currentUser()?.role === '服务经理')

export {
  currentUser,
  setCurrentUser,
  token,
  selectedOrder,
  setSelectedOrder,
  statistics,
  setStatistics,
  login,
  logout,
  loadUser,
  loadStatistics,
  isLoggedIn,
  isKefu,
  isShifu,
  isJingli
}
