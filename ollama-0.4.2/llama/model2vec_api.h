// #ifndef MODEL2VEC_API_H
// #define MODEL2VEC_API_H

// #include <stdbool.h>
// #include <stddef.h>

// // Opaque structure definition
// typedef struct model2Vec model2Vec;

// // Function declarations
// model2Vec *model2vec_init(int embedding_dim, bool apply_zipf, int pca_components);
// void model2vec_free(model2Vec *instance);

// bool model2vec_initialize(model2Vec *instance, const float **embeddings, const char **tokens, size_t count);
// bool model2vec_distill(model2Vec *instance, const float **raw_embeddings, const char **tokens, size_t count);

// bool model2vec_apply_pca(const model2Vec *instance, const float *embedding, float *out_embedding); // Ensure const
// bool model2vec_apply_zipf(const model2Vec *instance, const float *embedding, int rank, float *out_embedding);

// size_t model2vec_embedding_dim(const model2Vec *instance);

// #endif // MODEL2VEC_API_H
