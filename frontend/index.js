/* ═══════════════════════════════════════════════════════════════
   AUTH MODULE — Complete Frontend Authentication Workflow
═══════════════════════════════════════════════════════════════ */

/* ── Auth Token Keys ── */
var AUTH_KEYS = {
  ACCESS_TOKEN: "crm_accessToken",
  REFRESH_TOKEN: "crm_refreshToken",
  LOGGED_IN_USER: "crm_loggedInUser",
  TOKEN_EXPIRY: "crm_tokenExpiry",
  REMEMBER_ME: "crm_rememberMe",
  REMEMBERED_USER: "crm_rememberedUser",
};

/* ── Session-expiry notification flag (sessionStorage, cleared on browser close) ── */
var SESSION_EXPIRED_FLAG = "crm_sessionExpired";

/* ── Refresh lock: prevents concurrent refresh storms ── */
var _refreshing = null;

/* ═══════════════════════════════════════════════════════════════
 AUTH — Core Functions
═══════════════════════════════════════════════════════════════ */
var Auth = {
  verifiedRole: null,
  verifiedUser: null,

  /* ── Save tokens with expiry based on Remember Me ── */
  saveTokens(username, accessToken, refreshToken, rememberMe = false) {
    const decoded = this.parseJwt(accessToken);
    if (!decoded?.exp || !VALID_ROLES.includes(decoded.role)) {
      throw new Error("Invalid access token received from server");
    }
    const expiry = decoded.exp * 1000;

    localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(AUTH_KEYS.LOGGED_IN_USER, username);
    localStorage.setItem(AUTH_KEYS.TOKEN_EXPIRY, String(expiry));
    this.verifiedRole = null;
    this.verifiedUser = null;
  },

  /* ── Save/load/clear Remember Me preferences ── */
  saveSession(username, rememberMe) {
    if (rememberMe) {
      localStorage.setItem(AUTH_KEYS.REMEMBER_ME, "true");
      localStorage.setItem(AUTH_KEYS.REMEMBERED_USER, username);
    } else {
      // Not remembered — clear any previous remembered state
      localStorage.removeItem(AUTH_KEYS.REMEMBER_ME);
      localStorage.removeItem(AUTH_KEYS.REMEMBERED_USER);
    }
  },

  loadRememberedUser() {
    const isRemembered =
      localStorage.getItem(AUTH_KEYS.REMEMBER_ME) === "true";
    if (isRemembered) {
      return localStorage.getItem(AUTH_KEYS.REMEMBERED_USER) || null;
    }
    return null;
  },

  clearRememberedSession() {
    localStorage.removeItem(AUTH_KEYS.REMEMBER_ME);
    localStorage.removeItem(AUTH_KEYS.REMEMBERED_USER);
  },

  /* ── Clear all auth tokens ── */
  clearTokens() {
    localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(AUTH_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(AUTH_KEYS.LOGGED_IN_USER);
    localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
    this.verifiedRole = null;
    this.verifiedUser = null;
    // Note: REMEMBER_ME and REMEMBERED_USER are intentionally preserved
    // here so the username is still pre-filled after session expiry.
    // They are only cleared on explicit logoutUser() call.
  },

  /* ── Check if user is authenticated (token exists + not expired) ── */
  isAuthenticated() {
    const token = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
    if (!token) return false;
    const decoded = this.parseJwt(token);
    if (!decoded || !decoded.exp || !VALID_ROLES.includes(decoded.role)) {
      this.clearTokens();
      return false;
    }

    const expMs = decoded.exp * 1000;
    if (Date.now() > expMs) {
      sessionStorage.setItem(SESSION_EXPIRED_FLAG, "true");
      this.clearTokens();
      return false;
    }
    return true;
  },

  /* ── Get the currently logged-in username ── */
  getLoggedInUser() {
    return localStorage.getItem(AUTH_KEYS.LOGGED_IN_USER) || null;
  },

  /* ── Get the currently logged-in user role ── */
  getUserRole() {
    if (this.verifiedRole) return this.verifiedRole;
    // Always derive role from signed JWT to avoid trusting mutable localStorage values
    const token = this.getAccessToken();
    if (!token) return null;
    const decoded = this.parseJwt(token);
    if (!decoded) return null;
    // Respect token expiry embedded in JWT
    if (decoded.exp && Date.now() > decoded.exp * 1000) return null;
    return VALID_ROLES.includes(decoded.role) ? decoded.role : null;
  },

  /* ── Get access token (for use in API requests) ── */
  getAccessToken() {
    return localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN) || null;
  },

  /* ── Validate login form fields ── */
  validateLoginForm(username, password) {
    const errors = [];
    if (!username || !username.trim()) {
      errors.push({
        field: "username",
        message: "Username or email is required.",
      });
    } else if (username.trim().length < 3) {
      errors.push({
        field: "username",
        message: "Username must be at least 3 characters.",
      });
    }
    if (!password || !password.trim()) {
      errors.push({
        field: "password",
        message: "Password is required.",
      });
    } else if (password.length < 6) {
      errors.push({
        field: "password",
        message: "Password must be at least 6 characters.",
      });
    }
    return { valid: errors.length === 0, errors };
  },

  /* ── Helper: Parse JWT without external libraries ── */
  parseJwt(token) {
    try {
      if (!token || token.split(".").length !== 3) return null;
      const base64Url = token.split(".")[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join(""),
      );
      const decoded = JSON.parse(jsonPayload);
      if (decoded && decoded.role === "sales_executive") {
        decoded.role = "sales";
      }
      return decoded;
    } catch (e) {
      return null;
    }
  },

  requireValidSession() {
    if (!this.isAuthenticated() || !this.verifiedRole) {
      this.clearTokens();
      this._resetAppState();
      this.showLoginPage();
      return false;
    }
    return true;
  },

  verifySessionWithBackend() {
    return new Promise(async (resolve) => {
      if (!this.isAuthenticated()) return resolve(false);
      const token = this.getAccessToken();
      try {
        const response = await fetch("http://127.0.0.1:8000/api/auth/me/", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          this.clearTokens();
          return resolve(false);
        }
        const data = await response.json();
        if (data.role === "sales_executive") {
          data.role = "sales";
        }
        if (!VALID_ROLES.includes(data.role)) {
          this.clearTokens();
          return resolve(false);
        }
        const tokenRole = this.getUserRole();
        if (tokenRole && tokenRole !== data.role) {
          this.clearTokens();
          return resolve(false);
        }
        this.verifiedRole = data.role;
        this.verifiedUser = data.username;
        if (data.username) {
          localStorage.setItem(AUTH_KEYS.LOGGED_IN_USER, data.username);
        }
        resolve(true);
      } catch (err) {
        resolve(false);
      }
    });
  },

  /* ── Main loginUser function ── */
  async loginUser(username, password, rememberMe = false) {
    const response = await fetch("http://127.0.0.1:8000/api/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || "Invalid credentials");
    }

    const data = await response.json();

    // Decode token to extract verified claims
    const decoded = this.parseJwt(data.access);
    const serverUsername = decoded?.username || username;

    this.saveTokens(
      serverUsername,
      data.access,
      data.refresh,
      rememberMe,
    );
    this.saveSession(serverUsername, rememberMe);
    const verified = await this.verifySessionWithBackend();
    if (!verified) {
      throw new Error("Unable to verify authenticated session");
    }
    return data;
  },

  /* ── Logout: clears all tokens, resets appState, returns to login ── */
  logoutUser() {
    this.clearTokens();
    this.clearRememberedSession();
    this._resetAppState();
    // Clear in-memory data store so stale data is never visible after re-login
    if (typeof Store !== "undefined") {
      Store.setEnquiries([]);
      Store.setAppointments([]);
      Store.setFeedback([]);
    }
    this.showLoginPage();
    Utils.toast("You have been signed out successfully.", "success", true);
  },

  /* ── FIX 4: Full appState reset on logout ── */
  _resetAppState() {
    appState.currentView = "dashboard";
    appState.sidebarCollapsed = false;
    appState.mobileSidebarOpen = false;
    appState.search = "";
    appState.filters = {
      enquiries: { status: "all", vehicle: "all", date: "all" },
      appointments: { status: "all", vehicle: "all", date: "all" },
      feedback: { status: "all", vehicle: "all", date: "all" },
    };
    appState.formDraft = {};
    // Clear persisted UI state so next login starts fresh
    try {
      localStorage.removeItem(LS_KEY + "_" + UI_STATE_STORAGE_KEY);
    } catch {}
  },

  /* ── authFetch: Authenticated API requests with automatic token refresh ── */
  async authFetch(url, options = {}, _isRetry = false) {
    if (!this.isAuthenticated() || !this.verifiedRole) {
      this.clearTokens();
      this._resetAppState();
      this.showLoginPage();
      throw new Error("Invalid or expired session.");
    }
    const token = this.getAccessToken();
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 && !_isRetry) {
      // Attempt token refresh exactly once
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        // Retry original request with new token
        return this.authFetch(url, options, true);
      }
      // Refresh failed — force logout with session expired notice
      sessionStorage.setItem(SESSION_EXPIRED_FLAG, "true");
      this.clearTokens();
      this._resetAppState();
      this.showLoginPage();
      this._checkSessionExpiry();
      throw new Error("Session expired. Please sign in again.");
    }

    return response;
  },

  /* ── Token Refresh: calls /api/token/refresh/ and updates access token ── */
  async refreshAccessToken() {
    // Deduplicate concurrent refresh calls — only one in-flight at a time
    if (_refreshing) return _refreshing;

    _refreshing = (async () => {
      try {
        const refreshToken = localStorage.getItem(
          AUTH_KEYS.REFRESH_TOKEN,
        );
        if (!refreshToken) return false;

        const response = await fetch(
          "http://127.0.0.1:8000/api/token/refresh/",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshToken }),
          },
        );

        if (!response.ok) return false;

        const data = await response.json();
        if (!data.access) return false;

        // Update stored access token and set expiry based on JWT exp claim when available
        localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, data.access);
        const decoded = this.parseJwt(data.access) || {};
        if (!decoded.exp || !VALID_ROLES.includes(decoded.role))
          return false;
        localStorage.setItem(
          AUTH_KEYS.TOKEN_EXPIRY,
          String(decoded.exp * 1000),
        );
        this.verifiedRole = decoded.role;

        return true;
      } catch {
        return false;
      } finally {
        _refreshing = null;
      }
    })();

    return _refreshing;
  },

  /* ── Show dashboard (called after successful login) ── */
  showDashboard() {
    const overlay = document.getElementById("authOverlay");
    const shell = document.getElementById("appShell");
    if (overlay) {
      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.style.display = "none";
        overlay.classList.add("hidden");
      }, 500);
    }
    if (shell) shell.classList.add("auth-visible");
  },

  /* ── Show login page (called on logout or unauthenticated access) ── */
  showLoginPage() {
    const overlay = document.getElementById("authOverlay");
    const shell = document.getElementById("appShell");
    if (overlay) {
      overlay.style.display = "flex";
      overlay.style.opacity = "1";
      overlay.classList.remove("hidden");
      // Reset form state
      const form = document.getElementById("loginForm");
      if (form) form.reset();
      const errBanner = document.getElementById("authErrorBanner");
      if (errBanner) errBanner.classList.remove("visible");
      // Re-populate remembered username if applicable
      this._restoreRememberedUser();
    }
    if (shell) shell.classList.remove("auth-visible");
  },

  /* ── Pre-fill remembered username on login page ── */
  _restoreRememberedUser() {
    const remembered = this.loadRememberedUser();
    const usernameEl = document.getElementById("authUsername");
    const rememberEl = document.getElementById("rememberMe");
    if (usernameEl && remembered) {
      usernameEl.value = remembered;
    }
    if (rememberEl && remembered) {
      rememberEl.checked = true;
    }
  },

  /* ── FIX 5: Show session expiry notification if flag is set ── */
  _checkSessionExpiry() {
    const wasExpired = sessionStorage.getItem(SESSION_EXPIRED_FLAG);
    if (wasExpired) {
      sessionStorage.removeItem(SESSION_EXPIRED_FLAG);
      // Delay slightly so the login page renders first
      setTimeout(() => {
        const errBanner = document.getElementById("authErrorBanner");
        const errText = document.getElementById("authErrorText");
        if (errBanner && errText) {
          errText.textContent =
            "Your session has expired. Please sign in again.";
          errBanner.classList.add("visible");
        }
        // Also fire an amber-styled toast for clear UX feedback
        Utils.toast("Session expired — please sign in again.", "warning");
      }, 300);
    }
  },

  /* ── Initialize authentication on page load ── */
  initializeAuth() {
    return new Promise(async (resolve) => {
      if (
        this.isAuthenticated() &&
        (await this.verifySessionWithBackend())
      ) {
        const role = this.getUserRole();

        const hash = window.location.hash.replace("#", "");
        const defaultRoute = DEFAULT_ROUTE_BY_ROLE[role] || "dashboard";
        const requestedView =
          hash || appState.currentView || defaultRoute;
        Router.navigate(
          resolveNavigationTarget(requestedView, role).viewId,
        );
        this.showDashboard();
        resolve();
      } else {
        this.clearTokens();
        this.showLoginPage();
        this._checkSessionExpiry();
        resolve();
      }
      this._bindLoginForm();
    });
  },

  /* ── Bind login form events ── */
  _bindLoginForm() {
    const form = document.getElementById("loginForm");
    const loginBtn = document.getElementById("loginBtn");
    const pwToggle = document.getElementById("pwToggle");
    const pwInput = document.getElementById("authPassword");
    const errBanner = document.getElementById("authErrorBanner");
    const errText = document.getElementById("authErrorText");

    // ── Modal open/close ──────────────────────────────
    const modalOverlay = document.getElementById("authModalOverlay");
    const openModal = () => { if (modalOverlay) { modalOverlay.classList.remove("hidden"); setTimeout(() => { const u = document.getElementById("authUsername"); if (u) u.focus(); }, 50); } };
    const closeModal = () => { if (modalOverlay) modalOverlay.classList.add("hidden"); };

    // Nav "Sign In" button
    const navBtn = document.getElementById("navSignInBtn");
    if (navBtn) navBtn.addEventListener("click", openModal);

    // Hero "SIGN IN" button
    const heroBtn = document.getElementById("heroSignInBtn");
    if (heroBtn) heroBtn.addEventListener("click", openModal);

    // Modal close button
    const closeBtn = document.getElementById("authModalClose");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    // Click backdrop to close
    if (modalOverlay) {
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) closeModal();
      });
    }

    // Escape key to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalOverlay && !modalOverlay.classList.contains("hidden")) {
        closeModal();
      }
    });

    if (!form) return;

    // Password visibility toggle
    const EYE_ICON =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    const EYE_OFF_ICON =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 4.22-5.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    if (pwToggle && pwInput) {
      pwToggle.addEventListener("click", () => {
        const isHidden = pwInput.type === "password";
        pwInput.type = isHidden ? "text" : "password";
        pwToggle.innerHTML = isHidden ? EYE_OFF_ICON : EYE_ICON;
      });
    }

    // Clear error styling on input
    ["authUsername", "authPassword"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", () => {
          el.classList.remove("auth-error");
          if (errBanner) errBanner.classList.remove("visible");
        });
      }
    });

    // Form submit
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const usernameEl = document.getElementById("authUsername");
      const passwordEl = document.getElementById("authPassword");
      const rememberEl = document.getElementById("rememberMe");
      const username = usernameEl?.value || "";
      const password = passwordEl?.value || "";
      const rememberMe = rememberEl?.checked || false;

      // Frontend validation
      const validation = Auth.validateLoginForm(username, password);
      if (!validation.valid) {
        validation.errors.forEach((err) => {
          const fieldEl = document.getElementById(
            err.field === "username" ? "authUsername" : "authPassword",
          );
          if (fieldEl) fieldEl.classList.add("auth-error");
        });
        if (errBanner && errText) {
          errText.textContent = validation.errors[0].message;
          errBanner.classList.add("visible");
        }
        return;
      }

      // Loading state
      if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="auth-spinner"></span>';
      }

      try {
        await Auth.loginUser(username, password, rememberMe);

        // Load backend data now that the user is authenticated
        await Actions.refreshAll();

        // Success — resolve the route before revealing the shell
        const role = Auth.getUserRole();

        if (Preferences.get("compactSidebar")) {
          appState.sidebarCollapsed = true;
          Shell.sync();
        }

        if (role === "director") {
          Utils.toast(
            "Welcome, Director. Accessing Strategic Panel...",
            "success",
            true,
          );
          Router.navigate(DEFAULT_ROUTE_BY_ROLE.director);
        } else if (role === "admin") {
          Router.navigate(DEFAULT_ROUTE_BY_ROLE.admin);
          Utils.toast("Welcome, Admin. Accessing controls.", "success", true);
        } else {
          const preferredLanding = Preferences.get("defaultLanding") || "dashboard";
          const target = resolveNavigationTarget(preferredLanding, role);
          Router.navigate(
            target.allowed ? target.viewId : (DEFAULT_ROUTE_BY_ROLE[role] || "dashboard"),
          );
          Utils.toast(
            `Welcome back, ${Auth.getLoggedInUser()}!`,
            "success",
            true,
          );
        }

        Auth.showDashboard();

        // Re-render topbar to show logged-in user info
        Renderer.topbar();
      } catch (err) {
        // Failed login — highlight fields and show error
        if (usernameEl) usernameEl.classList.add("auth-error");
        if (passwordEl) passwordEl.classList.add("auth-error");
        if (errBanner && errText) {
          errText.textContent =
            "Invalid username or password. Please try again.";
          errBanner.classList.add("visible");
        }
      } finally {
        if (loginBtn) {
          loginBtn.disabled = false;
          loginBtn.innerHTML = '<span id="loginBtnText">Sign In</span>';
        }
      }
    });
  },
};

