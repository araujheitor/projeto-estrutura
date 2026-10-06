(() => {
  const COLS = 8;
  const ROWS = 6;
  const STORAGE_KEY = 'subsolo-missoes-v1';
  const NOTES_KEY = 'subsolo-observacoes-v1';
  const GUESS_ANSWER = 'Reservatório de Água';
  const canvas = document.querySelector('#scanCanvas');
  const ctx = canvas.getContext('2d');
  const tooltip = document.querySelector('#canvasTooltip');
  const intensityRange = document.querySelector('#intensityRange');
  const depthRange = document.querySelector('#depthRange');
  let viewMode = 'intensity';
  let selectedIndex = 36;
  let pointPositions = [];

  function makeDemoData() {
    const contour = new Set(['B4','C4','D4','E4','F4','G4','B5','G5','B6','C6','D6','E6','F6','G6']);
    const transition = new Set(['A4','H4','C5','F5','A6','H6']);
    return Array.from({ length: ROWS * COLS }, (_, index) => {
      const row = Math.floor(index / COLS) + 1;
      const col = index % COLS;
      const id = `${String.fromCharCode(65 + col)}${row}`;
      const isContour = contour.has(id);
      const isTransition = transition.has(id);
      const baseDepth = isContour ? 7 + ((index % 3) - 1) * .12 : 2.4 + ((index * 17) % 61) / 10;
      return {
        id, x: (col + 1) * 10, y: row * 10,
        intensity: isContour ? 76 + ((index * 7) % 17) : isTransition ? 49 + ((index * 3) % 12) : 17 + ((index * 11) % 25),
        depth: Number(baseDepth.toFixed(1))
      };
    });
  }

  function loadData() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(stored) && stored.length === ROWS * COLS) return stored;
    } catch (_) {}
    return makeDemoData();
  }

  let points = loadData();

  const ANNOTATIONS_KEY = 'subsolo-annotations-v1';
  let annotations = [];
  let noteEditorState = { editingIndex: -1, pointIndex: null };

  function loadAnnotations() {
    try {
      const raw = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY));
      if (Array.isArray(raw)) return raw;
    } catch (_) {}
    return [];
  }

  function saveAnnotations() {
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(annotations));
  }

  function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function renderNotesPanel() {
    const list = document.querySelector('#notesList');
    if (!list) return;
    list.innerHTML = '';
    annotations.forEach((n, i) => {
      const li = document.createElement('li'); li.className = 'note-item'; li.dataset.index = i;
      const meta = document.createElement('div'); meta.className = 'note-meta';
      meta.textContent = (n.pointIndex != null ? `Ponto ${points[n.pointIndex].id}` : 'Geral') + ' · ' + new Date(n.ts).toLocaleString();
      const body = document.createElement('div'); body.className = 'note-body'; body.innerHTML = escapeHtml(n.text);
      const actions = document.createElement('div'); actions.className = 'note-actions';
      const editBtn = document.createElement('button'); editBtn.className = 'ghost-button edit-note'; editBtn.textContent = 'Editar';
      const delBtn = document.createElement('button'); delBtn.className = 'ghost-button delete-note'; delBtn.textContent = 'Excluir';
      actions.appendChild(editBtn); actions.appendChild(delBtn);
      li.appendChild(meta); li.appendChild(body); li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function openNoteEditor({ editingIndex = -1, pointIndex = null } = {}) {
    const editor = document.querySelector('#noteEditor');
    const text = document.querySelector('#noteText');
    if (!editor || !text) return;
    noteEditorState.editingIndex = editingIndex; noteEditorState.pointIndex = pointIndex;
    if (editingIndex >= 0) text.value = annotations[editingIndex].text || '';
    else text.value = '';
    editor.hidden = false; document.querySelector('#notesPanel').scrollIntoView({ block: 'nearest' });
  }

  function closeNoteEditor() { const editor = document.querySelector('#noteEditor'); if (editor) editor.hidden = true; noteEditorState = { editingIndex: -1, pointIndex: null }; }

  function toggleNotes(forceOpen) {
    const panel = document.querySelector('#notesPanel'); const toggle = document.querySelector('#notesToggle');
    if (!panel || !toggle) return;

    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : panel.getAttribute('aria-hidden') === 'true';

    if (shouldOpen) {
      panel.setAttribute('aria-hidden', 'false');
      panel.style.display = 'flex';
      toggle.setAttribute('aria-expanded', 'true');
    } else {
      panel.setAttribute('aria-hidden', 'true');
      panel.style.display = 'none';
      toggle.setAttribute('aria-expanded', 'false');
    }
  }

  // inicializa anotações e conecta eventos
  annotations = loadAnnotations();
  function initAnnotations() {
    const notesToggle = document.querySelector('#notesToggle');
    const addNotePoint = document.querySelector('#addNotePoint');
    const addNoteGlobal = document.querySelector('#addNoteGlobal');
    const saveNoteBtn = document.querySelector('#saveNoteBtn');
    const cancelNoteBtn = document.querySelector('#cancelNoteBtn');
    const closeNotes = document.querySelector('#closeNotes');
    const notesList = document.querySelector('#notesList');
    if (notesToggle) notesToggle.addEventListener('click', () => { const panel = document.querySelector('#notesPanel'); if (panel && panel.style.display === 'flex') toggleNotes(false); else toggleNotes(true); renderNotesPanel(); });
    if (addNotePoint) addNotePoint.addEventListener('click', () => { openNoteEditor({ editingIndex: -1, pointIndex: selectedIndex }); });
    if (addNoteGlobal) addNoteGlobal.addEventListener('click', () => { openNoteEditor({ editingIndex: -1, pointIndex: null }); });
    if (saveNoteBtn) saveNoteBtn.addEventListener('click', () => {
      const textEl = document.querySelector('#noteText'); if (!textEl) return; const txt = textEl.value.trim(); if (!txt) return showToast('Escreva algum texto para salvar a nota.');
      if (noteEditorState.editingIndex >= 0) {
        annotations[noteEditorState.editingIndex].text = txt; annotations[noteEditorState.editingIndex].ts = Date.now();
      } else {
        annotations.push({ text: txt, ts: Date.now(), pointIndex: noteEditorState.pointIndex });
      }
      saveAnnotations(); renderNotesPanel(); closeNoteEditor(); draw(); showToast('Nota salva.');
    });
    if (cancelNoteBtn) cancelNoteBtn.addEventListener('click', () => closeNoteEditor());
    if (closeNotes) closeNotes.addEventListener('click', () => toggleNotes(false));
    if (notesList) notesList.addEventListener('click', (e) => {
      const li = e.target.closest('.note-item'); if (!li) return; const idx = Number(li.dataset.index);
      if (e.target.classList.contains('delete-note')) {
        annotations.splice(idx,1); saveAnnotations(); renderNotesPanel(); draw(); showToast('Nota excluída.');
      } else if (e.target.classList.contains('edit-note')) {
        openNoteEditor({ editingIndex: idx, pointIndex: annotations[idx].pointIndex });
      }
    });
    // render inicial
    renderNotesPanel(); if (document.querySelector('#notesPanel')) document.querySelector('#notesPanel').style.display = 'none';
  }
  initAnnotations();

  const clamp = (number, min, max) => Math.min(max, Math.max(min, number));
  const formatDecimal = value => value.toFixed(1).replace('.', ',');

  function colorFor(point) {
    if (viewMode === 'depth') {
      const t = clamp((point.depth - 1) / 11, 0, 1);
      const r = Math.round(39 + (7 - 39) * t);
      const g = Math.round(153 + (62 - 153) * t);
      const b = Math.round(125 + (52 - 125) * t);
      return `rgb(${r},${g},${b})`;
    }
    if (point.intensity >= 65) return '#ff8a57';
    if (point.intensity >= 45) return '#e1b650';
    return '#aeb7b2';
  }

  function draw() {
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const padX = Math.max(62, cssWidth * .09);
    const padY = 54;
    const stepX = (cssWidth - padX * 2) / (COLS - 1);
    const stepY = (cssHeight - padY * 2) / (ROWS - 1);

    ctx.strokeStyle = 'rgba(16,32,30,.09)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    for (let c = 0; c < COLS; c++) {
      const x = padX + c * stepX;
      ctx.beginPath(); ctx.moveTo(x, padY); ctx.lineTo(x, cssHeight - padY); ctx.stroke();
    }
    for (let r = 0; r < ROWS; r++) {
      const y = padY + r * stepY;
      ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(cssWidth - padX, y); ctx.stroke();
    }
    ctx.setLineDash([]);

    const strong = points.filter(p => p.intensity >= 65);
    if (strong.length >= 4) {
      const strongPositions = strong.map(p => {
        const index = points.indexOf(p);
        return { x: padX + (index % COLS) * stepX, y: padY + Math.floor(index / COLS) * stepY };
      });
      ctx.strokeStyle = 'rgba(255,138,87,.34)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      strongPositions.forEach((pos, i) => i ? ctx.lineTo(pos.x, pos.y) : ctx.moveTo(pos.x, pos.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    pointPositions = points.map((point, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const x = padX + col * stepX;
      const y = padY + row * stepY;
      const isSelected = index === selectedIndex;
      const radius = 6 + point.intensity / 22;

      if (point.intensity >= 65) {
        ctx.beginPath(); ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,138,87,.12)'; ctx.fill();
      }
      if (isSelected) {
        ctx.beginPath(); ctx.arc(x, y, radius + 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#10201e'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colorFor(point); ctx.fill();
      ctx.strokeStyle = '#f8f6ef'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#263632'; ctx.font = '9px DM Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText(point.id, x, y - radius - 9);
      return { x, y, radius: radius + 10 };
    });

      // desenha marcadores de nota próximos aos pontos anotados
      if (Array.isArray(annotations) && annotations.length) {
        annotations.forEach(a => {
          if (a.pointIndex == null) return;
          const pos = pointPositions[a.pointIndex];
          if (!pos) return;
          ctx.beginPath(); ctx.arc(pos.x + 10, pos.y - 10, 6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,138,87,0.95)'; ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = '8px DM Mono, monospace'; ctx.textAlign = 'center';
          ctx.fillText('✎', pos.x + 10, pos.y - 7);
        });
      }

    ctx.fillStyle = '#8b948f'; ctx.font = '9px DM Mono, monospace'; ctx.textAlign = 'center';
    for (let c = 0; c < COLS; c++) ctx.fillText(String.fromCharCode(65 + c), padX + c * stepX, 24);
    ctx.textAlign = 'right';
    for (let r = 0; r < ROWS; r++) ctx.fillText(String(r + 1), padX - 23, padY + r * stepY + 3);
  }

  function selectPoint(index) {
    selectedIndex = index;
    const p = points[index];
    document.querySelector('#pointName').textContent = `Ponto ${p.id}`;
    document.querySelector('#pointCoords').textContent = `Coordenadas ${p.x}, ${p.y}`;
    intensityRange.value = p.intensity;
    depthRange.value = p.depth;
    updateRangeOutputs();
    draw();
    if (typeof renderNotesPanel === 'function') renderNotesPanel();
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function initializeObservationTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const panels = document.querySelectorAll('.tab-panel');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetId = button.dataset.tabTarget;
        tabButtons.forEach(btn => btn.classList.toggle('active', btn === button));
        panels.forEach(panel => panel.classList.toggle('active', panel.id === targetId));
      });
    });

    const saved = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
    document.querySelectorAll('[data-observation-field]').forEach(field => {
      field.value = saved[field.id] || '';
      field.addEventListener('input', () => {
        const payload = {};
        document.querySelectorAll('[data-observation-field]').forEach(item => {
          payload[item.id] = item.value;
        });
        localStorage.setItem(NOTES_KEY, JSON.stringify(payload));
      });
    });

    const guessInput = document.querySelector('#guessStructure');
    const guessButton = document.querySelector('#checkGuess');
    const feedback = document.querySelector('#guessFeedback');

    guessButton.addEventListener('click', () => {
      const guess = normalizeText(guessInput.value);
      const isCorrect = guess === normalizeText(GUESS_ANSWER);

      if (isCorrect) {
        feedback.className = 'guess-feedback success';
        feedback.innerHTML = '<strong>Acertou!</strong><br>Você identificou corretamente a estrutura como <strong>Reservatório de Água</strong>.';
        return;
      }

      feedback.className = 'guess-feedback error';
      feedback.innerHTML = '<strong>Você errou.</strong><br><span>Dica: a estrutura parece estar ligada ao armazenamento de um líquido em nível subterrâneo, com formato mais volumétrico e apoio em uma função de retenção.</span>';
    });
  }

  function updateRangeOutputs() {
    document.querySelector('#intensityOutput').textContent = `${intensityRange.value}%`;
    document.querySelector('#depthOutput').textContent = `${formatDecimal(Number(depthRange.value))} m`;
  }

  function neighborsOf(index) {
    const row = Math.floor(index / COLS), col = index % COLS;
    return [[row-1,col],[row+1,col],[row,col-1],[row,col+1]]
      .filter(([r,c]) => r >= 0 && r < ROWS && c >= 0 && c < COLS)
      .map(([r,c]) => r * COLS + c);
  }

  function calculateEvidence() {
    const strongIndexes = points.map((p,i) => p.intensity >= 65 ? i : -1).filter(i => i >= 0);
    const strong = strongIndexes.map(i => points[i]);
    const averageStrong = strong.length ? strong.reduce((s,p) => s + p.intensity, 0) / strong.length : 0;
    const intensityScore = clamp((averageStrong - 45) / 45, 0, 1) * Math.min(1, strong.length / 9);

    const depths = strong.map(p => p.depth);
    const mean = depths.length ? depths.reduce((a,b) => a+b,0) / depths.length : 0;
    const deviation = depths.length ? Math.sqrt(depths.reduce((s,v) => s + Math.pow(v-mean,2),0) / depths.length) : 9;
    const regularityScore = clamp(1 - deviation / 2.1, 0, 1) * Math.min(1, strong.length / 5);

    const connected = strongIndexes.filter(index => neighborsOf(index).filter(n => points[n].intensity >= 65).length >= 1).length;
    const continuityScore = strong.length ? connected / strong.length : 0;
    const southern = strongIndexes.filter(i => Math.floor(i / COLS) >= 3).length;
    const southScore = strong.length ? southern / strong.length : 0;
    const score = Math.round(100 * (intensityScore * .30 + regularityScore * .30 + continuityScore * .25 + southScore * .15));
    const variation = depths.length ? Math.max(...depths) - Math.min(...depths) : 0;
    return { score, strongCount: strong.length, variation, southPercent: Math.round(southScore * 100) };
  }

  function updateEvidence() {
    const evidence = calculateEvidence();
    document.querySelector('#strongCount').textContent = evidence.strongCount;
    document.querySelector('#depthVariation').textContent = `${formatDecimal(evidence.variation)} m`;
    document.querySelector('#southConcentration').textContent = `${evidence.southPercent}%`;
    document.querySelector('#scoreValue').textContent = evidence.score;
    document.querySelector('#scoreRing').style.setProperty('--score', evidence.score);

    let title, text, status, color;
    if (evidence.score >= 70) {
      title = 'Há indícios fortes de uma estrutura artificial.';
      text = 'Os sinais intensos, conectados e concentrados ao sul aparecem em profundidade semelhante. O padrão sustenta a hipótese do grupo, mas ainda precisa ser confirmado com a planta completa e análise técnica.';
      status = 'PROVÁVEL'; color = '#d8f168';
    } else if (evidence.score >= 40) {
      title = 'Os dados ainda são inconclusivos.';
      text = 'Algumas pistas apoiam a hipótese, mas o padrão não é regular ou contínuo o bastante. Mais pontos de escaneamento são necessários.';
      status = 'INCERTO'; color = '#e1b650';
    } else {
      title = 'Poucos indícios de uma estrutura artificial.';
      text = 'As leituras atuais não formam um contorno forte e nivelado. Isso não prova ausência; pode indicar dados insuficientes ou uma formação diferente.';
      status = 'POUCO PROVÁVEL'; color = '#ff8a57';
    }
    document.querySelector('#verdictTitle').textContent = title;
    document.querySelector('#verdictText').textContent = text;
    const statusEl = document.querySelector('#hypothesisStatus');
    statusEl.textContent = status; statusEl.style.color = color;
    document.querySelector('#statusLight').style.background = color;
  }

  function showToast(message) {
    const toast = document.querySelector('#toast');
    toast.textContent = message; toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function nearestPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    let nearest = -1, distance = Infinity;
    pointPositions.forEach((p, index) => {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < p.radius && d < distance) { nearest = index; distance = d; }
    });
    return { index: nearest, x, y };
  }

  canvas.addEventListener('click', event => {
    const hit = nearestPoint(event);
    if (hit.index >= 0) selectPoint(hit.index);
  });
  canvas.addEventListener('mousemove', event => {
    const hit = nearestPoint(event);
    if (hit.index < 0) { tooltip.style.display = 'none'; return; }
    const p = points[hit.index];
    tooltip.style.display = 'block'; tooltip.style.left = `${hit.x}px`; tooltip.style.top = `${hit.y}px`;
    tooltip.innerHTML = `<strong>${p.id}</strong> · ${p.intensity}%<br>${formatDecimal(p.depth)} m de profundidade`;
  });
  canvas.addEventListener('mouseleave', () => tooltip.style.display = 'none');

  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b === button));
    viewMode = button.dataset.mode; draw();
  }));
  [intensityRange, depthRange].forEach(input => input.addEventListener('input', updateRangeOutputs));

  document.querySelector('#saveReading').addEventListener('click', () => {
    points[selectedIndex].intensity = Number(intensityRange.value);
    points[selectedIndex].depth = Number(depthRange.value);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(points));
    draw(); updateEvidence(); showToast(`Medição do ponto ${points[selectedIndex].id} registrada.`);
  });

  document.querySelector('#resetData').addEventListener('click', () => {
    points = makeDemoData(); localStorage.removeItem(STORAGE_KEY); selectPoint(36); updateEvidence();
    showToast('Dados demonstrativos restaurados.');
  });

  document.querySelector('#exportButton').addEventListener('click', () => {
    const evidence = calculateEvidence();
    const rows = ['ponto,coordenada_x,coordenada_y,intensidade_percentual,profundidade_metros,classificacao'];
    points.forEach(p => rows.push([p.id,p.x,p.y,p.intensity,p.depth,p.intensity >= 65 ? 'sinal forte' : p.intensity >= 45 ? 'transicao' : 'solo comum'].join(',')));
    rows.push(''); rows.push(`indice_de_evidencia,${evidence.score}`);
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'leituras-subsolo.csv'; link.click(); URL.revokeObjectURL(link.href);
    showToast('Arquivo CSV exportado.');
  });

  document.querySelector('#printButton').addEventListener('click', () => window.print());
  window.addEventListener('resize', draw);
  document.querySelectorAll('nav a').forEach(link => link.addEventListener('click', () => {
    document.querySelectorAll('nav a').forEach(item => item.classList.toggle('active', item === link));
  }));

  initializeObservationTabs();
  selectPoint(selectedIndex);
  updateEvidence();
})();
