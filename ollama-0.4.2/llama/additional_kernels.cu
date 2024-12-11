#include <cuda_runtime.h>
#include <cmath>

// Kernel to compute the mean vector
__global__ void computeMeanKernel(const float *embeddings, float *mean, size_t embedding_count, size_t embedding_dim) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < embedding_dim) {
        float sum = 0.0f;
        for (size_t i = 0; i < embedding_count; ++i) {
            sum += embeddings[i * embedding_dim + idx];
        }
        mean[idx] = sum;
    }
}

// Kernel to center the data
__global__ void centerDataKernel(const float *embeddings, const float *mean, float *centered_data, size_t embedding_count, size_t embedding_dim) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < embedding_count * embedding_dim) {
        int dim_idx = idx % embedding_dim;
        centered_data[idx] = embeddings[idx] - mean[dim_idx];
    }
}

// Kernel to generate Zipf weights
__global__ void generateZipfWeightsKernel(float *zipf_weights, size_t count) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < count) {
        zipf_weights[idx] = log1p(idx + 1);
    }
}

// Kernel to apply Zipf weights to embeddings
__global__ void applyZipfWeightsKernel(float *embeddings, const float *zipf_weights, size_t embedding_count, size_t embedding_dim) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < embedding_count * embedding_dim) {
        int embedding_idx = idx / embedding_dim;
        embeddings[idx] *= zipf_weights[embedding_idx];
    }
}
