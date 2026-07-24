#!/usr/bin/env python3
"""Three-layer Turkish-content detector for public-facing files.

Layer 1: Turkish characters [çğıöşüÇĞİÖŞÜ].
Layer 2: Common Turkish words written with ASCII/English letters.
Layer 3: Fonetik normalize (ç->c, ğ->g, ı->i, ö->o, ş->s, ü->u).

Exits 0 if clean, 1 if any Turkish content is found.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Characters that should not appear in public-facing English content.
TURKISH_CHARS = re.compile(r"[çğıöşüÇĞİÖŞÜ]")

# Map for normalizing Turkish characters to ASCII.
NORMALIZE_MAP = str.maketrans(
    "çğıöşüÇĞİÖŞÜ",
    "cgiosuCGIOSU",
)

# Common Turkish words (4+ chars) that may appear in ASCII form.
TURKISH_WORDS = {
    "kayit",
    "kayitlar",
    "kayitlari",
    "kayded",
    "kaydedildi",
    "kaydedilmemis",
    "sirket",
    "sirketler",
    "detay",
    "detayli",
    "detaylı",
    "ozet",
    "özet",
    "basvuru",
    "basvurusu",
    "basvuruldu",
    "uygun",
    "uygunluk",
    "uygunsuz",
    "sartli",
    "sartlı",
    "sart",
    "şart",
    "eslesme",
    "eşleşme",
    "siralama",
    "sıralama",
    "sirala",
    "tarih",
    "tarihsel",
    "filtre",
    "filtreleme",
    "yuksek",
    "yüksek",
    "dusuk",
    "düşük",
    "goster",
    "göster",
    "gosterilen",
    "gösterilen",
    "secili",
    "seçili",
    "secim",
    "seçim",
    "temizle",
    "temizlendi",
    "temizleniyor",
    "tumu",
    "tümü",
    "artan",
    "azalan",
    "yeni",
    "eski",
    "yukari",
    "yukarı",
    "asagi",
    "aşağı",
    "gonder",
    "gonderildi",
    "gönder",
    "gönderildi",
    "kapat",
    "kapatildi",
    "tamam",
    "hayir",
    "hayır",
    "iptal",
    "kullanici",
    "kullanıcı",
    "parola",
    "sifre",
    "şifre",
    "eposta",
    "e-posta",
    "telefon",
    "adres",
    "ulke",
    "ülke",
    "sehir",
    "şehir",
    "dogum",
    "doğum",
    "yas",
    "yaş",
    "cinsiyet",
    "medeni",
    "egitim",
    "eğitim",
    "universite",
    "üniversite",
    "fakulte",
    "fakülte",
    "bolum",
    "bölüm",
    "deneyim",
    "tecrube",
    "tecrübe",
    "yetenek",
    "beceri",
    "seviye",
    "konusulan",
    "konuşulan",
    "yazilan",
    "yazılan",
    "okunan",
    "sertifika",
    "referans",
    "proje",
    "projeler",
    "amac",
    "amaç",
    "hedef",
    "aciklama",
    "açıklama",
    "notlar",
    "dosyalar",
    "resimler",
    "ozgecmis",
    "özgeçmiş",
    "nufus",
    "nüfus",
    "cuzdan",
    "cüzdan",
    "kimlik",
    "pasaport",
    "ehliyet",
    "askerlik",
    "saglik",
    "sağlık",
    "sigortasi",
    "sigortası",
    "emeklilik",
    "maas",
    "maaş",
    "ucret",
    "ücret",
    "brut",
    "brüt",
    "gelir",
    "vergi",
    "stopaj",
    "kesinti",
    "avans",
    "prim",
    "ikramiye",
    "tediye",
    "teminat",
    "kira",
    "gider",
    "fatura",
    "irsaliye",
    "muhasebeci",
    "sermaye",
    "ortak",
    "yonetim",
    "yönetim",
    "kurulu",
    "kurulu",
    "tasfiye",
    "birlesme",
    "birleşme",
    "devir",
    "bolunme",
    "bölünme",
    "hisse",
    "pay",
    "tahvil",
    "bono",
    "cek",
    "çek",
    "senet",
    "ipotek",
    "rehin",
    "mektup",
    "kefalet",
    "abartisiz",
    "abartısız",
    "bagkur",
    "bağkur",
    "resmi",
    "resmî",
    "gazete",
    "kalan",
    "yakalanan",
    "yakalandi",
    "yakalandı",
    "sinyal",
    "sinyaller",
    "ozete",
    "özet",
}

# Words that are intentionally allowed even if they look Turkish.
ALLOWED = {
    "alomaliye",
    "job-search-workflow",
    "polyform",
    "noncommercial",
}

# File extensions to scan.
TEXT_EXTENSIONS = {
    ".md",
    ".py",
    ".js",
    ".ts",
    ".html",
    ".css",
    ".yml",
    ".yaml",
    ".json",
    ".toml",
    ".txt",
    ".sh",
}

# Paths/files to skip.
SKIP_PATHS = {
    ".git",
    "node_modules",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "verify_no_turkish.py",
}


def is_text_file(path: Path) -> bool:
    if path.suffix.lower() not in TEXT_EXTENSIONS:
        return False
    for part in path.parts:
        if part in SKIP_PATHS:
            return False
    return True


def tokenize(text: str) -> list[str]:
    # Split on non-word characters, keep letters/numbers/hyphens/underscores.
    return re.findall(r"[A-Za-z0-9_\-ÇĞİÖŞÜçğıöşü]+", text)


def check_line(line: str, path: Path, line_no: int, findings: list[str]) -> None:
    lower_line = line.lower()

    # Layer 1: Turkish characters.
    for match in TURKISH_CHARS.finditer(line):
        findings.append(f"{path}:{line_no}:{match.start()+1}: Turkish character '{match.group()}'")

    # Layer 2 & 3: word list and normalized forms.
    for token in tokenize(line):
        lower_token = token.lower()
        if lower_token in ALLOWED:
            continue

        normalized = lower_token.translate(NORMALIZE_MAP)

        if lower_token in TURKISH_WORDS or normalized in TURKISH_WORDS:
            findings.append(f"{path}:{line_no}: Turkish word '{token}' (normalized: {normalized})")


def main() -> int:
    parser = argparse.ArgumentParser(description="Detect Turkish content in public-facing files.")
    parser.add_argument("--path", type=Path, default=Path("."), help="Root path to scan")
    parser.add_argument("--allow", action="append", default=[], help="Additional allowed words")
    args = parser.parse_args()

    allowed = ALLOWED | {a.lower() for a in args.allow}

    findings: list[str] = []

    for path in args.path.rglob("*"):
        if not path.is_file() or not is_text_file(path):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        for line_no, line in enumerate(text.splitlines(), start=1):
            check_line(line, path, line_no, findings)

    if findings:
        print("Turkish content detected:")
        for finding in findings:
            print(f"  {finding}")
        return 1

    print("PASS: No Turkish content detected.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
