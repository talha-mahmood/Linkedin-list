(function() {
  // Constants
  const EXTENSION_PREFIX = 'lnc'; // LinkedIn Network Categorizer
  const BUTTON_ID = `${EXTENSION_PREFIX}-categorize-btn`;

  // State
  let state = {
    categories: [],
    connections: [],
    currentProfileId: null,
    panelVisible: false
  };

  // --- Helper Functions ---
  function safeCallChromeAPI(apiCall, fallback = null, logError = true) {
    try {
      return apiCall();
    } catch (error) {
      if (error.message.includes("Extension context invalidated")) {
        if (logError) console.log(`${EXTENSION_PREFIX}: Extension context invalidated - please refresh the page.`);
        showPageRefreshNotice();
        return fallback;
      } else if (logError) {
        console.error(`${EXTENSION_PREFIX}: Chrome API error:`, error);
      }
      return fallback;
    }
  }

  function showPageRefreshNotice() {
    if (document.getElementById(`${EXTENSION_PREFIX}-refresh-notice`)) return;

    const notice = document.createElement('div');
    notice.id = `${EXTENSION_PREFIX}-refresh-notice`;
    notice.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: #0a66c2;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 9999;
      font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 280px;
    `;
    notice.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: 600;">LinkedIn Categorizer</div>
      <div>Extension has been updated. Please refresh the page to continue using the categorizer.</div>
      <div style="margin-top: 10px; text-align: right;">
        <button id="${EXTENSION_PREFIX}-refresh-page-btn" style="
          background-color: white;
          color: #0a66c2;
          border: none;
          padding: 6px 12px;
          border-radius: 16px;
          font-weight: 600;
          cursor: pointer;
        ">Refresh Page</button>
      </div>
    `;
    document.body.appendChild(notice);

    document.getElementById(`${EXTENSION_PREFIX}-refresh-page-btn`).addEventListener('click', () => {
      window.location.reload();
    });
  }

  // --- Initialization ---
  function initialize() {
    console.log(`${EXTENSION_PREFIX}: Initializing extension`);

    safeCallChromeAPI(() => {
      chrome.storage.local.get(['categories', 'connections'], function(data) {
        state.categories = data.categories || [];
        state.connections = data.connections || [];
        observePageChanges();
        checkForProfilePage();
      });
      chrome.runtime.onMessage.addListener(handleMessages);
    });
  }

  // --- Event Handling & Observation ---
  function handleMessages(message, sender, sendResponse) {
    if (message.action === 'categoriesUpdated' || message.action === 'connectionsUpdated') {
      safeCallChromeAPI(() => {
        chrome.storage.local.get(['categories', 'connections'], function(data) {
          state.categories = data.categories || [];
          state.connections = data.connections || [];
          if (state.panelVisible) {
            updateCategoryPanel();
          }
        });
      });
    }
  }

  function observePageChanges() {
    console.log(`${EXTENSION_PREFIX}: Setting up page observer`);
    const observer = new MutationObserver(mutations => {
      window.requestAnimationFrame(checkForProfilePage);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', checkForProfilePage);
  }

  function checkForProfilePage() {
    const currentUrl = window.location.href;
    const profileMatch = currentUrl.match(/linkedin\.com\/in\/([^\/?#]+)/);
    const buttonExists = document.getElementById(BUTTON_ID);

    if (profileMatch && profileMatch[1]) {
      const profileId = profileMatch[1];
      console.log(`${EXTENSION_PREFIX}: On profile page for: ${profileId}`);

      if (profileId !== state.currentProfileId) {
        state.currentProfileId = profileId;
        hidePanel();
        if (buttonExists) buttonExists.remove();
      }

      if (!document.getElementById(BUTTON_ID)) {
        console.log(`${EXTENSION_PREFIX}: Button not found, attempting to inject`);
        const containerSelectors = [
          '.pv-top-card__actions',
          '.pv-top-card-v2__actions',
          '.pvs-profile-actions',
          '.pv-top-card__links',
          '.pv-s-profile-actions',
          '.pv-top-card__action-buttons',
          '.profile-header__actions',
          'section.artdeco-card.ember-view.pv-top-card',
          '.ph5.pb5'
        ];

        for (const selector of containerSelectors) {
          const container = document.querySelector(selector);
          if (container) {
            console.log(`${EXTENSION_PREFIX}: Found container using selector: ${selector}`);
            insertCategorizeButton(container);
            return;
          }
        }

        const buttonSelectors = [
          'button[aria-label*="Connect"]',
          'button[aria-label*="Message"]',
          'button[aria-label*="Follow"]',
          'button[aria-label*="More actions"]',
          '.artdeco-button'
        ];

        for (const selector of buttonSelectors) {
          const linkedinButton = document.querySelector(selector);
          if (linkedinButton) {
            let container = linkedinButton.closest('.pv-top-card__actions') ||
              linkedinButton.closest('.pvs-profile-actions') ||
              linkedinButton.parentElement;

            if (container) {
              console.log(`${EXTENSION_PREFIX}: Found container via LinkedIn button: ${selector}`);
              insertCategorizeButton(container);
              return;
            }
          }
        }

        console.log(`${EXTENSION_PREFIX}: Scheduling delayed injection attempt`);
        setTimeout(() => {
          if (!document.getElementById(BUTTON_ID)) {
            const headingElement = document.querySelector('h1.text-heading-xlarge');
            if (headingElement) {
              let possibleContainer = null;
              let element = headingElement;
              for (let i = 0; i < 5; i++) {
                element = element.parentElement;
                if (!element || element === document.body) break;

                const childDivs = element.querySelectorAll('div');
                for (const div of childDivs) {
                  if (div.querySelector('button') || div.childElementCount > 1) {
                    possibleContainer = div;
                    break;
                  }
                }
                if (possibleContainer) break;
              }

              if (possibleContainer) {
                console.log(`${EXTENSION_PREFIX}: Found potential container via DOM traversal`);
                insertCategorizeButton(possibleContainer);
              } else {
                console.log(`${EXTENSION_PREFIX}: Creating our own button container as last resort`);
                const newContainer = document.createElement('div');
                newContainer.className = 'lnc-custom-container';
                newContainer.style.margin = '10px 0';

                if (headingElement.nextElementSibling) {
                  headingElement.parentElement.insertBefore(newContainer, headingElement.nextElementSibling);
                } else {
                  headingElement.parentElement.appendChild(newContainer);
                }

                insertCategorizeButton(newContainer);
              }
            }
          }
        }, 2000);
      }
    } else {
      if (state.currentProfileId) {
        console.log(`${EXTENSION_PREFIX}: Navigated away from profile`);
        state.currentProfileId = null;
        hidePanel();
      }

      if (buttonExists) buttonExists.remove();
    }
  }

  function insertCategorizeButton(container) {
    if (document.getElementById(BUTTON_ID)) {
      return;
    }

    console.log(`${EXTENSION_PREFIX}: Creating button`);
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.className = `${EXTENSION_PREFIX}-categorizer-btn artdeco-button artdeco-button--2 artdeco-button--secondary`;
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
        <path d="M10 1L9 0H2a1 1 0 00-1 1v11a1 1 0 001 1h1V3a1 1 0 011-1h6zm5 2H5a1 1 0 00-1 1v11a1 1 0 001 1h10a1 1 0 001-1V4a1 1 0 00-1-1zM8 6h5v1H8zm5 3H8v1h5zM8 11h5v1H8z"></path>
      </svg>
      <span class="artdeco-button__text">Add to List</span>`;
    button.style.marginLeft = '8px';
    button.addEventListener('click', toggleCategoryPanel);

    try {
      const moreButton = container.querySelector('button[aria-label*="More actions"]');
      const connectButton = container.querySelector('button[aria-label*="Connect"], button[aria-label*="Message"], button[aria-label*="Follow"]');

      if (moreButton) {
        container.insertBefore(button, moreButton);
      } else if (connectButton) {
        if (connectButton.nextSibling) {
          container.insertBefore(button, connectButton.nextSibling);
        } else {
          container.appendChild(button);
        }
      } else {
        container.appendChild(button);
      }

      console.log(`${EXTENSION_PREFIX}: Button added successfully`);
    } catch (error) {
      console.error(`${EXTENSION_PREFIX}: Error adding button:`, error);
      try {
        container.appendChild(button);
      } catch (e) {
        console.error(`${EXTENSION_PREFIX}: Final attempt failed:`, e);
      }
    }
  }

  function toggleCategoryPanel(e) {
    if (e) e.preventDefault();
    if (state.panelVisible) {
      hidePanel();
    } else {
      safeCallChromeAPI(() => {
        chrome.storage.local.get(['categories', 'connections'], function(data) {
          state.categories = data.categories || [];
          state.connections = data.connections || [];
          showPanel();
        });
      }, () => {
        showAPIErrorPanel();
      });
    }
  }

  function showAPIErrorPanel() {
    hidePanel();

    const panel = document.createElement('div');
    panel.id = `${EXTENSION_PREFIX}-categorizer-panel`;
    panel.className = `${EXTENSION_PREFIX}-categorizer-panel`;

    panel.innerHTML = `
      <div class="${EXTENSION_PREFIX}-panel-header">
        <h3>Categorizer Error</h3>
        <button class="${EXTENSION_PREFIX}-panel-close">&times;</button>
      </div>
      <div class="${EXTENSION_PREFIX}-panel-body">
        <p>The extension context has been invalidated. Please refresh the page to continue using the LinkedIn Categorizer.</p>
        <button id="${EXTENSION_PREFIX}-refresh-btn" class="artdeco-button artdeco-button--primary">Refresh Page</button>
      </div>
    `;

    document.body.appendChild(panel);
    panel.querySelector(`.${EXTENSION_PREFIX}-panel-close`).addEventListener('click', hidePanel);
    panel.querySelector(`#${EXTENSION_PREFIX}-refresh-btn`).addEventListener('click', () => {
      window.location.reload();
    });

    state.panelVisible = true;
  }

  function showPanel() {
    hidePanel();

    const panel = document.createElement('div');
    panel.id = `${EXTENSION_PREFIX}-categorizer-panel`;
    panel.className = `${EXTENSION_PREFIX}-categorizer-panel`;

    const profileData = extractProfileData();
    const profileUrl = window.location.href;
    const connection = state.connections.find(c => c.id === state.currentProfileId) || {
      id: state.currentProfileId,
      name: profileData.name,
      profileUrl: profileUrl,
      categories: [],
      addedAt: Date.now()
    };

    panel.innerHTML = `
      <div class="${EXTENSION_PREFIX}-panel-header">
        <h3>Add to List</h3>
        <button class="${EXTENSION_PREFIX}-panel-close">&times;</button>
      </div>
      <div class="${EXTENSION_PREFIX}-panel-body">
        <div class="${EXTENSION_PREFIX}-connection-info">
          <div class="${EXTENSION_PREFIX}-connection-details">
            <div class="${EXTENSION_PREFIX}-connection-name"><strong>${profileData.name}</strong></div>
            <div class="${EXTENSION_PREFIX}-connection-url">
              <a href="${profileUrl}" target="_blank" title="Open in new tab">
                ${profileUrl}
              </a>
            </div>
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
    const nameElement = document.querySelector('h1.text-heading-xlarge');
    const titleElement = document.querySelector('div.text-body-medium.break-words');
    const avatarElement = document.querySelector('.pv-top-card-profile-picture__image, .profile-photo-edit__preview');

    if (nameElement) name = nameElement.textContent.trim();
    if (titleElement) title = titleElement.textContent.trim();
    if (avatarElement) avatar = avatarElement.src || avatarElement.style.backgroundImage.slice(5, -2);

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
    const profileData = extractProfileData();

    const connection = {
      id: state.currentProfileId,
      name: profileData.name,
      profileUrl: window.location.href,
      categories: selectedCategories,
      addedAt: state.connections.find(c => c.id === state.currentProfileId)?.addedAt || Date.now(),
      updatedAt: Date.now()
    };

    const existingIndex = state.connections.findIndex(c => c.id === state.currentProfileId);
    if (existingIndex >= 0) {
      state.connections[existingIndex] = connection;
    } else {
      state.connections.push(connection);
    }

    safeCallChromeAPI(() => {
      chrome.storage.local.set({ connections: state.connections }, function() {
        showToast('Connection categorized successfully!');
        hidePanel();
        try {
          chrome.runtime.sendMessage({ action: 'connectionsUpdated' }).catch(err => {});
        } catch (err) {}
      });
    }, () => {
      hidePanel();
      showToast('Error saving connection - please refresh the page', 'error');
    });
  }

  function openCreateCategoryModal() {
    console.log(`${EXTENSION_PREFIX}: Attempting to open category modal`);
    
    // First try to use chrome.runtime API safely
    safeCallChromeAPI(() => {
      chrome.runtime.sendMessage({ 
        action: 'openCategoryModal',
        source: 'content_script',
        fromProfileId: state.currentProfileId,
        profileData: extractProfileData()
      }, (response) => {
        if (!response || !response.success) {
          // If no response or failed, show a message to the user
          showToast('Please click the extension icon to add a new category', 'info');
        }
      });
    }, () => {
      // Fallback if API call fails
      showToast('Please open the extension popup to add new categories', 'info');
    });
    
    // Show guidance toast regardless
    showToast('Opening category creator...', 'info');
  }

  function showToast(message, type = 'success') {
    let toast = document.getElementById(`${EXTENSION_PREFIX}-toast`);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = `${EXTENSION_PREFIX}-toast`;
      toast.className = `${EXTENSION_PREFIX}-toast`;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove('success', 'error', 'info', 'show');
    toast.classList.add(type, 'show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // --- Start ---
  console.log(`${EXTENSION_PREFIX}: Content script loaded`);
  try {
    if (chrome.runtime && chrome.runtime.id) {
      initialize();
    } else {
      console.error(`${EXTENSION_PREFIX}: Chrome runtime not available`);
      showPageRefreshNotice();
    }
  } catch (err) {
    console.error(`${EXTENSION_PREFIX}: Error during initialization`, err);
    showPageRefreshNotice();
  }
})();
