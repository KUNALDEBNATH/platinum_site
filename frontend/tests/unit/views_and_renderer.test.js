const { setupDomEnvironment } = require('../test_helper');

describe('Views and Renderer Coverage Boost Tests', () => {
  let env;
  let window;
  let document;
  let Auth;
  let Api;
  let Store;
  let Actions;
  let Views;
  let Components;
  let Renderer;
  let Router;
  let appState;
  let Utils;
  let init;
  let Persist;

  beforeEach(() => {
    env = setupDomEnvironment();
    window = env.window;
    document = env.document;
    Auth = window.Auth;
    Api = window.Api;
    Store = window.Store;
    Actions = window.Actions;
    Views = window.Views;
    Components = window.Components;
    Renderer = window.Renderer;
    Router = window.Router;
    appState = window.appState;
    Utils = window.Utils;
    init = window.init;
    Persist = window.Persist;

    // Populate mock store
    Store.enquiries = [
      { id: '1', customer: 'John', vehicle: 'r15', temperature: 'Hot', status: 'Submitted', date: '2026-06-13', source: 'Walk-in' },
      { id: '2', customer: 'Jane', vehicle: 'mt-15', temperature: 'Warm', status: 'Draft', date: '2026-06-12', source: 'Website' },
      { id: '3', customer: 'Alice', vehicle: 'fascino', temperature: 'Cold', status: 'Closed', date: '2026-06-11', source: 'Referral' }
    ];
    Store.appointments = [
      { id: '1', customer: 'John', vehicle: 'r15', status: 'Scheduled', date: '2026-06-13', time: '10:00' }
    ];
    Store.feedback = [
      { id: '1', enquiryId: '1', customer: 'John', vehicle: 'r15', rating: '5', feedback_text: 'Excellent service', date: '2026-06-13', status: 'Submitted' }
    ];
    Store.directorReport = {
      total_enquiries: 3,
      total_appointments: 1,
      total_feedback: 1,
      conversion_rate_percent: 33,
      temperature_breakdown: [
        { temperature: 'Hot', count: 1 },
        { temperature: 'Warm', count: 1 },
        { temperature: 'Cold', count: 1 }
      ],
      source_breakdown: [
        { source: 'Walk-in', count: 1 },
        { source: 'Website', count: 1 },
        { source: 'Referral', count: 1 }
      ]
    };
    Store.adminLogs = [
      { timestamp: '2026-06-13 12:00:00', user: 'admin', action_flag: 'ADD', object: 'Enquiry', change_message: 'Created John' }
    ];

    // Dynamic mock for fetch
    window.fetch.mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/auth/me/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ username: 'sales', role: 'sales' })
        });
      }
      if (urlStr.includes('/api/token/')) {
        const expTime = Math.floor(Date.now() / 1000) + 1000;
        const access = 'header.' + btoa(JSON.stringify({ username: 'sales', role: 'sales', exp: expTime })) + '.signature';
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ access, refresh: 'refresh' })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([])
      });
    });

    // Authenticate a default user so that navigation and api calls succeed by default
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const access = 'header.' + btoa(JSON.stringify({ username: 'sales', role: 'sales', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_accessToken', access);
    Auth.verifiedRole = 'sales';
  });

  test('Invokes all views successfully to test their static rendering logic', () => {
    expect(Views.dashboard()).toContain('Sales CRM Dashboard');
    expect(Views['sales-enquiries']()).toContain('Sales Enquiries');
    expect(Views.appointments()).toContain('Appointment Booking');
    expect(Views.feedback()).toContain('Sales Feedback');
    expect(Views['enquiry-form']()).toContain('New Sales Enquiry Form');
    expect(Views['appointment-form']()).toContain('New Appointment');

    // Director role views
    Auth.verifiedRole = 'director';
    expect(Views['director-dashboard']()).toContain('Director Insights & Analytics');
    expect(Views.reports()).toContain('Executive Reports');

    // Admin role views
    Auth.verifiedRole = 'admin';
    expect(Views['admin-controls']()).toContain('System Administration');

    // Access denied
    appState.deniedRoute = 'admin-controls';
    expect(Views['access-denied']()).toContain('403 Access Restricted');
  });

  test('Invokes all components directly with mock input data', () => {
    // statCard and statCards
    expect(Components.statCards()).toContain('stat-card');

    // table with empty lists
    const emptyTable = Components.table(window.TABLE_CONFIG.enquiries, []);
    expect(emptyTable).toContain('No matching records found');

    // listStack with empty list
    expect(Components.listStack([])).toBe('\n    <div class="list-stack">\n      \n    </div>\n  ');
  });

  test('Invokes Renderer methods and triggers UI interactions/events', () => {
    // Call Renderer page methods
    Renderer.page();

    // Trigger search input search key change
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = 'John';
      searchInput.dispatchEvent(new window.Event('input'));
      expect(appState.search).toBe('John');
    }

    // Trigger profile menu expansion toggle and clicks
    const avatarBtn = document.getElementById('avatarBtn');
    const profileMenu = document.getElementById('profileMenu');
    if (avatarBtn && profileMenu) {
      avatarBtn.dispatchEvent(new window.Event('click'));
      expect(profileMenu.classList.contains('open')).toBe(true);

      // Trigger document body click to dismiss menu
      document.dispatchEvent(new window.Event('click'));
      expect(profileMenu.classList.contains('open')).toBe(false);
    }

    // Trigger logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.dispatchEvent(new window.Event('click'));
      expect(window.localStorage.getItem('crm_accessToken')).toBeNull();
    }
  });

  test('Triggers navigation clicking and filters updates in rendered template', () => {
    // Rerender dashboard to bind nav triggers
    appState.currentView = 'dashboard';
    Renderer.page();

    // Trigger data-nav elements
    const dashboardNavBtn = document.querySelector('[data-nav="sales-enquiries"]');
    if (dashboardNavBtn) {
      dashboardNavBtn.dispatchEvent(new window.Event('click'));
      expect(appState.currentView).toBe('sales-enquiries');
    }

    // Trigger change on filter dropdowns
    const filterSelect = document.querySelector('[data-filter="enquiries"]');
    if (filterSelect) {
      filterSelect.value = 'submitted';
      filterSelect.dispatchEvent(new window.Event('change'));
      expect(appState.filters.enquiries.status).toBe('submitted');
    }
  });

  test('Triggers form submit and validation events', async () => {
    // Navigate to enquiry-form to render and bind form
    Router.navigate('enquiry-form');

    const form = document.getElementById('salesEnquiryForm');
    expect(form).not.toBeNull();

    // Trigger reset
    form.dispatchEvent(new window.Event('reset'));

    // Trigger change events for conditional logic
    // paymentType change to Finance
    const paymentSelect = form.querySelector('[name="paymentType"]');
    if (paymentSelect) {
      paymentSelect.value = 'Finance';
      paymentSelect.dispatchEvent(new window.Event('change'));
      const financeSect = document.getElementById('financeDetails');
      expect(financeSect.classList.contains('show')).toBe(true);
    }

    // testRide change to Yes
    const testRideSelect = form.querySelector('[name="testRide"]');
    if (testRideSelect) {
      testRideSelect.value = 'Yes';
      testRideSelect.dispatchEvent(new window.Event('change'));
    }

    // Submit invalid form (missing fields)
    form.dispatchEvent(new window.Event('submit'));
    // Wait for promise tick
    await new Promise((r) => setTimeout(r, 10));

    // Fill valid inputs
    const nameEl = form.querySelector('[name="customerName"]');
    nameEl.value = 'John Smith';
    nameEl.dispatchEvent(new window.Event('input')); // clears error styles

    form.querySelector('[name="phone"]').value = '9876543210';
    form.querySelector('[name="modelName"]').value = 'FZ-S';

    // Submit valid form
    window.fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ enquiry_id: '123', customer: 'John Smith', vehicle: 'FZ-S', status: 'Submitted' })
    });
    form.dispatchEvent(new window.Event('submit'));
    await new Promise((r) => setTimeout(r, 10));
    expect(appState.currentView).toBe('sales-enquiries');
  });

  test('Triggers appState mobile sidebar events and routing overrides', () => {
    // Simulate mobile resolution
    window.innerWidth = 500;
    appState.mobileSidebarOpen = true;

    Router.navigate('sales-enquiries');
    expect(appState.mobileSidebarOpen).toBe(false);

    // Test route redirect check
    Auth.verifiedRole = 'admin';
    Router.navigate('dashboard');
    expect(appState.currentView).toBe('admin-controls'); // redirected for admin role

    // Loose match navigation (e.g. 'admin-' matches 'admin-controls')
    Router.navigate('admin-');
    expect(appState.currentView).toBe('admin-controls');
  });

  test('Initializes the application using init() and processes hash change', async () => {
    // Reset verify role so it reads from token
    Auth.verifiedRole = null;

    // Mock authenticated
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const access = 'header.' + btoa(JSON.stringify({ username: 'admin', role: 'admin', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_accessToken', access);
    window.localStorage.setItem('crm_refreshToken', 'refresh');
    
    // Set up mock verify response
    window.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ username: 'admin', role: 'admin' })
    });

    await init();
    expect(appState.currentView).toBe('admin-controls');

    // Trigger hashchange listener registered in init()
    window.location.hash = '#reports';
    window.dispatchEvent(new window.Event('hashchange'));
    expect(appState.currentView).toBe('reports');
  });

  test('Boost: covers login form submissions with role admin and role director', async () => {
    Auth._bindLoginForm();
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('authUsername');
    const passwordInput = document.getElementById('authPassword');

    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const adminToken = 'header.' + btoa(JSON.stringify({ username: 'admin', role: 'admin', exp: expTime })) + '.signature';
    const directorToken = 'header.' + btoa(JSON.stringify({ username: 'director', role: 'director', exp: expTime })) + '.signature';
    const salesToken = 'header.' + btoa(JSON.stringify({ username: 'sales', role: 'sales', exp: expTime })) + '.signature';

    // Password toggle click coverage
    const pwToggle = document.getElementById('pwToggle');
    if (pwToggle) {
      pwToggle.dispatchEvent(new window.Event('click'));
      pwToggle.dispatchEvent(new window.Event('click'));
    }

    // 1. Test Admin successful login redirects to admin-controls
    usernameInput.value = 'admin';
    passwordInput.value = 'admin123';
    
    window.fetch.mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/token/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ access: adminToken, refresh: 'ref' })
        });
      }
      if (urlStr.includes('/api/auth/me/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ username: 'admin', role: 'admin' })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([])
      });
    });

    loginForm.dispatchEvent(new window.Event('submit'));
    await new Promise((r) => setTimeout(r, 10));
    expect(appState.currentView).toBe('admin-controls');

    // 2. Test Director successful login redirects to director-dashboard
    usernameInput.value = 'director';
    passwordInput.value = 'director123';

    window.fetch.mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/token/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ access: directorToken, refresh: 'ref' })
        });
      }
      if (urlStr.includes('/api/auth/me/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ username: 'director', role: 'director' })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([])
      });
    });

    loginForm.dispatchEvent(new window.Event('submit'));
    await new Promise((r) => setTimeout(r, 10));
    expect(appState.currentView).toBe('director-dashboard');

    // 3. Test Sales successful login redirects to default sales dashboard
    usernameInput.value = 'sales';
    passwordInput.value = 'sales123';

    window.fetch.mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/token/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ access: salesToken, refresh: 'ref' })
        });
      }
      if (urlStr.includes('/api/auth/me/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ username: 'sales', role: 'sales' })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([])
      });
    });

    loginForm.dispatchEvent(new window.Event('submit'));
    await new Promise((r) => setTimeout(r, 10));
    expect(appState.currentView).toBe('dashboard');

    // 4. Test login form submit validations for username input (password validation fallback coverage)
    usernameInput.value = 'sales';
    passwordInput.value = '123'; // invalid password length
    loginForm.dispatchEvent(new window.Event('submit'));
    await new Promise((r) => setTimeout(r, 10));
  });

  test('Boost: covers appointment form submit validations, success, and error paths', async () => {
    Router.navigate('appointment-form');
    const apptForm = document.getElementById('appointmentForm');
    expect(apptForm).not.toBeNull();

    // Trigger reset
    apptForm.dispatchEvent(new window.Event('reset'));

    // Trigger invalid submit (empty values)
    apptForm.dispatchEvent(new window.Event('submit'));
    await new Promise((r) => setTimeout(r, 10));

    // Fill valid data
    const nameInput = apptForm.querySelector('[name="apptCustomer"]');
    const vehicleInput = apptForm.querySelector('[name="apptVehicle"]');
    const dateInput = apptForm.querySelector('[name="apptDate"]');
    const timeInput = apptForm.querySelector('[name="apptTime"]');

    nameInput.value = 'James Dean';
    vehicleInput.value = 'Fascino';
    dateInput.value = '2026-06-15';
    timeInput.value = '15:45'; // 3:45 PM

    // Trigger inputs to clear error styling classes
    nameInput.dispatchEvent(new window.Event('input'));

    // Mock API Success
    window.fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve({
        appointment_id: 'APT-100',
        customer: 'James Dean',
        vehicle: 'Fascino',
        date: '2026-06-15',
        time: '03:45 PM',
        status: 'Scheduled'
      })
    });

    apptForm.dispatchEvent(new window.Event('submit'));
    await new Promise((r) => setTimeout(r, 10));
    expect(appState.currentView).toBe('appointments');

    // Reset back to form view for testing failure path
    Router.navigate('appointment-form');
    const apptFormErr = document.getElementById('appointmentForm');
    apptFormErr.querySelector('[name="apptCustomer"]').value = 'James Dean';
    apptFormErr.querySelector('[name="apptVehicle"]').value = 'Fascino';
    apptFormErr.querySelector('[name="apptDate"]').value = '2026-06-15';
    apptFormErr.querySelector('[name="apptTime"]').value = '15:45';

    // Mock API failure
    window.fetch.mockRejectedValueOnce(new Error('Booking Conflict'));
    apptFormErr.dispatchEvent(new window.Event('submit'));
    await new Promise((r) => setTimeout(r, 10));
    expect(appState.currentView).toBe('appointment-form'); // Stayed on page
  });

  test('Boost: covers authFetch token refresh retries, concurrent refresh queueing, and failures', async () => {
    // 1. Successful Refresh and Retry
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const validAccess = 'header.' + btoa(JSON.stringify({ username: 'sales', role: 'sales', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_accessToken', validAccess);
    window.localStorage.setItem('crm_refreshToken', 'valid_refresh');
    Auth.verifiedRole = 'sales';

    let callCount = 0;
    window.fetch.mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/token/refresh/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ access: validAccess })
        });
      }
      if (urlStr.includes('/api/enquiry/')) {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: true, status: 401 });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(['data'])
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });

    const fetchResult = await Auth.authFetch('http://127.0.0.1:8000/api/enquiry/');
    expect(fetchResult.status).toBe(200);

    // 2. Unsuccessful Refresh triggers forced logout
    callCount = 0;
    window.fetch.mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/token/refresh/')) {
        return Promise.resolve({
          ok: false,
          status: 400
        });
      }
      if (urlStr.includes('/api/enquiry/')) {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: true, status: 401 });
        }
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });

    await expect(Auth.authFetch('http://127.0.0.1:8000/api/enquiry/'))
      .rejects.toThrow('Session expired. Please sign in again.');
  });

  test('Boost: covers checkSessionExpiry toast triggers, loadUI edge filters, parseJwt errors, and verifySession errors', async () => {
    // ParseJwt json parse exception coverage
    const invalidJsonToken = 'header.' + btoa('{username:') + '.signature';
    expect(Auth.parseJwt(invalidJsonToken)).toBeNull();

    // Verify session when parsing fails
    window.localStorage.setItem('crm_accessToken', 'header.invalid_base64.signature');
    await expect(Auth.verifySessionWithBackend()).resolves.toBe(false);

    // Test checkSessionExpiry triggers toast if expired flag set
    window.sessionStorage.setItem('crm_sessionExpired', 'true');
    Auth._checkSessionExpiry();
    expect(window.sessionStorage.getItem('crm_sessionExpired')).toBeNull();

    // Test loadUI filters processing edge cases
    const validFilters = {
      currentView: 'feedback',
      sidebarCollapsed: true,
      search: 'Alice',
      filters: {
        enquiries: { status: 'draft', vehicle: 'r15', date: '2026-06' }
      }
    };
    window.localStorage.setItem('salesCRM_modular_uiState', JSON.stringify(validFilters));
    Persist.loadUI();
    expect(appState.currentView).toBe('feedback');
    expect(appState.sidebarCollapsed).toBe(true);
    expect(appState.search).toBe('Alice');
    expect(appState.filters.enquiries.status).toBe('draft');
  });

  test('Boost: covers Store setter methods directly', () => {
    Store.setEnquiries([]);
    Store.addEnquiry({ id: '5' });
    expect(Store.enquiries).toHaveLength(1);

    Store.setAppointments([]);
    Store.addAppointment({ id: '6' });
    expect(Store.appointments).toHaveLength(1);

    Store.setFeedback([]);
    Store.addFeedback({ id: '7' });
    expect(Store.feedback).toHaveLength(1);

    Store.setDirectorReport({ rep: 'rep' });
    expect(Store.directorReport).toEqual({ rep: 'rep' });

    Store.setAdminLogs(['log']);
    expect(Store.adminLogs).toEqual(['log']);
  });

  test('Boost: covers remaining Api methods and Actions refreshAll role paths', async () => {
    // Api methods success
    window.fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(['test']) });
    await expect(Api.getAppointments()).resolves.toEqual(['test']);
    await expect(Api.getFeedback()).resolves.toEqual(['test']);
    await expect(Api.getDirectorReport()).resolves.toEqual(['test']);
    await expect(Api.getAdminLogs()).resolves.toEqual(['test']);

    // Api methods failures
    window.fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(Api.getAppointments()).rejects.toThrow();
    await expect(Api.createAppointment({})).rejects.toThrow();
    await expect(Api.getFeedback()).rejects.toThrow();
    await expect(Api.createFeedback({})).rejects.toThrow();

    // createFeedback api method
    window.fetch.mockResolvedValueOnce({ ok: true, status: 201, json: () => Promise.resolve({ feedback_id: '1' }) });
    await expect(Api.createFeedback({})).resolves.toEqual({ feedback_id: '1' });

    // Actions.refreshAll check for different roles
    const mockEnquiryList = [{ enquiry_id: 'e1', customer: 'John', vehicle: 'r15', temperature: 'Hot', status: 'Submitted', date: '2026-06-13', source: 'Walk-in' }];
    const mockApptList = [{ appointment_id: 'a1', customer: 'John', vehicle: 'r15', status: 'Scheduled', date: '2026-06-13', time: '10:00 AM' }];
    const mockFdbList = [{ feedback_id: 'f1', enquiry_id: 'e1', customer: 'John', vehicle: 'r15', status: 'Submitted', date: '2026-06-13', rating: 5, feedback_text: 'Nice' }];

    // Mock API fetch outcomes
    window.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockEnquiryList)
    });
    // Overrides for specific calls
    window.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(mockEnquiryList) })
               .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(mockApptList) })
               .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(mockFdbList) });

    // Login user
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const access = 'header.' + btoa(JSON.stringify({ username: 'admin', role: 'admin', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_accessToken', access);
    Auth.verifiedRole = 'admin';

    await Actions.refreshAll();
    expect(Store.enquiries).toHaveLength(1);
    expect(Store.appointments).toHaveLength(1);
    expect(Store.feedback).toHaveLength(1);

    // RefreshAll check for role without read permissions
    Auth.verifiedRole = 'guest';
    await Actions.refreshAll();
    expect(Store.enquiries).toHaveLength(0);
  });

  test('Boost: covers token refresh with invalid role and refresh exceptions', async () => {
    // Token refresh with invalid role inside parsed JWT
    const expTime = Math.floor(Date.now() / 1000) + 1000;
    const invalidRoleToken = 'header.' + btoa(JSON.stringify({ username: 'sales', role: 'unauthorized_role', exp: expTime })) + '.signature';
    window.localStorage.setItem('crm_refreshToken', 'valid_refresh');

    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access: invalidRoleToken })
    });

    const refreshed = await Auth.refreshAccessToken();
    expect(refreshed).toBe(false);

    // Token refresh API fetch throws exception
    window.fetch.mockRejectedValueOnce(new Error('Network Failure'));
    const refErr = await Auth.refreshAccessToken();
    expect(refErr).toBe(false);
  });

  test('Boost: covers mobile view unauthorized routing guards', () => {
    // Set mobile size
    window.innerWidth = 500;
    appState.mobileSidebarOpen = true;

    // Set guest role to attempt access-denied
    Auth.verifiedRole = 'guest';
    Router.navigate('admin-controls');
    expect(appState.currentView).toBe('access-denied');
    expect(appState.mobileSidebarOpen).toBe(false);
  });
});
