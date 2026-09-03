const { setupDomEnvironment } = require('../test_helper');

describe('Utils Unit Tests', () => {
  let window;
  let Utils;
  let resolveRouteForRole;
  let resolveNavigationTarget;

  beforeEach(() => {
    const env = setupDomEnvironment();
    window = env.window;
    Utils = window.Utils;
    resolveRouteForRole = window.resolveRouteForRole;
    resolveNavigationTarget = window.resolveNavigationTarget;
  });

  test('Utils.escape matches basic HTML escaping requirements', () => {
    expect(Utils.escape('<div>test & "foo"\'</div>'))
      .toBe('&lt;div&gt;test &amp; &quot;foo&quot;&#39;&lt;/div&gt;');
  });

  test('Utils.capitalize capitalizes first letter', () => {
    expect(Utils.capitalize('hello')).toBe('Hello');
    expect(Utils.capitalize('world')).toBe('World');
  });

  test('Utils.badgeClass maps statuses to CSS class names', () => {
    expect(Utils.badgeClass('Submitted')).toBe('submitted');
    expect(Utils.badgeClass('Closed')).toBe('closed');
    expect(Utils.badgeClass('Completed')).toBe('completed');
    expect(Utils.badgeClass('Scheduled')).toBe('scheduled');
    expect(Utils.badgeClass('Pending')).toBe('pending');
    expect(Utils.badgeClass('Hot')).toBe('hot');
    expect(Utils.badgeClass('Warm')).toBe('warm');
    expect(Utils.badgeClass('Cold')).toBe('cold');
    expect(Utils.badgeClass('UnknownStatus')).toBe('draft');
  });

  test('Utils.uniqueValues returns list of unique non-empty attributes', () => {
    const rows = [
      { vehicle: 'R15' },
      { vehicle: 'RayZR' },
      { vehicle: 'R15' },
      { vehicle: '' },
      { vehicle: null }
    ];
    expect(Utils.uniqueValues(rows, 'vehicle')).toEqual(['R15', 'RayZR']);
  });

  test('Utils.filterRows correctly filters dataset based on text and dropdown values', () => {
    const rows = [
      { id: '1', customer: 'Pavan', vehicle: 'r15', status: 'submitted', date: '2026-06-13' },
      { id: '2', customer: 'John', vehicle: 'fascino', status: 'draft', date: '2026-05-12' }
    ];

    // Search query matching
    window.appState.search = 'Pavan';
    let filtered = Utils.filterRows(rows, { status: 'all', vehicle: 'all', date: 'all' }, ['customer']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].customer).toBe('Pavan');

    // Status filter
    window.appState.search = '';
    filtered = Utils.filterRows(rows, { status: 'draft', vehicle: 'all', date: 'all' }, ['customer']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].customer).toBe('John');

    // Vehicle filter
    filtered = Utils.filterRows(rows, { status: 'all', vehicle: 'r15', date: 'all' }, ['customer']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].customer).toBe('Pavan');

    // Date/Month filter matching
    filtered = Utils.filterRows(rows, { status: 'all', vehicle: 'all', date: '2026-05' }, ['customer']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].customer).toBe('John');
  });

  test('resolveRouteForRole resolves roles navigation constraints', () => {
    expect(resolveRouteForRole('dashboard', 'admin')).toBe('admin-controls');
    expect(resolveRouteForRole('dashboard', 'director')).toBe('director-dashboard');
    expect(resolveRouteForRole('dashboard', 'sales')).toBe('dashboard');
  });

  test('resolveNavigationTarget maps route permissions', () => {
    // Admin checking dashboard (should redirect to admin-controls and allow)
    const adminTarget = resolveNavigationTarget('dashboard', 'admin');
    expect(adminTarget.viewId).toBe('admin-controls');
    expect(adminTarget.allowed).toBe(true);

    // Sales checking admin controls (should not be allowed)
    const salesTarget = resolveNavigationTarget('admin-controls', 'sales');
    expect(salesTarget.allowed).toBe(false);
  });
});
