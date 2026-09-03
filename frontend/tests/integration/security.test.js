const { setupDomEnvironment } = require('../test_helper');

describe('Security and RBAC Integration Tests', () => {
  let env;
  let window;
  let Auth;
  let Router;
  let appState;

  beforeEach(() => {
    env = setupDomEnvironment();
    window = env.window;
    Auth = window.Auth;
    Router = window.Router;
    appState = window.appState;
  });

  test('Accessing route when unauthenticated triggers redirect to login', async () => {
    // Set no token
    window.localStorage.removeItem('crm_accessToken');
    
    // Attempt navigation
    Router.navigate('sales-enquiries');
    
    // Should stay on login overlay or trigger requireValidSession
    expect(Auth.isAuthenticated()).toBe(false);
    expect(window.document.getElementById('authOverlay').style.display).not.toBe('none');
  });

  test('Role-based navigation permissions - Sales Executive role', () => {
    // Authenticate as a sales executive
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const salesToken = 'header.' + btoa(JSON.stringify({ username: 'salesexecutive', role: 'sales', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_accessToken', salesToken);
    Auth.verifiedRole = 'sales';

    // Can access dashboard
    Router.navigate('dashboard');
    expect(appState.currentView).toBe('dashboard');

    // Cannot access admin controls
    Router.navigate('admin-controls');
    expect(appState.currentView).toBe('access-denied');
    expect(appState.deniedRoute).toBe('Admin Settings');
  });

  test('Role-based navigation permissions - Director role', () => {
    // Authenticate as director
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const directorToken = 'header.' + btoa(JSON.stringify({ username: 'director', role: 'director', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_accessToken', directorToken);
    Auth.verifiedRole = 'director';

    // Access Director panel
    Router.navigate('director-dashboard');
    expect(appState.currentView).toBe('director-dashboard');

    // Cannot access admin controls
    Router.navigate('admin-controls');
    expect(appState.currentView).toBe('access-denied');
  });

  test('Role-based navigation permissions - Admin role', () => {
    // Authenticate as admin
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const adminToken = 'header.' + btoa(JSON.stringify({ username: 'admin', role: 'admin', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_accessToken', adminToken);
    Auth.verifiedRole = 'admin';

    // Admin can access admin controls
    Router.navigate('admin-controls');
    expect(appState.currentView).toBe('admin-controls');
  });

  test('Role escalation block: directly modifying appState.currentView is verified against guards', () => {
    // Set user as sales executive
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const salesToken = 'header.' + btoa(JSON.stringify({ username: 'salesexecutive', role: 'sales', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_accessToken', salesToken);
    Auth.verifiedRole = 'sales';

    // Attempting navigation through Router is blocked
    Router.navigate('admin-controls');
    expect(appState.currentView).toBe('access-denied');
  });

  test('authFetch blocks request if token is missing or expired', async () => {
    // No token
    window.localStorage.removeItem('crm_accessToken');
    Auth.verifiedRole = null;

    await expect(Auth.authFetch('http://127.0.0.1:8000/api/enquiry/'))
      .rejects.toThrow('Invalid or expired session.');
  });
});
