/**
 * sync.js — Online/Offline Sync Service
 */

const SyncService = {
  _pendingCount: 0,

  async init() {
    await this._updateCount();
    window.addEventListener('online', () => this.onOnline());
    window.addEventListener('offline', () => this.onOffline());
  },

  onOnline() {
    this._updateStatusUI(true);
    this.syncPending();
  },

  onOffline() {
    this._updateStatusUI(false);
  },

  _updateStatusUI(online) {
    const dot = document.querySelector('.status-dot');
    const text = document.querySelector('.status-text');
    if (dot) dot.classList.toggle('offline', !online);
    if (text) text.textContent = online ? 'Online' : 'Offline';

    const syncBadge = document.getElementById('sync-badge');
    if (syncBadge) {
      syncBadge.classList.toggle('hidden', this._pendingCount === 0);
      syncBadge.textContent = this._pendingCount;
    }
  },

  async _updateCount() {
    const pending = await db.getPendingSync();
    this._pendingCount = pending.length;
  },

  async syncPending() {
    if (!navigator.onLine) return;
    const pending = await db.getPendingSync();
    if (pending.length === 0) return;

    console.log(`[Sync] Syncing ${pending.length} pending items...`);

    for (const item of pending) {
      try {
        // Simulated sync — in production, replace with actual API call
        // await fetch('/api/checklists', { method: 'POST', body: JSON.stringify(item.data) });
        console.log('[Sync] Sent:', item.data.date || 'unknown', item.data);
        await db.deletePendingSyncItem(item.id);
      } catch (e) {
        console.warn('[Sync] Failed to sync item:', e);
        break; // Stop on first failure, retry later
      }
    }

    await this._updateCount();
    this._updateStatusUI(navigator.onLine);
    console.log('[Sync] Complete. Remaining:', this._pendingCount);
  },

  isOnline() {
    return navigator.onLine;
  }
};
