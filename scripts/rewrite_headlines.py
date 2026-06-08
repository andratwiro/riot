#!/usr/bin/env python3
"""
RIOT — rewrite the cosmetic `headline` so each card is self-contained and votable
from the title alone by a 16-year-old: plain everyday language, no jargon, explain
acronyms, give enough context to take a side. Tweet-length is fine (more words OK).
Only touches `headline` in data/raw/explained_*.json; facts are never modified.
The 20 fiscal-ordinance cards (PLE_12_2025_EXTR p1..p20) are handled separately in
enrich_tax_cards.py (headline + body with real figures). Re-run build_table.py after.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"

NEW = {
  # --- PLE 03/2026 ordinari ---
  "PLE_03_2026_ORD-p6":  "Canviar la persona que parla en nom dels instituts públics dins el consell on la ciutat decideix temes d'educació, perquè els mateixos centres ho han demanat.",
  "PLE_03_2026_ORD-p7":  "Canviar les normes urbanístiques de l'antiga fàbrica Pich Aguilera perquè tots els pisos nous que s'hi facin siguin de protecció oficial (més barats), conservant part de l'edifici antic.",
  "PLE_03_2026_ORD-p8":  "Treure la mida mínima de 30 m² i altres requisits perquè sigui més fàcil obrir o dividir botigues i locals, i posar regles de com instal·lar l'aire condicionat a les façanes.",
  "PLE_03_2026_ORD-p10": "Començar a treure l'Ajuntament de FUNECAMP, l'empresa pública de serveis funeraris compartida amb altres pobles, i deixar de pagar-hi, després que un jutge anul·lés l'informe que la justificava.",
  "PLE_03_2026_ORD-p11": "Que l'Ajuntament doni suport a les vagues i protestes del professorat i reclami a la Generalitat més diners per a l'escola pública: menys alumnes per classe i menys paperassa.",
  "PLE_03_2026_ORD-p12": "Pel Dia de les Dones Treballadores, crear serveis municipals de cures: un centre de cures, servei de cangur gratuït, més places públiques de 0 a 3 anys i millors condicions per a qui cuida.",
  "PLE_03_2026_ORD-p13": "Posar el nom de l'exjugador d'hoquei Joan Sabater al Pavelló Olímpic com a homenatge a ell i a l'equip històric del «Reus de les sis copes», i estudiar dedicar-li també un carrer o plaça.",
  "PLE_03_2026_ORD-p14": "Que les famílies que ja van rebre un descompte d'impostos per posar plaques solars no el perdin ara perquè s'exigeix un tràmit nou, i que cap retallada d'aquests ajuts s'apliqui cap enrere.",
  "PLE_03_2026_ORD-p15": "Obligar el govern a millorar les instal·lacions esportives: tirar endavant el pavelló del Molinet, posar gespa de qualitat i sense microplàstics als camps de futbol i aparells per fer esport a l'aire lliure a cada barri.",
  "PLE_03_2026_ORD-p16": "Canviar la normativa perquè, quan l'Ajuntament et cobri un impost de més o duplicat, te l'hagi de tornar en un màxim de 6 mesos, amb interessos i sovint sense que l'hagis de reclamar.",

  # --- PLE 9/2023 ordinari ---
  "PLE_9_2023_ORD-p4":  "Aprovar quines persones representaran l'Ajuntament en diferents organismes i comissions (consells, empreses públiques, etc.) durant aquest mandat.",
  "PLE_9_2023_ORD-p5":  "Canviar la llista de càrrecs de confiança, persones que l'equip de govern contracta directament (sense oposició) per treballar per a l'Ajuntament.",
  "PLE_9_2023_ORD-p6":  "Donar una distinció d'honor de la ciutat al Ball de Cavallets de Reus per reconèixer aquesta tradició popular.",
  "PLE_9_2023_ORD-p7":  "Donar un primer vistiplau per començar a estudiar si s'urbanitza el sector de Bellisens, una zona vora la carretera N-340.",
  "PLE_9_2023_ORD-p8":  "Aprovar, de manera inicial, canvis al pla urbanístic en unes zones concretes del Barri del Carme per ordenar com s'hi pot construir.",
  "PLE_9_2023_ORD-p9":  "Aprovar el pla que estableix què farà la ciutat (restriccions i mesures d'estalvi) quan hi hagi poca aigua per culpa de la sequera.",
  "PLE_9_2023_ORD-p10": "Continuar amb el Pla Educatiu d'Entorn, que organitza activitats i suport educatiu per a infants i joves fora de l'horari de l'escola.",
  "PLE_9_2023_ORD-p11": "Demanar un préstec bancari a llarg termini per pagar inversions (obres i millores) previstes al pressupost del 2023.",
  "PLE_9_2023_ORD-p12": "Revisar la classificació del personal funcionari de l'Ajuntament, canviant categories i nivells dels treballadors públics.",
  "PLE_9_2023_ORD-p13": "Canviar les condicions del contracte de l'empresa que gestiona l'aparcament públic del Centre del Pallol.",
  "PLE_9_2023_ORD-p14": "Que l'Ajuntament impulsi un pacte local per la llengua per protegir i promoure l'ús del català a la ciutat.",
  "PLE_9_2023_ORD-p15": "Reclamar al govern municipal que compleixi les promeses que va fer a la campanya i durant el mandat 2019-2023.",
  "PLE_9_2023_ORD-p16": "Demanar que l'Ajuntament aturi el projecte de construir un aparcament a la zona de la Hispània.",
}

def main():
    changed = 0
    for ef in RAW.glob("explained_*.json"):
        arr = json.loads(ef.read_text())
        for e in arr:
            if e["id"] in NEW and e.get("headline") != NEW[e["id"]]:
                e["headline"] = NEW[e["id"]]
                changed += 1
        ef.write_text(json.dumps(arr, ensure_ascii=False, indent=2))
    missing = set(NEW) - {e["id"] for ef in RAW.glob("explained_*.json")
                          for e in json.loads(ef.read_text())}
    print(f"updated {changed} headlines; unmatched ids: {sorted(missing) or 'none'}")

if __name__ == "__main__":
    main()
