WAKE_PHRASES = [
    "code red",
    "help me",
    "emergency",
    "need help",
]

def is_wake_word_detected(text: str) -> bool:
    lower = text.lower()
    return any(phrase in lower for phrase in WAKE_PHRASES)