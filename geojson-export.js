(function (global) {
  'use strict';

  const SOURCE_NAMES = { zone: 'zones', vianey: 'vianey' };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sanitizeFeature(feature) {
    const properties = clone(feature.properties);
    delete properties.layer;
    delete properties.name;
    const result = {
      type: 'Feature',
      properties,
      geometry: clone(feature.geometry)
    };
    if (Object.hasOwn(feature, 'id')) result.id = clone(feature.id);
    if (Object.hasOwn(feature, 'bbox')) result.bbox = clone(feature.bbox);
    return result;
  }

  function collection(features) {
    return { type: 'FeatureCollection', features: features.map(sanitizeFeature) };
  }

  function normalizedName(value) {
    const normalized = String(value || 'entidad').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return normalized || 'entidad';
  }

  function filename(kind, name) {
    const source = SOURCE_NAMES[kind] || normalizedName(kind);
    return name === undefined ? `${source}_filtrados.geojson` : `${source}_${normalizedName(name)}.geojson`;
  }

  function isVisible(feature, selected) {
    const properties = feature.properties;
    return selected.sector.size > 0 && selected.state.size > 0
      && properties.sector_ids.some(id => selected.sector.has(id))
      && properties.state_ids.some(id => selected.state.has(id));
  }

  function filteredItems(kind, viewer) {
    return [...viewer.byId[kind].values()].filter(item => isVisible(item.feature, viewer.selected));
  }

  function download(features, name, document) {
    if (!features.length) return null;
    const blob = new Blob([JSON.stringify(collection(features))], { type: 'application/geo+json;charset=utf-8' });
    const url = global.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    global.setTimeout(() => global.URL.revokeObjectURL(url), 0);
    return { blob, name };
  }

  function downloadIcon() {
    return '<svg class="visibility-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v11M8 10l4 4 4-4M5 19h14"/></svg>';
  }

  function button(label, className) {
    const element = global.document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.setAttribute('aria-label', label);
    element.title = label;
    element.innerHTML = `${downloadIcon()}<span class="sr-only"></span>`;
    element.querySelector('.sr-only').textContent = label;
    return element;
  }

  function syncSourceButton(kind, viewer) {
    const element = global.document.querySelector(`[data-source-export="${kind}"]`);
    if (!element) return;
    const count = filteredItems(kind, viewer).length;
    const source = kind === 'zone' ? 'Zones' : 'Vianey';
    const available = count > 0;
    const label = available
      ? `Descargar ${count} entidades filtradas de ${source} como GeoJSON`
      : `No hay entidades filtradas de ${source} para descargar`;
    element.disabled = !available;
    element.setAttribute('aria-label', label);
    element.title = label;
    element.querySelector('.sr-only').textContent = label;
  }

  function addSourceButton(kind, viewer) {
    const eye = global.document.querySelector(`[data-layer-toggle="${kind}"]`);
    if (!eye || global.document.querySelector(`[data-source-export="${kind}"]`)) return;
    const source = kind === 'zone' ? 'Zones' : 'Vianey';
    const element = button(`Descargar entidades filtradas de ${source} como GeoJSON`, 'layer-toggle');
    element.dataset.sourceExport = kind;
    element.addEventListener('click', () => {
      const items = filteredItems(kind, viewer);
      download(items.map(item => item.feature), filename(kind), global.document);
    });
    eye.before(element);
    syncSourceButton(kind, viewer);
  }

  function decorateRows(kind, viewer) {
    const list = global.document.getElementById(`${kind}-entity-list`);
    if (!list) return;
    for (const eye of list.querySelectorAll(`[data-entity-toggle="${kind}"]`)) {
      if (eye.parentElement.querySelector('[data-entity-export]')) continue;
      const item = viewer.byId[kind].get(eye.dataset.entityId);
      if (!item) continue;
      const label = `Descargar ${item.name} como GeoJSON`;
      const element = button(label, 'entity-toggle');
      element.dataset.entityExport = kind;
      element.dataset.entityId = item.id;
      element.addEventListener('click', () => download([item.feature], filename(kind, item.name), global.document));
      eye.before(element);
    }
    syncSourceButton(kind, viewer);
  }

  function install() {
    const viewer = global.__viewerDebug;
    if (!viewer || !global.document) return;
    for (const kind of Object.keys(SOURCE_NAMES)) {
      addSourceButton(kind, viewer);
      decorateRows(kind, viewer);
      const list = global.document.getElementById(`${kind}-entity-list`);
      new MutationObserver(() => decorateRows(kind, viewer)).observe(list, { childList: true, subtree: true });
    }
  }

  global.__viewerGeoJsonExport = { collection, sanitizeFeature, filename, filteredItems, isVisible, download };
  if (global.document) install();
})(window);
