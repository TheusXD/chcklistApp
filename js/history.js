/**
 * history.js — History view: list past checklists and show details
 */

const HistoryView = {
  async render(container) {
    const checklists = await db.getAllChecklists();
    const today = appState.today;

    container.innerHTML = `
      <div class="history-header">
        <h2 class="view-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Histórico de Checklists
        </h2>
      </div>
      <div class="history-list" id="history-list"></div>
    `;

    const list = container.querySelector('#history-list');

    const pastChecklists = checklists.filter(c => c.date !== today);

    if (pastChecklists.length === 0) {
      list.innerHTML = '<div class="empty-state">Nenhum checklist anterior encontrado.</div>';
      return;
    }

    for (const ck of pastChecklists) {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.setAttribute('data-date', ck.date);

      // Count stats
      let total = 0, checked = 0;
      for (const key in ck.items) {
        total++;
        if (ck.items[key].checked || ck.items[key].qty > 0) checked++;
      }
      for (const key in ck.customChecks) {
        total++;
        if (ck.customChecks[key].checked || ck.customChecks[key].qty > 0) checked++;
      }
      const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

      const dateObj = new Date(ck.date + 'T12:00:00');
      const dateStr = dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      const hasPhotos = await db.getPhotos(ck.date);
      const hasGeo = !!ck.geo;

      card.innerHTML = `
        <div class="history-card-top">
          <div class="history-date">${dateStr}</div>
          <div class="history-pct ${pct === 100 ? 'complete' : ''}">${pct}%</div>
        </div>
        <div class="history-progress-bar">
          <div class="history-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="history-meta">
          <span>${checked}/${total} itens</span>
          ${hasPhotos.length > 0 ? `<span>📷 ${hasPhotos.length}</span>` : ''}
          ${hasGeo ? '<span>📍</span>' : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        window.location.hash = `#history/${ck.date}`;
      });

      list.appendChild(card);
    }
  },

  async renderDetail(container, date) {
    const ck = await db.getChecklist(date);
    if (!ck) {
      container.innerHTML = '<div class="empty-state">Checklist não encontrado.</div>';
      return;
    }

    const activities = await db.getActivities();
    const customItems = await db.getAllCustomItems();
    const photos = await db.getPhotos(date);
    const dateObj = new Date(date + 'T12:00:00');
    const dateStr = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let html = `
      <div class="detail-header">
        <button class="btn-back" id="btn-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Voltar
        </button>
        <h2 class="view-title">${dateStr}</h2>
      </div>
    `;

    // Geo
    if (ck.geo) {
      html += `
        <div class="detail-geo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <a href="${GeoService.getMapsUrl(ck.geo)}" target="_blank" rel="noopener">
            ${GeoService.formatCoords(ck.geo)}
          </a>
        </div>
      `;
    }

    for (const act of activities) {
      html += `<div class="detail-activity">`;
      html += `<div class="section-title">${act.name}</div>`;

      // Materials
      for (const mat of (act.materials || [])) {
        const state = ck.items[`${act.id}-${mat.key}`] || {};
        const checked = state.checked || state.qty > 0;
        const qty = state.qty || 0;
        let extra = '';
        if (state.diameter) extra += ` — ${state.diameter}`;
        if (state.type) extra += ` — ${state.type}`;

        html += `
          <div class="detail-item ${checked ? 'checked' : ''}">
            <span class="detail-check">${checked ? '✅' : '⬜'}</span>
            <span class="detail-name">${mat.name}${extra}</span>
            <span class="detail-qty">${qty > 0 ? `×${qty}` : ''}</span>
          </div>
        `;
      }

      // Custom items for this activity
      const actCustom = customItems.filter(i => i.activityId === act.id);
      for (const item of actCustom) {
        const state = ck.customChecks[`custom-${item.id}`] || {};
        const checked = state.checked || state.qty > 0;
        const qty = state.qty || 0;
        html += `
          <div class="detail-item custom ${checked ? 'checked' : ''}">
            <span class="detail-check">${checked ? '✅' : '⬜'}</span>
            <span class="detail-name">${item.name}${item.qty ? ` (${item.qty})` : ''}</span>
            <span class="detail-qty">${qty > 0 ? `×${qty}` : ''}</span>
          </div>
        `;
      }

      // Observation
      const obs = ck.observations[act.id];
      if (obs) {
        html += `<div class="detail-obs"><strong>Obs:</strong> ${obs}</div>`;
      }

      html += `</div>`;
    }

    // Photos
    if (photos.length > 0) {
      html += `<div class="section-title custom-section-title">Fotos</div>`;
      html += `<div class="photo-grid detail-photos">`;
      for (const photo of photos) {
        const url = PhotoService.createThumbnailUrl(photo.thumbnail || photo.blob);
        html += `<div class="photo-thumb"><img src="${url}" alt="Foto"></div>`;
      }
      html += `</div>`;
    }

    container.innerHTML = html;

    container.querySelector('#btn-back')?.addEventListener('click', () => {
      window.location.hash = '#history';
    });
  }
};
