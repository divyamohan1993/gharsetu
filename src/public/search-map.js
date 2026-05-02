/* Leaflet bootstrap for /search and /listings/:id. */
(function () {
  'use strict';

  function init() {
    if (typeof L === 'undefined') { setTimeout(init, 100); return; }
    var el = document.getElementById('map');
    if (!el) return;
    var listings = window.__listings || [];
    var lang = window.__mapLang || 'en';
    var fmt;
    try { fmt = new Intl.NumberFormat(lang === 'hi' ? 'hi-IN' : 'en-IN'); }
    catch (e) { fmt = { format: function (n) { return String(n); } }; }

    var center = listings.length > 0
      ? [listings[0].lat, listings[0].lng]
      : [30.9116, 77.0967]; // Solan default
    var zoom = window.__mapZoom || (listings.length > 1 ? 11 : 13);

    var map = L.map(el, { scrollWheelZoom: false }).setView(center, zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    var bounds = [];
    listings.forEach(function (l) {
      if (typeof l.lat !== 'number' || typeof l.lng !== 'number') return;
      var marker = L.marker([l.lat, l.lng]).addTo(map);
      var popup = document.createElement('div');
      var title = document.createElement('strong');
      title.textContent = l.title || '';
      var price = document.createElement('div');
      price.textContent = '₹' + fmt.format(l.rent || 0) + (lang === 'hi' ? ' /महीना' : ' /month');
      var city = document.createElement('div');
      city.textContent = l.city || '';
      var link = document.createElement('a');
      link.href = '/listings/' + encodeURIComponent(l.id);
      link.textContent = lang === 'hi' ? 'विवरण देखें' : 'View details';
      popup.appendChild(title);
      popup.appendChild(price);
      popup.appendChild(city);
      popup.appendChild(document.createElement('br'));
      popup.appendChild(link);
      marker.bindPopup(popup);
      bounds.push([l.lat, l.lng]);
    });

    if (bounds.length > 1) {
      try { map.fitBounds(bounds, { padding: [24, 24] }); } catch (e) { /* ignore */ }
    }

    map.on('click', function () { map.scrollWheelZoom.enable(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
