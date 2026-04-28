/**
 * state.js — Centralized State Management with Debounced Auto-Save
 */

class AppState {
  constructor() {
    this._saveTimer = null;
    this._saveDelay = 500; // ms debounce
    this._today = this._getDateStr();
    this._checklist = null;
    this._activities = [];
    this._customItems = {};
    this._listeners = new Set();
  }

  // ===== DATE HELPERS =====

  _getDateStr(date) {
    const d = date || new Date();
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  get today() {
    return this._today;
  }

  get todayFormatted() {
    const d = new Date(this._today + 'T12:00:00');
    const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const f = d.toLocaleDateString('pt-BR', opts);
    return f.charAt(0).toUpperCase() + f.slice(1);
  }

  // ===== INITIALIZATION =====

  async init() {
    await db.seedDefaults();
    this._activities = await db.getActivities();
    await this._loadToday();
    await this._loadCustomItems();

    // Restore team name from localStorage if checklist doesn't have one
    if (!this._checklist.teamName) {
      const saved = localStorage.getItem('teamName');
      if (saved) {
        this._checklist.teamName = saved;
        this._schedSave();
      }
    }
  }

  async _loadToday() {
    this._checklist = await db.getChecklist(this._today);
    if (!this._checklist) {
      this._checklist = this._createEmptyChecklist();
    }
  }

  async _loadCustomItems() {
    const all = await db.getAllCustomItems();
    this._customItems = {};
    for (const item of all) {
      if (!this._customItems[item.activityId]) {
        this._customItems[item.activityId] = [];
      }
      this._customItems[item.activityId].push(item);
    }
  }

  _createEmptyChecklist() {
    return {
      date: this._today,
      createdAt: Date.now(),
      teamName: localStorage.getItem('teamName') || '',
      items: {},       // { "activityId-materialKey": { checked: false, qty: 0, diameter: '', type: '' } }
      customChecks: {}, // { "custom-itemId": { checked: false, qty: 0 } }
      observations: {}, // { activityId: "text" }
      geo: null         // { lat, lng, timestamp }
    };
  }

  // ===== TEAM NAME =====

  get teamName() {
    return this._checklist?.teamName || '';
  }

  setTeamName(name) {
    this._checklist.teamName = name;
    localStorage.setItem('teamName', name); // persist across new days
    this._schedSave();
    this._notify();
  }

  // ===== GETTERS =====

  get activities() {
    return this._activities;
  }

  get checklist() {
    return this._checklist;
  }

  getCustomItems(activityId) {
    return this._customItems[activityId] || [];
  }

  getItemState(activityId, key) {
    const id = `${activityId}-${key}`;
    if (!this._checklist.items[id]) {
      this._checklist.items[id] = { checked: false, qty: 0, diameter: '', type: '' };
    }
    return this._checklist.items[id];
  }

  getCustomCheckState(itemId) {
    const key = `custom-${itemId}`;
    if (!this._checklist.customChecks[key]) {
      this._checklist.customChecks[key] = { checked: false, qty: 0 };
    }
    return this._checklist.customChecks[key];
  }

  getObservation(activityId) {
    return this._checklist.observations[activityId] || '';
  }

  getProgress() {
    const items = this._checklist.items;
    const customs = this._checklist.customChecks;
    let total = 0;
    let checked = 0;

    // Count fixed materials across all activities
    for (const act of this._activities) {
      for (const mat of (act.materials || [])) {
        total++;
        const state = items[`${act.id}-${mat.key}`];
        if (state && (state.checked || state.qty > 0)) checked++;
      }
    }

    // Count custom items
    for (const actId in this._customItems) {
      for (const item of this._customItems[actId]) {
        total++;
        const state = customs[`custom-${item.id}`];
        if (state && (state.checked || state.qty > 0)) checked++;
      }
    }

    return { total, checked, percent: total > 0 ? Math.round((checked / total) * 100) : 0 };
  }

  // ===== SETTERS (with debounced save) =====

  updateItem(activityId, key, updates) {
    const id = `${activityId}-${key}`;
    if (!this._checklist.items[id]) {
      this._checklist.items[id] = { checked: false, qty: 0, diameter: '', type: '' };
    }
    Object.assign(this._checklist.items[id], updates);
    this._schedSave();
    this._notify();
  }

  updateCustomCheck(itemId, updates) {
    const key = `custom-${itemId}`;
    if (!this._checklist.customChecks[key]) {
      this._checklist.customChecks[key] = { checked: false, qty: 0 };
    }
    Object.assign(this._checklist.customChecks[key], updates);
    this._schedSave();
    this._notify();
  }

  setObservation(activityId, text) {
    this._checklist.observations[activityId] = text;
    this._schedSave();
  }

  setGeo(geo) {
    this._checklist.geo = geo;
    this._schedSave();
  }

  // ===== MARK ALL / UNMARK ALL =====

  markAll(activityId) {
    const act = this._activities.find(a => a.id === activityId);
    if (act) {
      for (const mat of (act.materials || [])) {
        this.updateItem(activityId, mat.key, { checked: true, qty: Math.max(this.getItemState(activityId, mat.key).qty, 1) });
      }
    }
    const customs = this.getCustomItems(activityId);
    for (const item of customs) {
      this.updateCustomCheck(item.id, { checked: true, qty: Math.max(this.getCustomCheckState(item.id).qty, 1) });
    }
    this._notify();
  }

  // ===== CUSTOM ITEM MANAGEMENT =====

  async addCustomItem(activityId, name, qty) {
    const id = await db.addCustomItem({ activityId, name, qty });
    await this._loadCustomItems();
    this._notify();
    return id;
  }

  async deleteCustomItem(id) {
    // Clean up check state
    delete this._checklist.customChecks[`custom-${id}`];
    await db.deleteCustomItem(id);
    await this._loadCustomItems();
    this._schedSave();
    this._notify();
  }

  // ===== ACTIVITY MANAGEMENT =====

  async addActivity(name) {
    const id = await db.addActivity({
      name,
      icon: 'custom',
      isCustom: true,
      materials: []
    });
    this._activities = await db.getActivities();
    this._notify();
    return id;
  }

  async deleteActivity(id) {
    // Clean up checklist items associated with this activity
    for (const key in this._checklist.items) {
      if (key.startsWith(`${id}-`)) {
        delete this._checklist.items[key];
      }
    }
    // Clean up observation
    delete this._checklist.observations[id];

    await db.deleteActivity(id);
    this._activities = await db.getActivities();
    this._schedSave();
    this._notify();
  }

  // ===== NEW DAY =====

  async startNewDay() {
    // Save current checklist one final time
    await this._saveNow();

    // Archive: copy the completed checklist with a timestamped key so it stays in history
    const completed = { ...this._checklist };
    const archiveDate = completed.date + '_' + Date.now();
    completed.archivedFrom = completed.date;
    completed.date = archiveDate;
    await db.saveChecklist(completed);

    // Add to sync queue
    await db.addPendingSync(this._checklist);

    // Delete the active day checklist from db to prevent duplication
    await db.deleteChecklist(this._checklist.date);

    // Clear all activities (tabs) and custom items
    await db.clearAllActivities();
    this._activities = [];
    this._customItems = {};

    // Reset geolocation in memory
    if (window.GeoService) GeoService.reset();

    // Reset in-memory state (new empty checklist for today)
    this._checklist = this._createEmptyChecklist();
    await this._saveNow();
    this._notify();
  }

  // ===== DEBOUNCED SAVE =====

  _schedSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._saveNow(), this._saveDelay);
  }

  async _saveNow() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = null;
    try {
      await db.saveChecklist(this._checklist);
    } catch (e) {
      console.error('[State] Save failed:', e);
    }
  }

  // ===== CHANGE LISTENERS =====

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _notify() {
    for (const fn of this._listeners) {
      try { fn(); } catch (e) { console.error('[State] Listener error:', e); }
    }
  }
}

// Singleton
const appState = new AppState();
