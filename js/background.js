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
    console.log("Request to open category modal received.");
    
    // Store the request data temporarily in storage for the popup to access
    chrome.storage.local.set({
      categoryModalRequest: {
        timestamp: Date.now(),
        fromProfileId: request.fromProfileId,
        profileData: request.profileData,
        source: request.source || 'unknown'
      }
    }, () => {
      // Try to open the popup programmatically (will work in some browsers)
      try {
        // This works in some browsers but may fail in others
        chrome.action.openPopup().catch(err => {
          console.log("Could not open popup automatically");
        });
      } catch (err) {
        console.log("Browser doesn't support programmatic popup opening");
      }
      
      // Signal success back to content script
      sendResponse({ 
        success: true, 
        message: "Category modal request registered. Extension popup may need to be opened manually."
      });
    });
    
    return true; // Indicates async response
  }

  if (request.action === 'exportData') {
    exportData(request.categoryId, sendResponse);
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

function exportData(categoryId, sendResponse) {
  chrome.storage.local.get(['categories', 'connections'], function(data) {
    // Get the selected category if specified
    const selectedCategory = categoryId && categoryId !== 'all' ? 
      data.categories?.find(c => c.id === categoryId) : null;
    
    // If exporting a single category
    if (selectedCategory) {
      // Create a simpler export format with just URLs
      const exportData = {
        timestamp: new Date().toISOString(),
        category: selectedCategory.name,
        urls: []
      };
      
      // Filter connections for this category and extract just the URLs
      const filteredConnections = data.connections?.filter(conn => 
        conn.categories && conn.categories.includes(categoryId)
      ) || [];
      
      // Add only the URLs to the export data
      filteredConnections.forEach(connection => {
        if (connection.profileUrl) {
          exportData.urls.push(connection.profileUrl);
        }
      });
      
      try {
        const jsonData = JSON.stringify(exportData, null, 2);
        const date = new Date();
        const dateString = date.toISOString().split('T')[0];
        const categorySlug = selectedCategory.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const filename = `linkedin-${categorySlug}-urls-${dateString}.json`;
        
        sendResponse({
          success: true,
          data: jsonData,
          filename: filename,
          count: exportData.urls.length,
          category: selectedCategory.name
        });
      } catch (error) {
        console.error("Export error:", error);
        sendResponse({
          success: false,
          error: "Failed to generate export file: " + error.message
        });
      }
    } 
    // If exporting all categories
    else {
      // Create an object with categories as keys and arrays of URLs as values
      const exportData = {
        timestamp: new Date().toISOString(),
        categories: {}
      };
      
      // Initialize empty arrays for each category
      data.categories?.forEach(category => {
        exportData.categories[category.name] = [];
      });
      
      // Add URLs to the appropriate categories
      data.connections?.forEach(connection => {
        if (connection.profileUrl && connection.categories) {
          connection.categories.forEach(catId => {
            const category = data.categories?.find(c => c.id === catId);
            if (category && category.name) {
              exportData.categories[category.name].push(connection.profileUrl);
            }
          });
        }
      });
      
      try {
        const jsonData = JSON.stringify(exportData, null, 2);
        const date = new Date();
        const dateString = date.toISOString().split('T')[0];
        const filename = `linkedin-all-categories-urls-${dateString}.json`;
        
        // Count total URLs
        let totalUrls = 0;
        Object.values(exportData.categories).forEach(urls => {
          totalUrls += urls.length;
        });
        
        sendResponse({
          success: true,
          data: jsonData,
          filename: filename,
          count: totalUrls,
          category: "All Categories"
        });
      } catch (error) {
        console.error("Export error:", error);
        sendResponse({
          success: false,
          error: "Failed to generate export file: " + error.message
        });
      }
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
