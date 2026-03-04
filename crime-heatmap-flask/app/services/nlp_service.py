from __future__ import annotations

import re
from collections import Counter

DEVANAGARI_PATTERN = re.compile(r"[\u0900-\u097F]")
WORD_PATTERN = re.compile(r"[a-z0-9']+")

# Common Hinglish/Hindi tokens mapped to normalized English intent words.
TOKEN_NORMALIZATION = {
    "chori": "theft",
    "chor": "thief",
    "chedchad": "harassment",
    "marpit": "assault",
    "jhagda": "fight",
    "lut": "robbery",
    "loot": "robbery",
    "gunda": "goon",
    "gundagardi": "violence",
    "dhokha": "fraud",
    "thagi": "fraud",
    "kidnap": "kidnapping",
    "apaharan": "kidnapping",
    "badtameezi": "harassment",
    "eve teasing": "harassment",
    "snatching": "snatching",
    "chaaku": "knife",
    "chaku": "knife",
    "bandook": "gun",
    "goli": "gunshot",
    "hamla": "attack",
    "hamle": "attack",
    "zabardasti": "force",
    "darr": "fear",
    "dar": "fear",
    "raat": "night",
    "subah": "morning",
}

PHRASE_REPLACEMENTS = {
    "police station": "police_station",
    "fir number": "fir_number",
    "chain snatching": "snatching",
    "phone snatching": "snatching",
}

CATEGORY_KEYWORDS = {
    "theft": {"theft", "thief", "stolen", "stole", "snatching", "robbery", "pickpocket"},
    "assault": {"assault", "attack", "fight", "violence", "injury", "beating"},
    "harassment": {"harassment", "eve", "teasing", "molest", "abuse", "threat", "stalking"},
    "fraud": {"fraud", "scam", "phishing", "dhokha", "thagi", "otp", "upi"},
    "vandalism": {"vandalism", "damage", "arson", "fire", "broken", "graffiti"},
    "kidnapping": {"kidnapping", "abduction", "missing", "apaharan"},
}

URGENCY_KEYWORDS = {
    "critical": {"gun", "gunshot", "knife", "attack", "bleeding", "kidnapping", "hostage"},
    "high": {"assault", "robbery", "snatching", "violence", "threat"},
    "medium": {"harassment", "fraud", "stolen", "theft"},
}


def _normalize_spaces(value: str) -> str:
    return " ".join((value or "").strip().split())


def _classify_incident(tokens: list[str]) -> tuple[str, float]:
    if not tokens:
        return "general", 0.0
    token_set = set(tokens)
    best_label = "general"
    best_score = 0.0
    for label, keywords in CATEGORY_KEYWORDS.items():
        overlap = len(token_set.intersection(keywords))
        if overlap <= 0:
            continue
        score = overlap / max(1.0, min(4.0, len(keywords) / 2.0))
        if score > best_score:
            best_label = label
            best_score = score
    return best_label, round(min(0.99, best_score), 3)


def _estimate_urgency(tokens: list[str]) -> str:
    token_set = set(tokens)
    for level in ("critical", "high", "medium"):
        if token_set.intersection(URGENCY_KEYWORDS[level]):
            return level
    return "low"


def _build_summary(source: str, normalized_tokens: list[str]) -> str:
    if not source:
        return ""
    short_source = source.strip()
    if len(short_source) <= 140:
        return short_source
    summary_tokens = normalized_tokens[:24]
    if summary_tokens:
        return (" ".join(summary_tokens))[:160].strip()
    return short_source[:160].strip()


def normalize_report_text(text: str) -> dict:
    source = _normalize_spaces(text)
    lowered = source.lower()
    for phrase, replacement in PHRASE_REPLACEMENTS.items():
        lowered = lowered.replace(phrase, replacement)

    has_devanagari = bool(DEVANAGARI_PATTERN.search(source))
    # Keep ASCII token stream for downstream matching and hashes.
    tokens = WORD_PATTERN.findall(lowered)
    normalized_tokens = [TOKEN_NORMALIZATION.get(tok, tok) for tok in tokens]
    normalized_text = " ".join(normalized_tokens)
    category, category_confidence = _classify_incident(normalized_tokens)
    urgency = _estimate_urgency(normalized_tokens)
    summary = _build_summary(source, normalized_tokens)

    top_keywords = [item[0] for item in Counter(normalized_tokens).most_common(6) if len(item[0]) > 2]
    lang_hint = "mixed" if has_devanagari and bool(tokens) else ("hi" if has_devanagari else "en")

    return {
        "normalized_text": normalized_text,
        "language_hint": lang_hint,
        "has_devanagari": has_devanagari,
        "keywords": top_keywords,
        "summary": summary,
        "category": category,
        "category_confidence": category_confidence,
        "urgency_hint": urgency,
    }
