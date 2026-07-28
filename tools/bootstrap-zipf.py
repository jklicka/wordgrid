#!/usr/bin/env python3
"""
One-time bootstrap: emit data/zipf.json mapping word -> Zipf frequency.

Run this ONCE. The output is committed, so the Node content pipeline never
needs Python. Re-run only to refresh against a newer wordfreq release.

    python3 -m pip install --user wordfreq
    python3 tools/bootstrap-zipf.py

Why wordfreq and not a subtitle corpus: OpenSubtitles-derived lists (the usual
free option) are spoken dialogue, and literary vocabulary is essentially absent
from them. Measured against a 50k subtitle list, every word this game exists to
teach — laconic, ersatz, quotidian, loci, conic — was missing outright, while
ordinary words like `ion` and `coil` landed mid-table. wordfreq blends books,
Wikipedia, news and web alongside subtitles, which separates the bands cleanly.

Zipf is a log10 scale: 6 ≈ once per thousand words, 3 ≈ once per million.
"""
import json
import pathlib
import sys

try:
    from wordfreq import top_n_list, zipf_frequency
except ImportError:
    sys.exit("wordfreq not installed — run: python3 -m pip install --user wordfreq")

MIN_ZIPF = 2.0   # below this a word is too obscure to be worth teaching
MIN_LEN, MAX_LEN = 3, 8   # 3 is the game's minimum word; 8 fits a phone grid

out = pathlib.Path(__file__).resolve().parent.parent / "data" / "zipf.json"
out.parent.mkdir(parents=True, exist_ok=True)

table = {}
for word in top_n_list("en", 200_000):
    if not (word.isalpha() and word.isascii()):
        continue
    if not (MIN_LEN <= len(word) <= MAX_LEN):
        continue
    z = round(zipf_frequency(word, "en"), 2)
    if z >= MIN_ZIPF:
        table[word.upper()] = z

out.write_text(json.dumps(table, separators=(",", ":"), sort_keys=True))

teaching = sum(1 for z in table.values() if z < 3.6)
print(f"wrote {out.relative_to(out.parent.parent)}")
print(f"  {len(table):,} words  ({out.stat().st_size / 1024 / 1024:.1f} MB)")
print(f"  {teaching:,} in the teaching band (zipf 2.0-3.6)")
print(f"  {len(table) - teaching:,} common (zipf >= 3.6)")
