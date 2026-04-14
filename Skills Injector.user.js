// ==UserScript==
// @name         ChatGPT/Gemini/Duck.ai Skills Injector
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Injects selected prompt skills into the request upon submission without breaking the UI.
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://gemini.google.com/*
// @match        https://duck.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @connect      *
// @author       unstoppalezzz
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'skillsJson_v1';
  const PAGE_KEY = 'skillsPage_v1';
  const PAGE_SIZE = 3;

  function qsd(selector, root = document) {
    let el = root.querySelector(selector);
    if (el) return el;
    const walker = node => {
      if (!node) return null;
      const children = node.children || [];
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        try { if (child.matches && child.matches(selector)) return child; } catch (e) {}
        if (child.shadowRoot) {
          const inside = child.shadowRoot.querySelector(selector);
          if (inside) return inside;
          const deeper = walker(child.shadowRoot);
          if (deeper) return deeper;
        }
        const rec = walker(child);
        if (rec) return rec;
      }
      return null;
    };
    return walker(root);
  }

  function getEditor() {
    const candidates = [
      '#prompt-textarea',
      'textarea[aria-label="Enter a prompt here"]',
      'textarea[placeholder*="Send a message"]',
      'textarea',
      '[contenteditable="true"]',
      '[role="textbox"][contenteditable="true"]'
    ];
    for (const s of candidates) {
      const el = qsd(s);
      if (el) return el;
    }
    return qsd('textarea[data-testid="composer-input"], textarea[data-testid="message-input"], div[data-testid="composer"][contenteditable="true"]') || null;
  }

  function insertTextIntoEditor(editor, text) {
    editor.focus();
    if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
      const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      nativeSet.call(editor, text);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      try {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, text);
      } catch (e) {
        editor.textContent = text;
        editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
    }
  }

  function saveSkills(list) { try { GM_setValue(STORAGE_KEY, JSON.stringify(list)); } catch (e) { console.error(e); } }
  function loadSkills() { try { return JSON.parse(GM_getValue(STORAGE_KEY, '[]') || '[]'); } catch (e) { console.error(e); return []; } }
  function savePage(n) { try { GM_setValue(PAGE_KEY, String(n)); } catch (e) {} }
  function loadPage() { try { return parseInt(GM_getValue(PAGE_KEY, '0'), 10) || 0; } catch (e) { return 0; } }

  let skills = loadSkills();
  let currentPage = loadPage();
  let selectedSkill = null;
  let manageMode = false;

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', top: '100px', right: '20px', width: '260px',
    background: '#171717', color: '#ececec', border: '1px solid #424242',
    borderRadius: '12px', zIndex: '999999', fontSize: '12px', fontFamily: 'sans-serif',
    boxShadow: '0 4px 10px rgba(0,0,0,0.3)', overflow: 'hidden'
  });

  const header = document.createElement('div');
  header.textContent = 'Skill: None';
  Object.assign(header.style, { padding: '10px', background: '#212121', fontWeight: 'bold', borderBottom: '1px solid #424242', cursor: 'grab', userSelect: 'none' });
  panel.appendChild(header);

  const content = document.createElement('div');
  content.style.padding = '8px';
  panel.appendChild(content);

  const skillList = document.createElement('div');
  skillList.style.marginBottom = '8px';
  content.appendChild(skillList);

  const pagination = document.createElement('div');
  Object.assign(pagination.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' });
  const prevBtn = document.createElement('button'); prevBtn.textContent = '◀'; Object.assign(prevBtn.style, smallBtn()); prevBtn.onclick = () => { if (currentPage > 0) { currentPage--; savePage(currentPage); render(); } };
  const pageLabel = document.createElement('div'); pageLabel.style.flex = '1'; pageLabel.style.textAlign = 'center'; pageLabel.style.fontSize = '11px';
  const nextBtn = document.createElement('button'); nextBtn.textContent = '▶'; Object.assign(nextBtn.style, smallBtn()); nextBtn.onclick = () => { const max = Math.max(0, Math.ceil(skills.length / PAGE_SIZE) - 1); if (currentPage < max) { currentPage++; savePage(currentPage); render(); } };
  pagination.appendChild(prevBtn); pagination.appendChild(pageLabel); pagination.appendChild(nextBtn);
  content.appendChild(pagination);

  const controls = document.createElement('div'); controls.style.display = 'flex'; controls.style.flexDirection = 'column'; controls.style.gap = '6px';
  const addBtn = document.createElement('button'); addBtn.textContent = 'Add Skill'; Object.assign(addBtn.style, smallBtn()); controls.appendChild(addBtn);

  const addOptions = document.createElement('div'); addOptions.style.display = 'none'; addOptions.style.flexDirection = 'column'; addOptions.style.gap = '6px';
  const urlBtn = document.createElement('button'); urlBtn.textContent = 'From URL'; Object.assign(urlBtn.style, smallBtn());
  const pasteBtn = document.createElement('button'); pasteBtn.textContent = 'Paste Text / JSON'; Object.assign(pasteBtn.style, smallBtn());
  const importFileBtn = document.createElement('button'); importFileBtn.textContent = 'Import File (.json / .md)'; Object.assign(importFileBtn.style, smallBtn());
  addOptions.appendChild(urlBtn); addOptions.appendChild(pasteBtn); addOptions.appendChild(importFileBtn);
  controls.appendChild(addOptions);

  const manageRow = document.createElement('div'); manageRow.style.display = 'flex'; manageRow.style.gap = '6px';
  const manageToggle = document.createElement('button'); manageToggle.textContent = 'Manage'; Object.assign(manageToggle.style, smallBtn());
  const removeSelectedBtn = document.createElement('button'); removeSelectedBtn.textContent = 'Remove Selected'; Object.assign(removeSelectedBtn.style, smallBtn());
  removeSelectedBtn.disabled = true;
  manageRow.appendChild(manageToggle); manageRow.appendChild(removeSelectedBtn);
  controls.appendChild(manageRow);

  const exportBtn = document.createElement('button'); exportBtn.textContent = 'Export JSON'; Object.assign(exportBtn.style, smallBtn()); controls.appendChild(exportBtn);

  content.appendChild(controls);
  document.body.appendChild(panel);

  let isDraggingPanel = false;
  let dragStartX, dragStartY, panelStartX, panelStartY;

  header.addEventListener('mousedown', (e) => {
    isDraggingPanel = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = panel.getBoundingClientRect();

    panel.style.right = 'auto';
    panel.style.left = rect.left + 'px';
    panel.style.top = rect.top + 'px';

    panelStartX = rect.left;
    panelStartY = rect.top;

    header.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDraggingPanel) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    panel.style.left = (panelStartX + dx) + 'px';
    panel.style.top = (panelStartY + dy) + 'px';
  });

  document.addEventListener('mouseup', () => {
    isDraggingPanel = false;
    header.style.cursor = 'grab';
  });

  function smallBtn() { return { padding: '8px', background: '#2f2f2f', color: 'white', border: '1px solid #424242', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }; }

  function tryNotify(msg) { try { GM_notification && GM_notification({ text: msg, title: 'Skills Injector', timeout: 3000 }); } catch (e) {} console.log('Skills Injector:', msg); }

  function processPrompt(p) { return p; }

  function normalizeIncomingObjects(arr) {
    return arr
      .map(s => {
        if (!s) return null;
        const name = (typeof s.name === 'string' && s.name.trim()) ? s.name.trim() : null;
        let prompt = (typeof s.prompt === 'string') ? s.prompt : (typeof s === 'string' ? s : null);
        if (prompt == null) return null;
        prompt = processPrompt(prompt);
        return name ? { name, prompt } : null;
      })
      .filter(Boolean);
  }

  urlBtn.onclick = async () => {
    const url = prompt('Enter URL to import (.json, .md, or raw text):');
    if (!url) return;
    try {
      let text = null;
      if (typeof GM_xmlhttpRequest === 'function') {
        await new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: 'GET',
            url,
            onload: r => { text = r.responseText; resolve(); },
            onerror: e => reject(e)
          });
        });
      } else {
        const r = await fetch(url);
        text = await r.text();
      }

      try {
        const parsed = JSON.parse(text);
        const incoming = Array.isArray(parsed) ? parsed : [parsed];
        const valid = normalizeIncomingObjects(incoming);
        if (!valid.length) { tryNotify('JSON loaded, but no valid skills found.'); return; }
        skills = skills.concat(valid);
        saveSkills(skills);
        currentPage = Math.max(0, Math.ceil(skills.length / PAGE_SIZE) - 1);
        savePage(currentPage);
        render();
        tryNotify(`Imported ${valid.length} skill(s) from URL.`);
      } catch (err) {
        let name = url.split('/').pop().replace(/\.[^/.]+$/, "");
        if (!name) name = 'URL Import';

        const skillObj = { name, prompt: processPrompt(text.trim()) };
        skills.push(skillObj);
        saveSkills(skills);
        currentPage = Math.max(0, Math.ceil(skills.length / PAGE_SIZE) - 1);
        savePage(currentPage);
        render();
        tryNotify(`Imported "${name}" as Markdown from URL.`);
      }
    } catch (e) {
      console.error(e); tryNotify('Failed to load URL: ' + (e && e.message ? e.message : 'error'));
    }
  };

  pasteBtn.onclick = () => {
    const pasteOverlay = document.createElement('div');
    Object.assign(pasteOverlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.7)', zIndex: '9999999', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif'
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#212121', padding: '16px', borderRadius: '8px', width: '400px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid #424242'
    });

    const title = document.createElement('div');
    title.textContent = 'Paste JSON or Markdown Text:';
    title.style.color = '#fff';
    title.style.fontWeight = 'bold';

    const ta = document.createElement('textarea');
    Object.assign(ta.style, {
        width: '100%', height: '200px', background: '#171717', color: '#ececec',
        border: '1px solid #424242', borderRadius: '4px', padding: '8px', resize: 'vertical', fontFamily: 'monospace'
    });
    ta.placeholder = "Paste your Markdown prompt or JSON backup here...";

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', justifyContent: 'flex-end', gap: '8px' });

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    Object.assign(cancel.style, smallBtn());
    cancel.onclick = () => pasteOverlay.remove();

    const save = document.createElement('button');
    save.textContent = 'Import';
    Object.assign(save.style, smallBtn());
    save.style.background = '#007bff';
    save.style.borderColor = '#0056b3';

    save.onclick = () => {
      const raw = ta.value.trim();
      if (!raw) { tryNotify('No text provided.'); pasteOverlay.remove(); return; }

      try {
        const parsed = JSON.parse(raw);
        const incoming = Array.isArray(parsed) ? parsed : [parsed];
        const valid = normalizeIncomingObjects(incoming);
        if (!valid.length) { tryNotify('Parsed JSON did not contain valid skill objects.'); pasteOverlay.remove(); return; }
        skills = skills.concat(valid);
        saveSkills(skills);
        currentPage = Math.max(0, Math.ceil(skills.length / PAGE_SIZE) - 1);
        savePage(currentPage);
        render();
        tryNotify(`Imported ${valid.length} skill(s).`);
      } catch (e) {
        let name = prompt('Enter a name for this skill (leave blank to auto-generate):');
        if (name === null) { pasteOverlay.remove(); return; }
        name = name.trim();
        if (!name) name = `Skill ${skills.length + 1}`;

        const skillObj = { name, prompt: processPrompt(raw) };
        skills.push(skillObj);
        saveSkills(skills);
        currentPage = Math.max(0, Math.ceil(skills.length / PAGE_SIZE) - 1);
        savePage(currentPage);
        render();
        tryNotify('Imported 1 skill from pasted text.');
      }
      pasteOverlay.remove();
    };

    btnRow.appendChild(cancel);
    btnRow.appendChild(save);
    box.appendChild(title);
    box.appendChild(ta);
    box.appendChild(btnRow);
    pasteOverlay.appendChild(box);
    document.body.appendChild(pasteOverlay);
    ta.focus();
  };

  importFileBtn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json, .json, text/markdown, .md, text/plain, .txt';

    input.onchange = e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const txt = (ev.target && ev.target.result) || '';
        if (!txt.trim()) { tryNotify('Empty file'); return; }

        try {
          const parsed = JSON.parse(txt);
          const incoming = Array.isArray(parsed) ? parsed : [parsed];
          const valid = normalizeIncomingObjects(incoming);
          if (!valid.length) { tryNotify('JSON file did not contain valid skill objects.'); return; }
          skills = skills.concat(valid);
          saveSkills(skills);
          currentPage = Math.max(0, Math.ceil(skills.length / PAGE_SIZE) - 1);
          savePage(currentPage);
          render();
          tryNotify(`Imported ${valid.length} skill(s) from JSON.`);
        } catch (err) {
          let name = f.name.replace(/\.[^/.]+$/, "");
          const skillObj = { name, prompt: processPrompt(txt.trim()) };
          skills.push(skillObj);
          saveSkills(skills);
          currentPage = Math.max(0, Math.ceil(skills.length / PAGE_SIZE) - 1);
          savePage(currentPage);
          render();
          tryNotify(`Imported "${name}" from Markdown file.`);
        }
      };
      reader.readAsText(f);
    };
    input.click();
  };

  exportBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(skills, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'skills.json'; document.body.appendChild(a); a.click(); a.remove();
  };

  manageToggle.onclick = () => { manageMode = !manageMode; manageToggle.style.background = manageMode ? '#3a3a3a' : '#2f2f2f'; render(); };
  removeSelectedBtn.onclick = () => {
    if (!selectedSkill) { tryNotify('No skill selected.'); return; }
    if (!confirm(`Remove selected skill "${selectedSkill.name}"?`)) return;
    const idx = skills.indexOf(selectedSkill);
    if (idx >= 0) skills.splice(idx, 1);
    selectedSkill = null;
    saveSkills(skills);
    const max = Math.max(0, Math.ceil(skills.length / PAGE_SIZE) - 1);
    if (currentPage > max) currentPage = max;
    savePage(currentPage);
    removeSelectedBtn.disabled = true;
    render();
  };

  function handleInjection(event) {
    if (!selectedSkill) return;
    const editor = getEditor(); if (!editor) return;
    if (event && event.type === 'keydown' && (event.key !== 'Enter' || event.shiftKey)) return;

    const userText = (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') ? editor.value : editor.innerText || editor.textContent || '';
    const trimmedInput = userText.trim();
    let finalPrompt = selectedSkill.prompt || '';

    if (trimmedInput) {
      if (finalPrompt.includes('{{text}}')) {
          finalPrompt = finalPrompt.replace(/\{\{text\}\}/g, trimmedInput);
      } else if (finalPrompt.includes('{{input}}')) {
          finalPrompt = finalPrompt.replace(/\{\{input\}\}/g, trimmedInput);
      } else {
          finalPrompt = `${finalPrompt}\n\n\`\`\`\n${trimmedInput}\n\`\`\``;
      }
    }

    insertTextIntoEditor(editor, finalPrompt);
    selectedSkill = null;
    removeSelectedBtn.disabled = true;
    render();
  }

  document.addEventListener('keydown', handleInjection, true);
  document.addEventListener('click', (e) => {
    const sendCandidates = [
      'button[data-testid*="send"]',
      'button[aria-label*="Send"]',
      'button[type="submit"]',
      '[role="button"][aria-label*="Send"]',
      'button:has(svg[aria-hidden="true"])'
    ];
    let isSend = false;
    for (const sel of sendCandidates) {
      if (e.target.closest && e.target.closest(sel)) { isSend = true; break; }
      const found = qsd(sel);
      if (found && (found === e.target || found.contains(e.target))) { isSend = true; break; }
    }
    if (isSend) handleInjection(e);
  }, true);

  let dragSrcIndex = null;
  function enableDragForItem(el, absIndex) {
    el.draggable = true;
    el.addEventListener('dragstart', (ev) => { dragSrcIndex = absIndex; ev.dataTransfer.effectAllowed = 'move'; el.style.opacity = '0.5'; });
    el.addEventListener('dragend', () => { dragSrcIndex = null; el.style.opacity = ''; });
    el.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; el.style.outline = '2px dashed #007bff'; });
    el.addEventListener('dragleave', () => { el.style.outline = ''; });
    el.addEventListener('drop', (ev) => {
      ev.preventDefault();
      el.style.outline = '';
      if (dragSrcIndex == null) return;
      const from = dragSrcIndex;
      const to = absIndex;
      if (from === to) return;
      const item = skills.splice(from, 1)[0];
      skills.splice(to, 0, item);
      saveSkills(skills);
      if (selectedSkill === item) selectedSkill = item;
      render();
    });
  }

  function render() {
    header.textContent = selectedSkill ? `Skill: ${selectedSkill.name}` : 'Skill: None';
    skillList.replaceChildren();

    const maxPage = Math.max(0, Math.ceil(skills.length / PAGE_SIZE) - 1);
    if (currentPage > maxPage) currentPage = maxPage;
    if (currentPage < 0) currentPage = 0;
    savePage(currentPage);
    const start = currentPage * PAGE_SIZE;
    const pageSkills = skills.slice(start, start + PAGE_SIZE);

    if (!pageSkills.length) {
      const empty = document.createElement('div'); empty.style.fontSize = '12px'; empty.style.color = '#bdbdbd';
      empty.textContent = skills.length === 0 ? 'No skills saved.' : 'No skills on this page.';
      skillList.appendChild(empty);
    } else {
      pageSkills.forEach((skill, idx) => {
        const absIndex = start + idx;
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' });
        const btn = document.createElement('button');
        btn.textContent = skill.name;

        btn.title = skill.prompt;

        Object.assign(btn.style, { flex: '1', textAlign: 'left', padding: '8px', background: '#2f2f2f', color: 'white', border: '1px solid #424242', borderRadius: '6px', cursor: 'pointer' });
        btn.onclick = () => {
          selectedSkill = (selectedSkill === skill) ? null : skill;
          removeSelectedBtn.disabled = !selectedSkill;
          render();
        };
        if (selectedSkill === skill) { btn.style.background = '#007bff'; btn.style.borderColor = '#0056b3'; }
        row.appendChild(btn);

        if (manageMode) {
          const dragHandle = document.createElement('div');
          dragHandle.textContent = '⇅';
          Object.assign(dragHandle.style, { cursor: 'grab', padding: '6px', background: '#333', borderRadius: '6px' });
          const container = document.createElement('div');
          container.style.display = 'flex'; container.style.flex = '0';
          container.appendChild(dragHandle);
          row.appendChild(container);
          enableDragForItem(row, absIndex);
        }

        skillList.appendChild(row);
      });
    }

    pageLabel.textContent = `Page ${currentPage + 1}`;
    prevBtn.disabled = currentPage <= 0;
    nextBtn.disabled = currentPage >= Math.max(0, Math.ceil(skills.length / PAGE_SIZE) - 1);
  }

  addBtn.onclick = () => { addOptions.style.display = addOptions.style.display === 'none' ? 'flex' : 'none'; };
  manageToggle.onclick = () => { manageMode = !manageMode; manageToggle.style.background = manageMode ? '#3a3a3a' : '#2f2f2f'; render(); };

  render();

  window.__skills_injector = { getSkills: () => skills, setSkills: s => { skills = s; saveSkills(skills); render(); } };

})();