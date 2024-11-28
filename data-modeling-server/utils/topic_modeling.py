from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.decomposition import NMF
import lda
from bertopic import BERTopic
from sentence_transformers import SentenceTransformer
from transformers import pipeline

# LDA
def lda_topic_modeling(documents, num_topics):
    vectorizer = CountVectorizer(stop_words='english')
    X = vectorizer.fit_transform(documents)
    lda_model = lda.LDA(n_topics=num_topics, n_iter=500, random_state=42)
    lda_model.fit(X)
    topics = []
    for topic_idx, topic in enumerate(lda_model.topic_word_):
        words = [vectorizer.get_feature_names_out()[i] for i in topic.argsort()[:-11:-1]]
        topics.append({"topic": topic_idx, "words": words})
    return topics

# Biterm
def biterm_topic_modeling(documents, num_topics):
    # vectorizer = CountVectorizer(stop_words='english')
    # X = vectorizer.fit_transform(documents)
    # biterms = vec_to_biterms(X)

    # btm = oBTM(num_topics=num_topics, V=len(vectorizer.get_feature_names_out()))
    # btm.fit(biterms, iterations=50)

    # topics = btm.transform(biterms)
    topic_words = []
    # for topic_idx in range(num_topics):
    #     words = btm.get_top_topic_words(topic_idx, 10)
    #     topic_words.append({"topic": topic_idx, "words": words})
    return topic_words

# NNMF
def nnmf_topic_modeling(documents, num_topics):
    vectorizer = TfidfVectorizer(stop_words='english')
    X = vectorizer.fit_transform(documents)
    nmf_model = NMF(n_components=num_topics, random_state=42)
    W = nmf_model.fit_transform(X)
    H = nmf_model.components_
    topics = []
    for topic_idx, topic in enumerate(H):
        words = [vectorizer.get_feature_names_out()[i] for i in topic.argsort()[:-11:-1]]
        topics.append({"topic": topic_idx, "words": words})
    return topics

# BERTopic
def bert_topic_modeling(documents, num_topics):
    bertopic_model = BERTopic(top_n_words=10, nr_topics=num_topics)
    topics, _ = bertopic_model.fit_transform(documents)
    topic_words = bertopic_model.get_topics()
    topics_list = [{"topic": k, "words": [w[0] for w in v]} for k, v in topic_words.items() if k != -1]
    return topics_list

# LLM
def llm_topic_modeling(documents, num_topics):
    summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
    full_text = " ".join(documents)
    summary = summarizer(full_text, max_length=100, min_length=10, do_sample=False)
    return [{"summary": summary}]
