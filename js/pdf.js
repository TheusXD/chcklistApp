/**
 * pdf.js — PDF Export using jsPDF + AutoTable
 * Integrated with SignatureService for digital signatures
 */

const PdfService = {
  async exportChecklist(date, signatureDataURL) {
    const ck = date ? await db.getChecklist(date) : appState.checklist;
    if (!ck) { alert('Nenhum checklist para exportar.'); return; }

    const activities = await db.getActivities();
    const customItems = await db.getAllCustomItems();
    const photos = await db.getPhotos(ck.date);

    // Defensive accessor — jsPDF can register under different global names
    const jsPDFClass = (window.jspdf && window.jspdf.jsPDF)
      || window.jsPDF
      || (typeof jsPDF !== 'undefined' ? jsPDF : null);
    if (!jsPDFClass) {
      alert('Erro: Biblioteca jsPDF não carregada. Verifique sua conexão e recarregue.');
      return;
    }
    const doc = new jsPDFClass('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    let y = 15;

    // ===== HEADER =====
    doc.setFillColor(13, 71, 161);
    doc.rect(0, 0, pageW, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Checklist de Campo', 14, 14);
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    const dateObj = new Date(ck.date + 'T12:00:00');
    const dateStr = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(dateStr, 14, 22);

    // Team name
    if (ck.teamName) {
      doc.setFontSize(10);
      doc.text(`Equipe: ${ck.teamName}`, 14, 27);
    }

    // Geo
    if (ck.geo) {
      doc.setFontSize(9);
      doc.text(`📍 ${GeoService.formatCoords(ck.geo)}`, pageW - 14, 22, { align: 'right' });
    }

    y = 38;
    doc.setTextColor(0, 0, 0);

    // ===== ACTIVITIES =====
    for (const act of activities) {
      // Check page space
      if (y > 260) { doc.addPage(); y = 15; }

      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(13, 71, 161);
      doc.text(act.name, 14, y);
      y += 8;

      // Table data
      const rows = [];
      for (const mat of (act.materials || [])) {
        const state = ck.items[`${act.id}-${mat.key}`] || {};
        const checked = state.checked || state.qty > 0;
        const qty = state.qty || 0;
        let details = '';
        if (state.diameter) details += state.diameter;
        if (state.type) details += (details ? ', ' : '') + state.type;
        rows.push([
          checked ? '✓' : '—',
          mat.name,
          details || '—',
          qty > 0 ? qty.toString() : '—'
        ]);
      }

      // Custom items
      const actCustom = customItems.filter(i => i.activityId === act.id);
      for (const item of actCustom) {
        const state = ck.customChecks[`custom-${item.id}`] || {};
        const checked = state.checked || state.qty > 0;
        const qty = state.qty || 0;
        rows.push([
          checked ? '✓' : '—',
          item.name + (item.qty ? ` (${item.qty})` : ''),
          'Extra',
          qty > 0 ? qty.toString() : '—'
        ]);
      }

      if (rows.length > 0) {
        doc.autoTable({
          startY: y,
          head: [['', 'Material', 'Detalhe', 'Qtd']],
          body: rows,
          margin: { left: 14, right: 14 },
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [46, 125, 50], textColor: 255 },
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            3: { cellWidth: 15, halign: 'center' }
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
              data.cell.styles.textColor = data.cell.raw === '✓' ? [46, 125, 50] : [180, 180, 180];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        });
        y = doc.lastAutoTable.finalY + 6;
      }

      // Observation
      const obs = ck.observations[act.id];
      if (obs) {
        if (y > 260) { doc.addPage(); y = 15; }
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('Observações:', 14, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        const lines = doc.splitTextToSize(obs, pageW - 28);
        doc.text(lines, 14, y);
        y += lines.length * 4 + 6;
      }

      y += 4;
    }

    // ===== PHOTOS =====
    if (photos.length > 0) {
      if (y > 200) { doc.addPage(); y = 15; }
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(13, 71, 161);
      doc.text('Fotos', 14, y);
      y += 8;

      let x = 14;
      const thumbSize = 40;
      for (const photo of photos) {
        if (x + thumbSize > pageW - 14) { x = 14; y += thumbSize + 5; }
        if (y + thumbSize > 280) { doc.addPage(); y = 15; x = 14; }
        try {
          const base64 = await PhotoService.blobToBase64(photo.thumbnail || photo.blob);
          doc.addImage(base64, 'JPEG', x, y, thumbSize, thumbSize);
          x += thumbSize + 5;
        } catch (e) { console.warn('[PDF] Photo error:', e); }
      }
      y += thumbSize + 10;
    }

    // ===== SIGNATURE =====
    if (signatureDataURL) {
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(13, 71, 161);
      doc.text('Assinatura do Responsável', 14, y);
      y += 5;
      doc.setDrawColor(200, 200, 200);
      doc.line(14, y, pageW - 14, y);
      y += 3;
      try {
        doc.addImage(signatureDataURL, 'PNG', 14, y, 80, 30);
        y += 35;
      } catch (e) {
        console.warn('[PDF] Signature error:', e);
      }
    }

    // ===== FOOTER =====
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Checklist de Campo — ${ck.date} — Página ${i}/${pageCount}`, pageW / 2, 290, { align: 'center' });
    }

    doc.save(`checklist-${ck.date}.pdf`);
  },

  // Entry point: opens signature modal first, then generates PDF
  async exportWithSignature() {
    SignatureService.show(async () => {
      const sigData = SignatureService.getDataURL();
      SignatureService.hide();
      App.showToast('Gerando PDF, aguarde...');
      
      // Allow browser to paint the toast before blocking the main thread
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        await this.exportChecklist(null, sigData);
        App.showToast('PDF gerado!');
      } catch (e) {
        console.error('[PDF] Error:', e);
        App.showToast('Erro ao gerar PDF');
      }
    });
  }
};
