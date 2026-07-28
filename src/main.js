// ── Data model ────────────────────────────────────────────────────────────
//
// Each node represents one key-value pair in the JSON.
// Nesting is expressed through parentId: a node with parentId === null
// lives at the root level; a node with parentId === X is a child of X.
//
// node shape:
//   { id, parentId, key, type, value, collapsed }
//
// Supported types: string | number | boolean | null | object | array
// "object" and "array" are container types -- they have children, no value.

let nodes = [];
let nextId = 1;
let currentFilePath = null; // used by the Tauri save/open flow

function createNode(parentId = null) {
  return { id: nextId++, parentId, key: '', type: 'string', value: '', collapsed: false };
}

function getChildren(parentId) {
  return nodes.filter(n => n.parentId === parentId);
}

// Returns all descendants of a node (children, grandchildren, ...).
function getDescendants(id) {
  const children = getChildren(id);
  return children.flatMap(c => [c, ...getDescendants(c.id)]);
}

// Counts how many levels deep a node sits.
function getDepth(id) {
  let depth = 0;
  let node = nodes.find(n => n.id === id);
  while (node && node.parentId !== null) {
    depth++;
    node = nodes.find(n => n.id === node.parentId);
  }
  return depth;
}

// ── JSON serialisation ────────────────────────────────────────────────────
//
// Walks the node tree starting from parentId and returns a plain JS object
// that mirrors the structure the user has built.

function buildJSON(parentId = null) {
  const children = getChildren(parentId);
  if (children.length === 0) return parentId === null ? {} : undefined;

  const obj = {};
  for (const child of children) {
    const key = child.key || `field_${child.id}`;

    if (child.type === 'object') {
      obj[key] = buildJSON(child.id) ?? {};
    } else if (child.type === 'array') {
      obj[key] = getChildren(child.id).map(c => {
        if (c.type === 'object') return buildJSON(c.id) ?? {};
        return castValue(c.value, c.type);
      });
    } else {
      obj[key] = castValue(child.value, child.type);
    }
  }
  return obj;
}

function castValue(val, type) {
  if (type === 'number')  return isNaN(+val) ? 0 : +val;
  if (type === 'boolean') return val === 'true' || val === true;
  if (type === 'null')    return null;
  return val;
}

// ── JSON deserialisation ──────────────────────────────────────────────────
//
// Converts a plain JS object back into the flat node list.
// Called when the user opens an existing JSON file.

function loadFromJSON(obj, parentId) {
  if (obj === null || typeof obj !== 'object') return;

  for (const [key, value] of Object.entries(obj)) {
    const node = createNode(parentId);
    node.key = key;

    if (value === null) {
      node.type = 'null';
      node.value = 'null';
    } else if (Array.isArray(value)) {
      node.type = 'array';
      nodes.push(node);
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          const child = createNode(node.id);
          child.key = String(i);
          child.type = 'object';
          nodes.push(child);
          loadFromJSON(item, child.id);
        } else {
          const child = createNode(node.id);
          child.key = String(i);
          child.type = typeof item === 'number'  ? 'number'
                     : typeof item === 'boolean' ? 'boolean'
                     : 'string';
          child.value = String(item);
          nodes.push(child);
        }
      });
      continue; // already pushed
    } else if (typeof value === 'object') {
      node.type = 'object';
      nodes.push(node);
      loadFromJSON(value, node.id);
      continue; // already pushed
    } else if (typeof value === 'number') {
      node.type = 'number';
      node.value = String(value);
    } else if (typeof value === 'boolean') {
      node.type = 'boolean';
      node.value = String(value);
    } else {
      node.type = 'string';
      node.value = String(value);
    }

    nodes.push(node);
  }
}

// ── Render ────────────────────────────────────────────────────────────────

function render() {
  const tree = document.getElementById('tree');
  tree.innerHTML = '';

  const rootNodes = getChildren(null);
  document.getElementById('hint').style.display = rootNodes.length === 0 ? 'block' : 'none';

  for (const node of rootNodes) {
    tree.appendChild(renderNode(node));
  }

  updatePreview();
}

