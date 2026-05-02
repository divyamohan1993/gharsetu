/* GharSetu — vanilla client. No frameworks. */
(function () {
  'use strict';

  // Mobile nav close on link click (a11y).
  function initNav() {
    var toggle = document.getElementById('navtoggle');
    if (!toggle) return;
    document.querySelectorAll('.site-nav a').forEach(function (a) {
      a.addEventListener('click', function () { toggle.checked = false; });
    });
    var label = document.querySelector('.navtoggle-btn');
    if (label) {
      label.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle.checked = !toggle.checked;
        }
      });
    }
  }

  // Search filter form: debounce changes, auto-submit.
  function initFilterAuto() {
    var form = document.querySelector('.filters-form:not(.filters-form--inline)');
    if (!form) return;
    var t;
    var trigger = function () {
      clearTimeout(t);
      t = setTimeout(function () { form.submit(); }, 300);
    };
    form.querySelectorAll('select, input[type="checkbox"], input[type="radio"]').forEach(function (el) {
      el.addEventListener('change', trigger);
    });
  }

  // Lazy image fallback (browsers without loading=lazy).
  function initLazyImg() {
    if ('loading' in HTMLImageElement.prototype) return;
    if (!('IntersectionObserver' in window)) return;
    var imgs = document.querySelectorAll('img[loading="lazy"][data-src]');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var img = e.target;
          if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
          io.unobserve(img);
        }
      });
    });
    imgs.forEach(function (img) { io.observe(img); });
  }

  // Razorpay simulator: POST /pay/order then /pay/webhook with HMAC sig generated server-side.
  function initPay() {
    var btn = document.getElementById('pay-btn');
    if (!btn) return;
    var status = document.getElementById('pay-status');
    var csrf = (document.getElementById('pay-csrf') || {}).value || '';

    function setStatus(kind, msg) {
      if (!status) return;
      status.textContent = msg;
      status.className = 'pay-status pay-status--' + kind;
    }

    btn.addEventListener('click', async function () {
      btn.disabled = true;
      setStatus('info', 'Creating order...');
      try {
        var orderRes = await fetch('/pay/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
          credentials: 'same-origin',
          body: JSON.stringify({ booking_id: btn.dataset.booking })
        });
        if (!orderRes.ok) throw new Error('Order failed');
        var order = await orderRes.json();
        setStatus('info', 'Confirming payment...');
        var webhook = await fetch('/pay/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': order.signature || '', 'x-csrf-token': csrf },
          credentials: 'same-origin',
          body: JSON.stringify({
            event: 'payment.captured',
            payload: {
              payment: {
                entity: {
                  id: order.payment_id || ('pay_' + Date.now()),
                  order_id: order.rzp_order_id,
                  amount: order.amount * 100,
                  currency: 'INR',
                  status: 'captured'
                }
              }
            }
          })
        });
        if (!webhook.ok) throw new Error('Webhook failed');
        setStatus('ok', 'Payment successful. Redirecting...');
        setTimeout(function () { window.location.href = '/student/dashboard'; }, 800);
      } catch (err) {
        setStatus('err', 'Payment failed. Please try again.');
        btn.disabled = false;
      }
    });
  }

  // Build an audit-feed table row with safe DOM APIs (no innerHTML).
  function buildAuditRow(r) {
    var tr = document.createElement('tr');
    tr.setAttribute('data-entity', r.entity || '');
    tr.setAttribute('data-action', r.action || '');

    var d = new Date(r.created_at);
    var tdTime = document.createElement('td');
    var time = document.createElement('time');
    time.setAttribute('datetime', d.toISOString());
    time.textContent = d.toLocaleTimeString();
    tdTime.appendChild(time);

    var tdAction = document.createElement('td');
    var codeAct = document.createElement('code');
    codeAct.textContent = r.action || '';
    tdAction.appendChild(codeAct);

    var tdEntity = document.createElement('td');
    var codeEnt = document.createElement('code');
    codeEnt.textContent = (r.entity || '') + (r.entity_id ? ':' + String(r.entity_id).slice(0, 8) : '');
    tdEntity.appendChild(codeEnt);

    var tdActor = document.createElement('td');
    tdActor.textContent = r.actor_id ? String(r.actor_id).slice(0, 8) : '—';

    var tdIp = document.createElement('td');
    tdIp.textContent = r.ip || '—';

    var tdPayload = document.createElement('td');
    var pre = document.createElement('pre');
    pre.className = 'audit-payload';
    pre.textContent = r.payload || '';
    tdPayload.appendChild(pre);

    tr.appendChild(tdTime);
    tr.appendChild(tdAction);
    tr.appendChild(tdEntity);
    tr.appendChild(tdActor);
    tr.appendChild(tdIp);
    tr.appendChild(tdPayload);
    return tr;
  }

  // Admin SSE audit feed.
  function initAdminFeed() {
    var rows = document.getElementById('audit-rows');
    if (!rows) return;
    var statusEl = document.getElementById('admin-status');
    var entityF = document.getElementById('af-entity');
    var actionF = document.getElementById('af-action');
    var qF = document.getElementById('af-q');

    function applyFilters() {
      var entity = (entityF && entityF.value || '').trim();
      var action = (actionF && actionF.value || '').trim().toLowerCase();
      var q = (qF && qF.value || '').trim().toLowerCase();
      Array.prototype.forEach.call(rows.children, function (tr) {
        var ent = tr.getAttribute('data-entity') || '';
        var act = tr.getAttribute('data-action') || '';
        var text = tr.textContent.toLowerCase();
        var ok = (!entity || ent === entity) && (!action || act.indexOf(action) !== -1) && (!q || text.indexOf(q) !== -1);
        tr.style.display = ok ? '' : 'none';
      });
    }
    [entityF, actionF, qF].forEach(function (el) { if (el) el.addEventListener('input', applyFilters); });

    if (!('EventSource' in window)) {
      if (statusEl) statusEl.textContent = 'live updates not supported';
      return;
    }
    var es = new EventSource('/admin/audit/stream');
    es.onopen = function () { if (statusEl) statusEl.textContent = 'live'; };
    es.onerror = function () { if (statusEl) statusEl.textContent = 'reconnecting…'; };
    es.onmessage = function (e) {
      try {
        var r = JSON.parse(e.data);
        var tr = buildAuditRow(r);
        rows.insertBefore(tr, rows.firstChild);
        while (rows.children.length > 500) rows.removeChild(rows.lastChild);
        applyFilters();
      } catch (err) { /* ignore parse errors */ }
    };
  }

  // Form submit feedback (UX) — never bypasses server validation.
  function initFormHints() {
    document.querySelectorAll('form.form').forEach(function (f) {
      f.addEventListener('submit', function () {
        var btn = f.querySelector('button[type="submit"]');
        if (btn && !btn.disabled) {
          btn.dataset.label = btn.textContent;
          btn.textContent = 'Working...';
          btn.disabled = true;
          setTimeout(function () {
            if (btn.disabled) { btn.disabled = false; btn.textContent = btn.dataset.label || btn.textContent; }
          }, 8000);
        }
      });
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    initNav();
    initFilterAuto();
    initLazyImg();
    initPay();
    initAdminFeed();
    initFormHints();
  });
})();
