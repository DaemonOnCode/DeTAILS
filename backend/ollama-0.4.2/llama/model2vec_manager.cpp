#include "model2vec_manager.h"
#include "model2vec.h"
#include <vector>
#include <string>
#include <cstring>
#include <fstream>
#include <stdexcept>

// Internal function to convert a vector of strings to a C-style array
static const char **convert_tokens_to_carray(const std::vector<std::string> &tokens)
{
    const char **c_array = new const char *[tokens.size()];
    for (size_t i = 0; i < tokens.size(); ++i)
    {
        c_array[i] = tokens[i].c_str();
    }
    return c_array;
}

// Create a new model instance
model2Vec *model2vec_create(int embedding_dim, bool apply_zipf, int pca_components)
{
    return new model2Vec(embedding_dim, apply_zipf, pca_components);
}

// Free the model instance
void model2vec_destroy(model2Vec *model)
{
    if (model)
    {
        delete model;
    }
}

// Initialize the model with precomputed embeddings and tokens
bool model2vec_initialize(model2Vec *model, const float **embeddings, const char **tokens, size_t count)
{
    if (!model || !embeddings || !tokens || count == 0)
    {
        return false;
    }

    std::vector<vectorf> precomputed_embeddings;
    for (size_t i = 0; i < count; ++i)
    {
        vectorf embedding(model->embedding_dim);
        std::memcpy(embedding.data.data(), embeddings[i], model->embedding_dim * sizeof(float));
        precomputed_embeddings.push_back(embedding);
    }

    std::vector<std::string> token_list(tokens, tokens + count);
    try
    {
        model->initialize(precomputed_embeddings, token_list);
        return true;
    }
    catch (const std::exception &)
    {
        return false;
    }
}

// Distill raw embeddings into the model
bool model2vec_distill(model2Vec *model)
{
    // if (!model || model->embeddings.empty() || model->tokens.empty())
    // {
    //     return false; // Ensure model and its data are valid
    // }

    // size_t count = model->embeddings.size();

    // if (count != model->tokens.size())
    // {
    //     return false; // Ensure embeddings and tokens have matching sizes
    // }

    // // Prepare the raw embedding matrix
    // matrix raw_embedding_matrix(count, model->embedding_dim);
    // for (size_t i = 0; i < count; ++i)
    // {
    //     std::memcpy(raw_embedding_matrix.rows[i].data.data(), model->raw_embeddings[i].data(),
    //                 model->embedding_dim * sizeof(float));
    // }

    try
    {
        // Perform distillation using the model's distill method
        model->distill(model);
        return true;
    }
    catch (const std::exception &e)
    {
        logBMessage("Distillation failed: %s", e.what());
        return false;
    }
}

// Apply PCA transformation to an embedding
bool model2vec_apply_pca(const model2Vec *model, const float *embedding, float *result)
{
    if (!model || !embedding || !result)
    {
        return false;
    }

    vectorf input(model->embedding_dim);
    std::memcpy(input.data.data(), embedding, model->embedding_dim * sizeof(float));

    try
    {
        vectorf output = model->apply_pca(input);
        std::memcpy(result, output.data.data(), model->pca_components * sizeof(float));
        return true;
    }
    catch (const std::exception &)
    {
        return false;
    }
}

// Apply Zipf weighting to an embedding
bool model2vec_apply_zipf(const model2Vec *model, const float *embedding, int rank, float *result)
{
    if (!model || !embedding || !result)
    {
        return false;
    }

    vectorf input(model->embedding_dim);
    std::memcpy(input.data.data(), embedding, model->embedding_dim * sizeof(float));

    try
    {
        vectorf output = model->apply_zipf_weighting(input, rank);
        std::memcpy(result, output.data.data(), model->embedding_dim * sizeof(float));
        return true;
    }
    catch (const std::exception &)
    {
        return false;
    }
}

// Get the embedding dimension
size_t model2vec_get_embedding_dim(const model2Vec *model)
{
    return model ? model->embedding_dim : 0;
}

// Get the number of PCA components
size_t model2vec_get_pca_components(const model2Vec *model)
{
    return model ? model->pca_components : 0;
}

// Retrieve a token by its index
const char *model2vec_get_token(const model2Vec *model, size_t index)
{
    if (!model || index >= model->tokens.size())
    {
        return nullptr;
    }
    return model->tokens[index].c_str();
}

// Retrieve an embedding by its index
bool model2vec_get_embedding(const model2Vec *model, size_t index, float *embedding_out)
{
    logBMessage("Inside get embedding, index %d, embedding size %d", index, model->embeddings.size());
    if (!model || index >= model->embeddings.size() || !embedding_out)
    {
        return false;
    }
    logBMessage("Embedding size %d", model->embedding_dim);
    std::memcpy(embedding_out, model->embeddings[index].data.data(), model->embedding_dim * sizeof(float));
    return true;
}



bool model2vec_get_embedding_from_file(const char *filepath, int token_id, float *embedding_out) {
    if (!filepath || !embedding_out) {
        logBMessage("Invalid arguments provided to model2vec_get_embedding_from_file.");
        return false;
    }

    try {
        vectorf *embedding_ptr = model2Vec::get_embedding_by_token_id(filepath, token_id);
        if (!embedding_ptr) {
            logBMessage("No embedding found for token_id: %d in file: %s", token_id, filepath);
            return false;
        }

        // Copy the embedding data to the output buffer
        std::memcpy(embedding_out, embedding_ptr->data.data(), embedding_ptr->data.size() * sizeof(float));

        logBMessage("Successfully retrieved embedding for token_id: %d", token_id);

        // Clean up dynamically allocated memory
        delete embedding_ptr;

        return true;
    } catch (const std::exception &e) {
        logBMessage("Error in model2vec_get_embedding_from_file: %s", e.what());
        return false;
    }
}



