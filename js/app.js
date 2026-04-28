/**
 * app.js — Entry Point, Router & Global Events
 * v3: Added header height fix, skeleton, templates, signature, share, notifications
 */

const App = {
  _toastTimer: null,

  async init() {
    try {
      // Initialize database and state
      await appState.init();

      // Initialize services
      await SyncService.init();

      // Initialize UI
      UI.init();

      // Set date
      this._setDate();

      // Team name input
      this._bindTeamInput();
      // Fix 1.3: Dynamic header height
      this._updateHeaderHeight();
      window.addEventListener('resize', () => this._updateHeaderHeight());

      // Online/offline status
      this._updateStatus();
      window.addEventListener('online', () => this._updateStatus());
      window.addEventListener('offline', () => this._updateStatus());

      // Router
      this._handleRoute();
      window.addEventListener('hashchange', () => this._handleRoute());

      // Bind global events
      this._bindGlobalEvents();

      // State change listener
      appState.onChange(() => {
        UI.renderProgress();
      });

      // Auto-capture geolocation
      GeoService.capture();

      // Initialize signature canvas
      SignatureService.init();

      // Schedule notification reminder (Feature 4)
      this._scheduleReminder();

      // Register service worker
      this._registerSW();

      // Fix 1.5: Remove skeleton after init
      document.getElementById('skeleton-loader')?.remove();

      console.log('[App] Initialized successfully');
    } catch (e) {
      console.error('[App] Init error:', e);
      document.getElementById('skeleton-loader')?.remove();
    }
  },

  // ===== DATE =====
  _setDate() {
    const el = document.getElementById('header-date');
    if (el) el.textContent = appState.todayFormatted;
  },

  // ===== TEAM NAME =====
  _bindTeamInput() {
    const input = document.getElementById('input-team-name');
    if (!input) return;
    input.value = appState.teamName;
    let debounce = null;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        appState.setTeamName(input.value.trim());
        this._updateHeaderHeight();
      }, 400);
    });
  },

  // ===== FIX 1.3: DYNAMIC HEADER HEIGHT =====
  _updateHeaderHeight() {
    const header = document.getElementById('app-header');
    if (!header) return;
    const height = header.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--header-height', height + 'px');
  },

  // ===== ONLINE STATUS =====
  _updateStatus() {
    const online = navigator.onLine;
    const dot = document.querySelector('.status-dot');
    const text = document.querySelector('.status-text');
    if (dot) dot.classList.toggle('offline', !online);
    if (text) text.textContent = online ? 'Online' : 'Offline';
  },

  // ===== ROUTER =====
  _handleRoute() {
    const hash = window.location.hash || '#checklist';
    const mainView = document.getElementById('view-checklist');
    const historyView = document.getElementById('view-history');
    const mapView = document.getElementById('view-map');
    const navBtns = document.querySelectorAll('.bottom-nav-btn');
    const header = document.getElementById('app-header');
    const tabsNav = document.getElementById('tabs-nav');

    // Hide all views
    mainView?.classList.remove('active');
    historyView?.classList.remove('active');
    mapView?.classList.remove('active');

    // Toggle body class for map view
    document.body.classList.toggle('map-active', hash === '#map');

    if (hash === '#history' || hash.startsWith('#history/')) {
      historyView?.classList.add('active');
      navBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.view === 'history');
        b.removeAttribute('aria-current');
        if (b.dataset.view === 'history') b.setAttribute('aria-current', 'page');
      });

      if (hash.startsWith('#history/')) {
        const date = hash.replace('#history/', '');
        HistoryView.renderDetail(historyView, date);
      } else {
        HistoryView.render(historyView);
      }
    } else if (hash === '#map') {
      mapView?.classList.add('active');
      navBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.view === 'map');
        b.removeAttribute('aria-current');
        if (b.dataset.view === 'map') b.setAttribute('aria-current', 'page');
      });
    } else {
      mainView?.classList.add('active');
      navBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.view === 'checklist');
        b.removeAttribute('aria-current');
        if (b.dataset.view === 'checklist') b.setAttribute('aria-current', 'page');
      });
      UI.renderTabs();
      UI.renderChecklist();
    }
  },

  // ===== GLOBAL EVENTS =====
  _bindGlobalEvents() {
    // Bottom nav
    document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.location.hash = '#' + btn.dataset.view;
      });
    });

    // New day
    document.getElementById('btn-new-day')?.addEventListener('click', async () => {
      if (confirm('Iniciar novo dia?\n\nO checklist atual será salvo no histórico e os campos serão limpos.')) {
        await appState.startNewDay();
        UI.vibrate();
        UI.renderTabs();
        UI.renderChecklist();
        this.showToast('Novo dia iniciado!');
      }
    });

    // Export PDF → opens signature modal first
    document.getElementById('btn-export-pdf')?.addEventListener('click', async () => {
      PdfService.exportWithSignature();
    });

    // Signature modal buttons
    document.getElementById('btn-sig-clear')?.addEventListener('click', () => {
      SignatureService.clear();
    });
    document.getElementById('btn-sig-confirm')?.addEventListener('click', () => {
      if (SignatureService._onConfirm) SignatureService._onConfirm();
    });
    document.getElementById('modal-sig-close')?.addEventListener('click', () => {
      SignatureService.hide();
    });
    document.getElementById('modal-signature-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-signature-overlay') SignatureService.hide();
    });

    // Share button
    document.getElementById('btn-share')?.addEventListener('click', async () => {
      await ShareService.share();
    });

    // Templates button
    document.getElementById('btn-templates')?.addEventListener('click', async () => {
      await TemplatesService.renderModal();
      document.getElementById('modal-templates-overlay')?.classList.add('active');
    });
    document.getElementById('modal-templates-close')?.addEventListener('click', () => {
      document.getElementById('modal-templates-overlay')?.classList.remove('active');
    });
    document.getElementById('modal-templates-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-templates-overlay') {
        document.getElementById('modal-templates-overlay')?.classList.remove('active');
      }
    });
    document.getElementById('btn-save-template')?.addEventListener('click', () => {
      TemplatesService.showSavePrompt();
    });

    // Modal: Add custom item
    const modalOverlay = document.getElementById('modal-overlay');
    const formAdd = document.getElementById('form-add-item');
    document.getElementById('modal-close')?.addEventListener('click', () => modalOverlay.classList.remove('active'));
    modalOverlay?.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.classList.remove('active');
    });

    formAdd?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('input-item-name').value.trim();
      const qty = document.getElementById('input-item-qty').value.trim();
      const actId = parseInt(document.getElementById('input-item-activity').value) || document.getElementById('input-item-activity').value;
      if (!name) return;
      await appState.addCustomItem(actId, name, qty);
      modalOverlay.classList.remove('active');
      UI.vibrate();
      UI.renderChecklist();
      this.showToast('Material adicionado!');
    });

    // Modal: Add activity
    const activityOverlay = document.getElementById('modal-activity-overlay');
    const formActivity = document.getElementById('form-add-activity');
    document.getElementById('modal-activity-close')?.addEventListener('click', () => activityOverlay.classList.remove('active'));
    activityOverlay?.addEventListener('click', (e) => {
      if (e.target === activityOverlay) activityOverlay.classList.remove('active');
    });

    formActivity?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('input-activity-name');
      const depthInput = document.getElementById('input-activity-depth');
      const escoraInput = document.getElementById('input-activity-escora');
      
      const name = nameInput.value.trim();
      const depth = depthInput ? parseFloat(depthInput.value) : 0;
      const needsEscora = escoraInput ? escoraInput.checked : false;

      if (!name) return;

      const id = await appState.addActivity(name);
      
      // Salva a profundidade como observação para a equipe ter o registro
      if (depth > 0) {
        await appState.addCustomItem(id, 'Profundidade da Rede Verificada no Mapa', `${depth} metros`);
      }
      
      // Salva a escora se foi marcada
      if (needsEscora) {
        await appState.addCustomItem(id, 'Escora Metálica / Pranchão', 'Conforme necessidade');
      }

      activityOverlay.classList.remove('active');
      UI.setActivity(id);
      UI.renderTabs();
      this.showToast('Atividade criada!');

      nameInput.value = '';
      if (depthInput) depthInput.value = '';
      if (escoraInput) escoraInput.checked = false;
    });
  },

  // ===== FEATURE 4: NOTIFICATION REMINDER =====
  async _scheduleReminder() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      // Don't ask on first load — wait for user action
      return;
    }
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const tomorrow7am = new Date(now);
    tomorrow7am.setDate(tomorrow7am.getDate() + 1);
    tomorrow7am.setHours(7, 0, 0, 0);

    const delay = tomorrow7am - now;
    if (delay > 0 && delay < 86400000) {
      setTimeout(() => {
        new Notification('Checklist de Campo', {
          body: 'Não esqueça de revisar o checklist antes de sair para campo!',
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png'
        });
        this._scheduleReminder(); // Reschedule for next day
      }, delay);
    }
  },

  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      this.showToast('Notificações não suportadas');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      this.showToast('Notificações ativadas!');
      this._scheduleReminder();
    } else {
      this.showToast('Permissão de notificação negada');
    }
  },

  // ===== TOAST =====
  showToast(msg) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  },

  // ===== SERVICE WORKER =====
  _registerSW() {
    if (!('serviceWorker' in navigator)) return;

    let refreshing = false;

    navigator.serviceWorker.register('service-worker.js').then(reg => {
      console.log('[SW] Registered');

      // Auto-update: when a new SW is waiting, tell it to activate immediately
      const awaitNewSW = (worker) => {
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') {
            if (!refreshing) {
              refreshing = true;
              window.location.reload();
            }
          }
        });
      };

      if (reg.waiting) {
        // A new SW is already waiting — activate it now
        reg.waiting.postMessage('SKIP_WAITING');
        awaitNewSW(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (newSW) {
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW installed while old one controls — force switch
              newSW.postMessage('SKIP_WAITING');
              awaitNewSW(newSW);
            }
          });
        }
      });

      // Also listen for controller change (another tab triggered update)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

    }).catch(err => console.warn('[SW] Registration failed:', err));
  }
};

// ===== START =====
document.addEventListener('DOMContentLoaded', () => App.init());
