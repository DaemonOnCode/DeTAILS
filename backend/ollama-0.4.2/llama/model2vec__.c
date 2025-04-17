// #include "model2vec.h"
// #include <stdlib.h>
// #include <string.h>
// #include <math.h>
// #include <stdio.h>

// // Create a vector
// vectorf vector_create(size_t size)
// {
//     vectorf v;
//     v.data = (float *)calloc(size, sizeof(float));
//     v.size = size;
//     return v;
// }

// // Free a vector
// void vector_free(vectorf *v)
// {
//     if (v && v->data)
//     {
//         free(v->data);
//         v->data = NULL;
//         v->size = 0;
//     }
// }

// matrix matrix_create(size_t rows, size_t cols)
// {
//     matrix m;
//     m.rows = (vectorf *)malloc(rows * sizeof(vectorf));
//     if (!m.rows)
//     {
//         m.row_count = 0;
//         m.col_count = 0;
//         return m; // Return an empty matrix if allocation fails
//     }

//     m.row_count = rows;
//     m.col_count = cols;

//     for (size_t i = 0; i < rows; ++i)
//     {
//         m.rows[i] = vector_create(cols);
//     }

//     return m;
// }

// void matrix_destroy(matrix *m)
// {
//     if (!m || !m->rows)
//     {
//         return; // Nothing to free
//     }

//     for (size_t i = 0; i < m->row_count; ++i)
//     {
//         vector_free(&m->rows[i]);
//     }
//     free(m->rows);
//     m->rows = NULL;
//     m->row_count = 0;
//     m->col_count = 0;
// }

// // Normalize a vector
// void vector_normalize(vectorf *v)
// {
//     float norm = 0.0f;
//     for (size_t i = 0; i < v->size; ++i)
//     {
//         norm += v->data[i] * v->data[i];
//     }
//     norm = sqrtf(norm);
//     for (size_t i = 0; i < v->size; ++i)
//     {
//         v->data[i] /= norm;
//     }
// }

// // Create a model2vec instance
// model2Vec *model2vec_create(int embedding_dim, int apply_zipf, int pca_components)
// {
//     model2Vec *model = (model2Vec *)malloc(sizeof(model2Vec));
//     model->embedding_dim = embedding_dim;
//     model->apply_zipf = apply_zipf;
//     model->pca_components = pca_components;
//     model->pca_matrix = matrix_create(0, 0); // Initially empty
//     model->tokens = NULL;
//     model->token_count = 0;
//     model->embeddings = NULL;
//     return model;
// }

// // Destroy a model2vec instance
// void model2vec_destroy(model2Vec *model)
// {
//     matrix_destroy(&model->pca_matrix);
//     if (model->tokens)
//     {
//         for (size_t i = 0; i < model->token_count; ++i)
//         {
//             free(model->tokens[i]);
//         }
//         free(model->tokens);
//     }
//     if (model->embeddings)
//     {
//         for (size_t i = 0; i < model->token_count; ++i)
//         {
//             vector_free(&model->embeddings[i]);
//         }
//         free(model->embeddings);
//     }
//     free(model);
// }

// // Initialize with precomputed embeddings
// int model2vec_initialize(model2Vec *model, const matrix *precomputed_embeddings, const char **tokens, size_t token_count)
// {
//     if (precomputed_embeddings->row_count != token_count)
//     {
//         fprintf(stderr, "Mismatch between embeddings and tokens size.\n");
//         return 0;
//     }

//     model->tokens = (char **)malloc(token_count * sizeof(char *));
//     model->embeddings = (vectorf *)malloc(token_count * sizeof(vectorf));
//     model->token_count = token_count;

//     for (size_t i = 0; i < token_count; ++i)
//     {
//         model->tokens[i] = strdup(tokens[i]);
//         model->embeddings[i] = vector_create(precomputed_embeddings->col_count);
//         memcpy(model->embeddings[i].data, precomputed_embeddings->rows[i].data, precomputed_embeddings->col_count * sizeof(float));
//     }

//     return 1;
// }

// // Power Iteration to compute eigenvalues and eigenvectors
// void power_iteration(const matrix *m, vectorf *eigenvector, float *eigenvalue, int max_iter, float tol)
// {
//     for (size_t i = 0; i < m->col_count; ++i)
//     {
//         eigenvector->data[i] = (float)rand() / RAND_MAX;
//     }
//     vector_normalize(eigenvector);

//     vectorf temp = vector_create(eigenvector->size);

//     for (int iter = 0; iter < max_iter; ++iter)
//     {
//         for (size_t i = 0; i < m->row_count; ++i)
//         {
//             temp.data[i] = 0.0f;
//             for (size_t j = 0; j < m->col_count; ++j)
//             {
//                 temp.data[i] += m->rows[i].data[j] * eigenvector->data[j];
//             }
//         }

