/* ==========================================================================
   Service worker — Painel de Rastreamento (Matheus)

   Torna o painel instalável e utilizável offline.

   IMPORTANTE: sempre que alterar arquivos do app (HTML/CSS/JS/ícones),
   incremente a VERSAO abaixo. É isso que faz o navegador buscar a versão
   nova em vez de servir a antiga do cache.
   ========================================================================== */

var VERSAO = 'v1';

// O prefixo precisa ser EXCLUSIVO deste painel. O cache do navegador é por
// domínio, não por pasta: se dois painéis publicados no mesmo usuário do
// GitHub Pages usarem o mesmo prefixo, a limpeza de um apaga o cache do outro.
var APP = 'painel-matheus';
var CACHE_SHELL = APP + '-shell-' + VERSAO;
var CACHE_DADOS = APP + '-dados-' + VERSAO;

// Arquivos do "casco" do app, guardados já na instalação.
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/estilos.css',
  './assets/js/app.js',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './dados/index.json'
];

/* ------------------------------------------------------------- instalação */
self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(CACHE_SHELL)
      .then(function (c) {
        // addAll falha inteiro se um item falhar — por isso vai um a um
        return Promise.all(SHELL.map(function (url) {
          return c.add(new Request(url, { cache: 'reload' })).catch(function (e) {
            console.warn('[sw] não foi possível pré-cachear', url, e);
          });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

/* -------------------------------------------------------------- ativação */
self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys()
      .then(function (chaves) {
        return Promise.all(chaves.map(function (k) {
          // só remove versões antigas deste mesmo painel
          if (k.indexOf(APP + '-') === 0 && k !== CACHE_SHELL && k !== CACHE_DADOS) {
            return caches.delete(k);
          }
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* ------------------------------------------------------------ estratégias */

// Guarda a resposta sem travar a entrega. O ev.waitUntil mantém o service
// worker vivo até a gravação terminar — sem isso o navegador pode encerrá-lo
// antes e o item nunca chega ao cache.
function guardar(ev, nomeCache, resp) {
  if (!resp || !resp.ok) return;
  var copia = resp.clone();
  ev.waitUntil(caches.open(nomeCache).then(function (c) {
    return c.put(ev.request, copia);
  }));
}

// Rede primeiro, cache como reserva. Usado para navegação e para os dados,
// de modo que uma atualização publicada apareça assim que houver conexão.
function redePrimeiro(ev, nomeCache, reserva) {
  return fetch(ev.request)
    .then(function (resp) {
      guardar(ev, nomeCache, resp);
      return resp;
    })
    .catch(function () {
      return caches.match(ev.request).then(function (hit) {
        if (hit) return hit;
        if (reserva) return caches.match(reserva);
        return new Response('Sem conexão e sem cópia local deste conteúdo.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    });
}

// Cache primeiro, atualizando em segundo plano. Usado para CSS/JS/ícones.
function cachePrimeiro(ev, nomeCache) {
  return caches.match(ev.request).then(function (hit) {
    var rede = fetch(ev.request).then(function (resp) {
      guardar(ev, nomeCache, resp);
      return resp;
    }).catch(function () { return hit; });
    return hit || rede;
  });
}

/* ------------------------------------------------------------ interceptar */
self.addEventListener('fetch', function (ev) {
  var req = ev.request;

  // só GET e só o próprio domínio
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  // navegação (abrir o app / recarregar a página)
  if (req.mode === 'navigate') {
    ev.respondWith(redePrimeiro(ev, CACHE_SHELL, './index.html'));
    return;
  }

  // relatórios
  if (url.pathname.indexOf('/dados/') !== -1) {
    ev.respondWith(redePrimeiro(ev, CACHE_DADOS));
    return;
  }

  // demais recursos do app
  ev.respondWith(cachePrimeiro(ev, CACHE_SHELL));
});

/* ------------------------------------------------ mensagens vindas do app

   Na primeira visita o service worker ainda não controla a página, então os
   relatórios baixados nesse momento passam ao largo do cache. O app avisa
   quais arquivos carregou e eles são guardados aqui — assim o painel abre
   offline já a partir do primeiro acesso.
   -------------------------------------------------------------------------- */
self.addEventListener('message', function (ev) {
  var dado = ev.data;

  if (dado === 'skipWaiting') { self.skipWaiting(); return; }

  if (dado && dado.tipo === 'guardar' && Array.isArray(dado.urls)) {
    ev.waitUntil(
      caches.open(CACHE_DADOS).then(function (c) {
        return Promise.all(dado.urls.map(function (u) {
          return caches.match(u).then(function (existe) {
            if (existe) return;
            return c.add(u).catch(function (e) {
              console.warn('[sw] não foi possível guardar', u, e);
            });
          });
        }));
      })
    );
  }
});
