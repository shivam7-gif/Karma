(function() {
  // Elements - Top Overlay
  const statusContainer = document.getElementById('statusContainer');
  const screenBorder = document.getElementById('screenBorder');
  const actionText = document.getElementById('actionText');
  const stopBtn = document.getElementById('stopBtn');

  // Elements - Right-Side Product Intelligence Panel
  const intelPanel = document.getElementById('intelPanel');
  const intelHeader = document.getElementById('intelHeader');
  const intelStateBadge = document.getElementById('intelStateBadge');
  const intelPinBtn = document.getElementById('intelPinBtn');
  const intelMinBtn = document.getElementById('intelMinBtn');
  const intelActivity = document.getElementById('intelActivity');
  const intelProductTitle = document.getElementById('intelProductTitle');
  const intelProductPrice = document.getElementById('intelProductPrice');
  const intelProductRating = document.getElementById('intelProductRating');
  const intelProductBudget = document.getElementById('intelProductBudget');
  const intelReasoningSection = document.getElementById('intelReasoningSection');
  const intelReasoningToggle = document.getElementById('intelReasoningToggle');
  const intelReasoningText = document.getElementById('intelReasoningText');
  const intelCandidatesSection = document.getElementById('intelCandidatesSection');
  const intelCandidatesToggle = document.getElementById('intelCandidatesToggle');
  const intelCandidatesCount = document.getElementById('intelCandidatesCount');
  const intelCandidatesList = document.getElementById('intelCandidatesList');
  const intelViewProductBtn = document.getElementById('intelViewProductBtn');
  const intelStopBtn = document.getElementById('intelStopBtn');
  const intelEdgeHandle = document.getElementById('intelEdgeHandle');

  let currentProductUrl = null;
  let isPinned = false;
  let isRetracted = false;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let hoverCount = 0;

  const DEFAULT_STATUS_MESSAGES = {
    idle: 'Ready',
    thinking: 'Thinking...',
    controlling_screen: 'Karma is controlling the screen',
    searching: 'Searching Amazon',
    analyzing: 'Comparing products',
    opening_product: 'Inspecting product',
    adding_to_cart: 'Adding to cart',
    checkout_review: 'Checkout review',
    stopped: 'Automation stopped',
    error: 'An error occurred',
  };

  // =========================================================================
  // Interactivity Capture for Interactive Regions
  // =========================================================================
  function registerInteractive(element) {
    if (!element) return;
    element.addEventListener('mouseenter', () => {
      hoverCount++;
      if (window.karmaOverlay) {
        window.karmaOverlay.setInteractive(true);
      }
    });

    element.addEventListener('mouseleave', () => {
      hoverCount = Math.max(0, hoverCount - 1);
      if (hoverCount === 0 && !isDragging && window.karmaOverlay) {
        window.karmaOverlay.setInteractive(false);
      }
    });
  }

  registerInteractive(statusContainer);
  registerInteractive(intelPanel);
  registerInteractive(intelEdgeHandle);

  // =========================================================================
  // Drag Anywhere Functionality
  // =========================================================================
  if (intelHeader && intelPanel) {
    intelHeader.addEventListener('mousedown', (e) => {
      // Don't drag if clicking buttons
      if (e.target.closest('button')) return;

      isDragging = true;
      if (window.karmaOverlay) {
        window.karmaOverlay.setInteractive(true);
      }

      const rect = intelPanel.getBoundingClientRect();
      dragStartX = e.clientX - rect.left;
      dragStartY = e.clientY - rect.top;

      // Convert position to absolute pixels left/top
      intelPanel.style.left = `${rect.left}px`;
      intelPanel.style.top = `${rect.top}px`;
      intelPanel.style.right = 'auto';
      intelPanel.style.transform = 'none';

      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging || !intelPanel) return;

      let newLeft = e.clientX - dragStartX;
      let newTop = e.clientY - dragStartY;

      const panelWidth = intelPanel.offsetWidth;
      const panelHeight = intelPanel.offsetHeight;

      // Clamp to screen boundaries
      newLeft = Math.max(8, Math.min(window.innerWidth - panelWidth - 8, newLeft));
      newTop = Math.max(8, Math.min(window.innerHeight - panelHeight - 8, newTop));

      intelPanel.style.left = `${newLeft}px`;
      intelPanel.style.top = `${newTop}px`;
    });

    window.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;

      // If dragged within 20px of right edge and unpinned, auto-retract
      if (!isPinned && e.clientX >= window.innerWidth - 25) {
        retractPanel();
      }

      if (hoverCount === 0 && window.karmaOverlay) {
        window.karmaOverlay.setInteractive(false);
      }
    });
  }

  // =========================================================================
  // Panel Retract / Expand & Pin Controls
  // =========================================================================
  function retractPanel() {
    if (isPinned) return;
    isRetracted = true;
    if (intelPanel) intelPanel.classList.add('retracted');
    if (intelEdgeHandle) intelEdgeHandle.style.display = 'flex';
  }

  function expandPanel() {
    isRetracted = false;
    if (intelPanel) intelPanel.classList.remove('retracted');
    if (intelEdgeHandle) intelEdgeHandle.style.display = 'none';
  }

  if (intelMinBtn) {
    intelMinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      retractPanel();
    });
  }

  if (intelEdgeHandle) {
    intelEdgeHandle.addEventListener('click', expandPanel);
    intelEdgeHandle.addEventListener('mouseenter', expandPanel);
  }

  if (intelPinBtn) {
    intelPinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isPinned = !isPinned;
      intelPinBtn.classList.toggle('active', isPinned);
      intelPinBtn.title = isPinned ? 'Unpin Panel' : 'Pin Panel';
    });
  }

  // =========================================================================
  // Collapsible Sections
  // =========================================================================
  if (intelReasoningToggle && intelReasoningSection) {
    intelReasoningToggle.addEventListener('click', () => {
      intelReasoningSection.classList.toggle('collapsed');
    });
  }

  if (intelCandidatesToggle && intelCandidatesSection) {
    intelCandidatesToggle.addEventListener('click', () => {
      intelCandidatesSection.classList.toggle('collapsed');
    });
  }

  // =========================================================================
  // Stop & Action Buttons
  // =========================================================================
  function triggerStop(source) {
    if (window.karmaOverlay) {
      window.karmaOverlay.requestStop(source);
    }
    updateStatus({
      state: 'stopped',
      action: 'Stopping automation...',
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerStop('button_clicked');
    });
  }

  if (intelStopBtn) {
    intelStopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerStop('panel_button_clicked');
    });
  }

  if (intelViewProductBtn) {
    intelViewProductBtn.addEventListener('click', () => {
      if (currentProductUrl) {
        console.log('[Karma Intel] Viewing current product URL:', currentProductUrl);
      }
    });
  }

  // Global ESC key handler
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      triggerStop('escape_pressed');
    }
  });

  // =========================================================================
  // Status & Product Intelligence State Updates
  // =========================================================================
  function updateStatus(data) {
    if (!data) return;

    const state = data.state || 'controlling_screen';
    const message = data.action || DEFAULT_STATUS_MESSAGES[state] || 'Controlling screen';

    // 1. Top bar update
    if (actionText) {
      actionText.style.opacity = '0';
      setTimeout(() => {
        actionText.textContent = message;
        actionText.style.opacity = '1';
      }, 100);
    }

    // 2. Screen border styling
    if (screenBorder) {
      const allStates = [
        'state-idle', 'state-thinking', 'state-controlling_screen',
        'state-searching', 'state-analyzing', 'state-opening_product',
        'state-adding_to_cart', 'state-checkout_review', 'state-stopped', 'state-error'
      ];
      allStates.forEach(cls => screenBorder.classList.remove(cls));
      screenBorder.classList.add(`state-${state}`);
    }

    // 3. Panel State Badge
    if (intelStateBadge) {
      intelStateBadge.textContent = state.replace(/_/g, ' ');
    }

    // 4. Activity Text
    if (intelActivity) {
      if (data.intel && data.intel.activity) {
        intelActivity.textContent = data.intel.activity;
      } else {
        intelActivity.textContent = message;
      }
    }

    // 5. Product Intelligence Details
    if (data.intel) {
      const intel = data.intel;

      // Current Product
      if (intel.currentProduct) {
        const prod = intel.currentProduct;
        if (intelProductTitle) intelProductTitle.textContent = prod.title || 'Product selected';
        if (intelProductPrice) intelProductPrice.textContent = prod.price || '—';
        if (intelProductRating) {
          const ratingParts = [prod.rating, prod.reviews].filter(Boolean);
          intelProductRating.textContent = ratingParts.length ? ratingParts.join(' ') : '';
        }
        if (intelProductBudget) {
          intelProductBudget.textContent = prod.budgetComparison || `Budget limit: ₹${intel.budgetINR || 500}`;
        }
        if (prod.url) {
          currentProductUrl = prod.url;
          if (intelViewProductBtn) {
            intelViewProductBtn.disabled = false;
          }
        }
      }

      // Reasoning Summary
      if (intel.reasoningSummary && intelReasoningText) {
        intelReasoningText.textContent = intel.reasoningSummary;
      }

      // Candidates
      if (intel.candidates && intelCandidatesList) {
        if (intelCandidatesCount) {
          intelCandidatesCount.textContent = `${intel.candidatesFound || intel.candidates.length} found`;
        }

        intelCandidatesList.innerHTML = '';
        intel.candidates.forEach((cand) => {
          const item = document.createElement('div');
          item.className = `intel-candidate-item ${cand.status === 'selected' ? 'selected' : ''}`;

          const info = document.createElement('div');
          info.className = 'intel-candidate-info';

          const titleEl = document.createElement('div');
          titleEl.className = 'intel-candidate-title';
          titleEl.textContent = cand.title;

          const subEl = document.createElement('div');
          subEl.className = 'intel-candidate-sub';
          subEl.textContent = `${cand.status === 'selected' ? 'Selected' : 'Candidate'} ${cand.rating ? '• ' + cand.rating : ''}`;

          info.appendChild(titleEl);
          info.appendChild(subEl);

          const priceEl = document.createElement('div');
          priceEl.className = 'intel-candidate-price';
          priceEl.textContent = cand.price || '';

          item.appendChild(info);
          item.appendChild(priceEl);
          intelCandidatesList.appendChild(item);
        });
      }
    }

    // Auto-reveal panel if active shopping and not explicitly minimized
    if (!isRetracted) {
      expandPanel();
    }

    if (state === 'stopped') {
      if (stopBtn) {
        stopBtn.disabled = true;
        stopBtn.style.opacity = '0.5';
      }
      if (intelStopBtn) {
        intelStopBtn.disabled = true;
        intelStopBtn.style.opacity = '0.5';
      }
    }
  }

  // Hook IPC listener from preload
  if (window.karmaOverlay && typeof window.karmaOverlay.onStatusUpdate === 'function') {
    window.karmaOverlay.onStatusUpdate((data) => {
      updateStatus(data);
    });
  }
})();
