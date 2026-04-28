/**
 * admin.js — Admin Panel with PIN protection
 * Functions: delete history, clear all data, export backup, manage teams
 */

const AdminService = {
  // Default PIN "1234" hashed with SHA-256
  PIN_HASH: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  _authenticated: false,

  // ===== AUTH =====

  async _hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  authenticate() {
    return new Promise((resolve) => {
      const overlay = document.getElementById('modal-admin-pin-overlay');
      const input = document.getElementById('input-admin-pin');
      const btnConfirm = document.getElementById('btn-admin-pin-confirm');
      const error = document.getElementById('admin-pin-error');

      if (!overlay || !input) { resolve(false); return; }

      // Load custom PIN Hash
      const savedHash = localStorage.getItem('adminPinHash');
      if (savedHash) this.PIN_HASH = savedHash;

      input.value = '';
      error.classList.add('hidden');
      overlay.classList.add('active');
      input.focus();

      const cleanup = () => {
        overlay.classList.remove('active');
        btnConfirm.removeEventListener('click', onConfirm);
        input.removeEventListener('keydown', onKey);
      };

      const onConfirm = async () => {
        const inputHash = await this._hashPin(input.value);
        if (inputHash === this.PIN_HASH) {
          this._authenticated = true;
          cleanup();
          resolve(true);
        } else {
          error.classList.remove('hidden');
          input.value = '';
          input.focus();
          if (navigator.vibrate) navigator.vibrate(200);
        }
      };

      const onKey = (e) => {
        if (e.key === 'Enter') onConfirm();
        if (e.key === 'Escape') { cleanup(); resolve(false); }
      };

      btnConfirm.addEventListener('click', onConfirm);
      input.addEventListener('keydown', onKey);

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { cleanup(); resolve(false); }
      }, { once: true });
    });
  },

  async openPanel() {
    const ok = await this.authenticate();
    if (!ok) return;

    this._renderPanel();
    document.getElementById('modal-admin-overlay')?.classList.add('active');
  },

  // ===== RENDER =====

  _renderPanel() {
    const container = document.getElementById('admin-content');
    if (!container) return;

    container.innerHTML = `
      <div class="admin-section">
        <div class="admin-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Histórico
        </div>
        <div id="admin-history-list" class="admin-list"></div>
        <button class="admin-btn admin-btn-danger" id="btn-admin-clear-history">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          Apagar todo o histórico
        </button>
      </div>

      <div class="admin-section">
        <div class="admin-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Dados
        </div>
        <button class="admin-btn" id="btn-admin-export">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar backup (JSON)
        </button>
        <button class="admin-btn admin-btn-danger" id="btn-admin-clear-all">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Limpar TODOS os dados (reset)
        </button>
      </div>

      <div class="admin-section">
        <div class="admin-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          Segurança
        </div>
        <div class="admin-pin-change">
          <label>Alterar PIN de acesso:</label>
          <div class="admin-pin-row">
            <input type="password" id="input-new-pin" maxlength="6" placeholder="Novo PIN" class="admin-input">
            <button class="admin-btn admin-btn-sm" id="btn-admin-change-pin">Salvar</button>
          </div>
        </div>
      </div>

      <div class="admin-section">
        <div class="admin-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M12 2v20M2 12h20"/>
          </svg>
          Informações
        </div>
        <div id="admin-info" class="admin-info"></div>
      </div>
    `;

    this._loadHistoryList();
    this._loadInfo();
    this._bindEvents();
  },

  async _loadHistoryList() {
    const container = document.getElementById('admin-history-list');
    if (!container) return;

    const checklists = await db.getAllChecklists();
    const today = appState.today;
    const past = checklists.filter(c => c.date !== today);

    if (past.length === 0) {
      container.innerHTML = '<div class="admin-empty">Nenhum registro no histórico</div>';
      return;
    }

    container.innerHTML = past.map(ck => {
      const displayDate = ck.archivedFrom || ck.date.split('_')[0];
      const dateObj = new Date(displayDate + 'T12:00:00');
      const dateStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const team = ck.teamName ? ` — ${ck.teamName}` : '';
      let total = 0, checked = 0;
      for (const key in ck.items) { total++; if (ck.items[key]?.checked || ck.items[key]?.qty > 0) checked++; }
      const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

      return `
        <div class="admin-history-item" data-date="${ck.date}">
          <div class="admin-history-info">
            <span class="admin-history-date">${dateStr}${team}</span>
            <span class="admin-history-pct">${pct}%</span>
          </div>
          <button class="admin-btn-delete" data-date="${ck.date}" aria-label="Apagar este registro">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    // Delete individual entry
    container.querySelectorAll('.admin-btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const date = btn.dataset.date;
        if (confirm(`Apagar registro de ${date.split('_')[0]}?`)) {
          await db.db.checklists.delete(date);
          App.showToast('Registro apagado');
          this._loadHistoryList();
        }
      });
    });
  },

  async _loadInfo() {
    const container = document.getElementById('admin-info');
    if (!container) return;

    const checklists = await db.getAllChecklists();
    const photos = await db.db.photos.count();
    const templates = await db.getAllTemplates();
    const customs = await db.getAllCustomItems();

    container.innerHTML = `
      <div class="admin-info-row"><span>Checklists salvos:</span><strong>${checklists.length}</strong></div>
      <div class="admin-info-row"><span>Fotos armazenadas:</span><strong>${photos}</strong></div>
      <div class="admin-info-row"><span>Templates:</span><strong>${templates.length}</strong></div>
      <div class="admin-info-row"><span>Itens personalizados:</span><strong>${customs.length}</strong></div>
      <div class="admin-info-row"><span>Versão:</span><strong>v3.1</strong></div>
    `;
  },

  _bindEvents() {
    // Clear all history
    document.getElementById('btn-admin-clear-history')?.addEventListener('click', async () => {
      if (confirm('Apagar TODO o histórico?\n\nEsta ação não pode ser desfeita.')) {
        const all = await db.getAllChecklists();
        const today = appState.today;
        for (const ck of all) {
          if (ck.date !== today) {
            await db.db.checklists.delete(ck.date);
          }
        }
        App.showToast('Histórico apagado');
        this._loadHistoryList();
        this._loadInfo();
      }
    });

    // Export backup
    document.getElementById('btn-admin-export')?.addEventListener('click', async () => {
      const data = {
        exportDate: new Date().toISOString(),
        checklists: await db.getAllChecklists(),
        activities: await db.getActivities(),
        customItems: await db.getAllCustomItems(),
        templates: await db.getAllTemplates(),
        photos: await db.db.photos.count() // photo count only (blobs too large)
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `checklist-backup-${appState.today}.json`;
      a.click();
      URL.revokeObjectURL(url);
      App.showToast('Backup exportado!');
    });

    // Clear ALL data
    document.getElementById('btn-admin-clear-all')?.addEventListener('click', async () => {
      if (confirm('⚠️ ATENÇÃO: Isto vai apagar TODOS os dados do app.\n\nChecklists, fotos, templates, itens personalizados — TUDO será perdido.\n\nTem certeza?')) {
        if (confirm('Última confirmação: REALMENTE apagar tudo?')) {
          await db.db.delete();
          localStorage.clear();
          sessionStorage.clear();
          App.showToast('Dados apagados. Recarregando...');
          setTimeout(() => window.location.reload(), 1500);
        }
      }
    });

    // Change PIN
    document.getElementById('btn-admin-change-pin')?.addEventListener('click', async () => {
      const newPin = document.getElementById('input-new-pin')?.value.trim();
      if (!newPin || newPin.length < 4) {
        App.showToast('PIN deve ter no mínimo 4 dígitos');
        return;
      }
      const newHash = await this._hashPin(newPin);
      localStorage.setItem('adminPinHash', newHash);
      this.PIN_HASH = newHash;
      document.getElementById('input-new-pin').value = '';
      App.showToast('PIN atualizado!');
    });
  }
};
