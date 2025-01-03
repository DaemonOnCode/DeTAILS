from logging import config
from tabnanny import verbose
from regex import B
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.decomposition import NMF
import lda
from bertopic import BERTopic
from sentence_transformers import SentenceTransformer
from transformers import pipeline
from gensim.corpora import Dictionary, MmCorpus
from gensim.models.ldamulticore import LdaMulticore
import psutil
import bitermplus as btm
from hdbscan import HDBSCAN
from umap import UMAP
from bertopic.vectorizers import ClassTfidfTransformer
import pandas as pd

# LDA
def lda_topic_modeling(documents, num_topics):
    config = {
        "workers": psutil.cpu_count(logical=False),
        num_topics: num_topics,
        "passes": 10,
        "alpha": "symmetric",
        "eta": "auto"
    }

    dictionary = Dictionary(documents)
    dictionary.compactify()
    dictionary.save("dictionary.gensim")
    raw_corpus = [dictionary.doc2bow(doc) for doc in documents]
    MmCorpus.serialize("corpus.mm", raw_corpus)
    corpus = MmCorpus("corpus.mm")
    model = LdaMulticore(corpus=corpus, id2word=dictionary, **config)

    # document_topic_prob = {}
    model_document_topics = model.get_document_topics(corpus, minimum_probability=0.0, minimum_phi_value=0)
    for doc_num in range(len(corpus)):
        doc_row = model_document_topics[doc_num]
        doc_topic_prob_row = {}
        for i, prob in doc_row:
            doc_topic_prob_row[i+1] = prob
        # document_topic_prob[] = doc_topic_prob_row
    # vectorizer = CountVectorizer(stop_words='english')
    # X = vectorizer.fit_transform(documents)
    # lda_model = lda.LDA(n_topics=num_topics, n_iter=500, random_state=42)
    # lda_model.fit(X)
    # topics = []
    # for topic_idx, topic in enumerate(lda_model.topic_word_):
    #     words = [vectorizer.get_feature_names_out()[i] for i in topic.argsort()[:-11:-1]]
    #     topics.append({"topic": topic_idx, "words": words})
    # return topics
    pass

# Biterm
def biterm_topic_modeling(documents, num_topics):
    config = {
        "iterations": 50,
        verbose: False,
    }
    texts = documents
    X, vocab, vocab_dict = btm.get_words_freqs(texts)
    docs_vec = btm.get_vectorized_docs(texts, vocab)
    biterms = btm.get_biterms(docs_vec)
    model = btm.BTM(num_topics=num_topics, T=num_topics, M=20, alpha=50/8, beta=0.01)
    p_zd = model.fit_transform(docs_vec, biterms, **config)
    for doc_num in range(len(p_zd)):
            doc_row = p_zd[doc_num]
            doc_topic_prob_row = {}
            for i in range(len(doc_row)):
                doc_topic_prob_row[i+1] = doc_row[i]
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
def bertopic_modeling(documents, num_topics):
    model = SentenceTransformer("all-MiniLM-L6-v2")
    embedding_model = model.encode(documents, show_progress_bar=False)

    print("works 1.2!")
    
    # Step 2.2 - Reduce dimensionality
    umap_model = UMAP(n_neighbors=15, n_components=5, min_dist=0.0, metric='cosine')
    
    # Step 2.3 - Cluster reduced embeddings
    hdbscan_model = HDBSCAN(min_cluster_size=15, metric='euclidean', cluster_selection_method='eom', prediction_data=True)
    print("works 2!")
    # Step 2.4 - Tokenize topics
    vectorizer_model = CountVectorizer(stop_words="english")
    
    # Step 2.5 - Create topic representation
    ctfidf_model = ClassTfidfTransformer()
    
    topic_model = BERTopic(
        embedding_model=model,    # Step 1 - Extract embeddings
        umap_model=umap_model,              # Step 2 - Reduce dimensionality
        hdbscan_model=hdbscan_model,        # Step 3 - Cluster reduced embeddings
        vectorizer_model=vectorizer_model,  # Step 4 - Tokenize topics
        ctfidf_model=ctfidf_model,          # Step 5 - Extract topic words
        nr_topics=num_topics          # Step 6 - Diversify topic words
    )
    topics, probabilities = topic_model.fit_transform(documents)

    doc_info = topic_model.get_document_info(documents)
    doc_df = pd.DataFrame(doc_info)
    doc_info_csv_file = "doc_info_bertopic.csv"
    doc_df.to_csv(doc_info_csv_file, index=False)

    document_topic_prob = {}
    print("works 5!")
    for doc_num, probs in enumerate(probabilities):
        doc_topic_prob_row = {}
        for topic_id, prob in enumerate(probabilities):
            doc_topic_prob_row[topic_id] = prob
        # document_topic_prob[text_keys[doc_num]] = doc_topic_prob_row
    # topic_words = bertopic_model.get_topics()
    # topics_list = [{"topic": k, "words": [w[0] for w in v]} for k, v in topic_words.items() if k != -1]
    return topics

# LLM
def llm_topic_modeling(documents, num_topics):
    
    # Data preprocessing / tokenization
    # Text embedding generation
    # Dimensionality reduction
    # Clustering to identify topics
    # Topic representation
    # Visualization

    summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
    full_text = " ".join(documents)
    summary = summarizer(full_text, max_length=100, min_length=10, do_sample=False)
    return [{"summary": summary}]
