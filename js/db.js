/**
 * db.js — IndexedDB via Dexie.js
 * Database schema and CRUD operations for the Checklist PWA
 */

const DB_NAME = 'ChecklistCampoDB';
const DB_VERSION = 2;

class ChecklistDB {
  constructor() {
    this.db = new Dexie(DB_NAME);
    this._defineSchema();
  }

  _defineSchema() {
    this.db.version(1).stores({
      checklists: 'date, createdAt',
      customItems: '++id, activityId',
      activities: '++id, name, isCustom',
      photos: '++id, checklistDate, activityId, timestamp',
      pendingSync: '++id, timestamp'
    });

    this.db.version(2).stores({
      checklists: 'date, createdAt',
      customItems: '++id, activityId',
      activities: '++id, name, isCustom',
      photos: '++id, checklistDate, activityId, timestamp',
      pendingSync: '++id, timestamp',
      templates: '++id, name, createdAt'
    });
  }

  // ===== CHECKLISTS =====

  async getChecklist(date) {
    return await this.db.checklists.get(date);
  }

  async saveChecklist(data) {
    // data must include { date, ... }
    return await this.db.checklists.put(data);
  }

  async getAllChecklists() {
    return await this.db.checklists.orderBy('date').reverse().toArray();
  }

  async deleteChecklist(date) {
    // Also delete associated photos
    await this.db.photos.where('checklistDate').equals(date).delete();
    return await this.db.checklists.delete(date);
  }

  // ===== CUSTOM ITEMS =====

  async getCustomItems(activityId) {
    return await this.db.customItems.where('activityId').equals(activityId).toArray();
  }

  async getAllCustomItems() {
    return await this.db.customItems.toArray();
  }

  async addCustomItem(item) {
    return await this.db.customItems.add(item);
  }

  async deleteCustomItem(id) {
    return await this.db.customItems.delete(id);
  }

  // ===== ACTIVITIES =====

  async getActivities() {
    return await this.db.activities.toArray();
  }

  async addActivity(activity) {
    return await this.db.activities.add(activity);
  }

  async deleteActivity(id) {
    // Also delete associated custom items
    await this.db.customItems.where('activityId').equals(id).delete();
    return await this.db.activities.delete(id);
  }

  // ===== PHOTOS =====

  async getPhotos(checklistDate, activityId) {
    if (activityId) {
      return await this.db.photos
        .where({ checklistDate, activityId })
        .toArray();
    }
    return await this.db.photos.where('checklistDate').equals(checklistDate).toArray();
  }

  async addPhoto(photo) {
    return await this.db.photos.add(photo);
  }

  async deletePhoto(id) {
    return await this.db.photos.delete(id);
  }

  // ===== SYNC QUEUE =====

  async addPendingSync(data) {
    return await this.db.pendingSync.add({
      data,
      timestamp: Date.now()
    });
  }

  async getPendingSync() {
    return await this.db.pendingSync.toArray();
  }

  async clearPendingSync() {
    return await this.db.pendingSync.clear();
  }

  async deletePendingSyncItem(id) {
    return await this.db.pendingSync.delete(id);
  }

  // ===== TEMPLATES =====

  async addTemplate(template) {
    return await this.db.templates.add(template);
  }

  async getTemplate(id) {
    return await this.db.templates.get(id);
  }

  async getAllTemplates() {
    return await this.db.templates.orderBy('createdAt').reverse().toArray();
  }

  async deleteTemplate(id) {
    return await this.db.templates.delete(id);
  }

  // ===== SEED DEFAULT ACTIVITIES =====

  async seedDefaults() {
    // Sem atividades padrão — o usuário cria as suas pelo botão "+"
  }
}

// Singleton
const db = new ChecklistDB();
