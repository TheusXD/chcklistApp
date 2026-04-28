/**
 * share.js — Share checklist summary via Web Share API or WhatsApp
 */

const ShareService = {
  buildTextSummary() {
    const ck = appState.checklist;
    if (!ck) return 'Nenhum checklist disponível.';

    const dateObj = new Date(ck.date + 'T12:00:00');
    const dateStr = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let text = `📋 Checklist de Campo\n📅 ${dateStr}\n`;

    // Team
    if (ck.teamName) {
      text += `👥 Equipe: ${ck.teamName}\n`;
    }

    // Address + Geo
    const address = ck.address || '';
    if (address) {
      const mapsSearch = `https://www.google.com/maps/search/${encodeURIComponent(address)}`;
      text += `📍 ${address}\n🗺️ ${mapsSearch}\n`;
    } else if (ck.geo) {
      text += `📍 ${GeoService.formatCoords(ck.geo)}\n🗺️ ${GeoService.getMapsUrl(ck.geo)}\n`;
    }

    // Progress
    const prog = appState.getProgress();
    text += `\n✅ Progresso: ${prog.checked}/${prog.total} (${prog.percent}%)\n`;

    // Activities
    for (const act of appState.activities) {
      text += `\n🔧 ${act.name}\n`;

      for (const mat of (act.materials || [])) {
        const state = ck.items[`${act.id}-${mat.key}`] || {};
        const checked = state.checked || state.qty > 0;
        const qty = state.qty || 0;
        let detail = '';
        if (state.diameter) detail += ` (${state.diameter})`;
        if (state.type) detail += ` (${state.type})`;

        if (checked || qty > 0) {
          text += `  ✓ ${mat.name}${detail} — ${qty} un\n`;
        } else {
          text += `  ✗ ${mat.name}\n`;
        }
      }

      // Custom items
      const customs = appState.getCustomItems(act.id);
      for (const item of customs) {
        const state = ck.customChecks[`custom-${item.id}`] || {};
        const checked = state.checked || state.qty > 0;
        const qty = state.qty || 0;
        if (checked || qty > 0) {
          text += `  ✓ ${item.name}${item.qty ? ` (${item.qty})` : ''} — ${qty} un\n`;
        }
      }

      // Observation
      const obs = ck.observations[act.id];
      if (obs) {
        text += `  📝 Obs: ${obs}\n`;
      }
    }

    return text;
  },

  async share() {
    const summary = this.buildTextSummary();

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Checklist de Campo — ${appState.today}`,
          text: summary
        });
        App.showToast('Compartilhado!');
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.warn('[Share] Error:', e);
          this._fallbackWhatsApp(summary);
        }
      }
    } else {
      this._fallbackWhatsApp(summary);
    }
  },

  _fallbackWhatsApp(text) {
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  }
};