function renderNode(node) {
  const depth       = getDepth(node.id);
  const children    = getChildren(node.id);
  const isContainer = node.type === 'object' || node.type === 'array';

  // Outer wrapper -- indented by depth so children appear visually nested.
  const wrapper = document.createElement('div');
  wrapper.className = 'node-wrapper';
  wrapper.dataset.id = node.id;
  wrapper.style.marginLeft = depth * 24 + 'px';

  // The visible row.
  const div = document.createElement('div');
  div.className = `node depth-${Math.min(depth, 4)}`;
  div.dataset.id = node.id;

  // Colour bar on the left -- its colour changes with depth.
  const bar = document.createElement('div');
  bar.className = 'indent-bar';

  // Drag handle.
  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.title = 'Drag to move';
  handle.textContent = '⠇';

  // Collapse/expand button (only shown for containers that have children).
  const collapseBtn = document.createElement('div');
  collapseBtn.className = `collapse-btn ${!isContainer || children.length === 0 ? 'hidden' : ''}`;
  collapseBtn.textContent = node.collapsed ? '>' : 'v';
  collapseBtn.title = node.collapsed ? 'Expand' : 'Collapse';
  collapseBtn.addEventListener('click', () => { node.collapsed = !node.collapsed; render(); });

  // Key field.
  const keyInput = document.createElement('input');
  keyInput.className = 'key-input';
  keyInput.value = node.key;
  keyInput.placeholder = 'key';
  keyInput.addEventListener('input', e => { node.key = e.target.value; updatePreview(); });

  const colon = document.createElement('span');
  colon.className = 'colon';
  colon.textContent = ':';

  // Type selector.
  const typeSelect = document.createElement('select');
  typeSelect.className = 'type-select';
  ['string', 'number', 'boolean', 'null', 'object', 'array'].forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    if (t === node.type) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeSelect.addEventListener('change', e => {
    const oldType = node.type;
    node.type = e.target.value;
    // If we switch from a container type to a leaf type, remove all children.
    if ((oldType === 'object' || oldType === 'array') &&
        node.type !== 'object' && node.type !== 'array') {
      const ids = getDescendants(node.id).map(d => d.id);
      nodes = nodes.filter(n => !ids.includes(n.id));
    }
    render();
  });

  // Value field -- disabled for containers (they hold children, not a value).
  const valueInput = document.createElement('input');
  valueInput.className = 'value-input';
  valueInput.disabled = isContainer;
  valueInput.value = isContainer ? '' : node.value;
  valueInput.placeholder = isContainer
    ? `{ ${children.length} ${children.length === 1 ? 'field' : 'fields'} }`
    : node.type === 'boolean' ? 'true / false' : 'value';
  valueInput.addEventListener('input', e => { node.value = e.target.value; updatePreview(); });

  // Per-node action buttons.
  const actions = document.createElement('div');
  actions.className = 'node-actions';

  if (isContainer) {
    const addChildBtn = document.createElement('button');
    addChildBtn.className = 'icon-btn';
    addChildBtn.textContent = '+';
    addChildBtn.title = 'Add child field';
    addChildBtn.addEventListener('click', () => {
      nodes.push(createNode(node.id));
      node.collapsed = false;
      render();
    });
    actions.appendChild(addChildBtn);
  }

  const addSiblingBtn = document.createElement('button');
  addSiblingBtn.className = 'icon-btn';
  addSiblingBtn.textContent = 'n';
  addSiblingBtn.title = 'Add sibling field';
  addSiblingBtn.addEventListener('click', () => { nodes.push(createNode(node.parentId)); render(); });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'icon-btn delete';
  deleteBtn.textContent = 'x';
  deleteBtn.title = 'Delete field';
  deleteBtn.addEventListener('click', () => {
    const ids = [node.id, ...getDescendants(node.id).map(d => d.id)];
    nodes = nodes.filter(n => !ids.includes(n.id));
    render();
  });

  actions.appendChild(addSiblingBtn);
  actions.appendChild(deleteBtn);

  div.append(bar, handle, collapseBtn, keyInput, colon, typeSelect, valueInput, actions);
  wrapper.appendChild(div);

  // Render children below the row when expanded.
  if (!node.collapsed && isContainer) {
    for (const child of children) {
      wrapper.appendChild(renderNode(child));
    }
  }

  setupDrag(div, node);
  return wrapper;
}

