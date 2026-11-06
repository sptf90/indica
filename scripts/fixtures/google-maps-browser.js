/* SDK simulado somente nos testes Playwright. Nenhuma chamada ao Google. */
(() => {
  class TestMap {
    constructor(element, options) {
      this.element = element; this.center = options.center; this.zoom = options.zoom;
      element.style.background = '#f3ebe4';
      const label = document.createElement('span'); label.textContent = 'Mapa simulado para testes'; element.append(label);
    }
    getCenter() { return { toJSON: () => this.center }; }
    setCenter(point) { this.center = point; }
    setZoom(zoom) { this.zoom = zoom; }
    fitBounds(bounds) { this.center = bounds.points[0]; }
    addListener(type, handler) {
      const listener = event => { if (event.target === this.element) handler({ latLng: { toJSON: () => this.center } }); };
      this.element.addEventListener(type, listener); return { remove: () => this.element.removeEventListener(type, listener) };
    }
  }
  class Marker extends HTMLElement {
    constructor(options) { super(); this.position = options.position; this.title = options.title; this.map = options.map; this.setAttribute('role', 'button'); this.tabIndex = 0; }
    set map(map) { this.remove(); if (map) map.element.append(this); }
    addListener(type, handler) { const callback = event => { event.stopPropagation(); handler(); }; this.addEventListener(type, callback); return { remove: () => this.removeEventListener(type, callback) }; }
  }
  class Pin extends HTMLElement { constructor(options) { super(); this.textContent = options.glyphText; } }
  customElements.define('test-map-marker', Marker); customElements.define('test-map-pin', Pin);
  window.google = { maps: {
    importLibrary: async () => ({ Map: TestMap, AdvancedMarkerElement: Marker, PinElement: Pin }),
    event: { clearInstanceListeners() {} },
    LatLngBounds: class { points = []; extend(point) { this.points.push(point); } },
  } };
  window.__indicaMapsReady();
})();
