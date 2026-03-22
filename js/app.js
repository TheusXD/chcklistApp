/**
 * app.js — Entry Point, Router & Global Events
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

      // Register service worker
      this._registerSW();

      console.log('[App] Initialized successfully');
    } catch (e) {
      console.error('[App] Init error:', e);
    }
  },

  // ===== DATE =====
  _setDate() {
    const el = document.getElementById('header-date');
    if (el) el.textContent = appState.todayFormatted;
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
    const navBtns = document.querySelectorAll('.bottom-nav-btn');

    // Hide all views
    mainView?.classList.remove('active');
    historyView?.classList.remove('active');

    if (hash === '#history' || hash.startsWith('#history/')) {
      historyView?.classList.add('active');
      navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === 'history'));

      if (hash.startsWith('#history/')) {
        const date = hash.replace('#history/', '');
        HistoryView.renderDetail(historyView, date);
      } else {
        HistoryView.render(historyView);
      }
    } else {
      mainView?.classList.add('active');
      navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === 'checklist'));
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

    // Export PDF
    document.getElementById('btn-export-pdf')?.addEventListener('click', async () => {
      this.showToast('Gerando PDF...');
      try {
        await PdfService.exportChecklist();
        this.showToast('PDF gerado!');
      } catch (e) {
        console.error('[PDF] Error:', e);
        this.showToast('Erro ao gerar PDF');
      }
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
      const name = document.getElementById('input-activity-name').value.trim();
      if (!name) return;
      const id = await appState.addActivity(name);
      activityOverlay.classList.remove('active');
      UI.setActivity(id);
      UI.renderTabs();
      this.showToast('Atividade criada!');
    });
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
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js')
        .then(() => console.log('[SW] Registered'))
        .catch(err => console.warn('[SW] Registration failed:', err));
    }
  }
};

// ===== START =====
document.addEventListener('DOMContentLoaded', () => App.init());