// ── Drag and drop ─────────────────────────────────────────────────────────
//
// Uses pointer events (mousedown/mousemove/mouseup) instead of the HTML5
// Drag and Drop API. WebView2 on Windows does not fire dragstart reliably
// when draggable is set via JavaScript on divs that contain input elements,
// so the HTML5 approach silently drops all events there.
//
// Only the drag handle triggers a drag. During the move a small ghost label
// follows the cursor. On release, the position within the target row decides
// where the node lands:
//   top third    -> place before the target row (same parent)
//   bottom third -> make a child of the target (containers only)
//   middle       -> place after the target row (same parent)

let dragId     = null;
let dragGhost  = null;
let dragOverEl = null; // the .node element currently highlighted
let dragZone   = null; // 'top' | 'middle' | 'child'

function setupDrag(el, node) {
  const handle = el.querySelector('.drag-handle');
  if (!handle) return;

  handle.addEventListener('mousedown', e => {
    if (e.button !== 0) return; // primary button only
    e.preventDefault();
    e.stopPropagation();

    dragId = node.id;
    document.body.classList.add('drag-active');

    // Floating ghost label that follows the cursor.
    dragGhost = document.createElement('div');
    dragGhost.className = 'drag-ghost';
    dragGhost.textContent = node.key || '(unnamed)';
    dragGhost.style.left = e.clientX + 14 + 'px';
    dragGhost.style.top  = e.clientY + 4  + 'px';
    document.body.appendChild(dragGhost);

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup',   onDragEnd);
  });
}

function onDragMove(e) {
  if (dragId === null) return;

  // Keep ghost next to cursor.
  if (dragGhost) {
    dragGhost.style.left = e.clientX + 14 + 'px';
    dragGhost.style.top  = e.clientY + 4  + 'px';
  }

  // Temporarily hide the ghost so elementFromPoint sees what is behind it.
  if (dragGhost) dragGhost.style.visibility = 'hidden';
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  if (dragGhost) dragGhost.style.visibility = '';

  const nodeEl = hit && hit.closest('.node[data-id]');

  // Clear highlight on the previously hovered row.
  if (dragOverEl && dragOverEl !== nodeEl) {
    dragOverEl.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-child');
  }

  if (!nodeEl) {
    dragOverEl = null;
    dragZone   = null;
    return;
  }

  const targetId = parseInt(nodeEl.dataset.id, 10);
  if (targetId === dragId || getDescendants(dragId).some(d => d.id === targetId)) {
    dragOverEl = null;
    dragZone   = null;
    return;
  }

  const targetNode  = nodes.find(n => n.id === targetId);
  const isContainer = targetNode && (targetNode.type === 'object' || targetNode.type === 'array');

  const { top, height } = nodeEl.getBoundingClientRect();
  const relY  = e.clientY - top;
  const third = height / 3;

  nodeEl.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-child');

  if (relY < third) {
    nodeEl.classList.add('drag-over-top');
    dragZone = 'top';
  } else if (relY > height - third && isContainer) {
    nodeEl.classList.add('drag-over-child');
    dragZone = 'child';
  } else {
    nodeEl.classList.add('drag-over-bottom');
    dragZone = 'middle';
  }

  dragOverEl = nodeEl;
}

function onDragEnd() {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup',   onDragEnd);
  document.body.classList.remove('drag-active');

  if (dragGhost) { dragGhost.remove(); dragGhost = null; }

  if (dragOverEl) {
    dragOverEl.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-child');
  }

  const targetEl = dragOverEl;
  const zone     = dragZone;
  dragOverEl = null;
  dragZone   = null;

  if (dragId === null || targetEl === null || zone === null) {
    dragId = null;
    return;
  }

  const targetId   = parseInt(targetEl.dataset.id, 10);
  const dragNode   = nodes.find(n => n.id === dragId);
  const targetNode = nodes.find(n => n.id === targetId);
  dragId = null;

  if (!dragNode || !targetNode) return;
  if (getDescendants(dragNode.id).some(d => d.id === targetId)) return;

  nodes = nodes.filter(n => n.id !== dragNode.id);
  const targetIdx = nodes.findIndex(n => n.id === targetId);

  if (zone === 'top') {
    dragNode.parentId = targetNode.parentId;
    nodes.splice(targetIdx, 0, dragNode);
  } else if (zone === 'child') {
    dragNode.parentId = targetId;
    targetNode.collapsed = false;
    nodes.splice(targetIdx + 1, 0, dragNode);
  } else {
    dragNode.parentId = targetNode.parentId;
    nodes.splice(targetIdx + 1, 0, dragNode);
  }

  render();
}

