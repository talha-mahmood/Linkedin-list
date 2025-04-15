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

  // --- Initialization ---
  function initialize() {
    console.log(`${EXTENSION_PREFIX}: Initializing extension`);
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
    console.log(`${EXTENSION_PREFIX}: Setting up page observer`);
    const observer = new MutationObserver(mutations => {
      // Use requestAnimationFrame for performance
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
         if (buttonExists) buttonExists.remove(); // Clean up
      }

      if (!document.getElementById(BUTTON_ID)) {
        console.log(`${EXTENSION_PREFIX}: Button not found, attempting to inject`);
        
        // IMPROVED APPROACH: Find multiple potential containers and try each
        const containerSelectors = [
          '.pv-top-card__actions',
          '.pv-top-card-v2__actions',
          '.pvs-profile-actions',
          '.pv-top-card__links',
          '.pv-s-profile-actions',
          '.pv-top-card__action-buttons',
          '.profile-header__actions',
          // Add additional possible selectors to increase chance of finding a container
          'section.artdeco-card.ember-view.pv-top-card',
          '.ph5.pb5' // More general container that might contain actions
        ];
        
        // Step 1: Try explicit containers first
        for (const selector of containerSelectors) {
          const container = document.querySelector(selector);
          if (container) {
            console.log(`${EXTENSION_PREFIX}: Found container using selector: ${selector}`);
            insertCategorizeButton(container);
            return; // Exit once button is injected
          }
        }
        
        // Step 2: If no containers found, try to find by looking for other LinkedIn buttons
        const buttonSelectors = [
          'button[aria-label*="Connect"]', 
          'button[aria-label*="Message"]',
          'button[aria-label*="Follow"]',
          'button[aria-label*="More actions"]',
          // More general button selectors
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

        // Step 3: If still not inserted, try again after a delay (LinkedIn might be loading)
        console.log(`${EXTENSION_PREFIX}: Scheduling delayed injection attempt`);
        setTimeout(() => {
          if (!document.getElementById(BUTTON_ID)) {
            // Final attempt - look for any section near the top that might hold our button
            const headingElement = document.querySelector('h1.text-heading-xlarge');
            if (headingElement) {
              let possibleContainer = null;
              
              // Try to find a container by navigating up from the name heading
              let element = headingElement;
              for (let i = 0; i < 5; i++) { // Check up to 5 levels up
                element = element.parentElement;
                if (!element || element === document.body) break;
                
                // Look for child elements that look like button containers
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
                // Create our own container as last resort
                const newContainer = document.createElement('div');
                newContainer.className = 'lnc-custom-container';
                newContainer.style.margin = '10px 0';
                
                // Insert after the heading or nearby
                if (headingElement.nextElementSibling) {
                  headingElement.parentElement.insertBefore(newContainer, headingElement.nextElementSibling);
                } else {
                  headingElement.parentElement.appendChild(newContainer);
                }
                
                insertCategorizeButton(newContainer);
              }
            }
          }
        }, 2000); // Wait 2 seconds for LinkedIn to fully render
      }
    } else {
      // Not on a profile page
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
      return; // Prevent duplication
    }
    
    console.log(`${EXTENSION_PREFIX}: Creating button`);
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.className = `${EXTENSION_PREFIX}-categorizer-btn artdeco-button artdeco-button--2 artdeco-button--secondary`;
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
        <path d="M10 1L9 0H2a1 1 0 00-1 1v11a1 1 0 001 1h1V3a1 1 0 011-1h6zm5 2H5a1 1 0 00-1 1v11a1 1 0 001 1h10a1 1 0 001-1V4a1 1 0 00-1-1zM8 6h5v1H8zm5 3H8v1h5zM8 11h5v1H8z"></path>
      </svg>
      <span class="artdeco-button__text">Categorize</span>`;
    button.style.marginLeft = '8px';
    button.addEventListener('click', toggleCategoryPanel);

    try {
      // First try to place it next to other buttons
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
        // Just append it
        container.appendChild(button);
      }
      
      console.log(`${EXTENSION_PREFIX}: Button added successfully`);
    } catch (error) {
      console.error(`${EXTENSION_PREFIX}: Error adding button:`, error);
      try {
        // Fallback
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
    const notes = document.querySelector(`.${EXTENSION_PREFIX}-notes-input`).value;
    const profileData = extractProfileData();

    const connection = {
      id: state.currentProfileId,
      name: profileData.name,
      title: profileData.title,
      avatar: profileData.avatar,
      profileUrl: window.location.href,
      categories: selectedCategories,
      notes: notes,
      addedAt: state.connections.find(c => c.id === state.currentProfileId)?.addedAt || Date.now(),
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
      chrome.runtime.sendMessage({ action: 'connectionsUpdated' }).catch(err => {});
    });
  }

  function openCreateCategoryModal() {
    chrome.runtime.sendMessage({ action: 'openCategoryModal' });
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
  initialize();
})();
