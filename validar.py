#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Valida os arquivos de dados do Painel de Rastreamento GTF.

Uso:
    python3 validar.py

Confere:
  - index.json é JSON válido e tem a lista de relatórios
  - todo relatório listado existe de fato e é JSON válido
  - existe exatamente um relatório marcado como padrão
  - os campos obrigatórios estão presentes em cada relatório
  - os prefixos de 'overnight_prev_night' são reconhecidos pelo app
  - os valores de 'pm_episodes[].kind' são reconhecidos pelo app

Sai com código 0 se tudo estiver certo, 1 se houver erro.
"""

import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
DADOS = RAIZ

CAMPOS_META = ["id", "titulo", "periodo_inicio", "periodo_fim"]
CAMPOS_SUMMARY = [
    "total_days", "business_days", "days_no_movement",
    "avg_departure", "avg_return", "avg_stops_per_day", "avg_km_per_day",
    "total_km", "nights_home", "nights_alt", "nights_other",
    "nights_maintenance", "total_speed_events", "days_with_flags",
    "idle_avg_min", "idle_over_15min", "pm_distinct_days",
]
CAMPOS_DIA = [
    "date", "weekday", "is_weekend", "overnight_prev_night",
    "num_stops", "total_km", "flags", "in_maintenance", "trips",
]
PREFIXOS_PERNOITE = ("Casa", "Endereço", "Manutenção", "Outro")
TIPOS_EPISODIO = {
    "Passagem rápida",
    "Pernoite",
    "Pernoite de fim de semana / múltiplos dias",
}

erros = []
avisos = []


def erro(msg):
    erros.append(msg)


def aviso(msg):
    avisos.append(msg)


def carregar(caminho):
    try:
        with open(caminho, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        erro(f"arquivo não encontrado: {caminho.name}")
    except json.JSONDecodeError as e:
        erro(f"JSON inválido em {caminho.name}: linha {e.lineno}, {e.msg}")
    return None


def validar_relatorio(caminho, entrada):
    rel = carregar(caminho)
    if rel is None:
        return

    nome = caminho.name

    meta = rel.get("meta")
    if not isinstance(meta, dict):
        erro(f"{nome}: bloco 'meta' ausente")
    else:
        for c in CAMPOS_META:
            if c not in meta:
                erro(f"{nome}: meta.{c} ausente")
        if meta.get("id") and meta["id"] != entrada.get("id"):
            aviso(f"{nome}: meta.id ('{meta['id']}') difere do id no index.json "
                  f"('{entrada.get('id')}')")

    summary = rel.get("summary")
    if not isinstance(summary, dict):
        erro(f"{nome}: bloco 'summary' ausente")
    else:
        for c in CAMPOS_SUMMARY:
            if c not in summary:
                erro(f"{nome}: summary.{c} ausente")

    days = rel.get("days")
    if not isinstance(days, list) or not days:
        erro(f"{nome}: 'days' ausente ou vazio")
    else:
        for i, d in enumerate(days):
            rotulo = d.get("date", f"índice {i}")
            for c in CAMPOS_DIA:
                if c not in d:
                    erro(f"{nome}: dia {rotulo} — campo '{c}' ausente")
            ov = d.get("overnight_prev_night", "")
            if ov and not str(ov).startswith(PREFIXOS_PERNOITE):
                aviso(f"{nome}: dia {rotulo} — 'overnight_prev_night' começa com "
                      f"texto não reconhecido ('{ov[:40]}'); a etiqueta ficará cinza")
            for t in d.get("trips", []) or []:
                if "is_real" not in t:
                    aviso(f"{nome}: dia {rotulo} — trajeto sem 'is_real'")

        if summary and isinstance(summary, dict):
            if summary.get("total_days") not in (None, len(days)):
                aviso(f"{nome}: summary.total_days = {summary['total_days']} "
                      f"mas há {len(days)} dias na lista")
            soma_km = round(sum(d.get("total_km", 0) or 0 for d in days), 1)
            total_km = summary.get("total_km")
            if total_km is not None and abs(soma_km - total_km) > 1:
                aviso(f"{nome}: summary.total_km = {total_km} mas a soma dos dias "
                      f"dá {soma_km}")

    for i, e in enumerate(rel.get("pm_episodes", []) or []):
        k = e.get("kind")
        if k not in TIPOS_EPISODIO:
            aviso(f"{nome}: pm_episodes[{i}].kind = '{k}' não é um dos tipos "
                  f"reconhecidos; o episódio não entrará nas contagens")

    for bloco in ("idle_events", "geo_table", "pm_episodes"):
        if bloco not in rel:
            aviso(f"{nome}: bloco '{bloco}' ausente (a seção ficará vazia)")

    print(f"  ✓ {nome}  —  {len(rel.get('days', []))} dias, "
          f"{len(rel.get('idle_events', []))} ocorrências de motor ocioso, "
          f"{len(rel.get('pm_episodes', []))} episódios")


def main():
    print(f"Validando os dados em {DADOS}\n")

    indice = carregar(DADOS / "index.json")
    if indice is None:
        finalizar()
        return

    relatorios = indice.get("relatorios")
    if not isinstance(relatorios, list) or not relatorios:
        erro("index.json: 'relatorios' ausente ou vazio")
        finalizar()
        return

    ids = [r.get("id") for r in relatorios]
    if len(ids) != len(set(ids)):
        erro("index.json: há ids repetidos na lista de relatórios")

    padroes = [r for r in relatorios if r.get("padrao")]
    if len(padroes) == 0:
        aviso("index.json: nenhum relatório com \"padrao\": true — "
              "o app abrirá o primeiro da lista")
    elif len(padroes) > 1:
        erro(f"index.json: {len(padroes)} relatórios com \"padrao\": true — "
             "deixe apenas um")

    for r in relatorios:
        for c in ("id", "rotulo", "arquivo"):
            if not r.get(c):
                erro(f"index.json: relatório '{r.get('id', '?')}' sem o campo '{c}'")
        arq = r.get("arquivo")
        if arq:
            validar_relatorio(DADOS / arq, r)

    orfaos = {p.name for p in DADOS.glob("*.json")} - {"index.json"} - set(
        r.get("arquivo") for r in relatorios
    )
    for o in sorted(orfaos):
        aviso(f"{o} está em dados/ mas não aparece no index.json — não será exibido")

    finalizar()


def finalizar():
    print()
    for a in avisos:
        print(f"  ! aviso: {a}")
    for e in erros:
        print(f"  ✗ ERRO: {e}")
    print()
    if erros:
        print(f"Falhou: {len(erros)} erro(s), {len(avisos)} aviso(s).")
        sys.exit(1)
    print(f"Tudo certo. {len(avisos)} aviso(s).")
    sys.exit(0)


if __name__ == "__main__":
    main()
