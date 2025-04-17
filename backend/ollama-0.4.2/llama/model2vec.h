#ifndef MODEL2VEC_H
#define MODEL2VEC_H

#include <vector>
#include <string>
#include <stdexcept>

// Struct representing a vector
struct vectorf
{
    std::vector<float> data;

    explicit vectorf(size_t size);
    vectorf(): data() {}
    //  vectorf(size_t size, float value = 0.0f) : data(size, value) {}

    void normalize();

    vectorf(size_t size, float default_value) : data(size, default_value) {}

    template <typename InputIt>
    vectorf(InputIt first, InputIt last) : data(first, last) {}

    float &operator[](size_t idx) { return data[idx]; }
    const float &operator[](size_t idx) const { return data[idx]; }
};

// Struct representing a matrix
struct matrix
{
    size_t row_count;
    size_t col_count;
    std::vector<vectorf> rows;

    matrix(size_t rows, size_t cols);
    matrix(const std::vector<vectorf> &vectors);

    matrix transpose() const;
    matrix multiply(const matrix &other) const;
};

// Struct representing the Model2Vec
// model2Vec class
struct model2Vec {
    int embedding_dim;
    bool apply_zipf;
    int pca_components;
    std::vector<std::string> tokens;
    std::vector<vectorf> embeddings;
    std::vector<vectorf> distilledEmbeddings;
    matrix pca_matrix;

    model2Vec(int dim, bool zipf, int pca)
        : embedding_dim(dim), apply_zipf(zipf), pca_components(pca), pca_matrix(0, 0) {}

    void initialize(const matrix &precomputed_embeddings, const std::vector<std::string> &token_list);
    void distill(model2Vec *model);
    matrix applyPCA(const matrix &covariance);
    void applyZipfWeighting();
    void save_to_file(const std::string &filepath) const;
    static model2Vec *load_from_file(const std::string &filepath);
    vectorf apply_zipf_weighting(const vectorf&, int) const;
    vectorf apply_pca(const vectorf&) const;
    static vectorf *get_embedding_by_token_id(const std::string &filepath, int token_id);
    bool load_token_by_id(const std::string &filepath, int token_id, std::string &token, vectorf &embedding);

private:
    vectorf computeMean(const std::vector<vectorf> &embeddings);
    matrix centerData(const std::vector<vectorf> &embeddings, const vectorf &mean);
    matrix computeCovariance(const matrix &centered_data);
};

// struct model2Vec
// {
//     int embedding_dim;
//     bool apply_zipf;
//     int pca_components;
//     matrix pca_matrix;
//     std::vector<std::string> tokens;
//     std::vector<vectorf> embeddings;
//     std::vector<vectorf> distilledEmbeddings;

//     model2Vec(int dim, bool zipf, int pca);

//     void initialize(const matrix &precomputed_embeddings, const std::vector<std::string> &token_list);
//     void distill(model2Vec *model);
//     vectorf apply_pca(const vectorf &embedding) const;
//     vectorf apply_zipf_weighting(const vectorf &embedding, int rank) const;
//     void save_to_file(const std::string &filepath) const;
//     static model2Vec *load_from_file(const std::string &filepath);
//     // matrix apply_pca(const matrix &embeddings, int pca_dims);
//     // matrix post_process_embeddings(const matrix &embeddings, int pca_dims, bool apply_zipf);
// };

void logBMessage(const char *format, ...);
#endif // MODEL2VEC_H
