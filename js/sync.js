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

    if (!window.FirebaseDB || !window.FirebaseStorage) {
      console.warn('[Sync] Firebase não configurado. Abortando sync real.');
      return;
    }

    console.log(`[Sync] Iniciando sync de ${pending.length} checklists...`);

    for (const item of pending) {
      try {
        const checklist = item.data;
        const displayDate = checklist.archivedFrom || checklist.date.split('_')[0];
        
        // 1. Fetch photos for this checklist
        const photos = await db.getPhotos(displayDate);
        const uploadedPhotos = [];

        // 2. Upload photos to Firebase Storage
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          const fileName = `checklists/${checklist.date}/foto_${photo.activityId}_${photo.timestamp}.jpg`;
          const storageRef = window.FirebaseStorage.ref().child(fileName);
          
          console.log(`[Sync] Fazendo upload da foto ${i+1}/${photos.length}...`);
          // Se for blob, envia direto
          const uploadTask = await storageRef.put(photo.blob);
          const downloadUrl = await uploadTask.ref.getDownloadURL();
          
          uploadedPhotos.push({
            activityId: photo.activityId,
            timestamp: photo.timestamp,
            url: downloadUrl
          });
        }

        // 3. Prepare final document
        const firestoreData = {
          ...checklist,
          photos: uploadedPhotos,
          syncedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // 4. Save to Firestore
        console.log(`[Sync] Salvando checklist no Firestore...`);
        await window.FirebaseDB.collection('checklists').doc(checklist.date).set(firestoreData);

        // 5. Remove from local pending queue
        await db.deletePendingSyncItem(item.id);
        console.log(`[Sync] Item ${checklist.date} sincronizado com sucesso!`);

      } catch (e) {
        console.error('[Sync] Falha ao sincronizar item:', e);
        // Break on first error to retry later (e.g. if network drops mid-upload)
        break;
      }
    }

    await this._updateCount();
    this._updateStatusUI(navigator.onLine);
    console.log('[Sync] Processo concluído. Restantes:', this._pendingCount);
  },

  isOnline() {
    return navigator.onLine;
  }
};