// Save model data to a file
bool model2vec_save_to_file(const model2Vec *model, const char *filepath)
{
    if (!model || !filepath)
    {
        return false;
    }

    try
    {
        model->save_to_file(filepath);
        return true;
    }
    catch (const std::exception &)
    {
        return false;
    }
}

// Load model data from a file
model2Vec *model2vec_load_from_file(const char *filepath)
{
    if (!filepath)
    {
        return nullptr;
    }

    try
    {
        return model2Vec::load_from_file(filepath);
    }
    catch (const std::exception &e)
    {
        logBMessage("Error loading model from file, %s", e.what());
        return nullptr;
    }
}

// bool model2vec_add_tokens(model2Vec *model, void *tokens, size_t count)
// {
//     logBMessage("Inside add tokens");
//     if (!model || !tokens || count == 0)
//     {
//         logBMessage("Failed to add tokens");
//         return false;
//     }

//     auto *new_tokens = static_cast<std::vector<std::string> *>(tokens);
//     // for (size_t i = 0; i < count; ++i)
//     // {

//     //     if (tokens[i])
//     //     {
//     //         new_tokens.push_back(std::string(tokens[i]));
//     //     }
//     //     else
//     //     {
//     //         return false; // Invalid token
//     //     }
//     // }

//     // try
//     // {
//     //     model->tokens.insert(model->tokens.end(), new_tokens.begin(), new_tokens.end());
//     // }
//     // catch (const std::exception &)
//     // {
//     //     return false; // Handle memory allocation issues
//     // }

//     // model->tokens = *new_tokens;
//     model->tokens.insert(model->tokens.end(), new_tokens->begin(), new_tokens->end());

//     return true;
// }


bool model2vec_add_tokens(model2Vec *model, void *tokens, size_t count)
{
    logBMessage("Inside add tokens");

    // Validate inputs
    if (!model || !tokens || count == 0)
    {
        logBMessage("Failed to add tokens: invalid arguments");
        return false;
    }

    try
    {
        // Cast tokens to the correct type
        auto *new_tokens = static_cast<std::vector<std::string> *>(tokens);

        // Ensure the size matches the expected count
        if (new_tokens->size() != count)
        {
            logBMessage("Token count mismatch: expected %zu, got %zu", count, new_tokens->size());
            // return false;
        }

        // Insert the tokens into the model
        // size_t test_limit = std::min<size_t>(1000, count);
        model->tokens.insert(model->tokens.end(), new_tokens->begin(), new_tokens->end());
    }
    catch (const std::exception &e)
    {
        logBMessage("Error adding tokens: %s", e.what());
        return false;
    }

    logBMessage("Tokens added successfully");
    return true;
}


// bool model2vec_add_embeddings(model2Vec *model, float** embeddings, size_t count, int model_embedding_size)
// {
//     logBMessage("Adding Embeddings");
//     if (!model || !embeddings || count == 0 || model_embedding_size <= 0) {
//         logBMessage("Failed to add embeddings: invalid arguments");
//         return false;
//     }

//     try {
//         for (size_t i = 0; i < count; ++i) {
//             if (embeddings[i] == nullptr) {
//                 logBMessage("Failed to add embeddings: null embedding at index %d", i);
//                 // return false;
//             }

//             // Directly construct and insert into model->embeddings
//             vectorf vec(model_embedding_size); // Creates a vectorf with the specified size
//             std::memcpy(vec.data.data(), embeddings[i], model_embedding_size * sizeof(float));

//             // Append to the model's embeddings vector
//             model->embeddings.push_back(std::move(vec));
//         }
//     } catch (const std::exception& e) {
//         logBMessage("Error adding embeddings: %s", e.what());
//         return false;
//     }

//     logBMessage("Embeddings added successfully");
//     return true;
// }


bool model2vec_add_embeddings(model2Vec *model, float **embeddings, size_t count, int model_embedding_size)
{
    logBMessage("Adding Embeddings");

    // Validate inputs
    if (!model || !embeddings || count == 0 || model_embedding_size <= 0)
    {
        logBMessage("Failed to add embeddings: invalid arguments");
        return false;
    }

    try
    {
        for (size_t i = 0; i < count; ++i)
        {
            if (embeddings[i] == nullptr)
            {
                // logBMessage("Warning: Null embedding at index %zu, using zero vector", i);

                // Use a zero vector as a placeholder for null embeddings
                vectorf zero_vector(model_embedding_size, 0.0f);
                model->embeddings.push_back(std::move(zero_vector));
                continue;
            }

            // Construct a vectorf from the embedding
            vectorf vec(model_embedding_size);
            std::memcpy(vec.data.data(), embeddings[i], model_embedding_size * sizeof(float));

            // Append to the model's embeddings vector
            model->embeddings.push_back(std::move(vec));
        }
    }
    catch (const std::exception &e)
    {
        logBMessage("Error adding embeddings: %s", e.what());
        return false;
    }

    logBMessage("Embeddings added successfully");
    return true;
}
