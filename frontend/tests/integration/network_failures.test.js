const { setupDomEnvironment } = require('../test_helper');

describe('Network Failure Integration Tests', () => {
  let env;
  let window;
  let document;
  let Auth;
  let Api;
  let Utils;

  beforeEach(() => {
    env = setupDomEnvironment();
    window = env.window;
    document = env.document;
    Auth = window.Auth;
    Api = window.Api;
    Utils = window.Utils;

    // Authenticate user for API calls
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const access = 'header.' + btoa(JSON.stringify({ username: 'salesexecutive', role: 'sales', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_accessToken', access);
    Auth.verifiedRole = 'sales';
  });

  test('Resilience against Network connection failure (fetch throws error)', async () => {
    // Mock network disconnected
    window.fetch.mockRejectedValue(new Error('TypeError: Failed to fetch'));

    // Verify calling API throws expected user-friendly exception
    await expect(Api.getEnquiries()).rejects.toThrow('TypeError: Failed to fetch');
  });

  test('Resilience against Server 500 error / Backend unavailable', async () => {
    window.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: 'Internal Server Error' })
    });

    await expect(Api.getEnquiries()).rejects.toThrow('Internal Server Error');
  });

  test('Resilience against invalid/malformed JSON payload response', async () => {
    window.fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON at position 0'))
    });

    // The getApiErrorMessage catch handler converts JSON parsing failure to fallbackMessage
    await expect(Api.getEnquiries()).rejects.toThrow('Failed to fetch enquiries');
  });

  test('Form remains usable and error toast is shown when createEnquiry fails', async () => {
    // Put view onto enquiry-form
    window.Router.navigate('enquiry-form');
    
    const form = document.getElementById('salesEnquiryForm');
    expect(form).not.toBeNull();

    // Fill minimum required fields
    form.querySelector('[name="customerName"]').value = 'John Doe';
    form.querySelector('[name="modelName"]').value = 'MT-15';
    form.querySelector('[name="phone"]').value = '9876543210';

    // Mock API failure
    window.fetch.mockRejectedValueOnce(new Error('Server Timeout'));

    // Set up toast container check
    const toastContainer = document.getElementById('toastContainer');
    expect(toastContainer.children).toHaveLength(0);

    // Trigger form submit
    form.dispatchEvent(new window.Event('submit'));

    // Wait for promise cycle
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Confirm view did NOT change (remains on form page for correction)
    expect(window.appState.currentView).toBe('enquiry-form');

    // Confirm toast error notification is shown
    expect(toastContainer.children).toHaveLength(1);
    expect(toastContainer.innerHTML).toContain('Server Timeout');
  });
});
