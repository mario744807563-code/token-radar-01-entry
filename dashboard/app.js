// Token Launch Radar — the page. Reads window.RADAR (written beside this folder as data.js by
// main.ts from the same board the gate checks), renders the ranked board, a per-protocol detail
// view with the model's arithmetic and the farm plan, and the live-token comparison view.
// No network, no framework: filtering and sorting happen here, on the reader's machine.
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) return;

  var state = {
    view: 'board',
    q: '',
    cat: '',
    chain: '',
    sort: 'rank',
    watchOnly: false,
    selected: null,
  };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function moneyFull(n) {
    return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function pctCls(n) {
    if (n === null || n === undefined || n === 0) return 'flat';
    return n > 0 ? 'up' : 'down';
  }
  function ageText(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 730) return (days / 365.25).toFixed(1) + ' yrs';
    if (days >= 60) return Math.round(days / 30.4) + ' mo';
    return days + ' d';
  }
  function chainText(chains) {
    if (!chains || chains.length === 0) return '—';
    if (chains.length <= 2) return chains.join(', ');
    return chains[0] + ', ' + chains[1] + ' +' + (chains.length - 2);
  }

  // ---- header -------------------------------------------------------------
  $('stamp').innerHTML = '';
  var stampLines = [
    ['snapshot', R.as_of],
    ['model', R.model_version],
    ['source', 'DefiLlama public API'],
  ];
  stampLines.forEach(function (pair) {
    var d = el('div');
    d.appendChild(el('span', null, pair[0] + '  '));
    d.appendChild(el('b', null, pair[1]));
    $('stamp').appendChild(d);
  });

  var stats = [
    [String(R.scanned_size), 'protocols scanned'],
    [String(R.watchlist_size) + ' / ' + String(R.watchlist_size), 'watchlist covered'],
    [String(R.board_size), 'pre-token ranked'],
    [String(R.early_size), 'found below the floor'],
    [String(R.live_size), 'live tokens tracked apart'],
  ];
  stats.forEach(function (s) {
    var d = el('div', 'stat');
    d.appendChild(el('span', 'n', s[0]));
    d.appendChild(el('span', 'l', s[1]));
    $('stats').appendChild(d);
  });

  // ---- filter options -------------------------------------------------------
  var cats = {}, chains = {};
  R.rows.forEach(function (r) {
    if (r.category) cats[r.category] = true;
    (r.chains || []).forEach(function (c) { chains[c] = true; });
  });
  function fillSelect(sel, values, allLabel) {
    sel.appendChild(el('option', null, allLabel)).value = '';
    values.sort().forEach(function (v) {
      var o = el('option', null, v);
      o.value = v;
      sel.appendChild(o);
    });
  }
  fillSelect($('f-cat'), Object.keys(cats), 'All categories');
  fillSelect($('f-chain'), Object.keys(chains), 'All chains');

  // ---- board ----------------------------------------------------------------
  var BOARD_HEAD = ['#', 'Protocol', 'Category', 'Chains', 'TVL', '7d', 'Age', 'Multiple', 'Implied value'];
  var LIVE_HEAD = ['Protocol', 'Category', 'Chains', 'TVL', 'Market cap', 'Mcap / TVL', '7d'];

  function visibleRows() {
    var rows = R.rows.filter(function (r) {
      if (state.watchOnly && !r.on_watchlist) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.q && r.name.toLowerCase().indexOf(state.q) < 0 && r.slug.indexOf(state.q) < 0) return false;
      return true;
    });
    var by = {
      rank: function (a, b) { return a.rank - b.rank; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      change: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
      multiple: function (a, b) { return b.category_multiple - a.category_multiple; },
    };
    return rows.sort(by[state.sort] || by.rank);
  }

  function renderBoard() {
    var head = $('board-head');
    head.innerHTML = '';
    var tr = el('tr');
    BOARD_HEAD.forEach(function (h, i) {
      tr.appendChild(el('th', i >= 4 ? 'num' : null, h));
    });
    head.appendChild(tr);
    var body = $('board-body');
    body.innerHTML = '';
    var rows = visibleRows();
    $('empty').hidden = rows.length > 0;
    rows.forEach(function (r) {
      var tr = el('tr');
      if (state.selected === r.slug) tr.className = 'sel';
      tr.addEventListener('click', function () { select(r.slug, true); });
      var rank = el('td', 'rank', String(r.rank));
      var name = el('td');
      name.appendChild(el('span', 'pname', r.name));
      if (r.on_watchlist) name.appendChild(el('span', 'star', '★ watchlist'));
      tr.appendChild(rank);
      tr.appendChild(name);
      tr.appendChild(el('td', 'pcat', r.category || '—'));
      tr.appendChild(el('td', 'chains', chainText(r.chains)));
      tr.appendChild(el('td', 'num', money(r.tvl_usd)));
      var ch = el('td', 'num ' + pctCls(r.change_7d), pct(r.change_7d));
      tr.appendChild(ch);
      tr.appendChild(el('td', 'num', ageText(r.age_days)));
      tr.appendChild(el('td', 'num', r.category_multiple.toFixed(3) + '×'));
      tr.appendChild(el('td', 'num implied', money(r.implied_value_usd)));
      body.appendChild(tr);
    });
  }

  function renderLive() {
    var head = $('board-head');
    head.innerHTML = '';
    var tr = el('tr');
    LIVE_HEAD.forEach(function (h, i) {
      tr.appendChild(el('th', i >= 3 ? 'num' : null, h));
    });
    head.appendChild(tr);
    var body = $('board-body');
    body.innerHTML = '';
    var rows = R.live.filter(function (r) {
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.q && r.name.toLowerCase().indexOf(state.q) < 0 && r.slug.indexOf(state.q) < 0) return false;
      return true;
    });
    $('empty').hidden = rows.length > 0;
    rows.forEach(function (r) {
      var tr = el('tr');
      var name = el('td');
      name.appendChild(el('span', 'pname', r.name));
      tr.appendChild(name);
      tr.appendChild(el('td', 'pcat', r.category || '—'));
      tr.appendChild(el('td', 'chains', chainText(r.chains)));
      tr.appendChild(el('td', 'num', money(r.tvl_usd)));
      tr.appendChild(el('td', 'num', money(r.mcap_usd)));
      tr.appendChild(el('td', 'num', r.tvl_usd > 0 && r.mcap_usd ? (r.mcap_usd / r.tvl_usd).toFixed(3) + '×' : '—'));
      tr.appendChild(el('td', 'num ' + pctCls(r.change_7d), pct(r.change_7d)));
      body.appendChild(tr);
    });
  }

  // ---- detail -----------------------------------------------------------------
  function mathRow(label, value) {
    var d = el('div', 'row');
    d.appendChild(el('span', null, label));
    d.appendChild(el('span', null, value));
    return d;
  }

  function select(slug, scroll) {
    state.selected = slug;
    var r = null;
    R.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    var box = $('detail');
    box.innerHTML = '';
    if (!r) {
      box.appendChild(el('p', 'none', 'Pick a row on the board and its model, record and farm plan appear here.'));
      return;
    }
    box.appendChild(el('h2', null, r.name));
    var sub = el('p', 'sub');
    sub.appendChild(el('span', 'badge', 'pre-token · records no token'));
    if (r.on_watchlist) sub.appendChild(el('span', 'badge watch', 'on the house watchlist'));
    box.appendChild(sub);

    var math = el('div', 'math');
    math.appendChild(mathRow('TVL (snapshot)', moneyFull(r.tvl_usd)));
    var multLabel = r.multiple_source === 'category'
      ? '× category multiple (' + (r.category || 'Uncategorized') + ' median, ' + r.multiple_samples + ' live peers)'
      : '× category multiple (all-category median, ' + r.multiple_samples + ' live peers — ' + (r.category || 'this category') + ' has too few)';
    math.appendChild(mathRow(multLabel, r.category_multiple.toFixed(4) + '×'));
    math.appendChild(mathRow('× 7-day growth adjustment', r.growth_multiplier.toFixed(4) + '×'));
    math.appendChild(mathRow('× maturity adjustment (' + ageText(r.age_days) + ' without a token)', r.maturity_multiplier.toFixed(4) + '×'));
    var total = mathRow('= implied value', moneyFull(r.implied_value_usd));
    total.className = 'row total';
    math.appendChild(total);
    box.appendChild(math);

    var facts = el('dl', 'facts');
    [['Rank', '#' + r.rank], ['Category', r.category || '—'], ['Chains', (r.chains || []).join(', ') || '—'],
     ['Tracked since', r.listed_at || 'unknown'], ['7-day TVL change', pct(r.change_7d)], ['Slug', r.slug]
    ].forEach(function (pair) {
      var wrap = el('div');
      wrap.appendChild(el('dt', null, pair[0]));
      wrap.appendChild(el('dd', null, pair[1]));
      facts.appendChild(wrap);
    });
    box.appendChild(facts);

    box.appendChild(el('h3', null, 'Farm plan — before any token exists'));
    var plan = el('ol', 'plan');
    r.farm_steps.forEach(function (s) {
      var li = el('li');
      li.appendChild(el('span', 'step', s.text));
      li.appendChild(el('span', 'meta', 'Cost: ' + s.cost + ' · Time: ' + s.time));
      plan.appendChild(li);
    });
    box.appendChild(plan);
    if (scroll) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ---- method -----------------------------------------------------------------
  function renderMethod() {
    var body = $('method-body');
    var wrap = el('div', 'method-body-in');
    var p1 = el('p');
    p1.innerHTML = 'Implied value = <code>TVL × category multiple × growth × maturity</code>. The multiple is not a guess: ' +
      'it is the <code>median market-cap / TVL</code> of the protocols in the same snapshot whose token already trades — the price the market ' +
      'itself puts on a dollar of that kind of TVL. Categories with fewer than ' + R.model.min_category_samples + ' live peers borrow the ' +
      'all-category median (' + R.global_multiple.toFixed(3) + '×, from the whole live set). Multiples are clamped to ' +
      R.model.multiple_min + '×–' + R.model.multiple_max + '× so one thin category cannot dominate the board.';
    wrap.appendChild(p1);
    var p2 = el('p');
    p2.innerHTML = 'Growth multiplies by <code>1 + clamp(7-day change, −60%, +120%) / 100 × 0.5</code>; maturity by ' +
      '<code>0.6 + min(age, 3 years) / 3 years × 0.4</code>, so a protocol that has run longer with no token counts for more. ' +
      'The same function scores every row; no name is special-cased. Beyond the watchlist, the board applies the house\u2019s own screen: ' +
      'wrapped, staked or bridged products of tokens that already trade, exchanges\u2019 own products and versioned pools are not ranked as launches — ' +
      'without it the top of the board would be WBTC and USDT0, whose value already trades under another name. ' +
      'Protocols whose token already trades are shown apart, at the market\u2019s own values.';
    wrap.appendChild(p2);
    var t = el('table');
    var thead = el('tr');
    ['Category', 'Multiple', 'Live peers', 'Source'].forEach(function (h) { thead.appendChild(el('th', null, h)); });
    t.appendChild(thead);
    R.multiples.forEach(function (m) {
      var tr = el('tr');
      tr.appendChild(el('td', null, m.category));
      tr.appendChild(el('td', null, m.multiple.toFixed(3) + '×'));
      tr.appendChild(el('td', null, String(m.samples)));
      tr.appendChild(el('td', null, m.source === 'category' ? 'category median' : 'global median (thin category)'));
      t.appendChild(tr);
    });
    wrap.appendChild(t);
    body.appendChild(wrap);
  }

  // ---- wiring -----------------------------------------------------------------
  function render() {
    if (state.view === 'board') { renderBoard(); } else { renderLive(); }
  }
  $('view-board').addEventListener('click', function () {
    state.view = 'board';
    $('view-board').className = 'seg-on'; $('view-live').className = '';
    render();
  });
  $('view-live').addEventListener('click', function () {
    state.view = 'live';
    $('view-live').className = 'seg-on'; $('view-board').className = '';
    render();
    var box = $('detail');
    box.innerHTML = '';
    box.appendChild(el('p', 'none', 'These protocols already have a token: the radar shows the market\u2019s own market cap for them, never a model value. Their category medians are what price the pre-token board.'));
  });
  $('q').addEventListener('input', function (e) { state.q = e.target.value.trim().toLowerCase(); render(); });
  $('f-cat').addEventListener('change', function (e) { state.cat = e.target.value; render(); });
  $('f-chain').addEventListener('change', function (e) { state.chain = e.target.value; render(); });
  $('f-sort').addEventListener('change', function (e) { state.sort = e.target.value; renderBoard(); });
  $('f-watch').addEventListener('change', function (e) { state.watchOnly = e.target.checked; render(); });

  renderMethod();
  render();
  if (R.rows.length > 0) select(R.rows[0].slug, false);
})();
