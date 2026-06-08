#!/usr/bin/env python3
"""
RIOT — rewrite the cosmetic `headline` in the human layer so each card is
self-contained and votable from the title alone (tweet-ish, plain language,
states the concrete action). Only touches `headline` in data/raw/explained_*.json;
facts (title/raw_outcome/votes) are never modified. Re-run build_table.py after.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"

NEW = {
  # --- PLE 03/2026 ordinari ---
  "PLE_03_2026_ORD-p6":  "Substituir la directora que representa els instituts públics de secundària al Consell Educatiu de la ciutat.",
  "PLE_03_2026_ORD-p7":  "Canviar el pla urbanístic de l'antiga fàbrica Pich Aguilera perquè tot l'habitatge nou que s'hi faci sigui de protecció pública.",
  "PLE_03_2026_ORD-p8":  "Eliminar la mida mínima de 30 m² i altres requisits per obrir o dividir locals comercials, i regular l'aire condicionat a les façanes.",
  "PLE_03_2026_ORD-p10": "Que l'Ajuntament comenci a sortir de FUNECAMP, l'empresa funerària pública supramunicipal, i n'aturi els pagaments.",
  "PLE_03_2026_ORD-p11": "Que l'Ajuntament doni suport a les vagues del professorat i reclami a la Generalitat més recursos per a l'escola pública.",
  "PLE_03_2026_ORD-p12": "Crear serveis municipals de cures pel 8-M: un centre de cures, cangur gratuït i més places públiques de 0-3 anys.",
  "PLE_03_2026_ORD-p13": "Rebatejar el Pavelló Olímpic amb el nom de l'exjugador d'hoquei Joan Sabater, com a homenatge al «Reus de les sis copes».",
  "PLE_03_2026_ORD-p14": "Que qui ja va rebre descomptes d'impostos per posar plaques solars no els perdi pel nou tràmit que ara s'exigeix.",
  "PLE_03_2026_ORD-p15": "Obligar el govern a millorar els equipaments esportius: pavelló del Molinet, gespa sense microplàstics i aparells d'esport a cada barri.",
  "PLE_03_2026_ORD-p16": "Obligar l'Ajuntament, per ordenança, a tornar en sis mesos i amb interessos els impostos que cobri de més.",

  # --- PLE 12/2025 extraordinari (ordenances fiscals 2026 + pressupost) ---
  "PLE_12_2025_EXTR-p1":  "Fixar per al 2026 l'impost d'activitats econòmiques (IAE) que paguen les grans empreses.",
  "PLE_12_2025_EXTR-p2":  "Fixar per al 2026 l'impost sobre els immobles (IBI) de pisos, cases i locals.",
  "PLE_12_2025_EXTR-p3":  "Fixar per al 2026 l'impost sobre obres i construccions (ICIO).",
  "PLE_12_2025_EXTR-p4":  "Fixar per al 2026 la taxa per tramitar l'obertura i el control d'activitats i negocis.",
  "PLE_12_2025_EXTR-p5":  "Fixar per al 2026 la taxa de recollida d'escombraries que paguen els veïns.",
  "PLE_12_2025_EXTR-p6":  "Fixar per al 2026 la taxa de les llicències de taxi.",
  "PLE_12_2025_EXTR-p7":  "Fixar per al 2026 la taxa de cartografia, dades cadastrals i ús de les infraestructures de telecomunicacions.",
  "PLE_12_2025_EXTR-p8":  "Fixar per al 2026 la taxa de la grua quan s'emporta un cotxe i el deixa al dipòsit.",
  "PLE_12_2025_EXTR-p9":  "Fixar per al 2026 la taxa per demanar certificats i documents a l'Ajuntament.",
  "PLE_12_2025_EXTR-p10": "Fixar per al 2026 la taxa pels tràmits d'urbanisme (llicències i informes).",
  "PLE_12_2025_EXTR-p11": "Fixar per al 2026 la taxa per serveis especials de la Guàrdia Urbana (com vigilar actes privats).",
  "PLE_12_2025_EXTR-p12": "Fixar per al 2026 la taxa dels guals i de les reserves d'aparcament i càrrega i descàrrega.",
  "PLE_12_2025_EXTR-p13": "Fixar per al 2026 la taxa per ocupar el terra, el subsòl i l'espai aeri de la via pública.",
  "PLE_12_2025_EXTR-p14": "Fixar per al 2026 la taxa per fer servir edificis i instal·lacions municipals.",
  "PLE_12_2025_EXTR-p15": "Fixar per al 2026 la taxa del cens de gossos i gats i de la recollida d'animals abandonats.",
  "PLE_12_2025_EXTR-p16": "Fixar per al 2026 el preu de recollida de residus per a comerços i indústries.",
  "PLE_12_2025_EXTR-p17": "Fixar per al 2026 les tarifes de l'aigua potable i el clavegueram.",
  "PLE_12_2025_EXTR-p18": "Fixar per al 2026 el preu del bus urbà de Reus.",
  "PLE_12_2025_EXTR-p19": "Fixar per al 2026 el preu de la bicicleta pública compartida.",
  "PLE_12_2025_EXTR-p20": "Fixar per al 2026 la taxa dels serveis del cementiri (nínxols i enterraments).",
  "PLE_12_2025_EXTR-p21": "Aprovar el pressupost de l'Ajuntament per al 2026: quants diners gasta i ingressa, i en què.",
  "PLE_12_2025_EXTR-p22": "Modificar el pla d'ajuts i subvencions que dona l'Ajuntament fins al 2027.",
  "PLE_12_2025_EXTR-p23": "Apujar el sou del personal de l'Ajuntament: 2,5% el 2025 (endarrerit) i 1,5% el 2026, segons marca l'Estat.",
  "PLE_12_2025_EXTR-p24": "Aplicar la mateixa pujada de sou (2,5% i 1,5%) al personal de Reus Promoció.",
  "PLE_12_2025_EXTR-p25": "Aplicar la mateixa pujada de sou (2,5% i 1,5%) al personal de l'Institut de Cultura (IMRC).",
  "PLE_12_2025_EXTR-p26": "Aplicar la mateixa pujada de sou (2,5% i 1,5%) al personal de Mas Carandell.",

  # --- PLE 9/2023 ordinari ---
  "PLE_9_2023_ORD-p4":  "Nomenar les persones que representaran l'Ajuntament en diversos òrgans i organismes municipals.",
  "PLE_9_2023_ORD-p5":  "Modificar la llista de càrrecs de confiança (personal eventual) de l'Ajuntament.",
  "PLE_9_2023_ORD-p6":  "Concedir una menció d'honor al Ball de Cavallets de Reus per la seva tradició.",
  "PLE_9_2023_ORD-p7":  "Donar el vistiplau inicial per estudiar la urbanització del sector Bellisens, vora la N-340.",
  "PLE_9_2023_ORD-p8":  "Aprovar inicialment canvis al pla urbanístic en àrees del Barri del Carme (PAU 12-15).",
  "PLE_9_2023_ORD-p9":  "Aprovar el pla que fixa què farà Reus en períodes de sequera.",
  "PLE_9_2023_ORD-p10": "Donar continuïtat al Pla Educatiu d'Entorn, que coordina suport i activitats educatives fora de l'escola.",
  "PLE_9_2023_ORD-p11": "Demanar un préstec a llarg termini per finançar inversions del pressupost del 2023.",
  "PLE_9_2023_ORD-p12": "Reclassificar la plantilla de personal funcionari: revisar categories i nivells dels treballadors públics.",
  "PLE_9_2023_ORD-p13": "Modificar el contracte de l'empresa que explota l'aparcament públic del Centre del Pallol.",
  "PLE_9_2023_ORD-p14": "Impulsar un pacte local per la llengua per defensar i promoure el català a Reus.",
  "PLE_9_2023_ORD-p15": "Reclamar al govern que compleixi les promeses de campanya i del mandat 2019-2023.",
  "PLE_9_2023_ORD-p16": "Demanar que l'Ajuntament aturi el projecte de l'aparcament de la Hispània.",
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