// ── Preview panel ─────────────────────────────────────────────────────────

function updatePreview() {
  const el = document.getElementById('preview-content');
  if (el) el.textContent = JSON.stringify(buildJSON(null), null, 2);
}

function togglePreview() {
  document.getElementById('preview-panel').classList.toggle('visible');
  updatePreview();
}

// ── File operations ───────────────────────────────────────────────────────
//
// When running inside Tauri the app uses the native file system dialog.
// When opened as a plain HTML file in a browser it falls back to a standard
// download / file input.

const isTauri = () => typeof window !== 'undefined' && !!window.__TAURI__;

async function saveJSON() {
  const content = JSON.stringify(buildJSON(null), null, 2);

  if (isTauri()) {
    try {
      const { save } = window.__TAURI__.dialog;
      const { writeFile } = window.__TAURI__.fs;

      const filePath = await save({
        title: 'Save JSON file',
        defaultPath: currentFilePath || 'data.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (filePath) {
        await writeFile({ path: filePath, contents: content });
        currentFilePath = filePath;
        updateFileLabel(filePath);
        showToast('File saved');
      }
    } catch (err) {
      showToast('Error saving file: ' + err.message);
    }
  } else {
    // Browser fallback: trigger a file download.
    const blob = new Blob([content], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'data.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('File downloaded');
  }
}

async function openJSON() {
  if (isTauri()) {
    try {
      const { open }        = window.__TAURI__.dialog;
      const { readTextFile } = window.__TAURI__.fs;

      const filePath = await open({
        title: 'Open JSON file',
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (filePath) {
        const raw  = await readTextFile(filePath);
        const json = JSON.parse(raw);
        nodes = [];
        nextId = 1;
        loadFromJSON(json, null);
        currentFilePath = filePath;
        updateFileLabel(filePath);
        render();
        showToast('File opened');
      }
    } catch (err) {
      showToast('Error opening file: ' + err.message);
    }
  } else {
    // Browser fallback: file input element.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener('load', ev => {
        try {
          const json = JSON.parse(ev.target.result);
          nodes = [];
          nextId = 1;
          loadFromJSON(json, null);
          updateFileLabel(file.name);
          render();
          showToast('File loaded');
        } catch {
          showToast('Invalid JSON file');
        }
      });
      reader.readAsText(file);
    });
    input.click();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function addRootNode() {
  nodes.push(createNode(null));
  render();
}

function clearAll() {
  if (nodes.length === 0) return;
  if (!confirm('Clear all fields?')) return;
  nodes = [];
  nextId = 1;
  currentFilePath = null;
  updateFileLabel(null);
  render();
}

function updateFileLabel(path) {
  const el = document.getElementById('file-label');
  el.textContent = path ? path.split(/[\\/]/).pop() : 'No file open';
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Button wiring ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-open').addEventListener('click', openJSON);
  document.getElementById('btn-add').addEventListener('click', addRootNode);
  document.getElementById('btn-preview').addEventListener('click', togglePreview);
  document.getElementById('btn-clear').addEventListener('click', clearAll);
  document.getElementById('btn-save').addEventListener('click', saveJSON);
  document.getElementById('preview-close').addEventListener('click', togglePreview);

  // ── Startup example ───────────────────────────────────────────────────────
  //
  // Load a small example so the user can see how the editor works immediately.

  const root = (key, type, value = '') => {
    const n = createNode(null);
    n.key = key; n.type = type; n.value = value;
    return n;
  };

  const child = (parentId, key, type, value = '') => {
    const n = createNode(parentId);
    n.key = key; n.type = type; n.value = value;
    return n;
  };

  const name    = root('name',    'string',  'Alice Johnson');
  const age     = root('age',     'number',  '31');
  const active  = root('active',  'boolean', 'true');
  const address = root('address', 'object');
  nodes.push(name, age, active, address);

  nodes.push(
    child(address.id, 'street', 'string', '14 Elm Street'),
    child(address.id, 'city',   'string', 'London'),
    child(address.id, 'zip',    'string', 'EC1A 1BB'),
  );

  const tags = root('tags', 'array');
  nodes.push(tags);
  nodes.push(
    child(tags.id, '0', 'string', 'admin'),
    child(tags.id, '1', 'string', 'verified'),
  );

  render();
});
