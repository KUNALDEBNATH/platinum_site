const { setupDomEnvironment } = require('../test_helper');

describe('Auth Unit & Integration Tests', () => {
  let env;
  let window;
  let Auth;

  beforeEach(() => {
    env = setupDomEnvironment();
    window = env.window;
    Auth = window.Auth;
  });

  test('validateLoginForm returns errors for invalid credentials', () => {
    // Missing fields
    let res = Auth.validateLoginForm('', '');
    expect(res.valid).toBe(false);
    expect(res.errors).toContainEqual({ field: 'username', message: 'Username or email is required.' });

    // Short username and short password
    res = Auth.validateLoginForm('ab', '12345');
    expect(res.valid).toBe(false);
    expect(res.errors).toContainEqual({ field: 'username', message: 'Username must be at least 3 characters.' });
    expect(res.errors).toContainEqual({ field: 'password', message: 'Password must be at least 6 characters.' });

    // Valid
    res = Auth.validateLoginForm('salesexecutive', 'sales123');
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  test('parseJwt successfully decodes standard JWT payload structure', () => {
    // Standard mock JWT token
    const token = 'header.' + btoa(JSON.stringify({ username: 'admin', role: 'admin', exp: 9999999999 })) + '.signature';
    const decoded = Auth.parseJwt(token);
    expect(decoded.username).toBe('admin');
    expect(decoded.role).toBe('admin');
  });

  test('saveTokens and clearTokens modify localStorage correctly', () => {
    const accessToken = 'header.' + btoa(JSON.stringify({ username: 'admin', role: 'admin', exp: 9999999999 })) + '.signature';
    const refreshToken = 'refresh';

    Auth.saveTokens('admin', accessToken, refreshToken, false);

    expect(window.localStorage.getItem('crm_accessToken')).toBe(accessToken);
    expect(window.localStorage.getItem('crm_refreshToken')).toBe(refreshToken);
    expect(window.localStorage.getItem('crm_loggedInUser')).toBe('admin');

    Auth.clearTokens();

    expect(window.localStorage.getItem('crm_accessToken')).toBeNull();
    expect(window.localStorage.getItem('crm_refreshToken')).toBeNull();
    expect(window.localStorage.getItem('crm_loggedInUser')).toBeNull();
  });

  test('isAuthenticated returns false if token missing or expired', () => {
    expect(Auth.isAuthenticated()).toBe(false);

    // Set expired token
    const expTime = Math.floor(Date.now() / 1000) - 100; // 100 seconds ago
    const expiredToken = 'header.' + btoa(JSON.stringify({ username: 'admin', role: 'admin', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_accessToken', expiredToken);

    expect(Auth.isAuthenticated()).toBe(false);
    expect(window.sessionStorage.getItem('crm_sessionExpired')).toBe('true');
  });

  test('isAuthenticated returns true if token exists and valid', () => {
    const expTime = Math.floor(Date.now() / 1000) + 1000; // future exp
    const validToken = 'header.' + btoa(JSON.stringify({ username: 'admin', role: 'admin', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_accessToken', validToken);

    expect(Auth.isAuthenticated()).toBe(true);
  });

  test('logoutUser clears store, local storage, and resets view', () => {
    window.Store.setEnquiries([{ id: '1', customer: 'Pavan' }]);
    window.localStorage.setItem('crm_accessToken', 'token');
    window.localStorage.setItem('crm_rememberMe', 'true');

    Auth.logoutUser();

    expect(window.Store.enquiries).toHaveLength(0);
    expect(window.localStorage.getItem('crm_accessToken')).toBeNull();
    expect(window.localStorage.getItem('crm_rememberMe')).toBeNull();
    expect(window.appState.currentView).toBe('dashboard');
  });
});
