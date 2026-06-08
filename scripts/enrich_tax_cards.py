#!/usr/bin/env python3
"""
RIOT — enrich the 20 fiscal-ordinance cards (PLE_12_2025_EXTR p1..p20) with the
REAL 2026 direction/figure, extracted from the definitive acta (PLE_12_2025_EXTR.txt)
and grounded in verbatim quotes. Updates only the cosmetic `headline`/`body` in the
human layer; facts (title/raw_outcome/votes) are never touched. Re-run build_table.py after.

Direction summary (see commit body / acta lines for the quote behind each):
  frozen rate, only bonificacions:   p1 IAE, p2 IBI, p3 ICIO
  +2,5% (IPC 2025):                  p4, p7, p9, p10, p12, p14, p20
  specific figure:                   p5 +3,72%, p17 0-5%, p18 airport→4€, p13 min 6→7€
  +2,5% but with a carve-out:        p15 (adopted-pet registration now free)
  up, no % stated in acta:           p6, p8, p11, p16
  mixed/ambiguous:                   p19 bici
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
P = "PLE_12_2025_EXTR-"

CARDS = {
  P+"p1": (
    "No apujar l'IAE, l'impost que paguen les empreses grans pel fet de tenir activitat, i només afegir-hi alguns descomptes.",
    "L'impost d'activitats econòmiques (IAE) el paguen les empreses grans. No se'n canvia el tipus; només s'afegeix una bonificació obligatòria per a empreses noves i s'ajusta una bonificació ja existent. Votar a favor és aprovar aquests canvis; votar en contra és rebutjar-los."),
  P+"p2": (
    "No apujar l'IBI, l'impost anual que paguen els propietaris de pisos, cases i locals, i només canviar alguns descomptes (habitatge protegit, plaques solars i una zona concreta).",
    "L'IBI el paguen els propietaris de pisos, cases i locals. No se'n canvia el tipus ni el recàrrec dels pisos buits; s'ajusten bonificacions (habitatge de protecció, un límit per a les plaques solars i una nova bonificació del 95% en una zona concreta). Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p3": (
    "No apujar l'impost que es paga quan es fan obres (es manté en el 4%), i només ajustar com es calcula i alguns descomptes.",
    "L'impost d'obres i construccions (ICIO) es paga quan es fan obres. No se'n canvia el tipus (4%); es confirma el mòdul de càlcul (646 €/m²), es corregeix una bonificació (del 50% al 75%) i es reordenen els descomptes. Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p4": (
    "Apujar un 2,5% (la inflació) el que paguen els negocis perquè l'Ajuntament els tramiti el permís d'obertura i en faci el control.",
    "L'Ajuntament apuja un 2,5% (en línia amb l'IPC previst del 2025) el que cobra per revisar i tramitar l'obertura o el control d'activitats i negocis. Votar a favor és aprovar la pujada; votar en contra és rebutjar-la."),
  P+"p5": (
    "Apujar un 3,72% la taxa de la brossa que paguen els veïns, per cobrir el que costa de veritat recollir-la.",
    "La taxa que paguen els veïns per la brossa puja, de mitjana, un 3,72%, per cobrir el cost real del servei (com obliga la llei). Votar a favor és aprovar la pujada; votar en contra és rebutjar-la."),
  P+"p6": (
    "Canviar les tarifes que es paguen per les llicències de taxi (l'acta no diu si pugen o baixen ni quant).",
    "Es modifiquen les tarifes de les llicències de taxi per ajustar-les a les necessitats de finançament del servei; l'acta d'aquest punt no en concreta el percentatge. Votar a favor és aprovar el canvi; votar en contra és rebutjar-lo."),
  P+"p7": (
    "Apujar un 2,5% (la inflació) el que es paga pels mapes i dades de propietats i per fer servir les infraestructures de telecomunicacions de l'Ajuntament.",
    "Puja un 2,5% (IPC previst del 2025) el que es paga pels serveis de mapes i dades cadastrals i per fer servir les infraestructures de telecomunicacions municipals. Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p8": (
    "Apujar les tarifes de la grua quan s'emporta el teu cotxe i el deixa al dipòsit, i deixar 3 dies sense cobrar dipòsit si estàs ingressat a l'hospital.",
    "Es pugen les tarifes de la grua (retirada i dipòsit de vehicles) per finançar el servei i s'afegeix un marge de 3 dies sense cobrament en cas d'hospitalització. L'acta d'aquest punt no en concreta el percentatge. Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p9": (
    "Apujar un 2,5% (la inflació) el que costa demanar certificats i papers oficials a l'Ajuntament.",
    "Puja un 2,5% (IPC previst del 2025) el que es paga per obtenir certificats i altres documents administratius. Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p10": (
    "Apujar un 2,5% (la inflació) el que es paga pels tràmits d'urbanisme, com demanar llicències d'obra o informes.",
    "Puja un 2,5% (IPC previst del 2025) el que es paga pels tràmits urbanístics, com llicències i informes. Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p11": (
    "Apujar el que es cobra per serveis especials de la Guàrdia Urbana, com vigilar actes privats (l'acta no en diu el percentatge).",
    "Es pugen els imports que es cobren per serveis concrets de la Guàrdia Urbana (com vigilar actes privats), per ajustar-los al cost; l'acta d'aquest punt no en concreta el percentatge. Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p12": (
    "Apujar un 2,5% (la inflació) el que es paga pels guals i per reservar un tros de carrer per aparcar o per carregar i descarregar.",
    "Puja un 2,5% (IPC previst del 2025) el que es paga pels guals i per reservar espai a la via pública per carregar i descarregar. Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p13": (
    "Apujar el que es paga per ocupar la via pública (el terra, el subsòl o l'aire), i pujar la quota mínima de 6 a 7 euros.",
    "Es pugen les tarifes per fer servir el terra, el subsòl o l'espai aeri de la via pública i la quota mínima passa de 6 a 7 €. Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p14": (
    "Apujar un 2,5% (la inflació) el que es paga per fer servir edificis i instal·lacions de l'Ajuntament, com centres cívics o l'estació d'autobusos.",
    "Puja un 2,5% (IPC previst del 2025) el que es paga per utilitzar edificis, espais o instal·lacions de l'Ajuntament (estació d'autobusos, centres cívics, sala de plens...). Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p15": (
    "Apujar un 2,5% les taxes del cens i la recollida d'animals, però fer gratuït registrar un animal si l'has adoptat d'una protectora.",
    "Pugen un 2,5% (IPC) els imports del cens i la recollida d'animals, però el registre passa a ser gratuït si l'animal prové d'una adopció i s'elimina el cobrament per duplicar la xapa. Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p16": (
    "Apujar el preu que paguen botigues i fàbriques perquè els recullin la brossa, i ampliar els trams segons la mida del local (l'acta no en diu el percentatge).",
    "Es pugen els imports que paguen comerços i indústries per la recollida dels seus residus i s'amplien els trams segons la superfície; l'acta d'aquest punt no en concreta el percentatge. Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p17": (
    "Apujar entre el 0% i el 5% el preu de l'aigua, sobretot per a qui en gasta molta; qui en gasta poc i la tarifa social no canvien.",
    "Es pugen alguns preus de l'aigua entre el 0% i el 5%, aplicats sobretot als consums més elevats. El tram variable fins a 9 m³/mes, la tarifa social i els usos municipals no canvien. Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p18": (
    "Mantenir el bitllet del bus urbà a 1,50 €, i només apujar a 4 € el bitllet que va a l'aeroport.",
    "El bitllet senzill del bus urbà es manté a 1,50 €; només es modifica el bitllet a l'aeroport, que es fixa en 4 €, i s'afegeix una reducció temporal del 50% en algunes targetes per ajudes estatals. Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p19": (
    "Canviar les tarifes de la bici pública compartida (per exemple, 90 € l'any o 9 € al mes).",
    "Es modifiquen les tarifes del servei de bicicletes públiques compartides (per exemple, abonament anual 90 €, mensual 9 €/mes, tiquet diari 1 €), ajustant-les a les necessitats dels usuaris i als objectius de promoure el servei. Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
  P+"p20": (
    "Apujar un 2,5% (la inflació) el que es paga pels serveis del cementiri, com els nínxols i els enterraments.",
    "Puja un 2,5% (IPC previst del 2025) el que es paga pels serveis del cementiri, com nínxols i enterraments. Votar a favor és aprovar-ho; votar en contra és rebutjar-ho."),
}

def main():
    ef = RAW / "explained_PLE_12_2025_EXTR.json"
    arr = json.loads(ef.read_text())
    changed = 0
    for e in arr:
        if e["id"] in CARDS:
            head, body = CARDS[e["id"]]
            if e.get("headline") != head or e.get("body") != body:
                e["headline"], e["body"] = head, body
                changed += 1
    ef.write_text(json.dumps(arr, ensure_ascii=False, indent=2))
    missing = set(CARDS) - {e["id"] for e in arr}
    print(f"enriched {changed} tax cards; unmatched: {sorted(missing) or 'none'}")

if __name__ == "__main__":
    main()
