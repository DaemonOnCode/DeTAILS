#ifndef MODEL2VEC_MANAGER_H
#define MODEL2VEC_MANAGER_H

#include <stddef.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C"
{
#endif

    // C-style opaque pointer to the model
    typedef struct model2Vec model2Vec;

    // Create a new model instance
    model2Vec *model2vec_create(int embedding_dim, bool apply_zipf, int pca_components);

    // Free the model instance
    void model2vec_destroy(model2Vec *model);

    // Initialize the model with precomputed embeddings and tokens
    bool model2vec_initialize(model2Vec *model, const float **embeddings, const char **tokens, size_t count);

    // Distill raw embeddings into the model
    bool model2vec_distill(model2Vec *model);

    // Apply PCA transformation to an embedding
    bool model2vec_apply_pca(const model2Vec *model, const float *embedding, float *result);

    // Apply Zipf weighting to an embedding
    bool model2vec_apply_zipf(const model2Vec *model, const float *embedding, int rank, float *result);

    // Get the embedding dimension
    size_t model2vec_get_embedding_dim(const model2Vec *model);

    // Get the number of PCA components
    size_t model2vec_get_pca_components(const model2Vec *model);

    // Retrieve a token by its index
    const char *model2vec_get_token(const model2Vec *model, size_t index);

    // Retrieve an embedding by its index
    bool model2vec_get_embedding(const model2Vec *model, size_t index, float *embedding_out);

    // Add tokens to the model
    bool model2vec_add_tokens(model2Vec *model, void *tokens, size_t count);

    // Add embeddings to the model
    bool model2vec_add_embeddings(model2Vec *model, float** embeddings, size_t count, int model_embedding_size);

    // Save model data to a file
    bool model2vec_save_to_file(const model2Vec *model, const char *filepath);

    // Load model data from a file
    model2Vec *model2vec_load_from_file(const char *filepath);

    bool model2vec_get_embedding_from_file(const char* filepath, int token_id, float* embedding_out);

#ifdef __cplusplus
}
#endif

#endif // MODEL2VEC_MANAGER_H