//         vector_normalize(&temp);

//         float diff = 0.0f;
//         for (size_t i = 0; i < eigenvector->size; ++i)
//         {
//             diff += fabsf(temp.data[i] - eigenvector->data[i]);
//         }

//         if (diff < tol)
//             break;

//         memcpy(eigenvector->data, temp.data, eigenvector->size * sizeof(float));
//     }

//     *eigenvalue = 0.0f;
//     for (size_t i = 0; i < m->row_count; ++i)
//     {
//         for (size_t j = 0; j < m->col_count; ++j)
//         {
//             *eigenvalue += eigenvector->data[i] * m->rows[i].data[j] * eigenvector->data[j];
//         }
//     }

//     vector_free(&temp);
// }

// void compute_eigen(const matrix *m, vectorf *eigenvalues, matrix *eigenvectors)
// {
//     size_t size = m->row_count;

//     *eigenvalues = vector_create(size);
//     *eigenvectors = matrix_create(size, size);

//     matrix m_copy = matrix_create(size, size);
//     for (size_t i = 0; i < size; ++i)
//     {
//         memcpy(m_copy.rows[i].data, m->rows[i].data, m->col_count * sizeof(float));
//     }

//     for (size_t k = 0; k < size; ++k)
//     {
//         vectorf eigenvector = vector_create(size);
//         float eigenvalue = 0.0f;

//         power_iteration(&m_copy, &eigenvector, &eigenvalue, 1000, 1e-6);

//         eigenvalues->data[k] = eigenvalue;
//         memcpy(eigenvectors->rows[k].data, eigenvector.data, size * sizeof(float));

//         for (size_t i = 0; i < size; ++i)
//         {
//             for (size_t j = 0; j < size; ++j)
//             {
//                 m_copy.rows[i].data[j] -= eigenvalue * eigenvector.data[i] * eigenvector.data[j];
//             }
//         }

//         vector_free(&eigenvector);
//     }

//     matrix_destroy(&m_copy);
// }

// int model2vec_distill(model2Vec *model, const matrix *raw_embeddings, const char **tokens, size_t token_count)
// {
//     if (!model || !raw_embeddings || !tokens || token_count == 0)
//     {
//         return 0; // Failure
//     }

//     // Compute mean vector
//     vectorf mean_vector = vector_create(model->embedding_dim);
//     for (size_t i = 0; i < token_count; ++i)
//     {
//         for (size_t j = 0; j < model->embedding_dim; ++j)
//         {
//             mean_vector.data[j] += raw_embeddings->rows[i].data[j];
//         }
//     }

//     for (size_t j = 0; j < model->embedding_dim; ++j)
//     {
//         mean_vector.data[j] /= token_count;
//     }

//     // Center data
//     matrix centered_data = matrix_create(token_count, model->embedding_dim);
//     for (size_t i = 0; i < token_count; ++i)
//     {
//         for (size_t j = 0; j < model->embedding_dim; ++j)
//         {
//             centered_data.rows[i].data[j] = raw_embeddings->rows[i].data[j] - mean_vector.data[j];
//         }
//     }

//     // Compute covariance
//     matrix covariance = matrix_create(model->embedding_dim, model->embedding_dim);
//     for (size_t i = 0; i < model->embedding_dim; ++i)
//     {
//         for (size_t j = 0; j < model->embedding_dim; ++j)
//         {
//             for (size_t k = 0; k < token_count; ++k)
//             {
//                 covariance.rows[i].data[j] += centered_data.rows[k].data[i] * centered_data.rows[k].data[j];
//             }
//             covariance.rows[i].data[j] /= (token_count - 1);
//         }
//     }

//     // Compute eigenvalues/vectors
//     vectorf eigenvalues;
//     matrix eigenvectors;
//     compute_eigen(&covariance, &eigenvalues, &eigenvectors);

//     // Select PCA components
//     model->pca_matrix = matrix_create(model->pca_components, model->embedding_dim);
//     for (int i = 0; i < model->pca_components; ++i)
//     {
//         memcpy(model->pca_matrix.rows[i].data, eigenvectors.rows[i].data, model->embedding_dim * sizeof(float));
//     }

//     // Clean up
//     vector_free(&mean_vector);
//     matrix_destroy(&centered_data);
//     matrix_destroy(&covariance);
//     vector_free(&eigenvalues);
//     matrix_destroy(&eigenvectors);

//     return 1; // Success
// }

