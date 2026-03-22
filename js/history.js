/**
 * history.js — History view with dashboard metrics
 */

const HistoryView = {
  async render(container) {
    const checklists = await db.getAllChecklists();
    const today = appState.today;
    const pastChecklists = checklists.filter(c => c.date !== today);

    container.innerHTML = `
      <div class="history-header">
        <h2 class="view-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Histórico de Checklists
        </h2>
      </div>
      <div id="metrics-dashboard"></div>
      <div class="history-list" id="history-list"></div>
    `;

    // Render dashboard
    this._renderDashboard(pastChecklists, container.querySelector('#metrics-dashboard'));

    const list = container.querySelector('#history-list');

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

  // ===== DASHBOARD METRICS =====
  _renderDashboard(checklists, container) {
    if (!container || checklists.length === 0) {
      if (container) container.innerHTML = '';
      return;
    }

    // Calculate metrics
    let totalPcts = 0;
    let completeDays = 0;
    const materialCounts = {};

    for (const ck of checklists) {
      let total = 0, checked = 0;
      for (const key in ck.items) {
        total++;
        const item = ck.items[key];
        if (item.checked || item.qty > 0) {
          checked++;
          // Track material usage by key
          const matKey = key.split('-').slice(1).join('-');
          materialCounts[matKey] = (materialCounts[matKey] || 0) + (item.qty || 1);
        }
      }
      for (const key in ck.customChecks) {
        total++;
        if (ck.customChecks[key].checked || ck.customChecks[key].qty > 0) checked++;
      }
      const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
      totalPcts += pct;
      if (pct === 100) completeDays++;
    }

    const avgPct = Math.round(totalPcts / checklists.length);

    // Top 5 materials
    const topMaterials = Object.entries(materialCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    container.innerHTML = `
      <div class="metrics-grid">
        <div class="metric-card">
          <span class="metric-value">${avgPct}%</span>
          <span class="metric-label">Conclusão média</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${completeDays}</span>
          <span class="metric-label">Dias completos</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${checklists.length}</span>
          <span class="metric-label">Total de dias</span>
        </div>
      </div>
      <div class="metrics-chart-section">
        <div class="section-title" style="margin-bottom:8px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
          Materiais mais usados
        </div>
        <canvas id="metrics-chart" height="160"></canvas>
      </div>
    `;

    // Draw bar chart
    if (topMaterials.length > 0) {
      this._drawBarChart(container.querySelector('#metrics-chart'), topMaterials);
    }
  },

  _drawBarChart(canvas, data) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width, h = rect.height;

    const maxVal = Math.max(...data.map(d => d[1]), 1);
    const barW = Math.min(40, (w - 40) / data.length - 10);
    const startX = 40;
    const barArea = h - 40;
    const gap = (w - startX - data.length * barW) / (data.length + 1);

    // Y axis
    ctx.strokeStyle = '#E0E4EC';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX, 5);
    ctx.lineTo(startX, h - 25);
    ctx.stroke();

    // Bars
    const colors = ['#0D47A1', '#1565C0', '#1976D2', '#2E7D32', '#43A047'];
    data.forEach(([label, value], i) => {
      const barH = (value / maxVal) * (barArea - 10);
      const x = startX + gap * (i + 1) + barW * i;
      const y = h - 25 - barH;

      // Bar
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 4);
      ctx.fill();

      // Value
      ctx.fillStyle = '#1A1A2E';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(value.toString(), x + barW / 2, y - 5);

      // Label
      ctx.fillStyle = '#5A6072';
      ctx.font = '500 9px Inter, sans-serif';
      const lbl = label.length > 8 ? label.slice(0, 7) + '…' : label;
      ctx.fillText(lbl, x + barW / 2, h - 8);
    });
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
        <button class="btn-back" id="btn-back" aria-label="Voltar ao histórico">
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
