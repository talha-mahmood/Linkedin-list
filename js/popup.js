document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const loginContainer = document.getElementById('login-container');
  const mainContainer = document.getElementById('main-container');
  const statusMessage = document.getElementById('status-message');
  const loginBtn = document.getElementById('login-btn');
  const settingsTabBtn = document.getElementById('settings-tab-btn');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const refreshBtn = document.getElementById('refresh-btn');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const addCategoryBtn = document.getElementById('add-category-btn');
  const categoriesContainer = document.getElementById('categories-container');
  const connectionsContainer = document.getElementById('connections-container');
  const categoryFilter = document.getElementById('category-filter');
  const sortSelect = document.getElementById('sort-select');
  const lastSync = document.getElementById('last-sync');
  const helpBtn = document.getElementById('help-btn');

  // Modals
  const categoryModal = document.getElementById('category-modal');
  const categoryModalTitle = document.getElementById('category-modal-title');
  const categoryNameInput = document.getElementById('category-name');
  const categoryColorInput = document.getElementById('category-color');
  const iconSelector = document.getElementById('icon-selector');
  const saveCategoryBtn = document.getElementById('save-category-btn');
  const cancelCategoryBtn = document.getElementById('cancel-category-btn');
  const closeModalBtns = document.querySelectorAll('.close-btn');
  const colorPresetsContainer = document.querySelector('.color-presets'); // Get the container

  // Settings Tab Elements
  const exportDataBtn = document.getElementById('export-data-btn');
  const importDataBtn = document.getElementById('import-data-btn');
  const importDataFile = document.getElementById('import-data');
  const themeOptions = document.querySelectorAll('.theme-option');
  const clearDataBtn = document.getElementById('clear-data-btn');

  // App State
  let state = {
    isLoggedIn: false, // Assume false initially
    categories: [],
    connections: [],
    settings: { theme: 'light' }, // Default theme
    currentCategory: null, // For editing
    filters: { category: 'all', search: '' },
    sort: 'name'
  };

  // Icons for categories
  const icons = ['code', 'briefcase', 'users', 'brain', 'chart', 'database', 'globe', 'message', 'phone', 'star', 'heart', 'flag'];

  // --- Initialization ---
  function initialize() {
    chrome.storage.local.get(['isLoggedIn', 'categories', 'connections', 'lastSync', 'settings'], function(data) {
      state.isLoggedIn = data.isLoggedIn || false; // Use stored value if available
      state.categories = data.categories || [];
      state.connections = data.connections || [];
      state.settings = data.settings || { theme: 'light' };

      if (data.lastSync) {
        const date = new Date(data.lastSync);
        lastSync.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      }

      if (state.isLoggedIn) {
        showMainView();
      } else {
        showLoginView();
      }
      setupColorPresets(); // Call setup for presets
      setupIconSelector();
      setupEventListeners();

      // Check if there are any pending category modal requests
      chrome.storage.local.get('categoryModalRequest', function(data) {
        if (data.categoryModalRequest) {
          const request = data.categoryModalRequest;
          
          // Only process recent requests (within last 30 seconds)
          if (Date.now() - request.timestamp < 30000) {
            console.log('Processing pending category modal request');
            
            // Clear the request immediately to prevent duplicate processing
            chrome.storage.local.remove('categoryModalRequest');
            
            // Open the category modal
            setTimeout(() => {
              openAddCategoryModal();
            }, 300); // Small delay to ensure the UI is ready
          } else {
            // Clean up old requests
            chrome.storage.local.remove('categoryModalRequest');
          }
        }
      });
      updateExportCategorySelector(); // Update export category selector
    });
  }

  function showLoginView() {
      loginContainer.classList.remove('hidden');
      mainContainer.classList.add('hidden');
  }

  function showMainView() {
      loginContainer.classList.add('hidden');
      mainContainer.classList.remove('hidden');
      renderCategories();
      renderConnections();
      renderCategoryFilters();
      renderSettings(); // Render settings UI
  }

  // --- UI Rendering ---
  function renderCategories() {
    let html = '';
    if (state.categories.length === 0) {
      html = `<div class="empty-state"><p>No categories yet. Click "New Category".</p></div>`;
    } else {
      state.categories.forEach(category => {
        const connectionCount = state.connections.filter(c => c.categories?.includes(category.id)).length;
        html += `
          <div class="category-item" data-id="${category.id}" title="Filter by ${category.name}">
            <div class="category-icon" style="background-color: ${category.color}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${getIconPath(category.icon)}</svg>
            </div>
            <div class="category-details">
              <div class="category-name">${category.name}</div>
              <div class="category-count">${connectionCount} connection${connectionCount !== 1 ? 's' : ''}</div>
            </div>
            <div class="category-actions">
              <button class="icon-btn edit-category-btn" title="Edit Category" data-id="${category.id}">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="icon-btn delete-category-btn" title="Delete Category" data-id="${category.id}">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>`;
      });
    }
    categoriesContainer.innerHTML = html;
    addCategoryActionListeners();
    updateExportCategorySelector(); // Update export category selector
  }

  function renderConnections() {
    let filteredConnections = state.connections;
    if (state.filters.category !== 'all') {
      filteredConnections = filteredConnections.filter(conn => conn.categories?.includes(state.filters.category));
    }
    if (state.filters.search) {
      const searchTerm = state.filters.search.toLowerCase();
      filteredConnections = filteredConnections.filter(conn =>
        (conn.profileUrl && conn.profileUrl.toLowerCase().includes(searchTerm))
      );
    }

    filteredConnections.sort((a, b) => {
      if (state.sort === 'name') {
        // Sort by profile URL if names are not available
        const urlA = a.profileUrl || "";
        const urlB = b.profileUrl || "";
        return urlA.localeCompare(urlB);
      }
      if (state.sort === 'recent') return (b.addedAt || 0) - (a.addedAt || 0);
      if (state.sort === 'category') return (b.categories?.length || 0) - (a.categories?.length || 0);
      return 0;
    });

    let html = '';
    if (filteredConnections.length === 0) {
      html = `<div class="empty-state"><p>No connections match filters.</p></div>`;
    } else {
      filteredConnections.forEach(connection => {
        // Remove the displayName variable and name display entirely
        
        // Get category names for this connection
        let categoriesHTML = '';
        if (connection.categories && connection.categories.length > 0) {
          categoriesHTML = connection.categories.map(catId => {
            const category = state.categories.find(c => c.id === catId);
            return category ? 
              `<span class="category-tag" style="background-color: ${category.color}25; color: ${category.color}">${category.name}</span>` : 
              '';
          }).join('');
        }

        // Generate the connection item HTML without the name
        html += `
          <div class="connection-item" data-id="${connection.id || ''}" title="${connection.profileUrl || ''}">
            <div class="connection-info">
              <div class="connection-url">
                <a href="${connection.profileUrl || '#'}" target="_blank">
                  ${connection.profileUrl ? connection.profileUrl.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//i, '') : 'No URL'}
                </a>
              </div>
              <div class="connection-categories">${categoriesHTML || '<span class="no-categories">No categories</span>'}</div>
            </div>
          </div>`;
      });
    }
    connectionsContainer.innerHTML = html;
    
    // Update stats if available
    if (document.getElementById('export-connections-count')) {
      document.getElementById('export-connections-count').textContent = state.connections.length;
    }
    if (document.getElementById('export-categories-count')) {
      document.getElementById('export-categories-count').textContent = state.categories.length;
    }
    
    addConnectionActionListeners();
  }

  function renderCategoryFilters() {
    let html = '<label><input type="checkbox" value="all" ${state.filters.category === "all" ? "checked" : ""}> All Categories</label>';
    state.categories.forEach(category => {
      html += `
        <label>
          <input type="checkbox" value="${category.id}" ${state.filters.category === category.id ? 'checked' : ''}>
          <span class="category-color" style="background-color: ${category.color}"></span>
          ${category.name}
        </label>`;
    });
    categoryFilter.innerHTML = html;
    addCategoryFilterListeners();
  }

  function renderSettings() {
      themeOptions.forEach(option => {
          option.classList.toggle('selected', option.getAttribute('data-theme') === state.settings.theme);
      });
      applyTheme(state.settings.theme);
  }

  // --- Event Handling Setup ---
  function setupEventListeners() {
    console.log('Setting up event listeners...'); // Log: Start setup
    loginBtn.addEventListener('click', handleLogin);
    settingsTabBtn.addEventListener('click', () => switchTab('settings'));
    tabButtons.forEach(button => button.addEventListener('click', handleTabClick));
    refreshBtn.addEventListener('click', handleRefresh);
    searchInput.addEventListener('keyup', handleSearch);
    searchBtn.addEventListener('click', handleSearch);
    addCategoryBtn.addEventListener('click', openAddCategoryModal);
    saveCategoryBtn.addEventListener('click', saveCategory);
    cancelCategoryBtn.addEventListener('click', closeModals);

    // Ensure listener is attached to ALL close buttons found
    console.log(`Found ${closeModalBtns.length} elements with class 'close-btn'.`); // Log: How many buttons found
    closeModalBtns.forEach((btn, index) => {
        // Log which specific button we are attaching to
        console.log(`Attaching close listener to button #${index + 1}`, btn);
        btn.addEventListener('click', closeModals);
    });

    sortSelect.addEventListener('change', handleSortChange);
    helpBtn.addEventListener('click', showHelp);
    window.addEventListener('click', handleWindowClickForModals);

    // Settings listeners
    exportDataBtn.addEventListener('click', handleExportData);
    importDataBtn.addEventListener('click', () => importDataFile.click());
    importDataFile.addEventListener('change', handleImportData);
    clearDataBtn.addEventListener('click', handleClearData);
    themeOptions.forEach(option => option.addEventListener('click', handleThemeChange));
    console.log('Event listeners setup complete.'); // Log: End setup
  }

  function addCategoryActionListeners() {
      document.querySelectorAll('.category-item').forEach(item => item.addEventListener('click', handleCategoryItemClick));
      document.querySelectorAll('.edit-category-btn').forEach(btn => btn.addEventListener('click', handleEditCategoryClick));
      document.querySelectorAll('.delete-category-btn').forEach(btn => btn.addEventListener('click', handleDeleteCategoryClick));
  }

  function addConnectionActionListeners() {
      document.querySelectorAll('.connection-item').forEach(item => item.addEventListener('click', handleConnectionItemClick));
  }

  function addCategoryFilterListeners() {
      categoryFilter.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.addEventListener('change', handleCategoryFilterChange));
  }

  // --- Event Handlers ---
  function handleLogin() {
    showStatusMessage('Connecting (Mock)...', 'info');
    // Simulate login success
    setTimeout(() => {
      state.isLoggedIn = true;
      chrome.storage.local.set({ isLoggedIn: true }, () => {
          showMainView();
          showStatusMessage('Connected!', 'success');
          setTimeout(hideStatusMessage, 1500);
      });
    }, 500);
  }

  function handleTabClick(e) {
      switchTab(e.target.getAttribute('data-tab'));
  }

  function handleRefresh() {
    showStatusMessage('Syncing connections (Mock)...', 'info');
    chrome.runtime.sendMessage({ action: 'syncConnections' }, function(response) {
      if (response && response.success) {
        state.connections = response.connections;
        const now = Date.now();
        chrome.storage.local.set({ connections: state.connections, lastSync: now });
        lastSync.textContent = new Date(now).toLocaleTimeString();
        renderConnections();
        showStatusMessage('Connections synced!', 'success');
      } else {
        showStatusMessage('Sync failed.', 'error');
      }
      setTimeout(hideStatusMessage, 1500);
    });
  }

  function handleSearch() {
    state.filters.search = searchInput.value;
    renderConnections();
  }

  function handleSortChange(e) {
      state.sort = e.target.value;
      renderConnections();
  }

  function handleCategoryItemClick(e) {
      // Prevent triggering edit/delete when clicking the item itself
      if (e.target.closest('.icon-btn')) return;
      const categoryId = e.currentTarget.getAttribute('data-id');
      state.filters.category = categoryId;
      switchTab('connections');
      renderCategoryFilters(); // Update filter checkboxes
      renderConnections();
  }

  function handleEditCategoryClick(e) {
      e.stopPropagation(); // Prevent category item click
      const categoryId = e.currentTarget.getAttribute('data-id');
      const category = state.categories.find(c => c.id === categoryId);
      if (category) openEditCategoryModal(category);
  }

  function handleDeleteCategoryClick(e) {
      e.stopPropagation(); // Prevent category item click
      const categoryId = e.currentTarget.getAttribute('data-id');
      deleteCategory(categoryId);
  }

  function handleConnectionItemClick(e) {
      const connectionId = e.currentTarget.getAttribute('data-id');
      const connection = state.connections.find(c => c.id === connectionId);
      if (connection?.profileUrl) {
          chrome.tabs.create({ url: connection.profileUrl });
      }
  }

  function handleCategoryFilterChange(e) {
      const checkbox = e.target;
      if (checkbox.value === 'all') {
          if (checkbox.checked) {
              categoryFilter.querySelectorAll('input:not([value="all"])').forEach(cb => cb.checked = false);
              state.filters.category = 'all';
          } else {
              checkbox.checked = true; // Cannot uncheck 'All' directly
          }
      } else {
          if (checkbox.checked) {
              categoryFilter.querySelector('input[value="all"]').checked = false;
              // Allow multiple category filtering? For now, single select:
              categoryFilter.querySelectorAll('input:not([value="all"])').forEach(cb => {
                  if (cb !== checkbox) cb.checked = false;
              });
              state.filters.category = checkbox.value;
          } else {
              // If unchecking the last specific category, check 'All'
              const anyChecked = Array.from(categoryFilter.querySelectorAll('input:not([value="all"])')).some(cb => cb.checked);
              if (!anyChecked) {
                  categoryFilter.querySelector('input[value="all"]').checked = true;
                  state.filters.category = 'all';
              }
          }
      }
      renderConnections();
  }

  function handleWindowClickForModals(event) {
      if (event.target === categoryModal) closeModals();
  }

  function handleThemeChange(e) {
      const theme = e.currentTarget.getAttribute('data-theme');
      state.settings.theme = theme;
      saveSettings();
      renderSettings();
  }

  // --- Category Management ---
  function openAddCategoryModal() {
    const categoryModal = document.getElementById('category-modal');
    const categoryNameInput = document.getElementById('category-name');
    const categoryColorInput = document.getElementById('category-color');
    
    if (!categoryModal) {
      console.error('Category modal not found!');
      return;
    }
    
    state.currentCategory = null;
    
    if (document.getElementById('category-modal-title')) {
      document.getElementById('category-modal-title').textContent = 'Add New Category';
    }
    
    if (categoryNameInput) {
      categoryNameInput.value = '';
    }
    
    if (categoryColorInput) {
      categoryColorInput.value = '#0077B5'; // Default color
    }
    
    // Reset icon selection
    const iconOptions = document.querySelectorAll('.icon-option');
    iconOptions.forEach(opt => opt.classList.remove('selected'));
    
    // Select default icon
    const defaultIcon = document.querySelector('.icon-option[data-icon="users"]');
    if (defaultIcon) {
      defaultIcon.classList.add('selected');
    } else if (iconOptions.length > 0) {
      // If specific icon not found, select the first one
      iconOptions[0].classList.add('selected');
    }
    
    // Show the modal
    categoryModal.classList.remove('hidden');
    
    // Focus on name input if it exists
    if (categoryNameInput) {
      categoryNameInput.focus();
    }
    
    console.log('Category modal opened');
  }

  function openEditCategoryModal(category) {
    state.currentCategory = category;
    categoryModalTitle.textContent = 'Edit Category';
    categoryNameInput.value = category.name;
    categoryColorInput.value = category.color;
    document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelector(`.icon-option[data-icon="${category.icon}"]`)?.classList.add('selected');
    categoryModal.classList.remove('hidden');
    categoryNameInput.focus();
  }

  function saveCategory() {
    const selectedIconEl = document.querySelector('.icon-option.selected');
    const icon = selectedIconEl ? selectedIconEl.getAttribute('data-icon') : 'users';
    const name = categoryNameInput.value.trim();
    const color = categoryColorInput.value;

    if (!name) {
      showStatusMessage('Category name is required', 'error');
      return;
    }

    const category = {
      id: state.currentCategory ? state.currentCategory.id : Date.now().toString(),
      name: name,
      color: color,
      icon: icon
    };

    if (state.currentCategory) {
      state.categories = state.categories.map(c => c.id === category.id ? category : c);
    } else {
      state.categories.push(category);
    }

    chrome.storage.local.set({ categories: state.categories }, function() {
      renderCategories();
      renderCategoryFilters();
      closeModals();
      showStatusMessage('Category saved!', 'success');
      setTimeout(hideStatusMessage, 1500);
    });
  }

  function deleteCategory(categoryId) {
    if (confirm('Are you sure you want to delete this category? Connections will be removed from it.')) {
      state.categories = state.categories.filter(c => c.id !== categoryId);
      state.connections = state.connections.map(conn => {
        conn.categories = conn.categories?.filter(id => id !== categoryId);
        return conn;
      });

      chrome.storage.local.set({ categories: state.categories, connections: state.connections }, function() {
        renderCategories();
        renderConnections();
        renderCategoryFilters();
        showStatusMessage('Category deleted', 'success');
        setTimeout(hideStatusMessage, 1500);
      });
    }
  }

  function closeModals(event) {
    console.log('closeModals function called.'); // Log when the function is called
    if (event) {
        console.log('Clicked element:', event.target); // Log the element that triggered the function
    }
    categoryModal.classList.add('hidden');
    state.currentCategory = null;
  }

  // --- Settings Handlers ---
  function saveSettings() {
      chrome.storage.local.set({ settings: state.settings }, function() {
          console.log('Settings saved');
          // Optional: show brief confirmation
      });
  }

  function applyTheme(theme) {
      document.body.setAttribute('data-theme', theme);
      console.log(`Applying theme: ${theme}`);
  }

  function handleExportData() {
      showStatusMessage('Preparing export...', 'info');
      
      // Get the selected category ID
      const exportCategorySelect = document.getElementById('export-category');
      const selectedCategoryId = exportCategorySelect ? exportCategorySelect.value : 'all';
      
      // Count connections for the selected category
      let connectionCount = state.connections.length;
      if (selectedCategoryId !== 'all') {
        connectionCount = state.connections.filter(conn => 
          conn.categories?.includes(selectedCategoryId)
        ).length;
        
        // Check if there are any connections in this category
        if (connectionCount === 0) {
          showStatusMessage('No connections in the selected category to export', 'error');
          setTimeout(hideStatusMessage, 2000);
          return;
        }
      } else if (connectionCount === 0) {
        showStatusMessage('No connections to export', 'error');
        setTimeout(hideStatusMessage, 2000);
        return;
      }
      
      // Send request to export with the selected category
      chrome.runtime.sendMessage({ 
        action: 'exportData',
        categoryId: selectedCategoryId
      }, function(response) {
        if (response?.success && response.data) {
          // Create a blob from the data in the popup context
          const blob = new Blob([response.data], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          
          // Create and trigger download link
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = response.filename;
          document.body.appendChild(a);
          a.click();
          
          // Cleanup
          setTimeout(() => { 
            document.body.removeChild(a); 
            URL.revokeObjectURL(url); 
          }, 100);
          
          showStatusMessage(`Exported ${response.count} connections from "${response.category}"`, 'success');
        } else {
          showStatusMessage('Export failed: ' + (response?.error || 'Unknown error'), 'error');
        }
        setTimeout(hideStatusMessage, 3000);
      });
  }

  function handleImportData(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
          try {
              const data = JSON.parse(e.target.result);
              if (!data.categories || !Array.isArray(data.categories) || !data.connections || !Array.isArray(data.connections)) {
                  throw new Error('Invalid data format');
              }
              chrome.runtime.sendMessage({ action: 'importData', data: data }, function(response) {
                  if (response?.success) {
                      initialize(); // Reload state
                      showStatusMessage('Data imported successfully! Reloading...', 'success');
                  } else {
                      showStatusMessage(`Import failed: ${response?.error || 'Unknown error'}`, 'error');
                  }
              });
          } catch (error) { showStatusMessage(`Import failed: ${error.message}`, 'error'); }
          importDataFile.value = ''; // Reset file input
      };
      reader.onerror = () => { showStatusMessage('Failed to read file', 'error'); importDataFile.value = ''; };
      reader.readAsText(file);
  }

  function handleClearData() {
      if (confirm('WARNING: Delete all categories and connections? This cannot be undone.')) {
          chrome.storage.local.set({ categories: [], connections: [] }, function() {
              state.categories = [];
              state.connections = [];
              initialize(); // Reload UI
              showStatusMessage('All data cleared!', 'success');
              setTimeout(hideStatusMessage, 2000);
          });
      }
  }

  // --- Utility Functions ---
  function switchTab(tabId) {
    console.log(`Switching to tab: ${tabId}`);
    
    // Verify elements exist
    const allTabButtons = document.querySelectorAll('.tab-btn');
    const allTabContents = document.querySelectorAll('.tab-content');
    const settingsButton = document.getElementById('settings-tab-btn');
    
    if (allTabButtons.length === 0) {
      console.error('No tab buttons found!');
    }
    
    if (allTabContents.length === 0) {
      console.error('No tab content elements found!');
    }
    
    // Set active class on appropriate tab button
    allTabButtons.forEach(button => {
      const buttonTab = button.getAttribute('data-tab');
      if (buttonTab === tabId) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Set active class on appropriate tab content
    allTabContents.forEach(content => {
      if (content.id === `${tabId}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
    
    // Handle settings tab button separately if it exists
    if (settingsButton) {
      if (tabId === 'settings') {
        settingsButton.classList.add('active');
      } else {
        settingsButton.classList.remove('active');
      }
    }
  }

  function showStatusMessage(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.classList.remove('hidden');
  }

  function hideStatusMessage() {
    statusMessage.classList.add('hidden');
  }

  function showHelp() {
    chrome.tabs.create({ url: 'help.html' });
  }

  function setupIconSelector() {
    const iconSelector = document.getElementById('icon-selector');
    // Check if the element exists before trying to set its innerHTML
    if (!iconSelector) {
      console.error('Icon selector element not found! Check HTML structure.');
      return; // Exit the function if the element doesn't exist
    }
    
    let iconsHTML = icons.map(icon => `
      <div class="icon-option" data-icon="${icon}" title="${icon}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${getIconPath(icon)}</svg>
      </div>`).join('');
    
    iconSelector.innerHTML = iconsHTML;
    
    // Add click event listeners to icon options
    iconSelector.querySelectorAll('.icon-option').forEach(option => {
      option.addEventListener('click', function() {
        // Remove selected class from all options
        iconSelector.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
        // Add selected class to clicked option
        this.classList.add('selected');
      });
    });
  }

  function setupColorPresets() {
    const presets = ['#0077B5', '#2ECC71', '#E74C3C', '#F39C12', '#9B59B6', '#34495E']; // Store as hex
    let presetsHTML = presets.map(hexColor => `
        <span class="color-preset" data-color="${hexColor}" style="background-color: ${hexColor}"></span>
    `).join('');
    colorPresetsContainer.innerHTML = presetsHTML;

    // Add listener to the container using event delegation
    colorPresetsContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('color-preset')) {
            const hexColor = e.target.getAttribute('data-color');
            if (hexColor) {
                categoryColorInput.value = hexColor; // Set input value directly to hex
            }
        }
    });
  }

  function getIconPath(icon) {
    switch(icon) {
      case 'briefcase': 
        return '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>';
      case 'users': 
        return '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>';
      case 'code':
        return '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>';
      case 'brain':
        return '<circle cx="12" cy="12" r="9"></circle><path d="M12 17v-2"></path><path d="M12 9V7"></path>';
      case 'chart':
        return '<path d="M3 3v18h18"></path><path d="M18 12V8"></path><path d="M14 12V6"></path><path d="M10 12V10"></path><path d="M6 12v-2"></path>';
      case 'database':
        return '<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>';
      case 'globe':
        return '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>';
      case 'message':
        return '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>';
      case 'phone':
        return '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>';
      case 'star':
        return '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>';
      case 'heart':
        return '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>';
      case 'flag':
        return '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>';
      default:
        return '<circle cx="12" cy="12" r="10"></circle>'; // Default circle as fallback
    }
  }

  function updateExportCategorySelector() {
    const exportCategorySelect = document.getElementById('export-category');
    if (!exportCategorySelect) return;
    
    // Save current selection if it exists
    const currentSelection = exportCategorySelect.value || 'all';
    
    // Build options HTML
    let optionsHtml = '<option value="all">All Categories</option>';
    
    state.categories.forEach(category => {
      const connectionCount = state.connections.filter(c => c.categories?.includes(category.id)).length;
      optionsHtml += `<option value="${category.id}">${category.name} (${connectionCount})</option>`;
    });
    
    exportCategorySelect.innerHTML = optionsHtml;
    
    // Try to restore previous selection if it still exists
    if (currentSelection) {
      const optionExists = Array.from(exportCategorySelect.options).some(opt => opt.value === currentSelection);
      if (optionExists) {
        exportCategorySelect.value = currentSelection;
      }
    }
  }

  // Add this function to handle API calls safely
  function safeApiCall(fn) {
    try {
      return fn();
    } catch (error) {
      console.error('API call error:', error);
      return null;
    }
  }

  // --- Load Initial Data ---
  initialize();

}); // End DOMContentLoaded
