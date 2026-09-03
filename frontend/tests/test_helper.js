const fs = require('fs');
const path = require('path');

function setupDomEnvironment() {
  let store = {};
  let sessionStore = {};

  // Mock localStorage on Jest JSDOM window
  Object.defineProperty(global.window, 'localStorage', {
    value: {
      getItem: jest.fn((key) => store[key] || null),
      setItem: jest.fn((key, value) => { store[key] = String(value); }),
      removeItem: jest.fn((key) => { delete store[key]; }),
      clear: jest.fn(() => { store = {}; })
    },
    writable: true,
    configurable: true
  });

  // Mock sessionStorage on Jest JSDOM window
  Object.defineProperty(global.window, 'sessionStorage', {
    value: {
      getItem: jest.fn((key) => sessionStore[key] || null),
      setItem: jest.fn((key, value) => { sessionStore[key] = String(value); }),
      removeItem: jest.fn((key) => { delete sessionStore[key]; }),
      clear: jest.fn(() => { sessionStore = {}; })
    },
    writable: true,
    configurable: true
  });

  // Mock global fetch on Jest JSDOM window
  global.window.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([])
    })
  );

  // Silent error logging in tests
  global.window.console.error = jest.fn();

  // Mock window.scrollTo
  global.window.scrollTo = jest.fn();

  // Set testing flag to prevent automatic init execution during parsing
  global.window.__TESTING__ = true;

  // Load HTML structure into global document
  const htmlPath = path.resolve(__dirname, '../index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  global.document.documentElement.innerHTML = htmlContent;

  // Reset require cache and require index.js so Jest compiles it for coverage
  jest.resetModules();
  const indexModule = require('../index');

  // Expose exports to window properties for easy global testing accessibility
  Object.keys(indexModule).forEach((key) => {
    global.window[key] = indexModule[key];
  });

  return {
    window: global.window,
    document: global.document,
    store,
    sessionStore
  };
}

module.exports = { setupDomEnvironment };
