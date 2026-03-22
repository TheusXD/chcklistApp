/**
 * templates.js — Save/Load checklist templates
 */

const TemplatesService = {
  async saveTemplate(name) {
    const activities = await db.getActivities();
    const customItems = await db.getAllCustomItems();
    const checklist = appState.checklist;

    const templateData = {
      name,
      createdAt: Date.now(),
      activities: activities.map(a => ({
        id: a.id,
        name: a.name,
        icon: a.icon,
        isCustom: a.isCustom,
        materials: a.materials || []
      })),
      customItems: customItems.map(i => ({
        activityId: i.activityId,
        name: i.name,
        qty: i.qty
      })),
      // Save current check states as defaults
      items: checklist.items ? { ...checklist.items } : {},
      customChecks: checklist.customChecks ? { ...checklist.customChecks } : {}
    };

    return await db.addTemplate(templateData);
  },

  async loadTemplate(id) {
    const template = await db.getTemplate(id);
    if (!template) { App.showToast('Template não encontrado'); return; }

    // Load custom items from template
    const existingCustom = await db.getAllCustomItems();
    // Clear existing custom items
    for (const item of existingCustom) {
      await db.deleteCustomItem(item.id);
    }
    // Add template custom items
    for (const item of template.customItems || []) {
      await db.addCustomItem({
        activityId: item.activityId,
        name: item.name,
        qty: item.qty
      });
    }

    // Apply check states to current checklist
    if (template.items) {
      appState.checklist.items = { ...template.items };
    }
    if (template.customChecks) {
      appState.checklist.customChecks = {};
    }

    await appState._saveNow();
    await appState._loadCustomItems();
    appState._notify();

    App.showToast(`Template "${template.name}" carregado!`);
    UI.renderTabs();
    UI.renderChecklist();
  },

  async deleteTemplate(id) {
    await db.deleteTemplate(id);
    this.renderModal();
    App.showToast('Template removido');
  },

  async getAll() {
    return await db.getAllTemplates();
  },

  async renderModal() {
    const list = document.getElementById('templates-list');
    if (!list) return;

    const templates = await this.getAll();

    if (templates.length === 0) {
      list.innerHTML = '<div class="empty-state">Nenhum template salvo.</div>';
      return;
    }

    let html = '';
    for (const t of templates) {
      const date = new Date(t.createdAt).toLocaleDateString('pt-BR');
      const itemCount = (t.customItems || []).length;
      html += `
        <div class="template-card" data-template-id="${t.id}">
          <div class="template-info">
            <div class="template-name">${UI.esc(t.name)}</div>
            <div class="template-meta">${date} · ${itemCount} itens extras</div>
          </div>
          <div class="template-actions">
            <button class="btn-template-load" data-load-id="${t.id}" aria-label="Carregar template">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            <button class="btn-template-delete" data-del-id="${t.id}" aria-label="Excluir template">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }

    list.innerHTML = html;

    // Bind events
    list.querySelectorAll('.btn-template-load').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.loadId);
        if (confirm('Carregar este template? Os itens personalizados atuais serão substituídos.')) {
          document.getElementById('modal-templates-overlay').classList.remove('active');
          await this.loadTemplate(id);
        }
      });
    });

    list.querySelectorAll('.btn-template-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.delId);
        if (confirm('Excluir este template?')) {
          await this.deleteTemplate(id);
        }
      });
    });
  },

  showSavePrompt() {
    const name = prompt('Nome do template:');
    if (!name || !name.trim()) return;
    this.saveTemplate(name.trim()).then(() => {
      App.showToast('Template salvo!');
      this.renderModal();
    });
  }
};