// int model2vec_load_from_file(model2Vec *model, const char *file_path, int embedding_dim)
// {
//     if (!model || !file_path || embedding_dim <= 0)
//     {
//         return 0; // Failure
//     }

//     FILE *file = fopen(file_path, "r");
//     if (!file)
//     {
//         perror("Failed to open file");
//         return 0; // Failure
//     }

//     // Count tokens
//     size_t token_count = 0;
//     char line[4096]; // Assuming a max line length
//     while (fgets(line, sizeof(line), file))
//     {
//         token_count++;
//     }
//     rewind(file); // Reset file pointer to beginning

//     // Allocate embeddings and tokens
//     model->embeddings = (vectorf *)malloc(token_count * sizeof(vectorf));
//     if (!model->embeddings)
//     {
//         fclose(file);
//         return 0; // Memory allocation failed
//     }

//     model->tokens = (char **)malloc(token_count * sizeof(char *));
//     if (!model->tokens)
//     {
//         free(model->embeddings);
//         fclose(file);
//         return 0; // Memory allocation failed
//     }

//     // Parse file and populate tokens and embeddings
//     size_t idx = 0;
//     while (fgets(line, sizeof(line), file))
//     {
//         char *token = strtok(line, " ");
//         if (!token)
//             continue;

//         // Copy token
//         model->tokens[idx] = strdup(token);
//         if (!model->tokens[idx])
//         {
//             for (size_t i = 0; i < idx; ++i)
//             {
//                 free(model->tokens[i]);
//             }
//             free(model->tokens);
//             for (size_t i = 0; i < idx; ++i)
//             {
//                 vector_free(&model->embeddings[i]);
//             }
//             free(model->embeddings);
//             fclose(file);
//             return 0; // Memory allocation failed
//         }

//         // Copy embedding
//         model->embeddings[idx] = vector_create(embedding_dim);
//         for (int i = 0; i < embedding_dim; ++i)
//         {
//             char *value_str = strtok(NULL, " ");
//             if (value_str)
//             {
//                 model->embeddings[idx].data[i] = strtof(value_str, NULL);
//             }
//             else
//             {
//                 fprintf(stderr, "Invalid format in file for token %s\n", token);
//                 free(model->tokens[idx]);
//                 vector_free(&model->embeddings[idx]);
//                 model->tokens[idx] = NULL;
//                 break;
//             }
//         }

//         if (!model->tokens[idx])
//         {
//             break; // Error occurred during parsing
//         }

//         idx++;
//     }

//     fclose(file);

//     if (idx != token_count)
//     {
//         // Cleanup if parsing failed
//         for (size_t i = 0; i < idx; ++i)
//         {
//             free(model->tokens[i]);
//         }
//         free(model->tokens);
//         for (size_t i = 0; i < idx; ++i)
//         {
//             vector_free(&model->embeddings[i]);
//         }
//         free(model->embeddings);
//         return 0; // Parsing failed
//     }

//     model->token_count = token_count;
//     model->embedding_dim = embedding_dim;

//     return 1; // Success
// }

// vectorf model2vec_apply_pca(const model2Vec *model, const vectorf *embedding)
// {
//     // Check for valid inputs
//     if (!model || !embedding || !model->pca_matrix.rows || embedding->size != model->embedding_dim)
//     {
//         fprintf(stderr, "Invalid input to model2vec_apply_pca.\n");
//         return vector_create(0); // Return an empty vector on error
//     }

//     // Create a result vector with size equal to the number of PCA components
//     vectorf result = vector_create(model->pca_components);

//     // Multiply the embedding vector by the PCA matrix
//     for (int i = 0; i < model->pca_components; ++i)
//     {
//         result.data[i] = 0.0f;
//         for (size_t j = 0; j < embedding->size; ++j)
//         {
//             result.data[i] += model->pca_matrix.rows[i].data[j] * embedding->data[j];
//         }
//     }

//     return result;
// }

// vectorf model2vec_apply_zipf_weighting(const model2Vec *model, const vectorf *embedding, int rank)
// {
//     // Check for valid inputs
//     if (!model || !embedding || rank < 0)
//     {
//         fprintf(stderr, "Invalid input to model2vec_apply_zipf_weighting.\n");
//         return vector_create(0); // Return an empty vector on error
//     }

//     // Create a result vector with the same size as the embedding
//     vectorf result = vector_create(embedding->size);

//     // Calculate the Zipf weight using the logarithm as per the Python implementation
//     float zipf_weight = logf(1.0f + rank);

//     // Apply the Zipf weight to each element of the embedding
//     for (size_t i = 0; i < embedding->size; ++i)
//     {
//         result.data[i] = embedding->data[i] * zipf_weight;
//     }

//     return result;
// }