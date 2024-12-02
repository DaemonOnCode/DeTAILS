#ifndef MODEL2VEC_H
#define MODEL2VEC_H
#pragma once

#ifdef __cplusplus
extern "C"
{
#endif

#include <stddef.h> // For size_t

    // Data structures for C
    typedef struct
    {
        float *data;
        size_t size;
    } vectorf;

    typedef struct
    {
        vectorf *rows;
        size_t row_count;
        size_t col_count; // For convenience
    } matrix;

    struct model2Vec
    {
        int embedding_dim;
        int apply_zipf; // Use int as C does not have bool
        int pca_components;
        matrix pca_matrix;
        char **tokens; // Array of strings (C strings)
        size_t token_count;
        vectorf *embeddings; // Parallel to tokens
    };

    // Functions for model2Vec
    model2Vec *model2vec_create(int embedding_dim, int apply_zipf, int pca_components);
    void model2vec_destroy(model2Vec *model);

    int model2vec_initialize(model2Vec *model, const matrix *precomputed_embeddings, const char **tokens, size_t token_count);
    int model2vec_distill(model2Vec *model, const matrix *raw_embeddings, const char **tokens, size_t token_count);

    vectorf model2vec_apply_pca(const model2Vec *model, const vectorf *embedding);
    vectorf model2vec_apply_zipf_weighting(const model2Vec *model, const vectorf *embedding, int rank);

    // matrix helper functions
    matrix matrix_create(size_t rows, size_t cols);
    void matrix_destroy(matrix *matrix);
    vectorf vector_create(size_t size);
    void vector_free(vectorf *vector);

    // Helper functions
    void vector_normalize(vectorf *vector);
    void compute_eigen(const matrix *covariance_matrix, vectorf *eigenvalues, matrix *eigenvectors);
    void power_iteration(const matrix *matrix, vectorf *eigenvector, float *eigenvalue, int max_iter, float tol);

    matrix matrix_multiply(const matrix *mat1, const matrix *mat2);
    matrix matrix_transpose(const matrix *mat);
    vectorf compute_mean(const matrix *data);
    matrix center_data(const matrix *data, const vectorf *mean);
    matrix compute_covariance(const matrix *data);

#ifdef __cplusplus
}
#endif

#endif // MODEL2VEC_H