/* ─────────────────────────────────────────────────────────────
 END OF AUTH MODULE
───────────────────────────────────────────────────────────── */

var API_BASE = "http://127.0.0.1:8000/api";

var getApiErrorMessage = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));
  if (response.status === 403) {
    return "Access denied. You don't have permission to access this resource.";
  }
  return data.detail || fallbackMessage;
};

var Api = {
  async getEnquiries() {
    const response = await Auth.authFetch(`${API_BASE}/enquiry/`);
    if (!response.ok) {
      throw new Error(
        await getApiErrorMessage(response, "Failed to fetch enquiries"),
      );
    }
    return response.json();
  },

  async createEnquiry(payload) {
    const response = await Auth.authFetch(`${API_BASE}/enquiry/create/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(
        await getApiErrorMessage(response, "Failed to save enquiry."),
      );
    }
    const data = await response.json();
    return data;
  },

  async getAppointments() {
    const response = await Auth.authFetch(`${API_BASE}/appointment/`);
    if (!response.ok) {
      throw new Error(
        await getApiErrorMessage(
          response,
          "Failed to fetch appointments",
        ),
      );
    }
    return response.json();
  },

  async createAppointment(payload) {
    const response = await Auth.authFetch(
      `${API_BASE}/appointment/create/`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      throw new Error(
        await getApiErrorMessage(
          response,
          "Failed to save appointment.",
        ),
      );
    }
    const data = await response.json();
    return data;
  },

  async getFeedback() {
    const response = await Auth.authFetch(`${API_BASE}/feedback/`);
    if (!response.ok) {
      throw new Error(
        await getApiErrorMessage(response, "Failed to fetch feedback"),
      );
    }
    return response.json();
  },

  async createFeedback(payload) {
    const response = await Auth.authFetch(
      `${API_BASE}/feedback/create/`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      throw new Error(
        await getApiErrorMessage(response, "Failed to save feedback."),
      );
    }
    const data = await response.json();
    return data;
  },

  async getDirectorReport() {
    const response = await Auth.authFetch(
      `${API_BASE}/director/revenue/`,
    );
    if (!response.ok) throw new Error("Failed to fetch director report");
    return response.json();
  },

  async getAdminLogs() {
    const response = await Auth.authFetch(`${API_BASE}/admin/logs/`);
    if (!response.ok) throw new Error("Failed to fetch audit logs");
    return response.json();
  },
};

/* ═══════════════════════════════════════════════════════════════
 STATE
═══════════════════════════════════════════════════════════════ */
var appState = {
  currentView: "dashboard",
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  search: "",
  filters: {
    enquiries: { status: "all", vehicle: "all", date: "all" },
    appointments: { status: "all", vehicle: "all", date: "all" },
    feedback: { status: "all", vehicle: "all", date: "all" },
  },
  formDraft: {},
};

var UI_STATE_STORAGE_KEY = "uiState";
var PREFERENCES_STORAGE_KEY = "preferences";

/* ═══════════════════════════════════════════════════════════════
 DATA STORE
═══════════════════════════════════════════════════════════════ */

/* ── localStorage helpers ── */
var LS_KEY = "salesCRM_modular";
var _load = (key) => {
  try {
    const v = localStorage.getItem(LS_KEY + "_" + key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};
var _save = (key, data) => {
  try {
    localStorage.setItem(LS_KEY + "_" + key, JSON.stringify(data));
  } catch {
    /* storage full — fail silently */
  }
};

var Persist = {
  saveUI() {
    const autosaveFilters = Preferences.get("autosaveFilters");
    _save(UI_STATE_STORAGE_KEY, {
      currentView: appState.currentView,
      sidebarCollapsed: appState.sidebarCollapsed,
      search: appState.search,
      filters: autosaveFilters ? appState.filters : undefined,
    });
  },
  loadUI() {
    const saved = _load(UI_STATE_STORAGE_KEY);
    if (!saved || typeof saved !== "object") return;

    if (
      typeof saved.currentView === "string" &&
      saved.currentView in Views
    ) {
      appState.currentView = saved.currentView;
    }
    if (typeof saved.sidebarCollapsed === "boolean") {
      appState.sidebarCollapsed = saved.sidebarCollapsed;
    }
    if (typeof saved.search === "string") {
      appState.search = saved.search;
    }
    if (
      Preferences.get("autosaveFilters") &&
      saved.filters &&
      typeof saved.filters === "object"
    ) {
      Object.keys(appState.filters).forEach((key) => {
        const src = saved.filters[key];
        if (!src || typeof src !== "object") return;
        appState.filters[key] = {
          status: typeof src.status === "string" ? src.status : "all",
          vehicle: typeof src.vehicle === "string" ? src.vehicle : "all",
          date: typeof src.date === "string" ? src.date : "all",
        };
      });
    }
  },
};

/* ═══════════════════════════════════════════════════════════════
 PREFERENCES — Theme, sidebar, notifications, session, profile
═══════════════════════════════════════════════════════════════ */
var DEFAULT_PREFERENCES = {
  theme: "light", // "light" | "dark" | "system"
  compactSidebar: false,
  toasts: true,
  emailDigest: false,
  autosaveFilters: true,
  sessionTimeoutMinutes: 60,
  defaultLanding: "dashboard",
  displayName: "",
};

var Preferences = {
  _cache: null,

  load() {
    const saved = _load(PREFERENCES_STORAGE_KEY);
    this._cache = Object.assign(
      {},
      DEFAULT_PREFERENCES,
      saved && typeof saved === "object" ? saved : {},
    );
    return this._cache;
  },

  get(key) {
    if (!this._cache) this.load();
    return this._cache[key];
  },

  setMany(partial) {
    if (!this._cache) this.load();
    Object.assign(this._cache, partial);
    _save(PREFERENCES_STORAGE_KEY, this._cache);
  },

  /* Resolve "system" down to an actual light/dark value */
  resolvedTheme() {
    const theme = this.get("theme");
    if (theme === "dark" || theme === "light") return theme;
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  },

  /* Apply the active theme to <html data-theme="..."> */
  applyTheme(previewTheme) {
    const theme = previewTheme || this.resolvedTheme();
    const resolved =
      theme === "system"
        ? window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    document.documentElement.setAttribute(
      "data-theme",
      resolved === "dark" ? "dark" : "light",
    );
  },

  /* Keep "system" theme in sync if the OS preference changes live */
  watchSystemTheme() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (this.get("theme") === "system") this.applyTheme();
    };
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
  },
};

/* ── Idle/inactivity auto sign-out, driven by the Session Timeout setting ── */
var IdleMonitor = {
  _timer: null,
  start() {
    this._reset();
    ["mousemove", "mousedown", "keydown", "scroll", "touchstart"].forEach(
      (evt) => window.addEventListener(evt, () => this._reset(), { passive: true }),
    );
  },
  _reset() {
    if (this._timer) clearTimeout(this._timer);
    if (!Auth.isAuthenticated()) return;
    const minutes = Number(Preferences.get("sessionTimeoutMinutes")) || 60;
    this._timer = setTimeout(() => {
      if (Auth.isAuthenticated()) {
        Auth.logoutUser();
        Utils.toast(
          "You've been signed out after a period of inactivity.",
          "warning",
          true,
        );
      }
    }, minutes * 60 * 1000);
  },
};

/* ── Central Store: all data from API ── */
var Store = {
  enquiries: [],
  appointments: [],
  feedback: [],
  directorReport: null,
  adminLogs: [],

  setEnquiries(records) {
    this.enquiries = records;
  },

  addEnquiry(record) {
    this.enquiries.unshift(record);
  },

  setAppointments(records) {
    this.appointments = records;
  },

  addAppointment(record) {
    this.appointments.unshift(record);
  },

  setFeedback(records) {
    this.feedback = records;
  },

  addFeedback(record) {
    this.feedback.unshift(record);
  },

  setDirectorReport(data) {
    this.directorReport = data;
  },

  setAdminLogs(logs) {
    this.adminLogs = logs;
  },
};

var Actions = {
  async refreshAll() {
    const role = Auth.getUserRole();
    if (!Auth.requireValidSession()) return;
    try {
      const canReadEnquiries = role === "admin" || role === "director";
      const canReadAppointments =
        role === "admin" ||
        role === "director" ||
        role === "salesmanager" ||
        role === "manager";
      const canReadFeedback = role === "admin" || role === "director";

      if (canReadEnquiries || canReadAppointments || canReadFeedback) {
        const [enq, app, fdb] = await Promise.all([
          canReadEnquiries ? Api.getEnquiries() : Promise.resolve([]),
          canReadAppointments ? Api.getAppointments() : Promise.resolve([]),
          canReadFeedback ? Api.getFeedback() : Promise.resolve([]),
        ]);

        // Map backend fields to frontend local fields for consistency
        Store.setEnquiries(
          enq.map((item) => ({
            id: item.enquiry_id,
            customer: item.customer,
            vehicle: item.vehicle,
            temperature: item.temperature,
            status: item.status,
            date: item.date,
            source: item.source,
          })),
        );

        Store.setAppointments(
          app.map((item) => ({
            id: item.appointment_id,
            customer: item.customer,
            vehicle: item.vehicle,
            status: item.status,
            date: item.date,
            time: item.time,
          })),
        );

        Store.setFeedback(
          fdb.map((item) => ({
            id: item.feedback_id,
            enquiryId: item.enquiry_id,
            customer: item.customer,
            vehicle: item.vehicle,
            status: item.status,
            date: item.date,
            rating: item.rating,
            feedback_text: item.feedback_text,
          })),
        );
      } else {
        Store.setEnquiries([]);
        Store.setAppointments([]);
        Store.setFeedback([]);
      }

      if (role === "admin" || role === "director") {
        const report = await Api.getDirectorReport();
        Store.setDirectorReport(report);
      } else {
        Store.setDirectorReport(null);
      }

      if (role === "admin") {
        const logs = await Api.getAdminLogs();
        Store.setAdminLogs(logs);
      } else {
        Store.setAdminLogs([]);
      }
    } catch (e) {
      console.error("Data refresh failed", e);
      Utils.toast(
        "Database sync failed. Working with cached data.",
        "warning",
      );
    }
  },
};

/* ═══════════════════════════════════════════════════════════════
 CONFIG: NAVIGATION
═══════════════════════════════════════════════════════════════ */
var ROUTE_CONFIG = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>',
    group: "Workspace",
    roles: ["admin", "director", "salesmanager", "sales"],
    nav: true,
  },
  {
    id: "sales-enquiries",
    label: "Sales Enquiries",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h8"/></svg>',
    group: "Sales",
    roles: ["admin", "salesmanager", "sales"],
    nav: true,
  },
  {
    id: "enquiry-form",
    label: "Enquiry Form",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    group: "Sales",
    roles: ["admin", "salesmanager", "sales"],
    nav: true,
  },
  {
    id: "appointments",
    label: "Appointment Booking",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    group: "Sales",
    roles: ["admin", "salesmanager", "sales"],
    nav: true,
  },
  {
    id: "appointment-form",
    label: "New Appointment",
    group: "Sales",
    roles: ["admin", "salesmanager", "sales"],
    nav: false,
  },
  {
    id: "feedback",
    label: "Sales Feedback",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-1.9 5.4L21 21l-4.1-1.1a8.5 8.5 0 1 1 4.1-8.4Z"/></svg>',
    group: "Sales",
    roles: ["admin", "salesmanager", "sales"],
    nav: true,
  },
  {
    id: "reports",
    label: "Executive Reports",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M8 17V9M13 17v-5M18 17V6"/></svg>',
    group: "Director",
    roles: ["admin", "director"],
    nav: true,
  },
  {
    id: "director-dashboard",
    label: "Director Panel",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17 9 11l4 4 8-8"/><path d="M15 7h6v6"/></svg>',
    group: "Director",
    roles: ["admin", "director"],
    nav: true,
  },
  {
    id: "admin-controls",
    label: "Admin Settings",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.97 7.97 0 0 0 0-2l2-1.6-2-3.4-2.4.6a8 8 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a8 8 0 0 0-1.7 1l-2.4-.6-2 3.4 2 1.6a7.97 7.97 0 0 0 0 2l-2 1.6 2 3.4 2.4-.6a8 8 0 0 0 1.7 1l.4 2.5h4l.4-2.5a8 8 0 0 0 1.7-1l2.4.6 2-3.4Z"/></svg>',
    group: "System",
    roles: ["admin"],
    nav: true,
  },
];

var NAV_CONFIG = ROUTE_CONFIG.filter((route) => route.nav);
var DEFAULT_ROUTE_BY_ROLE = {
  admin: "admin-controls",
  director: "director-dashboard",
  salesmanager: "dashboard",
  sales: "dashboard",
};
var VALID_ROLES = Object.keys(DEFAULT_ROUTE_BY_ROLE);
var ROUTE_REDIRECTS_BY_ROLE = {
  admin: {
    dashboard: "admin-controls",
  },
  director: {
    dashboard: "director-dashboard",
  },
};

function resolveRouteForRole(viewId, role) {
  return ROUTE_REDIRECTS_BY_ROLE[role]?.[viewId] || viewId;
}

function resolveNavigationTarget(viewId, role) {
  const resolvedViewId = resolveRouteForRole(viewId, role);
  let navItem = ROUTE_CONFIG.find((item) => item.id === resolvedViewId);

  // Allow loose matching (e.g. 'admin' matches 'admin-controls')
  if (!navItem) {
    navItem = ROUTE_CONFIG.find((item) =>
      item.id.startsWith(resolvedViewId),
    );
  }

  if (!navItem) {
    return {
      viewId: resolvedViewId,
      navItem: null,
      allowed: false,
      deniedRoute: resolvedViewId || "Unknown route",
    };
  }

  return {
    viewId: navItem.id,
    navItem,
    allowed: !navItem.roles || navItem.roles.includes(role),
    deniedRoute: navItem.label,
  };
}

/* ═══════════════════════════════════════════════════════════════
 CONFIG: ENQUIRY FORM FIELDS
═══════════════════════════════════════════════════════════════ */
var ENQUIRY_FORM_FIELDS = [
  { section: "Customer & Enquiry Details" },
  { label: "Date", name: "date", type: "date" },
  {
    label: "Customer Name",
    name: "customerName",
    type: "text",
    placeholder: "Enter customer name",
    required: true,
  },
  {
    label: "Enquiry Type",
    name: "enquiryType",
    type: "select",
    options: ["Direct", "Test Ride", "Website Lead", "Showroom Visit"],
  },
  {
    label: "Customer Enquiry Date",
    name: "customerEnquiryDate",
    type: "date",
  },
  {
    label: "Customer Type",
    name: "customerType",
    type: "select",
    options: [
      "New Customer",
      "Existing Customer",
      "Corporate",
      "Referral",
    ],
  },
  {
    label: "Test Ride Taken",
    name: "testRide",
    type: "select",
    options: ["Yes", "No"],
  },
  {
    label: "Enquiry Source",
    name: "enquirySource",
    type: "select",
    options: ["Walk-in", "Phone Call", "Website", "Referral"],
  },
  {
    label: "Gender",
    name: "gender",
    type: "select",
    options: ["Male", "Female", "Other"],
  },
  {
    label: "Payment Type",
    name: "paymentType",
    type: "select",
    options: ["Cash", "Finance", "EMI", "Undecided"],
    conditionalTarget: "financeDetails",
  },
  {
    label: "Sales Enquiry Status",
    name: "salesEnquiryStatus",
    type: "select",
    options: ["Submitted", "Draft", "Closed"],
  },
  {
    label: "Lead Temperature",
    name: "leadTemperature",
    type: "chips",
    options: ["Hot", "Warm", "Cold"],
    hint: "Prioritize follow-up urgency.",
  },
  {
    label: "Phone Number",
    name: "phone",
    type: "tel",
    placeholder: "10 digit mobile number",
    required: true,
  },
  {
    label: "Model Code",
    name: "modelCode",
    type: "text",
    placeholder: "Example: FA-220",
  },
  {
    label: "WhatsApp Number",
    name: "whatsapp",
    type: "tel",
    placeholder: "WhatsApp number",
  },
  {
    label: "Model Name",
    name: "modelName",
    type: "text",
    placeholder: "Selected bike model",
    required: true,
  },
  { label: "Follow Up Date", name: "followUpDate", type: "date" },
  {
    label: "Email Address",
    name: "email",
    type: "email",
    placeholder: "name@example.com",
  },
  {
    label: "Source of Information",
    name: "sourceInfo",
    type: "select",
    options: ["Newspaper", "Instagram", "Friend", "Dealer Board"],
  },
  {
    label: "Customer Interested in Exchange",
    name: "exchange",
    type: "select",
    options: ["Yes", "No", "Maybe"],
    conditionalTarget: "exchangeDetails",
  },
  {
    label: "Remarks",
    name: "remarks",
    type: "textarea",
    placeholder: "Add notes about customer intent",
    full: true,
  },

  { section: "Address Details" },
  {
  label: "Address 1",
  name: "address1",
  type: "text",
  placeholder: "Primary address",
  },
  {
    label: "Address 4",
    name: "address4",
    type: "text",
    placeholder: "Landmark / extra details",
  },
  {
    label: "Address 2",
    name: "address2",
    type: "text",
    placeholder: "Secondary address",
  },
  {
    label: "District",
    name: "district",
    type: "text",
    placeholder: "District",
  },
  {
    label: "Address 3",
    name: "address3",
    type: "text",
    placeholder: "Area / locality",
  },
  { label: "City", name: "city", type: "text", placeholder: "City" },
  {
    label: "Pincode",
    name: "pincode",
    type: "text",
    placeholder: "Pincode",
  },
  { label: "State", name: "state", type: "text", placeholder: "State" },
];

/* ═══════════════════════════════════════════════════════════════
 CONFIG: TABLE DEFINITIONS
═══════════════════════════════════════════════════════════════ */
var TABLE_CONFIG = {
  enquiries: {
    title: "Enquiry Records",
    subtitle: "Reusable table with status, vehicle, and date filters.",
    tableKey: "enquiries",
    searchKeys: [
      "id",
      "customer",
      "vehicle",
      "source",
      "status",
      "temperature",
    ],
    addLabel: "Open Form",
    addView: "enquiry-form",
    columns: [
      { key: "id", label: "ID" },
      { key: "customer", label: "Customer Name" },
      { key: "vehicle", label: "Vehicle Model" },
      { key: "temperature", label: "Lead Temp", type: "badge" },
      { key: "status", label: "Status", type: "badge" },
      { key: "date", label: "Date" },
      { key: "source", label: "Source" },
    ],
  },
  appointments: {
    title: "Appointment Schedule",
    subtitle: "Reusable appointment table with the same layout system.",
    tableKey: "appointments",
    searchKeys: ["id", "customer", "vehicle", "status", "date"],
    addLabel: "New Appointment",
    addView: "appointment-form",
    columns: [
      { key: "id", label: "Appointment ID" },
      { key: "customer", label: "Customer Name" },
      { key: "vehicle", label: "Vehicle" },
      { key: "status", label: "Status", type: "badge" },
      { key: "date", label: "Date" },
      { key: "time", label: "Time" },
    ],
  },
  feedback: {
    title: "Feedback Records",
    subtitle:
      "Reusable feedback table with consistent filtering and status display.",
    tableKey: "feedback",
    searchKeys: ["id", "enquiryId", "customer", "vehicle", "status"],
    columns: [
      { key: "id", label: "Feedback ID" },
      { key: "enquiryId", label: "Enquiry ID" },
      { key: "customer", label: "Customer" },
      { key: "vehicle", label: "Vehicle" },
      { key: "status", label: "Status", type: "badge" },
      { key: "date", label: "Date" },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════
 UTILITIES
═══════════════════════════════════════════════════════════════ */
var Utils = {
  escape(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  },
  capitalize(value) {
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  },
  badgeClass(status) {
    const key = String(status).toLowerCase();
    const map = {
      submitted: "submitted",
      closed: "closed",
      completed: "completed",
      scheduled: "scheduled",
      pending: "pending",
      hot: "hot",
      warm: "warm",
      cold: "cold",
    };
    return map[key] || "draft";
  },
  uniqueValues(rows, key) {
    return [...new Set(rows.map((r) => r[key]).filter(Boolean))];
  },
  filterRows(rows, config, searchKeys) {
    const q = appState.search.trim().toLowerCase();
    return rows.filter((row) => {
      const searchMatch =
        !q ||
        searchKeys.some((key) =>
          String(row[key] || "")
            .toLowerCase()
            .includes(q),
        );
      const statusMatch =
        config.status === "all" ||
        String(row.status || "").toLowerCase() === config.status;
      const vehicleMatch =
        config.vehicle === "all" ||
        String(row.vehicle || "").toLowerCase() === config.vehicle;
      const dateMatch =
        config.date === "all" ||
        String(row.date || "").startsWith(config.date);
      return searchMatch && statusMatch && vehicleMatch && dateMatch;
    });
  },
  highlight(text, query) {
    const str = String(text ?? "");
    const q = String(query ?? "").trim();
    if (!q) return Utils.escape(str);
    const idx = str.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return Utils.escape(str);
    return (
      Utils.escape(str.slice(0, idx)) +
      "<mark>" +
      Utils.escape(str.slice(idx, idx + q.length)) +
      "</mark>" +
      Utils.escape(str.slice(idx + q.length))
    );
  },
  /* ── Global search across every record type the user can see ──
     Searches enquiries, appointments, and feedback at once so the
     topbar search box works no matter which page you're on. */
  globalSearch(query, limit = 8) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];

    const sources = [
      {
        type: "Enquiry",
        view: "sales-enquiries",
        rows: Store.enquiries,
        keys: TABLE_CONFIG.enquiries.searchKeys,
      },
      {
        type: "Appointment",
        view: "appointments",
        rows: Store.appointments,
        keys: TABLE_CONFIG.appointments.searchKeys,
      },
      {
        type: "Feedback",
        view: "feedback",
        rows: Store.feedback,
        keys: TABLE_CONFIG.feedback.searchKeys,
      },
    ];

    const results = [];
    for (const src of sources) {
      for (const row of src.rows) {
        const matchKey = src.keys.find((key) =>
          String(row[key] || "")
            .toLowerCase()
            .includes(q),
        );
        if (matchKey) {
          results.push({ type: src.type, view: src.view, row, matchKey });
        }
      }
    }

    // Rank exact / prefix matches on customer or id above generic hits
    results.sort((a, b) => {
      const score = (r) => {
        const customer = String(r.row.customer || "").toLowerCase();
        const id = String(r.row.id || "").toLowerCase();
        if (customer === q || id === q) return 0;
        if (customer.startsWith(q) || id.startsWith(q)) return 1;
        return 2;
      };
      return score(a) - score(b);
    });

    return results.slice(0, limit);
  },
  toast(message, type = "success", force = false) {
    // Respect the "Toast notifications" setting — errors/warnings and
    // explicitly-forced messages (e.g. "Preferences saved") always show.
    if (!force && type === "success" && Preferences.get("toasts") === false) {
      return;
    }
    const container = document.getElementById("toastContainer");
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    const icons = {
      success:
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
      error:
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
      warning:
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 2.6 17a1.6 1.6 0 0 0 1.4 2.4h16a1.6 1.6 0 0 0 1.4-2.4L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z"/><path d="M12 9v4M12 16.5h.01"/></svg>',
    };
    const icon = icons[type] || icons.success;
    el.innerHTML = `<span style="display:inline-flex;flex-shrink:0;">${icon}</span> ${Utils.escape(message)}`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.3s";
      setTimeout(() => el.remove(), 300);
    }, 3200);
  },
  computeMetrics() {
    const rows = Store.enquiries;
    const submitted = rows.filter((r) => r.status === "Submitted").length;
    const draft = rows.filter((r) => r.status === "Draft").length;
    const closed = rows.filter((r) => r.status === "Closed").length;
    return [
      {
        label: "Total Enquiries",
        value: rows.length,
        icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.2 15a9 9 0 1 1-4.2-10.7"/><path d="M12 3v9l6.4 3.7"/></svg>',
        trend: "-",
      },
      {
        label: "Open Pipeline",
        value: submitted + draft,
        icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h6l3 8 4-16 3 8h2"/></svg>',
        trend: "-",
      },
      {
        label: "Appointments",
        value: Store.appointments.length,
        icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
        trend: "-",
      },
      {
        label: "Closed Leads",
        value: closed,
        icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
        trend: "-",
      },
    ];
  },
};

/* ═══════════════════════════════════════════════════════════════
 COMPONENTS
═══════════════════════════════════════════════════════════════ */
var Components = {
  /* ── Sidebar ── */
  sidebar() {
    const userRole = Auth.getUserRole();
    if (!userRole) return "";

    // Filter NAV_CONFIG based on role
    const filteredNav = NAV_CONFIG.filter(
      (item) => !item.roles || item.roles.includes(userRole),
    );

    const groups = [...new Set(filteredNav.map((item) => item.group))];
    const groupHTML = groups
      .map((group) => {
        const items = filteredNav
          .filter((item) => item.group === group)
          .map(
            (item) => `
      <div class="nav-link ${appState.currentView === item.id ? "active" : ""}"
           data-nav="${Utils.escape(item.id)}" role="button" tabindex="0">
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-text">${Utils.escape(item.label)}</span>
      </div>
    `,
          )
          .join("");
        return `
      <div>
        <div class="nav-group-title">${Utils.escape(group)}</div>
        <div class="nav-menu">${items}</div>
      </div>
    `;
      })
      .join("");

    return `
    <div class="brand">
      <img src="data:image/jpeg;base64,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" alt="Platinum Software" class="brand-logo-img" />
      <div class="brand-copy">
        <h1>Platinum Software</h1>
        <p>Professional CRM Workspace</p>
      </div>
    </div>
    ${groupHTML}
  `;
  },

  /* ── Topbar ── */
  topbar() {
    const user = Auth.getLoggedInUser();
    const role = Auth.getUserRole() || "user";
    const roleLabel = role === "admin" ? "Administrator" : role === "director" ? "Director" : "Sales Executive";
    const nameOverride = (Preferences.get("displayName") || "").trim();
    const displayName =
      nameOverride || (user ? user.split("@")[0] : "Sales Executive");
    const initials = displayName.slice(0, 2).toUpperCase();

    return `
    <div class="topbar-left">
      <button class="icon-btn" id="sidebarToggle" aria-label="Toggle sidebar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
      <div class="search-wrap">
        <div class="search-box">
          <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></span>
          <input id="globalSearch" type="text" autocomplete="off"
            placeholder="Search customers, vehicles, or records"
            value="${Utils.escape(appState.search)}" />
        </div>
        <div class="search-results" id="searchResults" role="listbox"></div>
      </div>
    </div>
    <div class="topbar-right">


      <div style="position:relative;">
        <button class="avatar-btn" id="avatarBtn" aria-haspopup="true" aria-expanded="false">
          <div class="avatar">${initials}</div>
          <div class="avatar-copy">
            <strong>${Utils.escape(displayName)}</strong>
            <span>${Utils.escape(roleLabel)}</span>
          </div>
        </button>
        <div class="profile-menu" id="profileMenu" role="menu">
          <div class="profile-menu-header">
            <div class="profile-menu-avatar">${initials}</div>
            <div class="profile-menu-info">
              <strong>${Utils.escape(displayName)}</strong>
              <span>${Utils.escape(roleLabel)}</span>
            </div>
          </div>
          <div class="profile-menu-divider"></div>
          <div class="profile-item" id="profileBtn" role="menuitem">
            <span class="profile-item-icon">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </span>
            My Profile
          </div>
          <div class="profile-item" id="settingsBtn" role="menuitem">
            <span class="profile-item-icon">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.414 1.414M11.536 11.536l1.414 1.414M3.05 12.95l1.414-1.414M11.536 4.464l1.414-1.414" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </span>
            Settings
          </div>
          <div class="profile-menu-divider"></div>
          <div class="profile-item logout-item" id="logoutBtn" role="menuitem">
            <span class="profile-item-icon">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
            Sign out
          </div>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <div class="settings-modal-overlay" id="settingsOverlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div class="settings-modal">
        <div class="settings-modal-header">
          <div class="settings-modal-title">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.414 1.414M11.536 11.536l1.414 1.414M3.05 12.95l1.414-1.414M11.536 4.464l1.414-1.414" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Settings
          </div>
          <button class="settings-close-btn" id="settingsCloseBtn" aria-label="Close settings"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </div>
        <div class="settings-modal-body">
          <div class="settings-section">
            <h4 class="settings-section-title">Appearance</h4>
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-label">Theme</span>
                <span class="settings-row-desc">Interface color scheme</span>
              </div>
              <select class="settings-control" id="settingTheme">
                <option value="light" ${Preferences.get("theme") === "light" ? "selected" : ""}>Light</option>
                <option value="dark" ${Preferences.get("theme") === "dark" ? "selected" : ""}>Dark</option>
                <option value="system" ${Preferences.get("theme") === "system" ? "selected" : ""}>System default</option>
              </select>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-label">Compact sidebar</span>
                <span class="settings-row-desc">Collapse sidebar by default on load</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="settingCompact" ${Preferences.get("compactSidebar") ? "checked" : ""} />
                <span class="settings-toggle-track"></span>
              </label>
            </div>
          </div>
          <div class="settings-section">
            <h4 class="settings-section-title">Notifications</h4>
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-label">Toast notifications</span>
                <span class="settings-row-desc">Show in-app alerts for actions</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="settingToasts" ${Preferences.get("toasts") ? "checked" : ""} />
                <span class="settings-toggle-track"></span>
              </label>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-label">Email digests</span>
                <span class="settings-row-desc">Daily summary of pipeline activity</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="settingEmail" ${Preferences.get("emailDigest") ? "checked" : ""} />
                <span class="settings-toggle-track"></span>
              </label>
            </div>
          </div>
          <div class="settings-section">
            <h4 class="settings-section-title">Data & Privacy</h4>
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-label">Auto-save filters</span>
                <span class="settings-row-desc">Remember table filters between sessions</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="settingFilters" ${Preferences.get("autosaveFilters") ? "checked" : ""} />
                <span class="settings-toggle-track"></span>
              </label>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-label">Session timeout</span>
                <span class="settings-row-desc">Auto sign-out after inactivity</span>
              </div>
              <select class="settings-control" id="settingTimeout">
                <option value="30" ${Number(Preferences.get("sessionTimeoutMinutes")) === 30 ? "selected" : ""}>30 minutes</option>
                <option value="60" ${Number(Preferences.get("sessionTimeoutMinutes")) === 60 ? "selected" : ""}>1 hour</option>
                <option value="120" ${Number(Preferences.get("sessionTimeoutMinutes")) === 120 ? "selected" : ""}>2 hours</option>
              </select>
            </div>
          </div>
          <div class="settings-section">
            <h4 class="settings-section-title">Workspace</h4>
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-label">Default landing page</span>
                <span class="settings-row-desc">First page shown after sign-in</span>
              </div>
              <select class="settings-control" id="settingLanding">
                <option value="dashboard" ${Preferences.get("defaultLanding") === "dashboard" ? "selected" : ""}>Dashboard</option>
                <option value="sales-enquiries" ${Preferences.get("defaultLanding") === "sales-enquiries" ? "selected" : ""}>Sales Enquiries</option>
                <option value="appointments" ${Preferences.get("defaultLanding") === "appointments" ? "selected" : ""}>Appointments</option>
              </select>
            </div>
          </div>
        </div>
        <div class="settings-modal-footer">
          <button class="btn" id="settingsCancelBtn">Cancel</button>
          <button class="btn btn-primary" id="settingsSaveBtn">Save preferences</button>
        </div>
      </div>
    </div>

    <!-- Profile Modal -->
    <div class="settings-modal-overlay" id="profileOverlay" role="dialog" aria-modal="true" aria-label="My Profile">
      <div class="settings-modal">
        <div class="settings-modal-header">
          <div class="settings-modal-title">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            My Profile
          </div>
          <button class="settings-close-btn" id="profileCloseBtn" aria-label="Close profile"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </div>
        <div class="settings-modal-body">
          <div class="profile-modal-hero">
            <div class="profile-modal-avatar-lg">${initials}</div>
            <div class="profile-modal-hero-copy">
              <strong>${Utils.escape(displayName)}</strong>
              <span>${Utils.escape(roleLabel)}</span>
            </div>
          </div>
          <div class="profile-modal-field">
            <label for="profileDisplayName">Display name</label>
            <input type="text" id="profileDisplayName" maxlength="40"
              value="${Utils.escape(displayName)}" placeholder="How you'd like to appear in the app" />
          </div>
          <div class="profile-modal-field">
            <label for="profileEmail">Username / email</label>
            <input type="text" id="profileEmail" value="${Utils.escape(user || "")}" readonly />
          </div>
          <div class="profile-modal-stats">
            <div class="profile-modal-stat">
              <small>Role</small>
              <strong>${Utils.escape(roleLabel)}</strong>
            </div>
            <div class="profile-modal-stat">
              <small>Session</small>
              <strong>Secured</strong>
            </div>
          </div>
        </div>
        <div class="settings-modal-footer">
          <button class="btn" id="profileCancelBtn">Cancel</button>
          <button class="btn btn-primary" id="profileSaveBtn">Save changes</button>
        </div>
      </div>
    </div>
  `;
  },

  /* ── Card ── */
  card({ title, subtitle, content, actionLabel, actionView }) {
    return `
    <section class="card">
      <div class="card-header">
        <div>
          <h3>${Utils.escape(title)}</h3>
          ${subtitle ? `<p>${Utils.escape(subtitle)}</p>` : ""}
        </div>
        ${
          actionLabel
            ? `<button class="btn btn-secondary" data-nav="${Utils.escape(actionView || "")}">${Utils.escape(actionLabel)}</button>`
            : ""
        }
      </div>
      <div class="card-body">${content}</div>
    </section>
  `;
  },

  /* ── Stat Cards ── */
  statCards() {
    return `
    <div class="stats-grid">
      ${Utils.computeMetrics()
        .map(
          (item) => `
        <section class="card stat-card">
          <div class="stat-top">
            <div>
              <small>${Utils.escape(item.label)}</small>
              <h3>${item.value}</h3>
            </div>
            <div class="stat-icon">${item.icon}</div>
          </div>
          <div class="trend">${Utils.escape(item.trend)}</div>
        </section>
      `,
        )
        .join("")}
    </div>
  `;
  },

  /* ── Table ── */
  table(cfg, rows) {
    const {
      title,
      subtitle,
      tableKey,
      columns,
      searchKeys,
      addLabel,
      addView,
    } = cfg;
    const config = appState.filters[tableKey];
    const filtered = Utils.filterRows(rows, config, searchKeys);
    const vehicleOpts = Utils.uniqueValues(rows, "vehicle");
    const monthOpts = [
      ...new Set(rows.map((r) => String(r.date).slice(0, 7))),
    ];

    const statusOptions = [
      ...new Set(rows.map((r) => String(r.status).toLowerCase())),
    ];

    const toolbar = `
    <div class="table-toolbar">
      <div class="toolbar-left">
        <select class="control" data-filter="${tableKey}" data-filter-key="status">
          <option value="all" ${config.status === "all" ? "selected" : ""}>All Status</option>
          ${statusOptions
            .map(
              (s) =>
                `<option value="${s}" ${config.status === s ? "selected" : ""}>${Utils.capitalize(s)}</option>`,
            )
            .join("")}
        </select>
        <select class="control" data-filter="${tableKey}" data-filter-key="vehicle">
          <option value="all" ${config.vehicle === "all" ? "selected" : ""}>All Vehicles</option>
          ${vehicleOpts
            .map(
              (v) =>
                `<option value="${v.toLowerCase()}" ${config.vehicle === v.toLowerCase() ? "selected" : ""}>${Utils.escape(v)}</option>`,
            )
            .join("")}
        </select>
        <select class="control" data-filter="${tableKey}" data-filter-key="date">
          <option value="all" ${config.date === "all" ? "selected" : ""}>All Dates</option>
          ${monthOpts
            .map(
              (m) =>
                `<option value="${m}" ${config.date === m ? "selected" : ""}>${m}</option>`,
            )
            .join("")}
        </select>
      </div>
      <div class="toolbar-right">
        ${
          addLabel
            ? `<button class="btn btn-primary" data-nav="${Utils.escape(addView || "")}">${Utils.escape(addLabel)}</button>`
            : ""
        }
      </div>
    </div>
  `;

    const tableRows = filtered.length
      ? filtered
          .map(
            (row) => `
        <tr>
          ${columns
            .map((col) => {
              if (col.type === "badge") {
                const val = row[col.key] || "";
                return `<td><span class="badge ${Utils.badgeClass(val)}">${Utils.escape(val)}</span></td>`;
              }
              return `<td>${Utils.escape(String(row[col.key] ?? "—"))}</td>`;
            })
            .join("")}
        </tr>
      `,
          )
          .join("")
      : `<tr><td colspan="${columns.length}" class="empty-state">No matching records found for the current filters.</td></tr>`;

    const content = `
    ${toolbar}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${columns.map((col) => `<th>${Utils.escape(col.label)}</th>`).join("")}</tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;

    return Components.card({ title, subtitle, content });
  },

  /* ── Form Field ── */
  formField(field) {
    if (field.section) {
      return `<div class="form-section"><h4>${Utils.escape(field.section)}</h4></div>`;
    }

    const cls = field.full ? "field full" : "field";
    const req = field.required ? 'data-required="true"' : "";
    const errMsg = field.required
      ? '<span class="error-msg">This field is required.</span>'
      : "";

    if (field.type === "select") {
      const cond = field.conditionalTarget
        ? `data-conditional="${field.conditionalTarget}"`
        : "";
      return `
      <div class="${cls}">
        <label>${Utils.escape(field.label)}</label>
        <select name="${field.name}" ${cond} ${req}>
          <option value="">Select ${Utils.escape(field.label)}</option>
          ${field.options
            .map(
              (o) =>
                `<option value="${Utils.escape(o)}">${Utils.escape(o)}</option>`,
            )
            .join("")}
        </select>
        ${errMsg}
      </div>
    `;
    }

    if (field.type === "chips") {
      return `
      <div class="${cls}">
        <label>${Utils.escape(field.label)}</label>
        <div class="choice-group">
          ${field.options
            .map(
              (opt, i) => `
            <label class="choice-chip ${opt.toLowerCase()}">
              <input type="radio" name="${field.name}" value="${Utils.escape(opt)}" ${i === 0 ? "checked" : ""}>
              <span class="choice-pill">${Utils.escape(opt)}</span>
            </label>
          `,
            )
            .join("")}
        </div>
        ${field.hint ? `<div class="field-hint">${Utils.escape(field.hint)}</div>` : ""}
      </div>
    `;
    }

    if (field.type === "textarea") {
      return `
      <div class="${cls}">
        <label>${Utils.escape(field.label)}</label>
        <textarea name="${field.name}" placeholder="${Utils.escape(field.placeholder || "")}" ${req}></textarea>
        ${errMsg}
      </div>
    `;
    }

    return `
    <div class="${cls}">
      <label>${Utils.escape(field.label)}</label>
      <input name="${field.name}" type="${field.type}"
             placeholder="${Utils.escape(field.placeholder || "")}" ${req} />
      ${errMsg}
    </div>
  `;
  },

  /* ── Enquiry Form ── */
  enquiryForm(fields) {
    const fieldsHTML = fields
      .map((f) => Components.formField(f))
      .join("");

    const content = `
    <div class="helper-note">
      <span style="display:inline-flex;flex-shrink:0;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg></span>
      <span>Fill all required fields. Select Payment Type as <strong>Finance</strong> or <strong>EMI</strong> to reveal finance details. Select Exchange as <strong>Yes</strong> or <strong>Maybe</strong> to reveal exchange details.</span>
    </div>
    <div style="height:16px;"></div>
    <form id="salesEnquiryForm" novalidate>
      <div class="form-grid">
        ${fieldsHTML}

        <div class="conditional-section" id="financeDetails">
          <div class="field">
            <label>Down Payment (₹)</label>
            <input name="downPayment" type="number" placeholder="Planned down payment" />
          </div>
          <div class="field">
            <label>EMI Amount (₹)</label>
            <input name="emi" type="number" placeholder="Expected monthly EMI" />
          </div>
          <div class="field">
            <label>Tenure (Months)</label>
            <input name="tenure" type="number" placeholder="Loan tenure in months" />
          </div>
          <div class="field">
            <label>Finance Company</label>
            <input name="whichFinance" type="text" placeholder="Preferred finance company" />
          </div>
        </div>

        <div class="conditional-section" id="exchangeDetails">
          <div class="field">
            <label>Exchange Type</label>
            <input name="exchangeType" type="text" placeholder="Scooter / Bike / Car" />
          </div>
          <div class="field">
            <label>Vehicle Model &amp; Make</label>
            <input name="vehicleModelMake" type="text" placeholder="Current vehicle details" />
          </div>
          <div class="field">
            <label>Year of Manufacturing</label>
            <input name="yearOfManufacturing" type="text" placeholder="e.g. 2019" />
          </div>
          <div class="field">
            <label>Owner Type</label>
            <input name="ownerType" type="text" placeholder="First / Second owner" />
          </div>
          <div class="field">
            <label>Valid Insurance</label>
            <select name="validInsurance">
              <option value="">Select</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </div>
          <div class="field">
            <label>Original RC Available</label>
            <select name="originalRcAvailable">
              <option value="">Select</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </div>
          <div class="field">
            <label>Customer Expected Exchange Price (₹)</label>
            <input name="expectedExchangePrice" type="number" placeholder="Customer expectation" />
          </div>
          <div class="field">
            <label>Price Offer by Dealer (₹)</label>
            <input name="dealerOfferPrice" type="number" placeholder="Dealer offer" />
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn" data-nav="sales-enquiries">Cancel</button>
        <button type="reset" class="btn btn-secondary">Reset</button>
        <button type="submit" class="btn btn-primary">Submit Enquiry</button>
      </div>
    </form>
  `;

    return Components.card({
      title: "New Sales Enquiry Form",
      subtitle:
        "Capture customer interest, lead temperature, vehicle preference, and contact details.",
      content,
    });
  },

  /* ── List Stack ── */
  listStack(items) {
    return `
    <div class="list-stack">
      ${items
        .map(
          (item) => `
        <div class="list-item">
          <div>
            <strong>${Utils.escape(item.primary)}</strong>
            <span>${Utils.escape(item.secondary)}</span>
          </div>
          <span class="badge ${Utils.badgeClass(item.badge)}">${Utils.escape(item.badge)}</span>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
  },
};

/* ═══════════════════════════════════════════════════════════════
 VIEWS
═══════════════════════════════════════════════════════════════ */
var Views = {
  dashboard() {
    const recentItems = Store.enquiries.slice(0, 4).map((item) => ({
      primary: `${item.customer} · ${item.vehicle}`,
      secondary: `${item.id} · ${item.source} · ${item.date}`,
      badge: item.status,
    }));

    const upcomingItems = Store.appointments
      .filter((a) => a.status === "Scheduled")
      .map((item) => ({
        primary: `${item.customer} · ${item.vehicle}`,
        secondary: `${item.id} · ${item.date} at ${item.time}`,
        badge: item.status,
      }));

    const hot = Store.enquiries.filter(
      (r) => r.temperature === "Hot",
    ).length;
    const warm = Store.enquiries.filter(
      (r) => r.temperature === "Warm",
    ).length;
    const cold = Store.enquiries.filter(
      (r) => r.temperature === "Cold",
    ).length;
    const total = Store.enquiries.length;
    const hotPct = total > 0 ? Math.round((hot / total) * 100) : 0;
    const warmPct = total > 0 ? Math.round((warm / total) * 100) : 0;
    const hotDeg = hotPct * 3.6;
    const warmDeg = warmPct * 3.6;

    const sources = {};
    Store.enquiries.forEach((r) => {
      sources[r.source] = (sources[r.source] || 0) + 1;
    });
    const sourceItems = Object.entries(sources).map(([src, count]) => ({
      primary: src,
      secondary: `${count} enquiries`,
      badge: `${total > 0 ? Math.round((count / total) * 100) : 0}%`,
    }));

    const leadDistContent = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
      <div style="width:180px;height:180px;border-radius:50%;background:conic-gradient(var(--red) 0deg ${hotDeg}deg,var(--orange) ${hotDeg}deg ${hotDeg + warmDeg}deg,var(--blue) ${hotDeg + warmDeg}deg 360deg);display:flex;align-items:center;justify-content:center;">
        <div style="width:120px;height:120px;background:var(--white);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-direction:column;font-weight:700;">
          <div style="font-size:22px;">${total}</div>
          <div style="font-size:11px;color:var(--text-muted);">TOTAL LEADS</div>
        </div>
      </div>
      <div style="width:100%;max-width:220px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:var(--red);display:inline-flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--red);"></span>Hot</span><span>${hot} (${hotPct}%)</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:var(--orange);display:inline-flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--orange);"></span>Warm</span><span>${warm} (${warmPct}%)</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:var(--blue);display:inline-flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--blue);"></span>Cold</span><span>${cold} (${total > 0 ? Math.round((cold / total) * 100) : 0}%)</span></div>
      </div>
    </div>
  `;

    const sourceContent = Components.listStack(sourceItems);

    return `
    <section class="page-header">
      <div class="page-title">
        <h2>Platinum CRM Dashboard</h2>
        <p>Overview of your enquiries, appointments, and sales pipeline. All components are fully reusable and dynamically rendered.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-nav="sales-enquiries">View Enquiries</button>
        <button class="btn btn-primary" data-nav="enquiry-form">Add New Enquiry</button>
      </div>
    </section>
    ${Components.statCards()}
    <section class="split-grid">
      ${Components.card({ title: "Recent Enquiries", subtitle: "Latest sales activity in the pipeline", content: Components.listStack(recentItems), actionLabel: "Open Enquiries", actionView: "sales-enquiries" })}
      ${Components.card({ title: "Upcoming Appointments", subtitle: "Scheduled customer visits", content: Components.listStack(upcomingItems), actionLabel: "All Appointments", actionView: "appointments" })}
    </section>
    <section class="split-grid">
      ${Components.card({ title: "Lead Distribution", subtitle: "Temperature breakdown across pipeline", content: leadDistContent })}
      ${Components.card({ title: "Enquiry Sources", subtitle: "Where customers are coming from", content: sourceContent })}
    </section>
  `;
  },

  "sales-enquiries"() {
    return `
    <section class="page-header">
      <div class="page-title">
        <h2>Sales Enquiries</h2>
        <p>All customer enquiries with status, lead temperature, and vehicle details. Filter by status, vehicle, or date.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" data-nav="enquiry-form">Add Enquiry</button>
      </div>
    </section>
    ${Components.table(TABLE_CONFIG.enquiries, Store.enquiries)}
  `;
  },

  appointments() {
    return `
    <section class="page-header">
      <div class="page-title">
        <h2>Appointment Booking</h2>
        <p>Track scheduled, pending, and completed customer appointments. Manage follow-up timing after enquiry capture.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" data-nav="appointment-form">Add Appointment</button>
      </div>
    </section>
    ${Components.table(TABLE_CONFIG.appointments, Store.appointments)}
  `;
  },

  feedback() {
    return `
    <section class="page-header">
      <div class="page-title">
        <h2>Sales Feedback</h2>
        <p>Outcome records from customer appointments and discussions. Track submitted vs draft feedback entries.</p>
      </div>
    </section>
    ${Components.table(TABLE_CONFIG.feedback, Store.feedback)}
  `;
  },

  "enquiry-form"() {
    return `
    <section class="page-header">
      <div class="page-title">
        <h2>Enquiry Form</h2>
        <p>Capture complete customer details including contact information, vehicle interest, lead temperature, payment type, and address.</p>
      </div>
      <div class="page-actions">
        <button class="btn" data-nav="sales-enquiries">← Back to List</button>
      </div>
    </section>
    ${Components.enquiryForm(ENQUIRY_FORM_FIELDS)}
  `;
  },

  "appointment-form"() {
    return `
    <section class="page-header">
      <div class="page-title">
        <h2>New Appointment</h2>
        <p>Schedule a new customer appointment by filling in the details below.</p>
      </div>
      <div class="page-actions">
        <button class="btn" data-nav="appointments">← Back to List</button>
      </div>
    </section>
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Appointment Details</h3>
          <p>Fill in all required fields to book the appointment.</p>
        </div>
      </div>
      <div class="card-body">
        <form id="appointmentForm" novalidate>
          <div class="form-grid">
            <div class="field">
              <label>Customer Name</label>
              <input type="text" name="apptCustomer" placeholder="Enter customer name" data-required="true" />
              <span class="error-msg">This field is required.</span>
            </div>
            <div class="field">
              <label>Vehicle</label>
              <input type="text" name="apptVehicle" placeholder="e.g. Fascino, FZ-S, R15" data-required="true" />
              <span class="error-msg">This field is required.</span>
            </div>
            <div class="field">
              <label>Date</label>
              <input type="date" name="apptDate" data-required="true" />
              <span class="error-msg">This field is required.</span>
            </div>
            <div class="field">
              <label>Time</label>
              <input type="time" name="apptTime" data-required="true" />
              <span class="error-msg">This field is required.</span>
            </div>
            <div class="field">
              <label>Status</label>
              <select name="apptStatus">
                <option value="Scheduled">Scheduled</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
          <div class="form-actions">
            <button type="reset" class="btn btn-secondary">Reset</button>
            <button type="submit" class="btn btn-primary">Book Appointment</button>
          </div>
        </form>
      </div>
    </div>
  `;
  },

  "director-dashboard"() {
    const report = Store.directorReport || {};
    const temperatureBreakdown = Array.isArray(
      report.temperature_breakdown,
    )
      ? report.temperature_breakdown
      : [];
    const sourceBreakdown = Array.isArray(report.source_breakdown)
      ? report.source_breakdown
      : [];
    const totalTemperature = temperatureBreakdown.reduce(
      (sum, item) => sum + Number(item.count || 0),
      0,
    );
    const topSourceCount = sourceBreakdown.reduce(
      (max, item) => Math.max(max, Number(item.count || 0)),
      0,
    );

    // Use real data from the backend report
    const metrics = [
      {
        label: "Total Enquiries",
        value: String(report.total_enquiries || 0),
        icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h6l3 8 4-16 3 8h2"/></svg>',
        trend: "-",
      },
      {
        label: "Appointments",
        value: String(report.total_appointments || 0),
        icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
        trend: "-",
      },
      {
        label: "Feedbacks",
        value: String(report.total_feedback || 0),
        icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg>',
        trend: "-",
      },
      {
        label: "Conversion Rate",
        value: `${report.conversion_rate_percent || 0}%`,
        icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
        trend: "-",
      },
    ];

    const metricCards = metrics
      .map(
        (m) => `
      <section class="card stat-card">
        <div class="stat-top">
          <div>
            <small>${Utils.escape(m.label)}</small>
            <h3>${m.value}</h3>
          </div>
          <div class="stat-icon">${m.icon}</div>
        </div>
        <div class="trend">${Utils.escape(m.trend)}</div>
      </section>
    `,
      )
      .join("");

    return `
      <section class="page-header">
        <div class="page-title">
          <h2>Director Insights & Analytics</h2>
          <p>High-level performance metrics, sales conversion data, and pipeline breakdown.</p>
        </div>
        <div class="page-actions">
          <a href="../llm/Platinum_Sales_Chatbot-main/index.html" class="btn btn-primary">Open AI Strategy Chatbot</a>
        </div>
      </section>
      
      <div class="stats-grid">
        ${metricCards}
      </div>

      <section class="split-grid">
        ${Components.card({
          title: "Lead Temperature Mix",
          subtitle: "Live distribution for strategic pipeline review",
          content: temperatureBreakdown.length
            ? `<div style="display:flex; flex-direction:column; gap:14px;">
                ${temperatureBreakdown
                  .map((t) => {
                    const count = Number(t.count || 0);
                    const percent = totalTemperature
                      ? Math.round((count / totalTemperature) * 100)
                      : 0;
                    return `
                      <div>
                        <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:8px; font-weight:700;">
                          <span>${Utils.escape(t.temperature || "Unspecified")}</span>
                          <span>${Utils.escape(String(percent))}%</span>
                        </div>
                        <div style="height:10px; background:var(--border-mid); border-radius:999px; overflow:hidden;">
                          <div style="height:100%; width:${percent}%; background:var(--blue); border-radius:999px;"></div>
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>`
            : `<div style="padding:12px;color:var(--text-muted);">No temperature analytics available.</div>`,
        })}
        ${Components.card({
          title: "Lead Source Momentum",
          subtitle:
            "Visual channel concentration across incoming enquiries",
          content: sourceBreakdown.length
            ? `<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:12px;">
                ${sourceBreakdown
                  .map((s) => {
                    const count = Number(s.count || 0);
                    const height = topSourceCount
                      ? Math.max(
                          18,
                          Math.round((count / topSourceCount) * 84),
                        )
                      : 18;
                    return `
                      <div style="min-height:132px; display:flex; flex-direction:column; justify-content:flex-end; gap:8px;">
                        <div style="height:${height}px; background:var(--green); border-radius:8px 8px 3px 3px;"></div>
                        <strong style="font-size:13px;">${Utils.escape(s.source || "Unspecified")}</strong>
                        <span style="color:var(--text-muted); font-size:12px;">${Utils.escape(String(count))} enquiries</span>
                      </div>
                    `;
                  })
                  .join("")}
              </div>`
            : `<div style="padding:12px;color:var(--text-muted);">No source analytics available.</div>`,
        })}
      </section>
    `;
  },

  reports() {
    const report = Store.directorReport || {};
    const temps = Array.isArray(report.temperature_breakdown)
      ? report.temperature_breakdown
      : [];
    const sources = Array.isArray(report.source_breakdown)
      ? report.source_breakdown
      : [];

    return `
      <section class="page-header">
        <div class="page-title">
          <h2>Executive Reports</h2>
          <p>Backend-driven sales performance breakdowns for director review.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="window.print()">Export Report</button>
        </div>
      </section>
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Lead Temperature Report</h3>
            <p>Enquiries grouped by backend temperature data.</p>
          </div>
        </div>
        <div class="card-body">
          <div style="overflow-x: auto;">
            <table class="data-table">
              <thead>
                <tr><th>Temperature</th><th>Count</th></tr>
              </thead>
              <tbody>
                ${
                  temps.length > 0
                    ? temps
                        .map(
                          (t) => `
                  <tr>
                    <td>${Utils.escape(t.temperature || "Unspecified")}</td>
                    <td>${Utils.escape(String(t.count || 0))}</td>
                  </tr>
                `,
                        )
                        .join("")
                    : '<tr><td colspan="2" style="text-align:center;">No temperature data found.</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Enquiry Source Report</h3>
            <p>Lead sources grouped by backend enquiry data.</p>
          </div>
        </div>
        <div class="card-body">
          <div style="overflow-x: auto;">
            <table class="data-table">
              <thead>
                <tr><th>Source</th><th>Count</th></tr>
              </thead>
              <tbody>
                ${
                  sources.length > 0
                    ? sources
                        .map(
                          (s) => `
                  <tr>
                    <td>${Utils.escape(s.source || "Unspecified")}</td>
                    <td>${Utils.escape(String(s.count || 0))}</td>
                  </tr>
                `,
                        )
                        .join("")
                    : '<tr><td colspan="2" style="text-align:center;">No source data found.</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  "admin-controls"() {
    const uniqueUsers = new Set(
      Store.adminLogs.map((l) => l.user).filter(Boolean),
    );
    const activeUsers = uniqueUsers.size;

    return `
      <section class="page-header">
        <div class="page-title">
          <h2>System Administration</h2>
          <p>Review administrative activity from the secured backend audit log.</p>
        </div>
      </section>

      <div class="stats-grid">
        <section class="card stat-card">
          <div class="stat-top">
            <div><small>Active Users</small><h3>${Utils.escape(String(activeUsers))}</h3></div>
            <div class="stat-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          </div>
          <div class="trend">${Utils.escape(`${Store.adminLogs.length} recent audit events`)}</div>
        </section>
        <section class="card stat-card">
          <div class="stat-top">
            <div><small>Audit Events</small><h3>${Utils.escape(String(Store.adminLogs.length))}</h3></div>
            <div class="stat-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17 9 11l4 4 8-8"/><path d="M15 7h6v6"/></svg></div>
          </div>
          <div class="trend">${Utils.escape("Loaded from /api/admin/logs/")}</div>
        </section>
        <section class="card stat-card">
          <div class="stat-top">
            <div><small>Admin Endpoint</small><h3>Secured</h3></div>
            <div class="stat-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg></div>
          </div>
          <div class="trend">${Utils.escape("403 for non-admin roles")}</div>
        </section>
      </div>

      <section class="card">
        <div class="card-header">
          <div>
            <h3>Security Audit Log</h3>
            <p>Recent administrative actions and authentication events.</p>
          </div>
        </div>
        <div class="card-body">
          <div style="overflow-x: auto;">
            <table class="data-table">
              <thead>
                <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Target</th><th>Details</th></tr>
              </thead>
              <tbody>
                ${
                  Store.adminLogs.length > 0
                    ? Store.adminLogs
                        .map(
                          (log) => `
                  <tr>
                    <td>${Utils.escape(log.timestamp)}</td>
                    <td>${Utils.escape(log.user || "System")}</td>
                    <td>${Utils.escape(log.action_flag)}</td>
                    <td>${Utils.escape(log.object || "-")}</td>
                    <td>${Utils.escape(log.change_message || "-")}</td>
                  </tr>
                `,
                        )
                        .join("")
                    : '<tr><td colspan="5" style="text-align:center;">No audit logs found.</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  },

  "access-denied"() {
    const userRole = Auth.getUserRole() || "Unknown";
    const attemptedRoute = appState.deniedRoute || "this module";

    return `
      <div class="card" style="max-width: 500px; margin: 80px auto; text-align: center; overflow: visible;">
        <div class="card-body" style="padding: 40px 30px;">
          <div style="width: 64px; height: 64px; background: var(--red-soft); color: var(--red); border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: -72px auto 20px auto; border: 4px solid var(--bg); box-shadow: 0 4px 12px rgba(220, 38, 38, 0.15);">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          </div>
          <h2 style="font-size: 22px; margin: 0 0 12px; font-weight: 800; letter-spacing: -0.02em;">403 Access Restricted</h2>
          <p style="color: var(--text-muted); line-height: 1.6; margin-bottom: 24px; font-size: 14px;">
            Your current role (<strong style="text-transform: capitalize; color: var(--text);">${Utils.escape(userRole)}</strong>) 
            does not have permission to view <strong>${Utils.escape(attemptedRoute)}</strong>.
          </p>
          <button class="btn btn-primary" onclick="Router.navigate(DEFAULT_ROUTE_BY_ROLE[Auth.getUserRole()] || 'dashboard')" style="width: 100%;">
            Return to Workspace
          </button>
        </div>
      </div>
    `;
  },
};

/* ═══════════════════════════════════════════════════════════════
 ROUTER
═══════════════════════════════════════════════════════════════ */
var Router = {
  navigate(viewId) {
    if (!Auth.requireValidSession()) return;
    const userRole = Auth.getUserRole();
    const target = resolveNavigationTarget(viewId, userRole);

    // Role-based route guard
    if (!target.allowed) {
      Utils.toast("Access Denied: Insufficient Permissions", "error");
      appState.currentView = "access-denied";
      appState.deniedRoute = target.deniedRoute;

      if (window.innerWidth <= 900) {
        appState.mobileSidebarOpen = false;
        Shell.sync();
      }
      window.history.replaceState(null, null, "#access-denied");
      Persist.saveUI();
      Renderer.page();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    appState.currentView = target.viewId;
    if (target.viewId !== "access-denied") {
      window.history.replaceState(null, null, "#" + target.viewId);
    }
    if (window.innerWidth <= 900) {
      appState.mobileSidebarOpen = false;
      Shell.sync();
    }
    Persist.saveUI();
    Renderer.page();
    window.scrollTo({ top: 0, behavior: "smooth" });
  },
};

/* ═══════════════════════════════════════════════════════════════
 SHELL
═══════════════════════════════════════════════════════════════ */
var Shell = {
  sync() {
    const shell = document.getElementById("appShell");
    shell.classList.toggle(
      "sidebar-collapsed",
      appState.sidebarCollapsed && window.innerWidth > 900,
    );
    shell.classList.toggle(
      "mobile-sidebar-open",
      appState.mobileSidebarOpen && window.innerWidth <= 900,
    );
  },
};

/* ═══════════════════════════════════════════════════════════════
 RENDERER
═══════════════════════════════════════════════════════════════ */
var Renderer = {
  sidebar() {
    document.getElementById("sidebar").innerHTML = Components.sidebar();
    document.querySelectorAll("[data-nav]").forEach((el) => {
      const view = el.dataset.nav;
      if (!view) return;
      const handler = () => Router.navigate(view);
      el.addEventListener("click", handler);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") handler();
      });
    });
  },

  topbar() {
    document.getElementById("topbar").innerHTML = Components.topbar();

    document
      .getElementById("sidebarToggle")
      .addEventListener("click", () => {
        if (window.innerWidth <= 900) {
          appState.mobileSidebarOpen = !appState.mobileSidebarOpen;
        } else {
          appState.sidebarCollapsed = !appState.sidebarCollapsed;
        }
        Shell.sync();
        Persist.saveUI();
      });

    const sidebarBackdrop = document.getElementById("sidebarBackdrop");
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener("click", () => {
        appState.mobileSidebarOpen = false;
        Shell.sync();
        Persist.saveUI();
      });
    }

    const searchInput = document.getElementById("globalSearch");
    const searchResults = document.getElementById("searchResults");

    searchInput.addEventListener("input", (e) => {
      appState.search = e.target.value;
      Persist.saveUI();
      // Keep the on-page table (enquiries/appointments/feedback) filtered
      // whenever the user is already looking at one of those tables.
      Renderer.pageContent();
      Renderer.renderSearchResults(e.target.value);
    });

    searchInput.addEventListener("focus", () => {
      if (searchInput.value.trim()) Renderer.renderSearchResults(searchInput.value);
    });

    searchInput.addEventListener("keydown", (e) => {
      const items = () => Array.from(searchResults.querySelectorAll(".search-result"));

      if (e.key === "Escape") {
        Renderer.closeSearchResults();
        searchInput.blur();
        return;
      }

      if (e.key === "Enter") {
        const active = searchResults.querySelector(".search-result.is-active") || items()[0];
        if (active) {
          e.preventDefault();
          active.click();
        }
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const list = items();
        if (!list.length) return;
        e.preventDefault();
        const currentIndex = list.findIndex((el) => el.classList.contains("is-active"));
        let nextIndex;
        if (e.key === "ArrowDown") {
          nextIndex = currentIndex < list.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : list.length - 1;
        }
        list.forEach((el) => el.classList.remove("is-active"));
        list[nextIndex].classList.add("is-active");
        list[nextIndex].scrollIntoView({ block: "nearest" });
      }
    });

    // Close the dropdown on outside click; ignore clicks inside the box itself.
    document.addEventListener("click", (e) => {
      if (!searchResults) return;
      if (e.target === searchInput || searchResults.contains(e.target)) return;
      Renderer.closeSearchResults();
    });

    const avatarBtn = document.getElementById("avatarBtn");
    const profileMenu = document.getElementById("profileMenu");
    avatarBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = profileMenu.classList.toggle("open");
      avatarBtn.setAttribute("aria-expanded", isOpen);
    });
    document.addEventListener("click", () => {
      profileMenu.classList.remove("open");
      avatarBtn.setAttribute("aria-expanded", "false");
    });

    // Logout button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        Auth.logoutUser();
      });
    }

    // Settings modal
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsOverlay = document.getElementById("settingsOverlay");
    const settingsCloseBtn = document.getElementById("settingsCloseBtn");
    const settingsCancelBtn = document.getElementById("settingsCancelBtn");
    const settingsSaveBtn = document.getElementById("settingsSaveBtn");
    const settingTheme = document.getElementById("settingTheme");
    let themeBeforePreview = Preferences.get("theme");

    const openSettings = (e) => {
      if (e) e.stopPropagation();
      profileMenu.classList.remove("open");
      themeBeforePreview = Preferences.get("theme");
      settingsOverlay.classList.add("open");
    };
    const closeSettings = (revertPreview = true) => {
      settingsOverlay.classList.remove("open");
      // If the theme was only previewed (changed but not saved), put it back.
      if (revertPreview && settingTheme) {
        settingTheme.value = themeBeforePreview;
        Preferences.applyTheme(themeBeforePreview);
      }
    };

    if (settingsBtn) settingsBtn.addEventListener("click", openSettings);
    if (settingsCloseBtn) settingsCloseBtn.addEventListener("click", () => closeSettings(true));
    if (settingsCancelBtn) settingsCancelBtn.addEventListener("click", () => closeSettings(true));
    if (settingTheme) {
      // Live preview so picking "Dark" shows the result immediately.
      settingTheme.addEventListener("change", () => {
        Preferences.applyTheme(settingTheme.value);
      });
    }
    if (settingsSaveBtn) settingsSaveBtn.addEventListener("click", () => {
      const theme = document.getElementById("settingTheme").value;
      const compactSidebar = document.getElementById("settingCompact").checked;
      const toasts = document.getElementById("settingToasts").checked;
      const emailDigest = document.getElementById("settingEmail").checked;
      const autosaveFilters = document.getElementById("settingFilters").checked;
      const sessionTimeoutMinutes = Number(document.getElementById("settingTimeout").value) || 60;
      const defaultLanding = document.getElementById("settingLanding").value;

      Preferences.setMany({
        theme,
        compactSidebar,
        toasts,
        emailDigest,
        autosaveFilters,
        sessionTimeoutMinutes,
        defaultLanding,
      });

      Preferences.applyTheme();
      appState.sidebarCollapsed = compactSidebar || appState.sidebarCollapsed;
      Shell.sync();
      Persist.saveUI();
      IdleMonitor._reset();

      Utils.toast("Preferences saved.", "success", true);
      closeSettings(false);
    });
    if (settingsOverlay) {
      settingsOverlay.addEventListener("click", (e) => {
        if (e.target === settingsOverlay) closeSettings(true);
      });
    }

    // Profile modal
    const profileBtn = document.getElementById("profileBtn");
    const profileOverlay = document.getElementById("profileOverlay");
    const profileCloseBtn = document.getElementById("profileCloseBtn");
    const profileCancelBtn = document.getElementById("profileCancelBtn");
    const profileSaveBtn = document.getElementById("profileSaveBtn");

    const openProfile = (e) => {
      if (e) e.stopPropagation();
      profileMenu.classList.remove("open");
      profileOverlay.classList.add("open");
    };
    const closeProfile = () => profileOverlay.classList.remove("open");

    if (profileBtn) profileBtn.addEventListener("click", openProfile);
    if (profileCloseBtn) profileCloseBtn.addEventListener("click", closeProfile);
    if (profileCancelBtn) profileCancelBtn.addEventListener("click", closeProfile);
    if (profileOverlay) {
      profileOverlay.addEventListener("click", (e) => {
        if (e.target === profileOverlay) closeProfile();
      });
    }
    if (profileSaveBtn) {
      profileSaveBtn.addEventListener("click", () => {
        const nameInput = document.getElementById("profileDisplayName");
        const newName = (nameInput?.value || "").trim();
        Preferences.setMany({ displayName: newName });
        closeProfile();
        Renderer.topbar();
        Renderer.sidebar();
        Utils.toast("Profile updated.", "success", true);
      });
    }
  },

  /* ── Global search dropdown ──
     Live, instant results across enquiries, appointments, and feedback —
     works from any page, not just the table screens. */
  renderSearchResults(query) {
    const container = document.getElementById("searchResults");
    if (!container) return;
    const q = String(query || "").trim();

    if (!q) {
      container.classList.remove("open");
      container.innerHTML = "";
      return;
    }

    const results = Utils.globalSearch(q);

    if (!results.length) {
      container.innerHTML = `<div class="search-empty">No matches for "${Utils.escape(q)}"</div>`;
      container.classList.add("open");
      return;
    }

    container.innerHTML = `
      <div class="search-results-hint">${results.length} result${results.length === 1 ? "" : "s"}</div>
      ${results
        .map((r, i) => {
          const row = r.row;
          const metaParts = [row.status, row.date].filter(Boolean);
          return `
          <button type="button" class="search-result${i === 0 ? " is-active" : ""}"
            role="option" data-view="${Utils.escape(r.view)}" data-id="${Utils.escape(row.id)}">
            <span class="search-result-type">${Utils.escape(r.type)}</span>
            <span class="search-result-main">
              <strong>${Utils.highlight(row.customer || row.id, q)}</strong>
              <span>${Utils.highlight(row.vehicle || row.id, q)}</span>
            </span>
            <span class="search-result-meta">${Utils.escape(metaParts.join(" · "))}</span>
          </button>`;
        })
        .join("")}
    `;
    container.classList.add("open");

    container.querySelectorAll(".search-result").forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        const id = btn.dataset.id;
        appState.search = id;
        Persist.saveUI();
        Renderer.closeSearchResults();
        Router.navigate(view);
      });
    });
  },

  closeSearchResults() {
    const container = document.getElementById("searchResults");
    if (!container) return;
    container.classList.remove("open");
  },

  pageContent() {
    const root = document.getElementById("pageRoot");
    const viewFn = Views[appState.currentView] || Views.dashboard;
    root.innerHTML = viewFn.call(Views);
    Renderer.bindPageEvents();
  },

  page(rerenderTopbar = true) {
    this.pageContent();
    if (rerenderTopbar) this.topbar();
    this.sidebar();
  },

  bindPageEvents() {
    /* data-nav on any element navigates to the target view */
    document.querySelectorAll("[data-nav]").forEach((el) => {
      if (el.closest(".sidebar")) return; // sidebar handles its own
      const view = el.dataset.nav;
      if (!view) return;
      el.addEventListener("click", () => Router.navigate(view));
    });

    /* Table filter dropdowns */
    document.querySelectorAll("[data-filter]").forEach((control) => {
      control.addEventListener("change", () => {
        const tableKey = control.dataset.filter;
        const filterKey = control.dataset.filterKey;
        if (appState.filters[tableKey]) {
          appState.filters[tableKey][filterKey] = control.value;
        }
        Persist.saveUI();
        Renderer.pageContent();
        Renderer.sidebar(); // keep active state
      });
    });

    /* Form behaviour */
    this.bindForm();
  },

  bindForm() {
    const form = document.getElementById("salesEnquiryForm");

    /* ── Appointment Form ── */
    const apptForm = document.getElementById("appointmentForm");
    if (apptForm) {
      const apptValidate = () => {
        let valid = true;
        apptForm
          .querySelectorAll('[data-required="true"]')
          .forEach((el) => {
            const empty = !el.value.trim();
            const parent = el.closest(".field");
            if (parent) parent.classList.toggle("has-error", empty);
            el.classList.toggle("error", empty);
            if (empty) valid = false;
          });
        return valid;
      };

      apptForm
        .querySelectorAll('[data-required="true"]')
        .forEach((el) => {
          el.addEventListener("input", () => {
            if (el.value.trim()) {
              const parent = el.closest(".field");
              if (parent) parent.classList.remove("has-error");
              el.classList.remove("error");
            }
          });
        });

      apptForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!apptValidate()) {
          Utils.toast("Please fill all required fields.", "error");
          return;
        }

        const get = (name) =>
          apptForm.querySelector(`[name="${name}"]`)?.value?.trim() || "";
        const rawTime = get("apptTime");
        const [h, m] = rawTime.split(":").map(Number);
        const suffix = h >= 12 ? "PM" : "AM";
        const hour12 = h % 12 || 12;
        const formattedTime = `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;

        const payload = {
          id: `SABP-${Date.now()}`,
          customer: get("apptCustomer"),
          vehicle: get("apptVehicle"),
          date: get("apptDate"),
          time: formattedTime,
          status: get("apptStatus") || "Scheduled",
        };

        try {
          const saved = await Api.createAppointment(payload);

          const mapped = {
            id: saved.appointment_id,
            customer: saved.customer,
            vehicle: saved.vehicle,
            date: saved.date,
            time: saved.time,
            status: saved.status,
          };

          Store.addAppointment(mapped);

          Utils.toast(
            `Appointment booked for ${mapped.customer} on ${mapped.date} at ${mapped.time}.`,
            "success",
          );

          Router.navigate("appointments");
        } catch (error) {
          console.error("Create appointment failed:", error);
          Utils.toast(
            error.message || "Failed to save appointment to server.",
            "error",
          );
        }
      });
    }

    if (!form) return;

    /* Conditional field visibility */
    const conditionalMap = {
      financeDetails: (val) => val === "finance" || val === "emi",
      exchangeDetails: (val) => val === "yes" || val === "maybe",
    };

    form.querySelectorAll("[data-conditional]").forEach((select) => {
      const targetId = select.dataset.conditional;
      const target = document.getElementById(targetId);
      const test = conditionalMap[targetId] || (() => false);

      const toggle = () => {
        if (target)
          target.classList.toggle(
            "show",
            test((select.value || "").toLowerCase()),
          );
      };
      select.addEventListener("change", toggle);
      toggle();
    });

    /* Inline validation */
    const validate = () => {
      let valid = true;
      form.querySelectorAll('[data-required="true"]').forEach((el) => {
        const empty = !el.value.trim();
        const parent = el.closest(".field");
        if (parent) parent.classList.toggle("has-error", empty);
        el.classList.toggle("error", empty);
        if (empty) valid = false;
      });
      return valid;
    };

    form.querySelectorAll('[data-required="true"]').forEach((el) => {
      el.addEventListener("input", () => {
        if (el.value.trim()) {
          const parent = el.closest(".field");
          if (parent) parent.classList.remove("has-error");
          el.classList.remove("error");
        }
      });
    });

    /* Submit */
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!validate()) {
        Utils.toast("Please fill all required fields.", "error");
        return;
      }

      const get = (name) =>
        form.querySelector(`[name="${name}"]`)?.value?.trim() || "";
      const getChecked = (name) =>
        form.querySelector(`[name="${name}"]:checked`)?.value || "Hot";

      const payload = {
        id: `SE-${String(Date.now()).slice(-5)}`,
        customer: get("customerName") || "Customer",
        vehicle: get("modelName") || "Selected model",
        temperature: getChecked("leadTemperature"),
        status: get("salesEnquiryStatus") || "Submitted",
        date: new Date().toISOString().slice(0, 10),
        source: get("enquirySource") || "Walk-in",
      };

      try {
        const saved = await Api.createEnquiry(payload);

        const mapped = {
          id: saved.enquiry_id,
          customer: saved.customer,
          vehicle: saved.vehicle,
          temperature: saved.temperature,
          status: saved.status,
          date: saved.date,
          source: saved.source,
        };

        Store.addEnquiry(mapped);

        Utils.toast(
          `Enquiry for ${mapped.customer} submitted. Lead: ${mapped.temperature} | ${mapped.vehicle}`,
          "success",
        );

        Router.navigate("sales-enquiries");
      } catch (error) {
        console.error("Create enquiry failed:", error);
        Utils.toast(
          error.message || "Failed to save enquiry to server.",
          "error",
        );
      }
    });

    /* Reset */
    form.addEventListener("reset", () => {
      setTimeout(() => {
        form
          .querySelectorAll(".conditional-section")
          .forEach((el) => el.classList.remove("show"));
        form
          .querySelectorAll(".error")
          .forEach((el) => el.classList.remove("error"));
        form
          .querySelectorAll(".field")
          .forEach((f) => f.classList.remove("has-error"));
      }, 10);
    });
  },
};

/* ═══════════════════════════════════════════════════════════════
 INIT
═══════════════════════════════════════════════════════════════ */
async function init() {
  Preferences.load();
  Preferences.applyTheme();
  Preferences.watchSystemTheme();

  Persist.loadUI();
  if (Preferences.get("compactSidebar")) {
    appState.sidebarCollapsed = true;
  }

  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "");
    if (
      hash &&
      hash !== appState.currentView &&
      hash !== "access-denied"
    ) {
      Router.navigate(hash);
    }
  });

  // Auth MUST be initialized before any protected data is loaded.
  // initializeAuth() shows the login page if no valid session exists
  // and wires up the login form. Data loading only proceeds when authenticated.
  await Auth.initializeAuth();

  // Only load backend data if the user is authenticated
  if (
    Auth.isAuthenticated() &&
    appState.currentView !== "access-denied"
  ) {
    await Actions.refreshAll();
  }

  Renderer.topbar();
  Renderer.pageContent();
  Renderer.sidebar();
  Shell.sync();
  window.addEventListener("resize", Shell.sync.bind(Shell));
  IdleMonitor.start();
}

// In standard browser environment, trigger init automatically.
// In Node (testing) environment, we let the test helper control init.
if (typeof window !== "undefined" && typeof window.addEventListener !== "undefined" && !window.__TESTING__) {
  init();
}

// Export for coverage / Jest context if running in Node module loader
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    Auth, Api, appState, Store, Actions, ROUTE_CONFIG, NAV_CONFIG,
    DEFAULT_ROUTE_BY_ROLE, VALID_ROLES, ROUTE_REDIRECTS_BY_ROLE,
    resolveRouteForRole, resolveNavigationTarget, ENQUIRY_FORM_FIELDS,
    TABLE_CONFIG, Utils, Components, Views, Router, Shell, Renderer, init, Persist,
    Preferences, IdleMonitor
  };
}
