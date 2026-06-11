import { createSignal, Show } from 'solid-js'
import { login as storeLogin } from '../store'

function LoginPage() {
  const [username, setUsername] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [error, setError] = createSignal('')
  const [loading, setLoading] = createSignal(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await storeLogin(username(), password())
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const fillCredentials = (user: string, pass: string) => {
    setUsername(user)
    setPassword(pass)
  }

  return (
    <div class="login-page">
      <div class="login-card">
        <h2>维修服务平台</h2>
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              placeholder="请输入用户名"
            />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder="请输入密码"
            />
          </div>
          <Show when={error()}>
            <div class="error-message">{error()}</div>
          </Show>
          <button class="btn btn-primary" type="submit" disabled={loading()} style={{ width: '100%', "margin-top": '8px' }}>
            {loading() ? '登录中...' : '登录'}
          </button>
        </form>
        <div class="role-shortcuts">
          <button onClick={() => fillCredentials('kefu1', '123456')}>客服专员</button>
          <button onClick={() => fillCredentials('shifu1', '123456')}>师傅调度</button>
          <button onClick={() => fillCredentials('jingli1', '123456')}>服务经理</button>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
