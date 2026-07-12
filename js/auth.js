(function () {
  async function parseResponse(response, fallbackError = 'Request failed') {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || fallbackError);
    return result;
  }

  async function checkSession() {
    const response = await fetch('/api/auth/me');
    if (!response.ok) throw new Error('Authentication service unavailable');
    return response.json();
  }

  async function login(payload) {
    return parseResponse(await fetch('/api/auth/login', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify(payload)
    }), 'Authentication failed');
  }

  async function register(payload) {
    return parseResponse(await fetch('/api/auth/register', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify(payload)
    }), 'Registration failed');
  }

  async function logout() {
    return parseResponse(await fetch('/api/auth/logout', { method:'POST' }), 'Could not log out');
  }

  window.ExpensoAuth = { checkSession, login, register, logout };
})();
