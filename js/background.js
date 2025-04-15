// Background service worker for LinkedIn Network Categorizer

// --- Installation & Setup ---
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    setupDefaultData();
    chrome.tabs.create({ url: 'onboarding.html' });
  } else if (details.reason === 'update') {
    console.log(`LinkedIn Network Categorizer updated to v${chrome.runtime.getManifest().version}`);
    // Perform any migration tasks if needed
  }
});

function setupDefaultData() {
  const defaultCategories = [
    { id: 'cat_dev', name: 'Developers', color: '#0077B5', icon: 'code' },
    { id: 'cat_biz', name: 'Business Contacts', color: '#2ECC71', icon: 'briefcase' },
    { id: 'cat_ai', name: 'AI Specialists', color: '#9B59B6', icon: 'brain' }
  ];
  const defaultSettings = { theme: 'light' };

  chrome.storage.local.set({
    categories: defaultCategories,
    settings: defaultSettings,
    connections: [],
    isLoggedIn: false // Start as logged out
  });
}

// --- Message Handling ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received:', request.action);

  if (request.action === 'login') {
    // Mock login - replace with real OAuth later
    setTimeout(() => sendResponse({ success: true }), 500);
    return true; // Indicates async response
  }

  if (request.action === 'syncConnections') {
    // Mock sync - replace with real API call later
    mockSyncConnections(sendResponse);
    return true; // Indicates async response
  }

  if (request.action === 'openCategoryModal') {
    // Try to focus existing popup or open it - This is tricky from background
    // Best effort: send message back to content script or rely on user clicking icon
    console.log("Request to open category modal received.");
    // Consider sending a message to the active tab's content script if needed
    return false; // No async response needed here
  }

  if (request.action === 'exportData') {
    exportData(sendResponse);
    return true; // Indicates async response
  }

  if (request.action === 'importData') {
    importData(request.data, sendResponse);
    return true; // Indicates async response
  }

  // Handle popup opening request from onboarding page (best effort)
  if (request.action === 'openPopup') {
      // This API is not available in Manifest V3 background scripts.
      // The user needs to click the extension icon.
      console.log("Received 'openPopup' message, but cannot programmatically open popup.");
      return false;
  }

  // Default: Indicate no async response
  return false;
});

// --- Action Implementations ---
function mockSyncConnections(sendResponse) {
  chrome.storage.local.get(['connections'], function(data) {
    const existing = data.connections || [];
    // Add a few mock connections if list is short (for demo)
    const mocks = (existing.length < 3) ? generateMockConnections() : [];
    const combined = [...existing];
    mocks.forEach(mock => {
        if (!combined.some(conn => conn.id === mock.id)) {
            combined.push(mock);
        }
    });
    sendResponse({ success: true, connections: combined });
  });
}

function generateMockConnections() {
    // Simple mock data
    return [
        { id: 'mock1', name: 'Demo User One', title: 'Software Engineer', avatar: '', profileUrl: '#', categories: ['cat_dev'], addedAt: Date.now() - 86400000 },
        { id: 'mock2', name: 'Demo User Two', title: 'Product Manager', avatar: '', profileUrl: '#', categories: ['cat_biz'], addedAt: Date.now() - 172800000 }
    ];
}

function exportData(sendResponse) {
  chrome.storage.local.get(['categories', 'connections', 'settings'], function(data) {
    const exportObj = {
      categories: data.categories || [],
      connections: data.connections || [],
      settings: data.settings || {},
      exportDate: new Date().toISOString(),
      version: chrome.runtime.getManifest().version
    };
    try {
      const jsonData = JSON.stringify(exportObj, null, 2); // Pretty print JSON
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      sendResponse({ success: true, url: url });
    } catch (error) {
      console.error("Export error:", error);
      sendResponse({ success: false, error: "Failed to generate export file." });
    }
  });
}

function importData(data, sendResponse) {
  try {
    // Basic validation
    if (!data || typeof data !== 'object' || !Array.isArray(data.categories) || !Array.isArray(data.connections)) {
      throw new Error('Invalid data format');
    }
    // More validation could be added here (e.g., check category/connection structure)

    chrome.storage.local.set({
      categories: data.categories,
      connections: data.connections,
      settings: data.settings || {} // Import settings if present
    }, function() {
      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }
      // Send message to potentially open popups/tabs to refresh their state
      chrome.runtime.sendMessage({ action: 'dataImported' }).catch(err => {});
      sendResponse({ success: true });
    });
  } catch (error) {
    console.error('Import error:', error);
    sendResponse({ success: false, error: error.message });
  }
}
