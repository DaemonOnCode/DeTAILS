import spacy


def get_spacy_stopwords(language: str = "en") -> set:
    if language == "en":
        nlp = spacy.load("en_core_web_sm")
    elif language == "fr":
        nlp = spacy.load("fr_core_news_sm")
    else:
        raise ValueError("Unsupported language")

    return nlp.Defaults.stop_words
