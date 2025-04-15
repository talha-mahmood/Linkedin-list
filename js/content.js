(function() {
  // Constants
  const EXTENSION_PREFIX = 'lnc'; // LinkedIn Network Categorizer

  // State
  let state = {
    categories: [],
    connections: [],
    currentProfileId: null,
    panelVisible: false
  };

  // --- Initialization ---
  function initialize() {
    chrome.storage.local.get(['categories', 'connections'], function(data) {
      state.categories = data.categories || [];
      state.connections = data.connections || [];
      observePageChanges();
      checkForProfilePage(); // Initial check
    });
    chrome.runtime.onMessage.addListener(handleMessages);
  }

  // --- Event Handling & Observation ---
  function handleMessages(message, sender, sendResponse) {
    if (message.action === 'categoriesUpdated' || message.action === 'connectionsUpdated') {
      chrome.storage.local.get(['categories', 'connections'], function(data) {
        state.categories = data.categories || [];
        state.connections = data.connections || [];
        if (state.panelVisible) {
          updateCategoryPanel(); // Refresh panel if open
        }
      });
    }
  }

  function observePageChanges() {
    const observer = new MutationObserver(mutations => {
      // Use requestAnimationFrame to avoid excessive checks during rapid DOM changes
      window.requestAnimationFrame(checkForProfilePage);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Listen for SPA navigation events if MutationObserver is insufficient
    window.addEventListener('popstate', checkForProfilePage);
    // Potentially add listeners for pushState/replaceState if needed
  }

  function checkForProfilePage() {
    const currentUrl = window.location.href;
    const profileMatch = currentUrl.match(/linkedin\.com\/in\/([^\/?#]+)/);

    if (profileMatch && profileMatch[1]) {
      const profileId = profileMatch[1];
      if (profileId !== state.currentProfileId) {
         state.currentProfileId = profileId;
         hidePanel();
      }

      if (!document.getElementById(`${EXTENSION_PREFIX}-categorize-btn`)) {
        // Updated and expanded selectors - Check LinkedIn's current structure if these fail
        const potentialSelectors = [
            '.pvs-profile-actions',                                  // Primary modern selector
            'div.pv-top-card-v2__actions',                           // Another common top card actions container
            'div.pv-top-card__button-container',                     // Older structure
            'div[data-control-name="profile_topcard_primary_actions"]', // Attribute selector
            // Find a container near the 'Connect' or 'Message' button as a fallback
            'button[aria-label*="Invite"][aria-label*="to connect"]',
            'button[aria-label*="Send message"]',
            'button[aria-label*="Follow"]',
            'button[aria-label*="More actions"]'
        ];

        waitForElement(potentialSelectors.join(', '), 7000).then(foundElement => { // Increased timeout slightly
            let actionsContainer = null;

            // If we found a button, try to get its parent container
            if (foundElement.tagName === 'BUTTON') {
                // Look for a common parent div that holds multiple action buttons
                actionsContainer = foundElement.closest('.pvs-profile-actions, .pv-top-card-v2__actions, .pv-top-card__button-container');
                // If specific containers aren't found, just use the button's direct parent
                if (!actionsContainer) {
                    actionsContainer = foundElement.parentElement;
                }
            } else {
                // If we found a container directly
                actionsContainer = foundElement;
            }

            // Final check if we have a valid container
            if (actionsContainer && actionsContainer.tagName !== 'BODY' && !document.getElementById(`${EXTENSION_PREFIX}-categorize-btn`)) {
                insertCategorizeButton(actionsContainer);
            } else if (!actionsContainer) {
                console.warn(`${EXTENSION_PREFIX}: Could not reliably find a suitable container for the categorize button.`);
            }
        }).catch(err => {
           console.error(`${EXTENSION_PREFIX}: Error finding profile actions container using selectors: ${potentialSelectors.join(', ')}`, err);
        });
      }
    } else {
      if (state.currentProfileId) {
          state.currentProfileId = null;
          hidePanel(); // Hide panel when navigating away
      }
      const catButton = document.getElementById(`${EXTENSION_PREFIX}-categorize-btn`);
      if (catButton) catButton.remove();
    }
  }

  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) return resolve(element);

      let observer; // Declare observer variable
      const timeoutId = setTimeout(() => {
        if (observer) observer.disconnect(); // Check if observer exists before disconnecting
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);

      observer = new MutationObserver(mutations => { // Assign observer here
        const element = document.querySelector(selector);
        if (element) {
          clearTimeout(timeoutId);
          observer.disconnect();
          resolve(element);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // --- UI Injection ---
  function insertCategorizeButton(container) {
    const button = document.createElement('button');
    button.id = `${EXTENSION_PREFIX}-categorize-btn`;
    button.className = `${EXTENSION_PREFIX}-categorizer-btn artdeco-button artdeco-button--secondary artdeco-button--muted`; // Use LinkedIn classes
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" data-supported-dps="16x16" fill="currentColor" class="mercado-match" width="16" height="16" focusable="false">
        <path d="M10 1L9 0H2a1 1 0 00-1 1v11a1 1 0 001 1h1V3a1 1 0 011-1h6zm5 2H5a1 1 0 00-1 1v11a1 1 0 001 1h10a1 1 0 001-1V4a1 1 0 00-1-1zM8 6h5v1H8zm5 3H8v1h5zM8 11h5v1H8z"></path>
      </svg>
      <span class="artdeco-button__text">Categorize</span>`; // Use LinkedIn text class
    button.addEventListener('click', toggleCategoryPanel);

    // Try to insert intelligently relative to existing buttons
    const moreButton = container.querySelector('button[aria-label*="More actions"]');
    const connectButton = container.querySelector('button[aria-label*="Invite"][aria-label*="to connect"], button[aria-label*="Send message"], button[aria-label*="Follow"]');

    if (moreButton && moreButton.parentElement === container) {
        // Insert before the 'More' button if possible
        container.insertBefore(button, moreButton);
    } else if (connectButton && connectButton.parentElement === container) {
        // Otherwise, insert after the primary action button
        container.insertBefore(button, connectButton.nextSibling);
    } else {
        // Fallback: append to the end
        container.appendChild(button);
    }
  }

  function toggleCategoryPanel(e) {
    if (e) e.preventDefault();
    if (state.panelVisible) {
      hidePanel();
    } else {
      // Reload categories/connections before showing
      chrome.storage.local.get(['categories', 'connections'], function(data) {
          state.categories = data.categories || [];
          state.connections = data.connections || [];
          showPanel();
      });
    }
  }

  function showPanel() {
    hidePanel(); // Ensure only one panel exists

    const panel = document.createElement('div');
    panel.id = `${EXTENSION_PREFIX}-categorizer-panel`;
    panel.className = `${EXTENSION_PREFIX}-categorizer-panel`;

    const profileData = extractProfileData();
    const connection = state.connections.find(c => c.id === state.currentProfileId) || {
      id: state.currentProfileId,
      name: profileData.name,
      title: profileData.title,
      avatar: profileData.avatar,
      profileUrl: window.location.href,
      categories: [],
      notes: '',
      addedAt: Date.now()
    };

    panel.innerHTML = `
      <div class="${EXTENSION_PREFIX}-panel-header">
        <h3>Categorize Connection</h3>
        <button class="${EXTENSION_PREFIX}-panel-close">&times;</button>
      </div>
      <div class="${EXTENSION_PREFIX}-panel-body">
        <div class="${EXTENSION_PREFIX}-connection-info">
          <div class="${EXTENSION_PREFIX}-connection-avatar">
            <img src="${profileData.avatar || chrome.runtime.getURL('assets/icons/icon48.png')}" alt="${profileData.name}">
          </div>
          <div class="${EXTENSION_PREFIX}-connection-details">
            <div class="${EXTENSION_PREFIX}-connection-name">${profileData.name}</div>
            <div class="${EXTENSION_PREFIX}-connection-title">${profileData.title || ''}</div>
          </div>
        </div>
        <div class="${EXTENSION_PREFIX}-category-section">
          <div class="${EXTENSION_PREFIX}-section-header">
            <div class="${EXTENSION_PREFIX}-section-title">Categories</div>
            <button class="${EXTENSION_PREFIX}-create-btn">+ Create New</button>
          </div>
          <div class="${EXTENSION_PREFIX}-category-list" id="${EXTENSION_PREFIX}-category-list">
            ${generateCategoryCheckboxes(connection.categories)}
          </div>
        </div>
        <div class="${EXTENSION_PREFIX}-notes-section">
          <div class="${EXTENSION_PREFIX}-section-header">
            <div class="${EXTENSION_PREFIX}-section-title">Notes</div>
          </div>
          <textarea class="${EXTENSION_PREFIX}-notes-input" placeholder="Add notes...">${connection.notes || ''}</textarea>
        </div>
      </div>
      <div class="${EXTENSION_PREFIX}-panel-footer">
        <button class="${EXTENSION_PREFIX}-cancel-btn artdeco-button artdeco-button--secondary">Cancel</button>
        <button class="${EXTENSION_PREFIX}-save-btn artdeco-button artdeco-button--primary">Save</button>
      </div>`;

    document.body.appendChild(panel);

    panel.querySelector(`.${EXTENSION_PREFIX}-panel-close`).addEventListener('click', hidePanel);
    panel.querySelector(`.${EXTENSION_PREFIX}-cancel-btn`).addEventListener('click', hidePanel);
    panel.querySelector(`.${EXTENSION_PREFIX}-save-btn`).addEventListener('click', saveConnection);
    panel.querySelector(`.${EXTENSION_PREFIX}-create-btn`).addEventListener('click', openCreateCategoryModal);

    state.panelVisible = true;
  }

  function hidePanel() {
    const panel = document.getElementById(`${EXTENSION_PREFIX}-categorizer-panel`);
    if (panel) panel.remove();
    state.panelVisible = false;
  }

  function updateCategoryPanel() {
      const categoryList = document.getElementById(`${EXTENSION_PREFIX}-category-list`);
      if (!categoryList) return;
      const connection = state.connections.find(c => c.id === state.currentProfileId) || { categories: [] };
      categoryList.innerHTML = generateCategoryCheckboxes(connection.categories);
  }

  // --- Data Handling ---
  function extractProfileData() {
    let name = '', title = '', avatar = '';
    // Use more specific selectors based on current LinkedIn structure
    const nameElement = document.querySelector('h1.text-heading-xlarge');
    const titleElement = document.querySelector('div.text-body-medium.break-words');
    const avatarElement = document.querySelector('.pv-top-card-profile-picture__image, .profile-photo-edit__preview');

    if (nameElement) name = nameElement.textContent.trim();
    if (titleElement) title = titleElement.textContent.trim();
    if (avatarElement) avatar = avatarElement.src || avatarElement.style.backgroundImage.slice(5, -2); // Handle src or background-image

    return { name, title, avatar };
  }

  function generateCategoryCheckboxes(selectedCategories = []) {
    if (state.categories.length === 0) {
      return '<p class="lnc-no-categories">No categories created yet. Click "+ Create New".</p>';
    }
    return state.categories.map(category => `
      <div class="${EXTENSION_PREFIX}-category-item">
        <input type="checkbox" id="${EXTENSION_PREFIX}-cat-${category.id}" class="${EXTENSION_PREFIX}-category-checkbox"
          data-category-id="${category.id}" ${selectedCategories.includes(category.id) ? 'checked' : ''}>
        <label for="${EXTENSION_PREFIX}-cat-${category.id}" class="${EXTENSION_PREFIX}-category-label">
          <span class="${EXTENSION_PREFIX}-category-color" style="background-color: ${category.color}"></span>
          ${category.name}
        </label>
      </div>`).join('');
  }

  function saveConnection() {
    const selectedCategories = Array.from(document.querySelectorAll(`.${EXTENSION_PREFIX}-category-checkbox:checked`))
                                  .map(cb => cb.getAttribute('data-category-id'));
    const notes = document.querySelector(`.${EXTENSION_PREFIX}-notes-input`).value;
    const profileData = extractProfileData(); // Re-extract in case it changed

    const connection = {
      id: state.currentProfileId,
      name: profileData.name,
      title: profileData.title,
      avatar: profileData.avatar,
      profileUrl: window.location.href,
      categories: selectedCategories,
      notes: notes,
      addedAt: state.connections.find(c => c.id === state.currentProfileId)?.addedAt || Date.now(), // Preserve addedAt if exists
      updatedAt: Date.now()
    };

    const existingIndex = state.connections.findIndex(c => c.id === state.currentProfileId);
    if (existingIndex >= 0) {
      state.connections[existingIndex] = connection;
    } else {
      state.connections.push(connection);
    }

    chrome.storage.local.set({ connections: state.connections }, function() {
      showToast('Connection categorized successfully!');
      hidePanel();
      // Notify popup if open
      chrome.runtime.sendMessage({ action: 'connectionsUpdated' }).catch(err => {});
    });
  }

  function openCreateCategoryModal() {
    // Send message to background/popup to handle opening the modal
    chrome.runtime.sendMessage({ action: 'openCategoryModal' });
  }

  function showToast(message, type = 'success') {
    let toast = document.getElementById(`${EXTENSION_PREFIX}-toast`);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = `${EXTENSION_PREFIX}-toast`;
      // Apply styles via CSS class instead of inline styles
      toast.className = `${EXTENSION_PREFIX}-toast`;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove('success', 'error', 'info', 'show'); // Reset classes
    toast.classList.add(type, 'show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // --- Start ---
  initialize();

})();
