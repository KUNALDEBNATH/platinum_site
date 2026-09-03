const { setupDomEnvironment } = require('../test_helper');

describe('API Contract Integration Tests', () => {
  let env;
  let window;
  let Auth;
  let Api;

  beforeEach(() => {
    env = setupDomEnvironment();
    window = env.window;
    Auth = window.Auth;
    Api = window.Api;
  });

  test('Validates Login response schema processing', async () => {
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const access = 'header.' + btoa(JSON.stringify({ username: 'admin', role: 'admin', exp: expTime })) + '.signature';
    const refresh = 'refresh_token';

    // Mock API returning valid contract
    window.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ access, refresh })
    });
    // Second mock for verifySessionWithBackend
    window.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ username: 'admin', role: 'admin' })
    });

    const loginRes = await Auth.loginUser('admin', 'admin123');
    expect(loginRes).toHaveProperty('access');
    expect(loginRes).toHaveProperty('refresh');
    expect(Auth.getUserRole()).toBe('admin');
  });

  test('Validates Token Refresh response schema processing', async () => {
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const newAccess = 'header.' + btoa(JSON.stringify({ username: 'admin', role: 'admin', exp: expTime })) + '.signature';
    
    window.localStorage.setItem('crm_refreshToken', 'some_refresh');
    
    // Mock refresh API returning contract
    window.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ access: newAccess })
    });

    const refreshSuccess = await Auth.refreshAccessToken();
    expect(refreshSuccess).toBe(true);
    expect(window.localStorage.getItem('crm_accessToken')).toBe(newAccess);
  });

  test('Validates Enquiry Creation payload and response mapping', async () => {
    // Authenticate user
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const access = 'header.' + btoa(JSON.stringify({ username: 'salesexecutive', role: 'sales', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_accessToken', access);
    Auth.verifiedRole = 'sales';

    const mockResponse = {
      enquiry_id: 'ENQ001',
      customer: 'Pavan',
      vehicle: 'R15',
      temperature: 'Hot',
      status: 'Submitted',
      date: '2026-06-13',
      source: 'Walk-in'
    };

    window.fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve(mockResponse)
    });

    const payload = {
      customer: 'Pavan',
      vehicle: 'R15',
      temperature: 'Hot',
      status: 'Submitted'
    };

    const res = await Api.createEnquiry(payload);
    
    // Validate schema keys returned from backend mapping
    expect(res).toHaveProperty('enquiry_id', 'ENQ001');
    expect(res).toHaveProperty('customer', 'Pavan');
    expect(res).toHaveProperty('vehicle', 'R15');
    expect(res).toHaveProperty('status', 'Submitted');
  });

  test('Validates general error response payload processing', async () => {
    // Authenticate user
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const access = 'header.' + btoa(JSON.stringify({ username: 'salesexecutive', role: 'sales', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_accessToken', access);
    Auth.verifiedRole = 'sales';

    // Mock API returning error detail contract
    window.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: 'Missing required field: customer' })
    });

    await expect(Api.createEnquiry({}))
      .rejects.toThrow('Missing required field: customer');
  });

  test('Validates permission-denied (403) contract handling', async () => {
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const access = 'header.' + btoa(JSON.stringify({ username: 'salesexecutive', role: 'sales', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_accessToken', access);
    Auth.verifiedRole = 'sales';

    // Mock backend returning 403 Forbidden
    window.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ detail: 'You do not have permission to view enquiries' })
    });

    await expect(Api.getEnquiries())
      .rejects.toThrow("Access denied. You don't have permission to access this resource.");
  });
});
