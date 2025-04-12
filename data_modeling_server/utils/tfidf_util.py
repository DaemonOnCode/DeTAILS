from sklearn.feature_extraction.text import TfidfVectorizer
from typing import List, Dict


def calculate_tfidf(documents: List[str]) -> Dict[str, float]:
    """
    Calculate TF-IDF scores for terms in the given documents.

    :param documents: List of documents (strings)
    :return: Dictionary of terms and their corresponding TF-IDF scores
    """
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(documents)
    feature_names = vectorizer.get_feature_names_out()
    scores = tfidf_matrix.toarray().sum(axis=0)

    return dict(zip(feature_names, scores))
