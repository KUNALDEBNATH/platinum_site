const { setupDomEnvironment } = require('../test_helper');

describe('Loading States Integration Tests', () => {
  let env;
  let window;
  let document;
  let Auth;

  beforeEach(() => {
    env = setupDomEnvironment();
    window = env.window;
    document = env.document;
    Auth = window.Auth;
    Auth._bindLoginForm();
  });

  test('Sign In button activates spinner and disables during authentication, then restores on success', async () => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const usernameInput = document.getElementById('authUsername');
    const passwordInput = document.getElementById('authPassword');

    // Fill credentials
    usernameInput.value = 'salesmanager';
    passwordInput.value = 'sales123';

    // Mock API call to hold execution so we can inspect loading state
    let resolveLogin;
    const loginPromise = new Promise((resolve) => { resolveLogin = resolve; });
    window.fetch.mockImplementation(() => loginPromise);

    // Submit form (don't await yet so we can inspect DOM)
    const submitPromise = new Promise((resolve) => {
      loginForm.dispatchEvent(new window.Event('submit'));
      resolve();
    });

    await submitPromise;

    // Check loading state: button should be disabled and show spinner
    expect(loginBtn.disabled).toBe(true);
    expect(loginBtn.innerHTML).toContain('class="auth-spinner"');

    // Resolve login request
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const access = 'header.' + btoa(JSON.stringify({ username: 'salesmanager', role: 'salesmanager', exp: expTime })) + '.signature';
    resolveLogin({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ access, refresh: 'ref' })
    });

    // Let any pending promises resolve
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Sign in button must revert back to active state and hide spinner
    expect(loginBtn.disabled).toBe(false);
    expect(loginBtn.innerHTML).toContain('Sign In');
  });

  test('Sign In button reverts and hides spinner when authentication fails', async () => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const usernameInput = document.getElementById('authUsername');
    const passwordInput = document.getElementById('authPassword');

    // Fill credentials
    usernameInput.value = 'salesmanager';
    passwordInput.value = 'wrongpassword';

    // Mock failing API call
    window.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: 'Invalid credentials' })
    });

    // Submit form
    loginForm.dispatchEvent(new window.Event('submit'));

    // Wait for promise cycle
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Sign in button must revert back to active state and hide spinner
    expect(loginBtn.disabled).toBe(false);
    expect(loginBtn.innerHTML).toContain('Sign In');
  });
});
