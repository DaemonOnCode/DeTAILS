// #include "model2vec_api.h"
// #include <stdlib.h>
// #include <string.h>
// #include <math.h>
// #include <stdbool.h>

// // Opaque structure definition
// struct model2Vec
// {
//     int embedding_dim;
//     bool apply_zipf;
//     int pca_components;
//     float **pca_matrix;     // PCA transformation matrix
//     size_t pca_matrix_rows; // Number of PCA components (rows in PCA matrix)
//     float **embeddings;     // Embeddings matrix
//     char **tokens;          // Tokens array
//     size_t token_count;     // Number of tokens
// };

// // Internal helper functions
// static float *allocate_vector(size_t size)
// {
//     return (float *)calloc(size, sizeof(float));
// }

// static float **allocate_matrix(size_t rows, size_t cols)
// {
//     float **matrix = (float **)malloc(rows * sizeof(float *));
//     if (!matrix)
//         return NULL;

//     for (size_t i = 0; i < rows; i++)
//     {
//         matrix[i] = allocate_vector(cols);
//         if (!matrix[i])
//         {
//             // Free previously allocated rows in case of failure
//             for (size_t j = 0; j < i; j++)
//             {
//                 free(matrix[j]);
//             }
//             free(matrix);
//             return NULL;
//         }
//     }
//     return matrix;
// }

// static void free_matrix(float **matrix, size_t rows)
// {
//     if (!matrix)
//         return;

//     for (size_t i = 0; i < rows; i++)
//     {
//         free(matrix[i]);
//     }
//     free(matrix);
// }

// // Initialization
// model2Vec *model2vec_init(int embedding_dim, bool apply_zipf, int pca_components)
// {
//     model2Vec *instance = (model2Vec *)malloc(sizeof(model2Vec));
//     if (!instance)
//         return NULL;

//     instance->embedding_dim = embedding_dim;
//     instance->apply_zipf = apply_zipf;
//     instance->pca_components = pca_components;
//     instance->pca_matrix = NULL;
//     instance->pca_matrix_rows = 0;
//     instance->embeddings = NULL;
//     instance->tokens = NULL;
//     instance->token_count = 0;

//     return instance;
// }

// // Free resources
// void model2vec_free(model2Vec *instance)
// {
//     if (!instance)
//         return;

//     free_matrix(instance->pca_matrix, instance->pca_matrix_rows);
//     free_matrix(instance->embeddings, instance->token_count);

//     if (instance->tokens)
//     {
//         for (size_t i = 0; i < instance->token_count; i++)
//         {
//             free(instance->tokens[i]);
//         }
//         free(instance->tokens);
//     }

//     free(instance);
// }

// // Initialize embeddings
// bool model2vec_initialize(model2Vec *instance, const float **embeddings, const char **tokens, size_t count)
// {
//     if (!instance || !embeddings || !tokens || count == 0)
//         return false;

//     instance->embeddings = allocate_matrix(count, instance->embedding_dim);
//     if (!instance->embeddings)
//         return false;

//     instance->tokens = (char **)malloc(count * sizeof(char *));
//     if (!instance->tokens)
//     {
//         free_matrix(instance->embeddings, count);
//         return false;
//     }

//     for (size_t i = 0; i < count; i++)
//     {
//         memcpy(instance->embeddings[i], embeddings[i], instance->embedding_dim * sizeof(float));
//         instance->tokens[i] = strdup(tokens[i]);
//         if (!instance->tokens[i])
//         {
//             // Free allocated tokens in case of failure
//             for (size_t j = 0; j < i; j++)
//             {
//                 free(instance->tokens[j]);
//             }
//             free(instance->tokens);
//             free_matrix(instance->embeddings, count);
//             return false;
//         }
//     }
//     instance->token_count = count;

//     return true;
// }

// // Distill embeddings
// bool model2vec_distill(model2Vec *instance, const float **raw_embeddings, const char **tokens, size_t count)
// {
//     if (!instance || !raw_embeddings || !tokens || count == 0)
//         return false;

//     // Perform PCA or other operations here
//     // Example placeholder logic: copy raw_embeddings to instance->embeddings
//     free_matrix(instance->embeddings, instance->token_count);
//     instance->embeddings = allocate_matrix(count, instance->embedding_dim);
//     if (!instance->embeddings)
//         return false;

//     for (size_t i = 0; i < count; i++)
//     {
//         memcpy(instance->embeddings[i], raw_embeddings[i], instance->embedding_dim * sizeof(float));
//     }

//     instance->token_count = count;
//     return true;
// }

// // Apply PCA
// bool model2vec_apply_pca(const model2Vec *instance, const float *embedding, float *out_embedding)
// {
//     if (!instance || !embedding || !out_embedding || !instance->pca_matrix)
//         return false;

//     for (int i = 0; i < instance->pca_components; i++)
//     {
//         out_embedding[i] = 0.0f;
//         for (int j = 0; j < instance->embedding_dim; j++)
//         {
//             out_embedding[i] += embedding[j] * instance->pca_matrix[i][j];
//         }
//     }

//     return true;
// }

// // Apply Zipf weighting
// bool model2vec_apply_zipf(const model2Vec *instance, const float *embedding, int rank, float *out_embedding)
// {
//     if (!instance || !embedding || !out_embedding)
//         return false;

//     float weight = logf(1.0f + rank);
//     for (int i = 0; i < instance->embedding_dim; i++)
//     {
//         out_embedding[i] = embedding[i] * weight;
//     }

//     return true;
// }

// // Get embedding dimension
// size_t model2vec_embedding_dim(const model2Vec *instance)
// {
//     return instance ? (size_t)instance->embedding_dim : 0;
// }
