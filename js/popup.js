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
  }

  function renderConnections() {
    let filteredConnections = state.connections;
    if (state.filters.category !== 'all') {
      filteredConnections = filteredConnections.filter(conn => conn.categories?.includes(state.filters.category));
    }
    if (state.filters.search) {
      const searchTerm = state.filters.search.toLowerCase();
      filteredConnections = filteredConnections.filter(conn =>
        conn.name.toLowerCase().includes(searchTerm) ||
        (conn.title && conn.title.toLowerCase().includes(searchTerm))
      );
    }

    filteredConnections.sort((a, b) => {
      if (state.sort === 'name') return a.name.localeCompare(b.name);
      if (state.sort === 'recent') return (b.addedAt || 0) - (a.addedAt || 0);
      if (state.sort === 'category') return (b.categories?.length || 0) - (a.categories?.length || 0);
      return 0;
    });

    let html = '';
    if (filteredConnections.length === 0) {
      html = `<div class="empty-state"><p>No connections match filters.</p></div>`;
    } else {
      filteredConnections.forEach(connection => {
        let categoriesHTML = connection.categories?.map(catId => {
          const category = state.categories.find(c => c.id === catId);
          return category ? `<span class="category-tag" style="background-color: ${category.color}25; color: ${category.color}">${category.name}</span>` : '';
        }).join('') || '';

        html += `
          <div class="connection-item" data-id="${connection.id}" title="View ${connection.name} on LinkedIn">
            <div class="connection-avatar">
              <img src="${connection.avatar || 'assets/icons/icon48.png'}" alt="${connection.name}">
            </div>
            <div class="connection-info">
              <div class="connection-name">${connection.name}</div>
              <div class="connection-title">${connection.title || ''}</div>
              <div class="connection-categories">${categoriesHTML}</div>
            </div>
          </div>`;
      });
    }
    connectionsContainer.innerHTML = html;
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
    state.currentCategory = null;
    categoryModalTitle.textContent = 'Add New Category';
    categoryNameInput.value = '';
    categoryColorInput.value = '#0077B5'; // Default hex color
    document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelector('.icon-option[data-icon="users"]')?.classList.add('selected'); // Default icon
    categoryModal.classList.remove('hidden');
    categoryNameInput.focus();
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
      showStatusMessage('Exporting data...', 'info');
      chrome.runtime.sendMessage({ action: 'exportData' }, function(response) {
          if (response?.success && response.url) {
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = response.url;
              a.download = `linkedin-categorizer-export-${new Date().toISOString().split('T')[0]}.json`;
              document.body.appendChild(a);
              a.click();
              setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(response.url); }, 100);
              showStatusMessage('Data exported!', 'success');
          } else {
              showStatusMessage('Export failed', 'error');
          }
          setTimeout(hideStatusMessage, 2000);
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
    tabButtons.forEach(button => button.classList.toggle('active', button.getAttribute('data-tab') === tabId));
    tabContents.forEach(content => content.classList.toggle('active', content.id === tabId + '-tab'));
    settingsTabBtn.classList.toggle('active', tabId === 'settings'); // Highlight settings icon if settings tab active
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
    let iconsHTML = icons.map(icon => `
      <div class="icon-option" data-icon="${icon}" title="${icon}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${getIconPath(icon)}</svg>
      </div>`).join('');
    iconSelector.innerHTML = iconsHTML;
    iconSelector.addEventListener('click', function(e) {
        const target = e.target.closest('.icon-option');
        if (target) {
            document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
            target.classList.add('selected');
        }
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
    // Simple SVG paths - add more as needed
    switch(icon) {
      case 'code': return '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>';
      case 'briefcase': return '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>';
      case 'users': return '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>';
      case 'brain': return '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v1.77c.6.27 1.13.65 1.59 1.11A5.03 5.03 0 0 1 16 9.5c0 .88-.23 1.7-.63 2.41a5.5 5.5 0 0 1-1.16 1.68l.02.02c.7.7 1.17 1.66 1.17 2.71 0 1.05-.47 2.01-1.17 2.71l-.02.02a5.5 5.5 0 0 1-1.16 1.68C13.7 21.77 12.88 22 12 22s-1.7-.23-2.41-.63a5.5 5.5 0 0 1-1.68-1.16l-.02-.02c-.7-.7-1.17-1.66-1.17-2.71 0-1.05.47-2.01 1.17-2.71l.02-.02a5.5 5.5 0 0 1 1.16-1.68C8.23 11.2 8 10.38 8 9.5c0-1.1.43-2.1 1.11-2.89A4.49 4.49 0 0 1 10.5 5.18V4.5A2.5 2.5 0 0 1 13 2h-1.5zM12 6a3.5 3.5 0 0 0-3.5 3.5c0 .68.19 1.3.52 1.82A3.5 3.5 0 0 0 12 13a3.5 3.5 0 0 0 3.5-3.5c0-.68-.19-1.3-.52-1.82A3.5 3.5 0 0 0 12 6z"></path>'; // More detailed brain
      case 'chart': return '<path d="M3 3v18h18"></path><path d="M18 12V8"></path><path d="M14 12V6"></path><path d="M10 12V10"></path><path d="M6 12v-2"></path>';
      case 'database': return '<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>';
      case 'globe': return '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>';
      case 'message': return '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>';
      case 'phone': return '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 a19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>';
      case 'star': return '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>';
      case 'heart': return '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>';
      case 'flag': return '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>';
      default: return '<circle cx="12" cy="12" r="10"></circle>'; // Default circle
    }
  }

  // --- Load Initial Data ---
  initialize();

}); // End DOMContentLoaded
