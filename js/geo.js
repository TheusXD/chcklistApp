/**
 * geo.js — Geolocation capture
 */

const GeoService = {
  _position: null,

  reset() {
    this._position = null;
  },

  async capture() {
    if (!('geolocation' in navigator)) {
      console.warn('[Geo] Geolocation not supported');
      return null;
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geo = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: Date.now()
          };
          this._position = geo;
          appState.setGeo(geo);
          resolve(geo);
        },
        (err) => {
          console.warn('[Geo] Error:', err.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  },

  get current() {
    return this._position || (appState.checklist && appState.checklist.geo);
  },

  formatCoords(geo) {
    if (!geo) return 'Não disponível';
    return `${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}`;
  },

  getMapsUrl(geo) {
    if (!geo) return '#';
    return `https://www.google.com/maps?q=${geo.lat},${geo.lng}`;
  }
};
