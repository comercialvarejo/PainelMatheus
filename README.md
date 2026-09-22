# Painel de Rastreamento — Matheus

Aplicativo web (PWA) para acompanhamento dos relatórios de rastreamento do veículo
**TBM3G64**, conduzido por **Matheus Augusto Linjardi Pereira**.

Roda em qualquer navegador, funciona no celular e no computador, pode ser **instalado
como aplicativo** na tela inicial e continua funcionando **offline** depois do primeiro
acesso. Sem framework, sem build, sem Node — HTML, CSS e JavaScript puros, prontos para
o GitHub Pages.

> Este repositório é irmão do painel do Tiago Radin: mesma base de código, dados e
> identidade próprios. Os dois podem ser publicados na mesma conta do GitHub e
> instalados lado a lado no mesmo celular.

---

## Índice

- [Como publicar no GitHub Pages](#como-publicar-no-github-pages)
- [Como instalar como aplicativo](#como-instalar-como-aplicativo)
- [Atualizar com um novo relatório](#atualizar-com-um-novo-relatório)
- [O que o painel mostra](#o-que-o-painel-mostra)
- [Estrutura dos arquivos](#estrutura-dos-arquivos)
- [Rodar localmente](#rodar-localmente)
- [⚠️ Aviso sobre dados pessoais](#-aviso-sobre-dados-pessoais)

---

## Como publicar no GitHub Pages

### 1. Criar o repositório

No GitHub, **New repository**, nome sugerido `painel-matheus`, criado **sem** README,
`.gitignore` ou licença — já existem aqui.

> Precisa ser um repositório **separado** do painel do Tiago. Dois sites do GitHub Pages
> não podem sair do mesmo repositório na mesma pasta raiz.

### 2. Enviar os arquivos

**Pelo site:** abra o repositório → **uploading an existing file** → arraste **o conteúdo
desta pasta** (os arquivos e as subpastas `assets/`, `dados/` e `ferramentas/`, não a
pasta em si) → **Commit changes**.

> ⚠️ O arquivo `.nojekyll` é essencial e fica invisível no Finder/Explorer por começar
> com ponto. Se não subir, crie direto no GitHub: **Add file → Create new file**, nome
> `.nojekyll`, conteúdo vazio, salvar.

**Pelo Git:**

```bash
cd painel-matheus
git init
git add .
git commit -m "Painel de rastreamento — Matheus"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/painel-matheus.git
git push -u origin main
```

### 3. Ligar o GitHub Pages

**Settings → Pages** → Source: **Deploy from a branch** → Branch `main`, pasta `/ (root)`
→ **Save**. Em 1 a 3 minutos o endereço aparece:

```
https://SEU-USUARIO.github.io/painel-matheus/
```

---

## Como instalar como aplicativo

| Aparelho | Passo a passo |
|---|---|
| **Android (Chrome)** | Abra o link → botão **Instalar app** no topo, ou menu ⋮ → **Adicionar à tela inicial**. |
| **iPhone / iPad (Safari)** | Abra o link → ícone de **Compartilhar** → **Adicionar à Tela de Início**. |
| **Windows / Mac (Chrome ou Edge)** | Ícone de instalação na barra de endereço, ou menu → **Instalar Painel Matheus**. |

O ícone é **verde-azulado**, para não confundir com o do painel do Tiago (azul-roxo) na
tela inicial.

---

## Atualizar com um novo relatório

O caminho mais curto: exportar o **Relatório de Posições** do rastreador em `.xlsx` e
rodar o conversor. Ele lê a planilha bruta, aplica todas as regras de análise e grava o
JSON já no formato do painel.

```bash
python3 ferramentas/converter.py ~/Downloads/Listagem_Relatorio_de_Posicoes.xlsx \
    --cidade-casa "Arapongas/PR" \
    --feriado 2026-10-12="Nossa Senhora Aparecida"
```

O script imprime um resumo do que encontrou e o trecho JSON pronto para colar em
`dados/index.json`. Depois:

```bash
python3 ferramentas/validar.py     # confere se está tudo íntegro
```

E faça o commit dos dois arquivos (o novo JSON e o `index.json` atualizado).

### Opções do conversor

| Opção | Para que serve |
|---|---|
| `--casa "Rua X"` | Define o endereço de referência. Sem isso, usa o local de pernoite mais frequente. |
| `--cidade-casa "Arapongas/PR"` | Cidade do endereço de referência. |
| `--vizinhanca "Rua Y" "Rua Z"` | Ruas que o rastreador confunde com a casa. Normalmente detectado sozinho. |
| `--feriado 2026-12-25=Natal` | Feriado a desconsiderar. Pode repetir. |
| `--manutencao 2026-10-05:2026-10-08` | Período em que o veículo estava na oficina. Pode repetir. |
| `--motorista` / `--placa` | Sobrescrevem o que vem na planilha. |

### Regras de análise aplicadas

- **Parada** = um ciclo de ignição ligada → desligada.
- Ciclo com menos de **1 km** = motor ligado parado, marcado como "sem deslocamento relevante".
- Alerta de micro-paradas a partir de **3** no dia; de velocidade a partir de **5** excessos.
- **Saída tardia** a partir das 09:30; **retorno tardio** a partir das 20:00.
- **Pernoite** = posição registrada mais próxima das 03:00.
- Endereço que aparece como pernoite mas com o **hodômetro imóvel** é tratado como
  vizinhança da casa — é ruído de geocodificação, não um local diferente.
- **Feriado**, **dia parcial** e **manutenção** aparecem no detalhamento como contexto,
  mas não contam como desvio nem entram em "Pontos de atenção".

Para mudar os limiares, edite as constantes no topo de `ferramentas/converter.py`.

### Se editar o código do app

Ao alterar `index.html`, o CSS, o JS ou os ícones, **incremente a versão** em `sw.js`:

```js
var VERSAO = 'v2';   // era 'v1'
```

Sem isso, quem já abriu o painel continua vendo a versão antiga em cache.
Trocar apenas arquivos de `dados/` **não** exige mudar a versão.

> O `sw.js` também define `var APP = 'painel-matheus'`. Esse prefixo **precisa ser
> diferente** do usado no painel do Tiago: o cache do navegador é por domínio, não por
> pasta, e dois painéis no mesmo `github.io` com o mesmo prefixo apagariam o cache um
> do outro.

---

## O que o painel mostra

Seções que não têm dados no período **somem sozinhas**, junto com o item correspondente
no menu do topo. No relatório de setembro/2026, por exemplo, não aparecem as seções de
endereço alternativo nem de distâncias — o veículo pernoitou no endereço de referência
em todas as noites.

| Seção | Aparece quando |
|---|---|
| Resumo (KPIs) | sempre |
| Pontos de atenção | sempre |
| Onde o veículo pernoita | sempre; as barras mostram só as categorias com noites |
| Rotina — médias em dias úteis | sempre |
| Endereço alternativo | há um 2º local de pernoite com 3 noites ou mais |
| Distâncias dos endereços incomuns | `geo_table` preenchido (exige geolocalização manual) |
| Motor ligado sem deslocamento | há ciclos com menos de 1 km |
| Detalhamento por dia | sempre |

As médias de saída, retorno, paradas e km consideram apenas **dias úteis cheios** —
fins de semana, feriados, dias de manutenção e o dia parcial no fim do período ficam
de fora, para não distorcer o resultado.

---

## Estrutura dos arquivos

```
painel-matheus/
├── index.html                  estrutura da página (não contém dados)
├── manifest.webmanifest        nome, ícones e cores do app
├── sw.js                       service worker — offline e cache
├── .nojekyll                   impede o GitHub de processar a pasta como blog
├── .gitignore
├── README.md
├── assets/
│   ├── css/estilos.css         todo o visual, responsivo (mobile-first)
│   ├── js/app.js               carrega os dados e monta a interface
│   └── icons/                  ícones do app
├── dados/
│   ├── index.json              lista de relatórios disponíveis
│   └── 2026-09-01_2026-09-22.json
└── ferramentas/
    ├── converter.py            .xlsx do rastreador  ->  JSON do painel
    └── validar.py              confere os JSONs antes de publicar
```

O formato completo do JSON está documentado no README do painel do Tiago; os dois
repositórios usam exatamente o mesmo esquema.

---

## Rodar localmente

O painel carrega os dados via `fetch`, então **abrir o `index.html` com dois cliques não
funciona** — o navegador bloqueia no protocolo `file://`. Suba um servidor local:

```bash
cd painel-matheus
python3 -m http.server 8000
```

E acesse `http://localhost:8000`.

---

## ⚠️ Aviso sobre dados pessoais

Este repositório contém **dados pessoais identificáveis**: nome completo do motorista,
placa do veículo, endereço residencial e a rotina diária de deslocamentos.

**Num repositório público, tudo isso fica acessível a qualquer pessoa na internet** e é
indexável por buscadores. No Brasil, o tratamento é regido pela LGPD (Lei 13.709/2018),
que exige base legal e medidas de segurança adequadas — expor publicamente o
monitoramento de um funcionário dificilmente se sustenta.

Alternativas que mantêm o mesmo app funcionando:

| Opção | Como fica |
|---|---|
| **Repositório privado + Netlify ou Cloudflare Pages** | Grátis, conecta ao repo privado, publica um site só para quem tem o link. Aceita proteção por senha. |
| **Repositório privado + GitHub Pages** | Exige plano Pro/Team, mantém tudo no GitHub. |
| **Público sem os dados** | Descomente o bloco de privacidade no `.gitignore`. O código fica versionado, os relatórios ficam só na sua máquina. |
| **Uso local** | Rodar com `python3 -m http.server`, sem publicar. |

Se optar por manter público, ao menos considere reduzir o nome do motorista ao primeiro
nome e remover o endereço residencial dos arquivos em `dados/`.

---

### Nota sobre o endereço de referência

O endereço de referência (casa) **não veio informado** — foi inferido dos dados:
`Rua Tinguaçú Castanho, Arapongas/PR`, onde o veículo pernoitou em 22 das 22 noites do
período. Confirme antes de usar o relatório para qualquer decisão, porque é esse
endereço que define o que conta como pernoite normal e o que vira alerta.

---

## Compatibilidade

Chrome, Edge, Firefox e Safari atuais, no desktop e no celular. A instalação como
aplicativo e o modo offline dependem de **HTTPS** — o GitHub Pages já fornece.
