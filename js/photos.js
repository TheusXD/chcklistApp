/**
 * photos.js — Photo capture, resize, and IndexedDB storage
 */

const PhotoService = {
  MAX_THUMB_SIZE: 200,
  MAX_PHOTO_SIZE: 1200,

  /**
   * Open file picker / camera capture
   * Returns { blob, thumbnail } or null
   */
  async capturePhoto() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return resolve(null);
        try {
          const blob = await this._resizeImage(file, this.MAX_PHOTO_SIZE);
          const thumbnail = await this._resizeImage(file, this.MAX_THUMB_SIZE);
          resolve({ blob, thumbnail });
        } catch (e) {
          console.error('[Photos] Resize error:', e);
          resolve(null);
        }
      };
      input.click();
    });
  },

  async _resizeImage(file, maxSize) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = (h / w) * maxSize; w = maxSize; }
          else { w = (w / h) * maxSize; h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')),
          'image/jpeg', 0.85
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });
  },

  async addPhoto(checklistDate, activityId) {
    const result = await this.capturePhoto();
    if (!result) return null;
    const id = await db.addPhoto({
      checklistDate,
      activityId,
      blob: result.blob,
      thumbnail: result.thumbnail,
      timestamp: Date.now()
    });
    return id;
  },

  async getPhotos(checklistDate, activityId) {
    return await db.getPhotos(checklistDate, activityId);
  },

  async deletePhoto(id) {
    return await db.deletePhoto(id);
  },

  createThumbnailUrl(blob) {
    return URL.createObjectURL(blob);
  },

  async blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }
};
