/* ==========================================================================
   Painel de Rastreamento GTF
   Carrega os relatórios de ./dados/ e monta a interface.
   Nenhuma dependência externa — roda direto no GitHub Pages.
   ========================================================================== */
(function () {
  'use strict';

  var CAMINHO_DADOS = './dados/';
  var IDLE_INICIAL = 40;

  var estado = {
    indice: null,      // conteúdo de dados/index.json
    relatorio: null,   // relatório atualmente carregado
    idleExpandido: false,
    cache: {}          // relatórios já baixados nesta sessão
  };

  /* ---------------------------------------------------------------- utils */

  function $(id) { return document.getElementById(id); }

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(n) {
    return typeof n === 'number' ? n.toLocaleString('pt-BR') : esc(n);
  }

  // decimais no padrão brasileiro: 186.4 -> "186,4"
  function dec(n, casas) {
    if (typeof n !== 'number') return esc(n);
    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: casas === undefined ? 0 : casas,
      maximumFractionDigits: casas === undefined ? 1 : casas
    });
  }

  // "2026-06-01" -> "01/06/2026"
  function dataBR(iso) {
    if (!iso) return '—';
    var p = String(iso).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : esc(iso);
  }

  // "2026-06-01 17:38" -> "01/06/2026 17:38"
  function dataHoraBR(s) {
    if (!s) return '—';
    var p = String(s).split(' ');
    return dataBR(p[0]) + (p[1] ? ' ' + p[1] : '');
  }

  /* -------------------------------------------------- carregamento de dados */

  function buscarJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ao buscar ' + url);
      return r.json();
    });
  }

  function mostrarErro(msg) {
    $('loadState').classList.add('hidden');
    $('content').classList.add('hidden');
    $('errorState').classList.remove('hidden');
    $('errorMsg').textContent = msg;
    $('main').setAttribute('aria-busy', 'false');
  }

  function iniciar() {
    buscarJSON(CAMINHO_DADOS + 'index.json')
      .then(function (indice) {
        estado.indice = indice;
        montarSeletor(indice);
        var id = idInicial(indice);
        return carregarRelatorio(id);
      })
      .catch(function (e) {
        mostrarErro(
          e.message +
          '. Se estiver abrindo o arquivo direto do disco (file://), use um servidor local — veja o README.'
        );
      });
  }

  function idInicial(indice) {
    var params = new URLSearchParams(location.search);
    var pedido = params.get('r');
    var lista = indice.relatorios || [];
    var existe = lista.some(function (r) { return r.id === pedido; });
    if (pedido && existe) return pedido;
    var padrao = lista.filter(function (r) { return r.padrao; })[0];
    return (padrao || lista[0] || {}).id;
  }

  function montarSeletor(indice) {
    var sel = $('periodSelect');
    var lista = indice.relatorios || [];
    sel.closest('.select-wrap').classList.toggle('hidden', lista.length <= 1);
    sel.innerHTML = lista.map(function (r) {
      return '<option value="' + esc(r.id) + '">' + esc(r.rotulo || r.id) + '</option>';
    }).join('');
    sel.addEventListener('change', function () {
      carregarRelatorio(sel.value);
      var u = new URL(location.href);
      u.searchParams.set('r', sel.value);
      history.replaceState(null, '', u);
    });
  }

  function carregarRelatorio(id) {
    var meta = (estado.indice.relatorios || []).filter(function (r) { return r.id === id; })[0];
    if (!meta) { mostrarErro('Relatório "' + id + '" não encontrado em dados/index.json.'); return; }

    $('periodSelect').value = id;

    if (estado.cache[id]) { aplicar(estado.cache[id]); return Promise.resolve(); }

    $('content').classList.add('hidden');
    $('loadState').classList.remove('hidden');
    $('main').setAttribute('aria-busy', 'true');

    return buscarJSON(CAMINHO_DADOS + meta.arquivo)
      .then(function (rel) {
        estado.cache[id] = rel;
        aplicar(rel);
        guardarOffline([CAMINHO_DADOS + 'index.json', CAMINHO_DADOS + meta.arquivo]);
      })
      .catch(function (e) { mostrarErro(e.message); });
  }

  // Pede ao service worker que guarde estes arquivos para uso offline.
  // Necessário porque, na primeira visita, ele ainda não controla a página e
  // não enxerga os downloads feitos agora.
  function guardarOffline(urls) {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(function (reg) {
      var alvo = reg.active || navigator.serviceWorker.controller;
      if (alvo) alvo.postMessage({ tipo: 'guardar', urls: urls });
    }).catch(function () { /* sem service worker — segue sem cache offline */ });
  }

  function aplicar(rel) {
    estado.relatorio = rel;
    estado.idleExpandido = false;
    renderizarTudo();
    $('loadState').classList.add('hidden');
    $('errorState').classList.add('hidden');
    $('content').classList.remove('hidden');
    $('main').setAttribute('aria-busy', 'false');
  }

  /* ------------------------------------------------------------ renderizar */

  function renderizarTudo() {
    var rel = estado.relatorio;
    var m = rel.meta || {};
    var s = rel.summary || {};

    // cabeçalho
    document.title = (m.titulo || 'Painel de Rastreamento') +
      (m.motorista ? ' — ' + m.motorista : '');
    $('appTitle').textContent = m.motorista
      ? m.titulo + ' — ' + m.motorista
      : (m.titulo || 'Painel de Rastreamento');
    $('appSubtitle').textContent = [
      m.placa ? 'Veículo ' + m.placa : '',
      (m.periodo_inicio ? dataBR(m.periodo_inicio) + ' a ' + dataBR(m.periodo_fim) : '')
    ].filter(Boolean).join(' · ');
    $('footerMeta').textContent = [
      m.endereco_casa ? 'Referência (casa): ' + m.endereco_casa : '',
      m.gerado_em ? 'Relatório gerado em ' + dataBR(m.gerado_em) : ''
    ].filter(Boolean).join(' · ');

    // seções que dependem de blocos opcionais somem quando não há dados
    alternarSecao('sec-primeiro-maio', (rel.pm_episodes || []).length > 0);
    alternarSecao('sec-geo', (rel.geo_table || []).length > 0);
    alternarSecao('sec-ocioso', (rel.idle_events || []).length > 0);

    renderKPIs(s);
    renderRotina(s);
    renderPernoites(s, m);
    renderAlertas(rel.days || []);
    if ((rel.pm_episodes || []).length) renderPrimeiroMaio(rel, s);
    renderGeo(rel.geo_table || []);
    if ((rel.idle_events || []).length) renderOcioso(rel.idle_events, s);
    renderTabelaDias();
  }

  // mostra ou esconde uma seção e o item correspondente no menu do topo
  function alternarSecao(id, mostrar) {
    var sec = $(id);
    if (sec) sec.classList.toggle('hidden', !mostrar);
    var link = document.querySelector('.section-nav a[href="#' + id + '"]');
    if (link) link.classList.toggle('hidden', !mostrar);
  }

  function cardKPI(v, l, cor) {
    return '<div class="kpi"><div class="v"' + (cor ? ' style="color:' + cor + '"' : '') +
      '>' + v + '</div><div class="l">' + esc(l) + '</div></div>';
  }

  function renderKPIs(s) {
    $('kpis').innerHTML = [
      cardKPI(num(s.business_days), 'Dias úteis no período'),
      cardKPI(esc(s.avg_departure || '—'), 'Saída média'),
      cardKPI(esc(s.avg_return || '—'), 'Retorno médio'),
      cardKPI(dec(s.avg_stops_per_day), 'Paradas / dia (média)'),
      cardKPI(dec(s.total_km) + ' km', 'Km total no período'),
      cardKPI(num(s.days_no_movement), 'Dias úteis sem movimento', s.days_no_movement > 3 ? '#ef5a6f' : null),
      cardKPI(num(s.days_with_flags), 'Dias com algum alerta', '#f2b84b')
    ].join('');
  }

  function renderRotina(s) {
    $('mAvgDep').textContent = s.avg_departure || '—';
    $('mAvgRet').textContent = s.avg_return || '—';
    $('mAvgStops').textContent = dec(s.avg_stops_per_day);
    $('mAvgKm').textContent = dec(s.avg_km_per_day) + ' km';
    $('mTotalKm').textContent = dec(s.total_km) + ' km';
    $('mNoMove').textContent = s.days_no_movement;
    $('mSpeed').textContent = num(s.total_speed_events);
  }

  function renderPernoites(s, m) {
    var todas = [
      { chave: 'casa', l: 'Casa', v: s.nights_home || 0, c: '#3ecf8e' },
      { chave: 'alt', l: 'Endereço alternativo', v: s.nights_alt || 0, c: '#f2b84b' },
      { chave: 'manut', l: 'Oficina (manutenção)', v: s.nights_maintenance || 0, c: '#7fb0e8' },
      { chave: 'outro', l: 'Outro local incomum', v: s.nights_other || 0, c: '#ef5a6f' },
      { chave: 'desconhecido', l: 'Sem registro', v: s.nights_unknown || 0, c: '#9aa1ad' }
    ];
    // categorias zeradas não viram barra nem legenda — o período pode
    // simplesmente não ter manutenção ou endereço alternativo
    var barras = todas.filter(function (b) { return b.v > 0; });
    var total = barras.reduce(function (a, b) { return a + b.v; }, 0);

    $('overnightBars').innerHTML = barras.map(function (b) {
      var pct = total ? (b.v / total * 100) : 0;
      return '<div class="bar-row">' +
        '<div class="bar-label">' + esc(b.l) + '</div>' +
        '<div class="bar-val">' + b.v + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct.toFixed(1) +
        '%;background:' + b.c + '"></div></div>' +
        '</div>';
    }).join('');

    $('overnightLegend').innerHTML = barras.map(function (b) {
      return '<span><i class="dot" style="background:' + b.c + '"></i>' +
        esc(b.l) + '</span>';
    }).join('');

    $('overnightNote').innerHTML = notaPernoites(s, m, total);
  }

  // Texto explicativo do bloco de pernoites, montado conforme o que os dados
  // mostram — um motorista que dorme sempre em casa e outro que alterna entre
  // endereços exigem leituras diferentes.
  function notaPernoites(s, m, total) {
    var casa = s.nights_home || 0;
    var alt = s.nights_alt || 0;
    var outro = s.nights_other || 0;
    var manut = s.nights_maintenance || 0;
    var partes = [];

    if (alt > 0) {
      partes.push('O veículo <b>alterna entre dois endereços</b> nas madrugadas: ' +
        casa + ' noites no endereço de referência' +
        (m.endereco_casa ? ' (' + esc(m.endereco_casa) + ')' : '') +
        ' e ' + alt + ' em ' +
        (m.endereco_alternativo ? '<b>' + esc(m.endereco_alternativo) + '</b>'
                                : 'um endereço alternativo recorrente') + '.');
    } else if (casa === total && total > 0) {
      partes.push('O veículo pernoitou <b>no endereço de referência em todas as ' +
        total + ' noites</b> do período' +
        (m.endereco_casa ? ' (' + esc(m.endereco_casa) + ')' : '') +
        ' — não há endereço alternativo recorrente nem pernoite fora do padrão.');
    } else {
      partes.push(casa + ' de ' + total + ' noites no endereço de referência' +
        (m.endereco_casa ? ' (' + esc(m.endereco_casa) + ')' : '') + '.');
    }

    if (manut > 0) {
      partes.push('Houve ' + manut + ' noites em manutenção na oficina, ' +
        'já confirmadas e desconsideradas como desvio.');
    }
    if (outro > 0) {
      partes.push('Restam <b>' + outro + '</b> pernoites em local ainda sem explicação.');
    }
    return partes.join(' ');
  }

  // Nem toda observação é desvio: feriado, dia parcial e manutenção explicam
  // o comportamento do dia em vez de apontarem um problema.
  var FLAGS_INFORMATIVAS = /^(Feriado|Dia parcial|Veículo em manutenção)/;

  function temAlertaReal(d) {
    return (d.flags || []).some(function (f) { return !FLAGS_INFORMATIVAS.test(f); });
  }

  function renderAlertas(days) {
    var comAlerta = days.filter(function (d) {
      return temAlertaReal(d) && !d.is_weekend && !d.in_maintenance;
    });
    $('flagCount').textContent = comAlerta.length + ' dias úteis';
    $('flagList').innerHTML = comAlerta.map(function (d) {
      var incomum = String(d.overnight_prev_night || '').indexOf('Outro') === 0;
      return '<li><span><b>' + dataBR(d.date) + '</b> (' + esc(d.weekday) + ') — ' +
        esc(d.flags.join(' · ')) + '</span>' +
        '<span class="date">' + (incomum ? '🔴 pernoite incomum' : '') + '</span></li>';
    }).join('') || '<li class="muted">Nenhum alerta em dias úteis neste período.</li>';
  }

  function renderPrimeiroMaio(rel, s) {
    var eps = rel.pm_episodes || [];
    var m = rel.meta || {};
    if (m.endereco_alternativo) $('pmTitleAddr').textContent = m.endereco_alternativo;

    var fds = eps.filter(function (e) { return e.kind.indexOf('fim de semana') >= 0; });
    var noite = eps.filter(function (e) { return e.kind === 'Pernoite'; });
    var rapidas = eps.filter(function (e) { return e.kind === 'Passagem rápida'; });
    var rapidasTarde = rapidas.filter(function (e) {
      var h = parseInt(String(e.arrival).split(' ')[1].split(':')[0], 10);
      return h >= 16 && h <= 19;
    });

    $('pmDays').textContent = s.pm_distinct_days;
    $('pmTotalDays').textContent = s.total_days;
    $('pmWeekend').textContent = fds.length;
    $('pmNight').textContent = noite.length;
    $('pmQuick').textContent = rapidas.length;
    $('pmQuickEvening').textContent = rapidasTarde.length;
    $('pmQuickEvening2').textContent = rapidasTarde.length;

    $('pmTableBody').innerHTML = eps.map(function (e) {
      var dur = e.dwell_h >= 1 ? dec(e.dwell_h) + ' h' : Math.round(e.dwell_h * 60) + ' min';
      return '<tr>' +
        '<td>' + dataHoraBR(e.arrival) + '</td>' +
        '<td>' + dataHoraBR(e.departure) + '</td>' +
        '<td>' + dur + '</td>' +
        '<td>' + esc(e.kind) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderGeo(geo) {
    $('geoTableBody').innerHTML = geo.map(function (g) {
      return '<tr>' +
        '<td><b>' + esc(g.addr) + '</b></td>' +
        '<td>' + num(g.dist_home_m) + ' m</td>' +
        '<td>' + num(g.dist_alt_m) + ' m</td>' +
        '<td>' + esc(g.dir_from_home) + '</td>' +
        '<td>' + esc(g.note) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderOcioso(eventos, s) {
    $('idleCount').textContent = eventos.length + ' ocorrências';
    $('idleAvg').textContent = dec(s.idle_avg_min);
    $('idleOver15').textContent = s.idle_over_15min;

    var lista = estado.idleExpandido ? eventos : eventos.slice(0, IDLE_INICIAL);
    $('idleTableBody').innerHTML = lista.map(function (e) {
      var alto = e.dur_min >= 15;
      return '<tr>' +
        '<td>' + dataBR(e.date) + '</td>' +
        '<td>' + esc(e.start) + '</td>' +
        '<td>' + esc(e.end) + '</td>' +
        '<td style="font-weight:' + (alto ? '700' : '400') +
        ';color:' + (alto ? '#f2b84b' : 'inherit') + '">' + dec(e.dur_min) + ' min</td>' +
        '<td>' + esc(e.addr) + ', ' + esc(e.city) + '</td>' +
        '</tr>';
    }).join('');

    var btn = $('idleMoreBtn');
    if (eventos.length > IDLE_INICIAL) {
      btn.classList.remove('hidden');
      btn.textContent = estado.idleExpandido
        ? 'Mostrar menos'
        : 'Mostrar as outras ' + (eventos.length - IDLE_INICIAL) + ' ocorrências';
    } else {
      btn.classList.add('hidden');
    }
  }

  function pillPernoite(texto) {
    var t = String(texto || '');
    if (t.indexOf('Casa') === 0) return '<span class="pill home">Casa</span>';
    if (t.indexOf('Endereço') === 0) return '<span class="pill alt">Alternativo</span>';
    if (t.indexOf('Manutenção') === 0) return '<span class="pill shop">Oficina GTF</span>';
    if (t.indexOf('Outro') === 0) return '<span class="pill other">' + esc(t.replace('Outro local: ', '')) + '</span>';
    return '<span class="pill unknown">?</span>';
  }

  function renderTrajetos(dia) {
    if (!dia.trips || !dia.trips.length) {
      return '<div class="detail-inner muted">Nenhuma parada registrada neste dia.</div>';
    }
    return '<div class="detail-inner">' + dia.trips.map(function (t) {
      return '<div class="trip' + (t.is_real ? '' : ' micro') + '">' +
        '<div class="t">' + esc(t.start) + '–' + esc(t.end) + '</div>' +
        '<div class="route">' + esc(t.start_addr || '?') + ', ' + esc(t.start_city || '?') +
        ' → <b>' + esc(t.end_addr || '?') + ', ' + esc(t.end_city || '?') + '</b>' +
        (t.is_real ? '' : '<span class="micro-tag">sem deslocamento relevante</span>') + '</div>' +
        '<div class="metrics"><span>' + dec(t.dist_km) + ' km</span>' +
        '<span>' + dec(t.dur_min) + ' min</span></div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function celula(rotulo, conteudo) {
    return '<td data-label="' + rotulo + '">' + conteudo + '</td>';
  }

  // minúsculas e sem acento, para "itambe" encontrar "Itambé"
  function normalizar(s) {
    s = String(s === null || s === undefined ? '' : s).toLowerCase();
    return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
  }

  // texto pesquisável de um dia — inclui as cidades e endereços das paradas.
  // Calculado uma vez por dia e guardado no próprio objeto.
  function textoBusca(d) {
    if (d.__busca !== undefined) return d.__busca;
    var partes = [
      d.date, dataBR(d.date), d.weekday,
      d.first_departure_addr, d.return_addr, d.overnight_prev_night,
      (d.flags || []).join(' ')
    ];
    (d.trips || []).forEach(function (t) {
      partes.push(t.start_addr, t.start_city, t.end_addr, t.end_city);
    });
    d.__busca = normalizar(partes.filter(Boolean).join(' '));
    return d.__busca;
  }

  function renderTabelaDias() {
    var days = (estado.relatorio && estado.relatorio.days) || [];
    var q = normalizar($('searchBox').value.trim());
    var soAlertas = $('onlyFlags').checked;
    var ocultarFds = $('hideWeekend').checked;
    var linhas = '';
    var contador = 0;

    days.forEach(function (d, idx) {
      if (ocultarFds && d.is_weekend) return;
      if (soAlertas && !temAlertaReal(d)) return;
      if (q && textoBusca(d).indexOf(q) === -1) return;
      contador++;
      linhas +=
        '<tr class="day-row' + (d.is_weekend ? ' weekend' : '') + '" data-idx="' + idx +
        '" tabindex="0" role="button" aria-expanded="false">' +
        celula('Data', dataBR(d.date) +
          '<span class="dow">' + esc(String(d.weekday).replace('-feira', '')) + '</span>') +
        celula('Dia', esc(String(d.weekday).replace('-feira', ''))) +
        celula('Pernoite anterior', pillPernoite(d.overnight_prev_night)) +
        celula('1ª saída', d.first_departure_time || '<span class="muted">—</span>') +
        celula('Retorno', d.return_time || '<span class="muted">—</span>') +
        celula('Paradas', d.num_stops) +
        celula('Km', dec(d.total_km)) +
        celula('Alertas', (d.flags || []).map(function (f) {
          return '<span class="flag-chip">' + esc(f) + '</span>';
        }).join('')) +
        '</tr>' +
        '<tr class="detail-row hidden" id="detail-' + idx + '"><td colspan="8">' +
        renderTrajetos(d) + '</td></tr>';
    });

    $('dayTableBody').innerHTML = linhas ||
      '<tr><td colspan="8" class="muted">Nenhum dia corresponde aos filtros.</td></tr>';
    $('dayCount').textContent = contador + (contador === 1 ? ' dia exibido' : ' dias exibidos') +
      ' de ' + days.length;
  }

  function alternarDetalhe(linha) {
    var alvo = $('detail-' + linha.dataset.idx);
    if (!alvo) return;
    var aberto = alvo.classList.toggle('hidden') === false;
    linha.classList.toggle('open', aberto);
    linha.setAttribute('aria-expanded', aberto ? 'true' : 'false');
  }

  /* ------------------------------------------------------------- interação */

  function ligarEventos() {
    ['searchBox', 'onlyFlags', 'hideWeekend'].forEach(function (id) {
      var el = $(id);
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', renderTabelaDias);
    });

    // delegação: sobrevive a cada re-render da tabela
    $('dayTableBody').addEventListener('click', function (ev) {
      var linha = ev.target.closest('tr.day-row');
      if (linha) alternarDetalhe(linha);
    });
    $('dayTableBody').addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var linha = ev.target.closest('tr.day-row');
      if (linha) { ev.preventDefault(); alternarDetalhe(linha); }
    });

    $('idleMoreBtn').addEventListener('click', function () {
      estado.idleExpandido = !estado.idleExpandido;
      renderOcioso(estado.relatorio.idle_events || [], estado.relatorio.summary || {});
    });

    marcarSecaoAtiva();
  }

  // destaca no menu a seção visível
  function marcarSecaoAtiva() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.section-nav a'));
    if (!('IntersectionObserver' in window)) return;
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id);
        });
      });
    }, { rootMargin: '-120px 0px -65% 0px', threshold: 0 });
    document.querySelectorAll('.section-anchor').forEach(function (s) { obs.observe(s); });
  }

  /* ------------------------------------------------------------------ PWA */

  function configurarPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').catch(function (e) {
          console.warn('Service worker não registrado:', e);
        });
      });
    }

    var evtInstalacao = null;
    var btn = $('installBtn');
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      evtInstalacao = e;
      btn.classList.remove('hidden');
    });
    btn.addEventListener('click', function () {
      if (!evtInstalacao) return;
      evtInstalacao.prompt();
      evtInstalacao.userChoice.finally(function () {
        evtInstalacao = null;
        btn.classList.add('hidden');
      });
    });
    window.addEventListener('appinstalled', function () { btn.classList.add('hidden'); });
  }

  /* ----------------------------------------------------------------- start */

  document.addEventListener('DOMContentLoaded', function () {
    ligarEventos();
    configurarPWA();
    iniciar();
  });
})();
