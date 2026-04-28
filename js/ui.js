/**
 * ui.js — UI Rendering Engine
 * Renders checklist materials, custom items, progress, search, photos, observations
 */

const UI = {
  _currentActivity: null,
  _searchQuery: '',
  _thumbUrls: [], // track for cleanup

  // ===== ICONS =====
  icons: {
    pipe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 2v6m0 8v6M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24"/></svg>`,
    wrench: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
    custom: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`,
    camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M5 13l4 4L19 7"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`,
    map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  },

  // ===== INIT =====
  init() {
    this._currentActivity = appState.activities[0]?.id || null;
  },

  get currentActivityId() {
    return this._currentActivity;
  },

  setActivity(id) {
    this._currentActivity = id;
    this.renderChecklist();
  },

  // ===== HAPTIC FEEDBACK =====
  vibrate() {
    if ('vibrate' in navigator) navigator.vibrate(15);
  },

  // ===== ESCAPE HTML =====
  esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },

  // ===== RENDER TABS =====
  renderTabs() {
    const nav = document.getElementById('tabs-nav');
    if (!nav) return;
    const activities = appState.activities;

    let html = '';
    for (const act of activities) {
      const icon = this.icons[act.icon] || this.icons.custom;
      const active = act.id === this._currentActivity ? ' active' : '';
      html += `<button class="tab-btn${active}" data-tab="${act.id}">${icon} <span class="tab-label">${this.esc(act.name)}</span></button>`;
    }
    html += `<button class="tab-btn tab-btn-add" id="btn-add-activity" title="Nova atividade">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 5v14M5 12h14"/></svg>
    </button>`;

    nav.innerHTML = html;

    // Bind tab clicks
    nav.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => this.setActivity(parseInt(btn.dataset.tab) || btn.dataset.tab));
    });

    // Add activity button
    document.getElementById('btn-add-activity')?.addEventListener('click', () => this.showAddActivityModal());
  },

  // ===== RENDER PROGRESS =====
  renderProgress() {
    const prog = appState.getProgress();
    const bar = document.getElementById('progress-fill');
    const text = document.getElementById('progress-text');
    if (bar) bar.style.width = prog.percent + '%';
    if (text) text.textContent = `${prog.checked}/${prog.total} (${prog.percent}%)`;
  },

  // ===== RENDER SEARCH BAR =====
  renderSearchBar(container) {
    container.innerHTML = `
      <div class="search-bar">
        ${this.icons.search}
        <input type="text" id="search-input" placeholder="Buscar material..." value="${this.esc(this._searchQuery)}">
      </div>
    `;
    container.querySelector('#search-input').addEventListener('input', (e) => {
      this._searchQuery = e.target.value.toLowerCase();
      this.renderMaterials();
      this.renderCustomItems();
    });
  },

  // ===== FULL CHECKLIST RENDER =====
  renderChecklist() {
    const main = document.getElementById('checklist-content');
    if (!main) return;

    const act = appState.activities.find(a => a.id === this._currentActivity);
    if (!act) {
      main.innerHTML = '<div class="empty-state">Nenhuma atividade selecionada.</div>';
      return;
    }

    main.innerHTML = `
      <div id="search-container"></div>
      <div class="section-header">
        <div class="section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
          </svg>
          Materiais
        </div>
        <button class="btn-mark-all" id="btn-mark-all">
          ${this.icons.check} Marcar Todos
        </button>
      </div>
      <div id="materials-list"></div>
      <div class="section-title custom-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 5v14M5 12h14"/></svg>
        Itens Personalizados
      </div>
      <div id="custom-items-list"></div>
      <button class="btn-add-item" id="btn-add-custom">
        ${this.icons.plus} Adicionar Material Extra
      </button>
      <div class="section-title custom-section-title" style="margin-top:24px">
        ${this.icons.camera} Fotos
      </div>
      <div id="photos-container"></div>
      <button class="btn-add-item btn-add-photo" id="btn-add-photo">
        ${this.icons.camera} Tirar / Anexar Foto
      </button>
      <div class="section-title custom-section-title" style="margin-top:24px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Observações
      </div>
      <div id="observations-container"></div>
      <div id="geo-container"></div>
    `;

    this.renderSearchBar(document.getElementById('search-container'));
    this.renderMaterials();
    this.renderCustomItems();
    this.renderPhotos();
    this.renderObservations();
    this.renderGeo();
    this.renderProgress();

    // Mark all
    document.getElementById('btn-mark-all')?.addEventListener('click', () => {
      appState.markAll(this._currentActivity);
      this.vibrate();
      this.renderChecklist();
      App.showToast('Todos marcados!');
    });

    // Add custom
    document.getElementById('btn-add-custom')?.addEventListener('click', () => {
      this.showAddItemModal();
    });

    // Add photo
    document.getElementById('btn-add-photo')?.addEventListener('click', async () => {
      const id = await PhotoService.addPhoto(appState.today, this._currentActivity);
      if (id) {
        App.showToast('Foto adicionada!');
        this.renderPhotos();
      }
    });

    // Update active tab
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.classList.toggle('active', String(btn.dataset.tab) === String(this._currentActivity));
    });
  },

  // ===== RENDER MATERIALS =====
  renderMaterials() {
    const container = document.getElementById('materials-list');
    if (!container) return;
    const act = appState.activities.find(a => a.id === this._currentActivity);
    if (!act || !act.materials) { container.innerHTML = ''; return; }

    let html = '';
    for (const mat of act.materials) {
      // Search filter
      if (this._searchQuery && !mat.name.toLowerCase().includes(this._searchQuery)) continue;

      const state = appState.getItemState(act.id, mat.key);
      const isChecked = state.checked || state.qty > 0;

      html += `<div class="material-card ${isChecked ? 'checked' : ''}" data-mat-key="${mat.key}">`;
      html += `<div class="card-main">`;

      // Checkbox
      html += `
        <label class="checkbox-wrapper">
          <input type="checkbox" data-act="${act.id}" data-key="${mat.key}" ${isChecked ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
      `;

      // Info
      html += `<div class="card-info"><span class="card-name">${this.esc(mat.name)}</span>`;

      // Counter
      html += `
        <div class="qty-counter">
          <button class="qty-btn qty-minus" data-act="${act.id}" data-key="${mat.key}" data-dir="-1">−</button>
          <span class="qty-value" id="qty-${act.id}-${mat.key}">${state.qty}</span>
          <button class="qty-btn qty-plus" data-act="${act.id}" data-key="${mat.key}" data-dir="1">+</button>
        </div>
      `;

      // Extra fields
      if (mat.type === 'diameter') {
        const opts = (mat.options || []).map(o => `<option value="${o}" ${state.diameter === o ? 'selected' : ''}>${o}</option>`).join('');
        html += `
          <div class="card-detail">
            <label>Diâmetro:</label>
            <select class="diam-select" data-act="${act.id}" data-key="${mat.key}">
              <option value="">Selecione</option>${opts}
              <option value="custom" ${state.diameter && !(mat.options || []).includes(state.diameter) ? 'selected' : ''}>Outro...</option>
            </select>
            <input type="text" class="diam-custom-input ${(!state.diameter || (mat.options || []).includes(state.diameter)) ? 'hidden' : ''}"
              data-act="${act.id}" data-key="${mat.key}"
              placeholder="Ex: 250mm" value="${this.esc(state.diameter && !(mat.options || []).includes(state.diameter) ? state.diameter : '')}">
          </div>
        `;
      } else if (mat.type === 'radio') {
        html += `<div class="card-detail"><div class="radio-group">`;
        for (const opt of (mat.options || [])) {
          html += `
            <label class="radio-wrapper">
              <input type="radio" name="radio-${act.id}-${mat.key}" value="${opt.value}"
                data-act="${act.id}" data-key="${mat.key}" ${state.type === opt.value ? 'checked' : ''}>
              <span class="radio-mark"></span>
              ${this.esc(opt.label)}
            </label>
          `;
        }
        html += `</div></div>`;
      }

      html += `</div></div></div>`;
    }

    container.innerHTML = html;
    this._bindMaterialEvents(container);
  },

  _bindMaterialEvents(container) {
    // Checkboxes
    container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', () => {
        const actId = parseInt(chk.dataset.act) || chk.dataset.act;
        const key = chk.dataset.key;
        const state = appState.getItemState(actId, key);
        appState.updateItem(actId, key, {
          checked: chk.checked,
          qty: chk.checked ? Math.max(state.qty, 1) : 0
        });
        this.vibrate();
        this.renderChecklist();
      });
    });

    // Qty buttons
    container.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const actId = parseInt(btn.dataset.act) || btn.dataset.act;
        const key = btn.dataset.key;
        const dir = parseInt(btn.dataset.dir);
        const state = appState.getItemState(actId, key);
        const newQty = Math.max(0, state.qty + dir);
        appState.updateItem(actId, key, { qty: newQty, checked: newQty > 0 });
        this.vibrate();
        this.renderChecklist();
      });
    });

    // Diameter selects
    container.querySelectorAll('.diam-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const actId = parseInt(sel.dataset.act) || sel.dataset.act;
        const key = sel.dataset.key;
        const customInput = sel.parentElement.querySelector('.diam-custom-input');
        if (sel.value === 'custom') {
          customInput?.classList.remove('hidden');
          customInput?.focus();
        } else {
          customInput?.classList.add('hidden');
          appState.updateItem(actId, key, { diameter: sel.value });
        }
      });
    });

    // Custom diameter inputs
    container.querySelectorAll('.diam-custom-input').forEach(inp => {
      inp.addEventListener('input', () => {
        const actId = parseInt(inp.dataset.act) || inp.dataset.act;
        const key = inp.dataset.key;
        appState.updateItem(actId, key, { diameter: inp.value });
      });
    });

    // Radios
    container.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const actId = parseInt(radio.dataset.act) || radio.dataset.act;
        const key = radio.dataset.key;
        appState.updateItem(actId, key, { type: radio.value });
        this.vibrate();
      });
    });
  },

  // ===== RENDER CUSTOM ITEMS =====
  renderCustomItems() {
    const container = document.getElementById('custom-items-list');
    if (!container) return;

    const items = appState.getCustomItems(this._currentActivity);
    const filtered = this._searchQuery
      ? items.filter(i => i.name.toLowerCase().includes(this._searchQuery))
      : items;

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">Nenhum item extra cadastrado.</div>';
      return;
    }

    let html = '';
    for (const item of filtered) {
      const state = appState.getCustomCheckState(item.id);
      const isChecked = state.checked || state.qty > 0;

      html += `
        <div class="custom-item-card ${isChecked ? 'checked' : ''}" data-custom-id="${item.id}">
          <label class="checkbox-wrapper">
            <input type="checkbox" data-custom-id="${item.id}" ${isChecked ? 'checked' : ''}>
            <span class="checkmark"></span>
          </label>
          <div class="custom-item-info">
            <div class="custom-item-name">${this.esc(item.name)}</div>
            ${item.qty ? `<div class="custom-item-qty">${this.esc(item.qty)}</div>` : ''}
          </div>
          <div class="qty-counter qty-counter-sm">
            <button class="qty-btn qty-minus" data-custom-id="${item.id}" data-dir="-1">−</button>
            <span class="qty-value">${state.qty}</span>
            <button class="qty-btn qty-plus" data-custom-id="${item.id}" data-dir="1">+</button>
          </div>
          <button class="btn-delete-item" data-delete-id="${item.id}" aria-label="Remover">
            ${this.icons.trash}
          </button>
        </div>
      `;
    }

    container.innerHTML = html;

    // Bind events
    container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = parseInt(chk.dataset.customId);
        const state = appState.getCustomCheckState(id);
        appState.updateCustomCheck(id, { checked: chk.checked, qty: chk.checked ? Math.max(state.qty, 1) : 0 });
        this.vibrate();
        this.renderChecklist();
      });
    });

    container.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.customId);
        const dir = parseInt(btn.dataset.dir);
        const state = appState.getCustomCheckState(id);
        const newQty = Math.max(0, state.qty + dir);
        appState.updateCustomCheck(id, { qty: newQty, checked: newQty > 0 });
        this.vibrate();
        this.renderChecklist();
      });
    });

    container.querySelectorAll('.btn-delete-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.deleteId);
        const item = appState.getCustomItems(this._currentActivity).find(i => i.id === id);
        if (confirm(`Remover "${item?.name}" da lista?`)) {
          await appState.deleteCustomItem(id);
          this.vibrate();
          this.renderChecklist();
          App.showToast('Item removido');
        }
      });
    });

    // Swipe to delete
    this._bindSwipeDelete(container);
  },

  // ===== SWIPE TO DELETE =====
  _bindSwipeDelete(container) {
    container.querySelectorAll('.custom-item-card').forEach(card => {
      let startX = 0, currentX = 0, swiping = false;

      card.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        swiping = true;
        card.style.transition = 'none';
      }, { passive: true });

      card.addEventListener('touchmove', (e) => {
        if (!swiping) return;
        currentX = e.touches[0].clientX;
        const dx = currentX - startX;
        if (dx < -10) {
          card.style.transform = `translateX(${Math.max(dx, -100)}px)`;
        }
      }, { passive: true });

      card.addEventListener('touchend', async () => {
        if (!swiping) return;
        swiping = false;
        const dx = currentX - startX;
        card.style.transition = 'transform 0.3s ease';
        if (dx < -80) {
          const id = parseInt(card.dataset.customId);
          card.style.transform = 'translateX(-120%)';
          setTimeout(async () => {
            await appState.deleteCustomItem(id);
            this.renderChecklist();
            App.showToast('Item removido');
          }, 300);
        } else {
          card.style.transform = '';
        }
        currentX = 0;
      });
    });
  },

  // ===== RENDER PHOTOS =====
  async renderPhotos() {
    const container = document.getElementById('photos-container');
    if (!container) return;

    // Cleanup old URLs
    this._thumbUrls.forEach(u => URL.revokeObjectURL(u));
    this._thumbUrls = [];

    const photos = await PhotoService.getPhotos(appState.today, this._currentActivity);
    if (photos.length === 0) {
      container.innerHTML = '<div class="empty-state">Nenhuma foto adicionada.</div>';
      return;
    }

    let html = '<div class="photo-grid">';
    for (const photo of photos) {
      const url = PhotoService.createThumbnailUrl(photo.thumbnail || photo.blob);
      this._thumbUrls.push(url);
      html += `
        <div class="photo-thumb" data-photo-id="${photo.id}">
          <img src="${url}" alt="Foto" loading="lazy">
          <button class="photo-delete" data-photo-del="${photo.id}">×</button>
        </div>
      `;
    }
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.photo-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.photoDel);
        if (confirm('Remover esta foto?')) {
          await PhotoService.deletePhoto(id);
          this.renderPhotos();
          App.showToast('Foto removida');
        }
      });
    });
  },

  // ===== RENDER OBSERVATIONS =====
  renderObservations() {
    const container = document.getElementById('observations-container');
    if (!container) return;

    const obs = appState.getObservation(this._currentActivity);
    container.innerHTML = `
      <textarea class="obs-textarea" id="obs-textarea" placeholder="Condições do serviço, anotações..."
        rows="3">${this.esc(obs)}</textarea>
    `;

    let debounce = null;
    container.querySelector('#obs-textarea').addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        appState.setObservation(this._currentActivity, e.target.value);
      }, 400);
    });
  },

  // ===== RENDER GEOLOCATION =====
  renderGeo() {
    const container = document.getElementById('geo-container');
    if (!container) return;

    const geo = GeoService.current;
    const address = appState.getAddress();

    container.innerHTML = `
      <div class="section-title custom-section-title" style="margin-top:24px">
        ${this.icons.map} Localização
      </div>
      <div class="form-group" style="margin-bottom:8px; position:relative;">
        <input type="text" id="input-address" class="obs-textarea" 
          placeholder="Ex: Rua das Flores, 123 - Atibaia" 
          value="${this.esc(address)}" 
          autocomplete="off"
          style="padding:12px; font-size:0.95rem; width:100%; box-sizing:border-box;">
        <div id="address-results" class="autocomplete-results" style="display:none;"></div>
      </div>
      ${geo ? `<div class="geo-info" style="opacity:0.6; font-size:0.75rem;">
        ${this.icons.map}
        <a href="${GeoService.getMapsUrl(geo)}" target="_blank" rel="noopener">
          GPS: ${GeoService.formatCoords(geo)}
        </a>
        <span class="geo-time">${new Date(geo.timestamp).toLocaleTimeString('pt-BR')}</span>
      </div>` : `
      <button class="btn-geo" id="btn-capture-geo" style="margin-top:8px;">
        ${this.icons.map} Capturar GPS
      </button>`}
    `;

    // Address input autocomplete
    let debounce = null;
    const input = document.getElementById('input-address');
    const resultsContainer = document.getElementById('address-results');

    input?.addEventListener('input', (e) => {
      const val = e.target.value;
      appState.setAddress(val);
      
      clearTimeout(debounce);
      if (val.length < 5) {
        resultsContainer.style.display = 'none';
        return;
      }
      
      debounce = setTimeout(async () => {
        try {
          const params = new URLSearchParams({
            SingleLine: val,
            city: 'Atibaia',
            region: 'SP',
            countryCode: 'BRA',
            f: 'json',
            outSR: '4326',
            maxLocations: '4'
          });
          const res = await fetch('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?' + params.toString());
          const data = await res.json();
          
          if (data.candidates && data.candidates.length > 0) {
            resultsContainer.innerHTML = data.candidates.map(c => 
              `<div class="address-item" data-lat="${c.location.y}" data-lng="${c.location.x}">${this.esc(c.address)}</div>`
            ).join('');
            resultsContainer.style.display = 'block';
            
            // Add click listeners to items
            resultsContainer.querySelectorAll('.address-item').forEach(item => {
              item.addEventListener('click', () => {
                const selectedAddress = item.textContent;
                input.value = selectedAddress;
                appState.setAddress(selectedAddress);
                appState.setGeo({
                  lat: parseFloat(item.dataset.lat),
                  lng: parseFloat(item.dataset.lng),
                  accuracy: 0,
                  timestamp: Date.now()
                });
                resultsContainer.style.display = 'none';
                this.renderGeo();
              });
            });
          } else {
            resultsContainer.style.display = 'none';
          }
        } catch (err) {
          console.warn('Geocoding error:', err);
          resultsContainer.style.display = 'none';
        }
      }, 500);
    });

    // Capture GPS button
    document.getElementById('btn-capture-geo')?.addEventListener('click', async () => {
      container.querySelector('#btn-capture-geo').textContent = 'Capturando...';
      await GeoService.capture();
      this.renderGeo();
    });
  },

  // ===== MODALS =====
  showAddItemModal() {
    const overlay = document.getElementById('modal-overlay');
    const form = document.getElementById('form-add-item');
    const nameInput = document.getElementById('input-item-name');
    const qtyInput = document.getElementById('input-item-qty');

    document.getElementById('modal-title').textContent = 'Adicionar Material';
    document.getElementById('input-item-activity').value = this._currentActivity;
    nameInput.value = '';
    qtyInput.value = '';
    overlay.classList.add('active');
    setTimeout(() => nameInput.focus(), 350);
  },

  showAddActivityModal() {
    const overlay = document.getElementById('modal-activity-overlay');
    const input = document.getElementById('input-activity-name');
    input.value = '';
    overlay.classList.add('active');
    setTimeout(() => input.focus(), 350);
  }
};
