
// #include <vector>
// #include <string>
// #include <cmath>
// #include <iostream>
// #include <fstream>
// #include <sstream>
// #include <stdexcept>
// #include <algorithm>
// #include <numeric>
// #include <random>
// #include <cstdarg>
// #include <thread>
// #include <mutex>
// #include <future>
// #include <iomanip>
// #include <model2vec.h>

// #define USE_CUDA
// #define USE_METAL


// // Include GPU-specific headers if applicable
// #ifdef USE_CUDA
// #include <cuda_runtime.h>
// #include <cublas_v2.h>
// #include <cusolverDn.h>
// #elif defined(USE_METAL)
// #include <Metal/Metal.hpp>
// #endif


// // Declare external CUDA kernel functions
// extern __global__ void computeMeanKernel(const float *embeddings, float *mean, size_t embedding_count, size_t embedding_dim);
// extern __global__ void centerDataKernel(const float *embeddings, const float *mean, float *centered_data, size_t embedding_count, size_t embedding_dim);
// extern __global__ void generateZipfWeightsKernel(float *zipf_weights, size_t count);
// extern __global__ void applyZipfWeightsKernel(float *embeddings, const float *zipf_weights, size_t embedding_count, size_t embedding_dim);


// // Logging function
// void logBMessage(const char *format, ...) {
//     static FILE *logFile = fopen("./log.txt", "a");
//     if (!logFile) {
//         fprintf(stderr, "Error opening log file.\n");
//         return;
//     }

//     va_list args;
//     va_start(args, format);
//     vfprintf(logFile, format, args);
//     fprintf(logFile, "\n");
//     va_end(args);

//     fflush(logFile);
// }

// // vectorf and matrix structures
// vectorf::vectorf(size_t size) : data(size, 0.0f)
// {
//     logBMessage("Calling from %s, model2vec.cpp", __func__);
// }


// void vectorf::normalize()
// {
//     logBMessage("Calling from %s, model2vec.cpp", __func__);
//     float norm = std::sqrt(std::inner_product(data.begin(), data.end(), data.begin(), 0.0f));
//     if (norm > 0)
//     {
//         for (auto &val : data)
//         {
//             val /= norm;
//         }
//     }
// }

// // Implementation of matrix methods
// matrix::matrix(size_t rows, size_t cols) : row_count(rows), col_count(cols), rows(rows, vectorf(cols))
// {
//     logBMessage("Calling from %s, model2vec.cpp", __func__);
// }

// matrix::matrix(const std::vector<vectorf> &vectors)
//     : row_count(vectors.size()),
//       col_count(vectors.empty() ? 0 : vectors[0].data.size()),
//       rows(vectors)
// {
//     logBMessage("Calling from %s, model2vec.cpp", __func__);
// }

// matrix matrix::transpose() const
// {
//     logBMessage("Calling from %s, model2vec.cpp", __func__);
//     matrix result(col_count, row_count);
//     for (size_t i = 0; i < row_count; ++i)
//     {
//         for (size_t j = 0; j < col_count; ++j)
//         {
//             result.rows[j].data[i] = rows[i].data[j];
//         }
//     }
//     return result;
// }

// matrix matrix::multiply(const matrix &other) const
// {
//     logBMessage("Calling from %s, model2vec.cpp", __func__);
//     if (col_count != other.row_count)
//     {
//         throw std::invalid_argument("matrix dimension mismatch for multiplication");
//     }

//     matrix result(row_count, other.col_count);
//     for (size_t i = 0; i < row_count; ++i)
//     {
//         for (size_t j = 0; j < other.col_count; ++j)
//         {
//             for (size_t k = 0; k < col_count; ++k)
//             {
//                 result.rows[i].data[j] += rows[i].data[k] * other.rows[k].data[j];
//             }
//         }
//     }
//     return result;
// }



// // Function Implementations
// void model2Vec::initialize(const matrix &precomputed_embeddings, const std::vector<std::string> &token_list) {
//     if (precomputed_embeddings.row_count != token_list.size())
//         throw std::invalid_argument("Mismatch between embeddings and tokens size");
//     tokens = token_list;
//     embeddings.reserve(token_list.size());
//     for (size_t i = 0; i < precomputed_embeddings.row_count; ++i)
//         embeddings.push_back(precomputed_embeddings.rows[i]);
// }

// vectorf model2Vec::computeMean(const std::vector<vectorf> &embeddings) {
//     logBMessage("computeMean: Starting computation for %zu embeddings of dimension %d", embeddings.size(), embedding_dim);

//     vectorf mean_vector(embedding_dim, 0.0f);

// #ifdef USE_CUDA
//     logBMessage("computeMean: Using CUDA backend for mean computation.");

//     float *d_embeddings, *d_mean;
//     size_t embedding_count = embeddings.size();

//     // Allocate memory
//     cudaMalloc(&d_embeddings, embedding_count * embedding_dim * sizeof(float));
//     cudaMalloc(&d_mean, embedding_dim * sizeof(float));
//     cudaMemset(d_mean, 0, embedding_dim * sizeof(float));

//     // Flatten embeddings for GPU
//     std::vector<float> flattened_embeddings;
//     for (const auto &vec : embeddings)
//         flattened_embeddings.insert(flattened_embeddings.end(), vec.data.begin(), vec.data.end());

//     cudaMemcpy(d_embeddings, flattened_embeddings.data(),
//                embedding_count * embedding_dim * sizeof(float), cudaMemcpyHostToDevice);

//     logBMessage("computeMean: Data transferred to GPU, launching kernel.");

//     // Launch CUDA kernel
//     int blockSize = 256;
//     int gridSize = (embedding_dim + blockSize - 1) / blockSize;
//     computeMeanKernel<<<gridSize, blockSize>>>(d_embeddings, d_mean, embedding_count, embedding_dim);
//     cudaDeviceSynchronize();

//     logBMessage("computeMean: CUDA kernel execution completed.");

//     cudaMemcpy(mean_vector.data.data(), d_mean, embedding_dim * sizeof(float), cudaMemcpyDeviceToHost);

//     logBMessage("computeMean: Results copied to host.");

//     // Normalize mean vector
//     for (size_t i = 0; i < embedding_dim; ++i)
//         mean_vector[i] /= embedding_count;

//     cudaFree(d_embeddings);
//     cudaFree(d_mean);
// #elif defined(USE_METAL)
//     logBMessage("computeMean: Using Metal backend for mean computation.");

//     // Metal implementation for mean vector
//     id<MTLDevice> device = MTLCreateSystemDefaultDevice();
//     id<MTLCommandQueue> commandQueue = [device newCommandQueue];

//     logBMessage("computeMean: Preparing Metal buffers.");

//     std::vector<float> flattened_embeddings;
//     for (const auto &vec : embeddings)
//         flattened_embeddings.insert(flattened_embeddings.end(), vec.data.begin(), vec.data.end());

//     id<MTLBuffer> dataBuffer = [device newBufferWithBytes:flattened_embeddings.data()
//                                                    length:flattened_embeddings.size() * sizeof(float)
//                                                   options:MTLResourceStorageModeShared];
//     id<MTLBuffer> meanBuffer = [device newBufferWithLength:embedding_dim * sizeof(float)
//                                                    options:MTLResourceStorageModeShared];

//     id<MTLLibrary> library = [device newDefaultLibrary];
//     id<MTLFunction> function = [library newFunctionWithName:@"computeMean"];
//     id<MTLComputePipelineState> pipelineState = [device newComputePipelineStateWithFunction:function error:nil];

//     id<MTLCommandBuffer> commandBuffer = [commandQueue commandBuffer];
//     id<MTLComputeCommandEncoder> encoder = [commandBuffer computeCommandEncoder];

//     logBMessage("computeMean: Setting Metal pipeline and dispatching threads.");

//     [encoder setComputePipelineState:pipelineState];
//     [encoder setBuffer:dataBuffer offset:0 atIndex:0];
//     [encoder setBuffer:meanBuffer offset:0 atIndex:1];
//     int threadsPerGroup = 256;
//     MTLSize threadsPerThreadgroup = MTLSizeMake(threadsPerGroup, 1, 1);
//     MTLSize threadgroups = MTLSizeMake((embedding_dim + threadsPerGroup - 1) / threadsPerGroup, 1, 1);
//     [encoder dispatchThreadgroups:threadgroups threadsPerThreadgroup:threadsPerThreadgroup];
//     [encoder endEncoding];
//     [commandBuffer commit];
//     [commandBuffer waitUntilCompleted];

//     logBMessage("computeMean: Metal kernel execution completed.");

//     float *meanData = static_cast<float *>([meanBuffer contents]);
//     for (size_t i = 0; i < embedding_dim; ++i)
//         mean_vector[i] = meanData[i] / embeddings.size();

// #else
//     logBMessage("computeMean: Using CPU backend for mean computation.");

//     // CPU fallback
//     size_t count = embeddings.size();
//     for (const auto &embedding : embeddings) {
//         for (size_t j = 0; j < embedding_dim; ++j) {
//             mean_vector[j] += embedding[j];
//         }
//     }

//     logBMessage("computeMean: Summed values for mean computation.");

//     for (size_t j = 0; j < embedding_dim; ++j) {
//         mean_vector[j] /= count;
//     }

//     logBMessage("computeMean: Mean vector computed.");
// #endif

//     logBMessage("computeMean: Completed mean computation.");
//     return mean_vector;
// }


// matrix model2Vec::centerData(const std::vector<vectorf> &embeddings, const vectorf &mean) {
//     logBMessage("centerData: Starting centering for %zu embeddings of dimension %d", embeddings.size(), embedding_dim);

//     matrix centered_data(embeddings.size(), embedding_dim);

// #ifdef USE_CUDA
//     logBMessage("centerData: Using CUDA backend.");

//     size_t embedding_count = embeddings.size();

//     float *d_embeddings, *d_mean, *d_centered_data;
//     cudaMalloc(&d_embeddings, embedding_count * embedding_dim * sizeof(float));
//     cudaMalloc(&d_mean, embedding_dim * sizeof(float));
//     cudaMalloc(&d_centered_data, embedding_count * embedding_dim * sizeof(float));

//     std::vector<float> flattened_embeddings;
//     for (const auto &vec : embeddings)
//         flattened_embeddings.insert(flattened_embeddings.end(), vec.data.begin(), vec.data.end());

//     cudaMemcpy(d_embeddings, flattened_embeddings.data(),
//                embedding_count * embedding_dim * sizeof(float), cudaMemcpyHostToDevice);
//     cudaMemcpy(d_mean, mean.data.data(), embedding_dim * sizeof(float), cudaMemcpyHostToDevice);

//     logBMessage("centerData: Data transferred to GPU.");

//     int blockSize = 256;
//     int gridSize = (embedding_count * embedding_dim + blockSize - 1) / blockSize;
//     centerDataKernel<<<gridSize, blockSize>>>(d_embeddings, d_mean, d_centered_data, embedding_count, embedding_dim);
//     cudaDeviceSynchronize();

//     logBMessage("centerData: CUDA kernel execution completed.");

//     cudaMemcpy(centered_data.rows.data()->data.data(), d_centered_data,
//                embedding_count * embedding_dim * sizeof(float), cudaMemcpyDeviceToHost);

//     cudaFree(d_embeddings);
//     cudaFree(d_mean);
//     cudaFree(d_centered_data);

//     logBMessage("centerData: Data centering completed.");

// #elif defined(USE_METAL)
//     logBMessage("centerData: Using Metal backend.");

//     size_t embedding_count = embeddings.size();
//     matrix centered_data(embedding_count, embedding_dim);

//     id<MTLDevice> device = MTLCreateSystemDefaultDevice();
//     id<MTLCommandQueue> commandQueue = [device newCommandQueue];

//     logBMessage("centerData: Preparing Metal buffers.");

//     // Flatten embeddings
//     std::vector<float> flattened_embeddings;
//     for (const auto &vec : embeddings)
//         flattened_embeddings.insert(flattened_embeddings.end(), vec.data.begin(), vec.data.end());

//     id<MTLBuffer> dataBuffer = [device newBufferWithBytes:flattened_embeddings.data()
//                                                    length:flattened_embeddings.size() * sizeof(float)
//                                                   options:MTLResourceStorageModeShared];
//     id<MTLBuffer> meanBuffer = [device newBufferWithBytes:mean.data.data()
//                                                    length:mean.data.size() * sizeof(float)
//                                                   options:MTLResourceStorageModeShared];
//     id<MTLBuffer> centeredBuffer = [device newBufferWithLength:flattened_embeddings.size() * sizeof(float)
//                                                        options:MTLResourceStorageModeShared];

//     logBMessage("centerData: Metal buffers created, preparing kernel execution.");

//     // Metal kernel to center data
//     id<MTLLibrary> library = [device newDefaultLibrary];
//     id<MTLFunction> function = [library newFunctionWithName:@"centerData"];
//     id<MTLComputePipelineState> pipelineState = [device newComputePipelineStateWithFunction:function error:nil];

//     id<MTLCommandBuffer> commandBuffer = [commandQueue commandBuffer];
//     id<MTLComputeCommandEncoder> encoder = [commandBuffer computeCommandEncoder];
//     [encoder setComputePipelineState:pipelineState];
//     [encoder setBuffer:dataBuffer offset:0 atIndex:0];
//     [encoder setBuffer:meanBuffer offset:0 atIndex:1];
//     [encoder setBuffer:centeredBuffer offset:0 atIndex:2];

//     int threadsPerGroup = 256;
//     MTLSize threadsPerThreadgroup = MTLSizeMake(threadsPerGroup, 1, 1);
//     MTLSize threadgroups = MTLSizeMake((embedding_count * embedding_dim + threadsPerGroup - 1) / threadsPerGroup, 1, 1);
//     [encoder dispatchThreadgroups:threadgroups threadsPerThreadgroup:threadsPerThreadgroup];
//     [encoder endEncoding];
//     [commandBuffer commit];
//     [commandBuffer waitUntilCompleted];

//     logBMessage("centerData: Metal kernel execution completed.");

//     // Copy results back
//     float *centeredData = static_cast<float *>([centeredBuffer contents]);
//     for (size_t i = 0; i < embedding_count; ++i)
//         std::copy(centeredData + i * embedding_dim, centeredData + (i + 1) * embedding_dim, centered_data.rows[i].data.begin());

//     logBMessage("centerData: Results copied from Metal buffer to host.");

// #else
//     logBMessage("centerData: Using CPU backend for centering data.");

//     // CPU fallback
//     for (size_t i = 0; i < embeddings.size(); ++i)
//         for (size_t j = 0; j < embedding_dim; ++j)
//             centered_data.rows[i][j] = embeddings[i][j] - mean[j];

//     logBMessage("centerData: CPU centering computation completed.");
// #endif

//     logBMessage("centerData: Completed centering computation.");
//     return centered_data;
// }


// matrix model2Vec::computeCovariance(const matrix &centered_data) {
//     matrix covariance(embedding_dim, embedding_dim);
// #ifdef USE_CUDA
//     // CUDA implementation for covariance
//     logBMessage("computeCovariance: Using CUDA backend.");

//     float *d_centered_data, *d_covariance;
//     cudaMalloc(&d_centered_data, centered_data.row_count * embedding_dim * sizeof(float));
//     cudaMalloc(&d_covariance, embedding_dim * embedding_dim * sizeof(float));

//     std::vector<float> flattened_data;
//     for (const auto &row : centered_data.rows)
//         flattened_data.insert(flattened_data.end(), row.data.begin(), row.data.end());

//     cudaMemcpy(d_centered_data, flattened_data.data(),
//                centered_data.row_count * embedding_dim * sizeof(float), cudaMemcpyHostToDevice);

//     cublasHandle_t handle;
//     cublasCreate(&handle);

//     const float alpha = 1.0f / (centered_data.row_count - 1);
//     const float beta = 0.0f;

//     cublasSgemm(handle, CUBLAS_OP_T, CUBLAS_OP_N, embedding_dim, embedding_dim, centered_data.row_count,
//                 &alpha, d_centered_data, embedding_dim, d_centered_data, embedding_dim, &beta, d_covariance, embedding_dim);

//     cudaMemcpy(covariance.rows.data()->data.data(), d_covariance,
//                embedding_dim * embedding_dim * sizeof(float), cudaMemcpyDeviceToHost);

//     cudaFree(d_centered_data);
//     cudaFree(d_covariance);
//     cublasDestroy(handle);

//     logBMessage("computeCovariance: CUDA computation completed.");
// #elif defined(USE_METAL)
//     // Metal implementation for covariance
//      size_t n = centered_data.row_count;
//     matrix covariance(embedding_dim, embedding_dim);

//     id<MTLDevice> device = MTLCreateSystemDefaultDevice();
//     id<MTLCommandQueue> commandQueue = [device newCommandQueue];

//     // Flatten centered data
//     std::vector<float> flattened_data;
//     for (const auto &vec : centered_data.rows)
//         flattened_data.insert(flattened_data.end(), vec.data.begin(), vec.data.end());

//     id<MTLBuffer> dataBuffer = [device newBufferWithBytes:flattened_data.data()
//                                                    length:flattened_data.size() * sizeof(float)
//                                                   options:MTLResourceStorageModeShared];
//     id<MTLBuffer> covarianceBuffer = [device newBufferWithLength:embedding_dim * embedding_dim * sizeof(float)
//                                                           options:MTLResourceStorageModeShared];

//     id<MTLLibrary> library = [device newDefaultLibrary];
//     id<MTLFunction> function = [library newFunctionWithName:@"computeCovariance"];
//     id<MTLComputePipelineState> pipelineState = [device newComputePipelineStateWithFunction:function error:nil];

//     id<MTLCommandBuffer> commandBuffer = [commandQueue commandBuffer];
//     id<MTLComputeCommandEncoder> encoder = [commandBuffer computeCommandEncoder];
//     [encoder setComputePipelineState:pipelineState];
//     [encoder setBuffer:dataBuffer offset:0 atIndex:0];
//     [encoder setBuffer:covarianceBuffer offset:0 atIndex:1];
//     [encoder setThreadgroupsPerGrid:MTLSizeMake((embedding_dim + 255) / 256, 1, 1)];
//     [encoder dispatchThreadgroups:MTLSizeMake((embedding_dim + 255) / 256, 1, 1) threadsPerThreadgroup:MTLSizeMake(256, 1, 1)];
//     [encoder endEncoding];

//     [commandBuffer commit];
//     [commandBuffer waitUntilCompleted];

//     // Copy results back
//     float *covarianceData = static_cast<float *>([covarianceBuffer contents]);
//     for (size_t i = 0; i < embedding_dim; ++i)
//         std::copy(covarianceData + i * embedding_dim, covarianceData + (i + 1) * embedding_dim, covariance.rows[i].data.begin());

//     return covariance;
// #else
//     // CPU fallback
//     size_t n = centered_data.row_count;
//     for (size_t i = 0; i < embedding_dim; ++i)
//         for (size_t j = 0; j < embedding_dim; ++j) {
//             for (size_t k = 0; k < n; ++k)
//                 covariance.rows[i][j] += centered_data.rows[k][i] * centered_data.rows[k][j];
//             covariance.rows[i][j] /= (n - 1);
//         }
// #endif
//     return covariance;
// }

// // matrix model2Vec::computeCovariance(const matrix &centered_data) {
// //     matrix covariance(embedding_dim, embedding_dim);
// // #ifdef USE_CUDA
// //     // CUDA implementation of covariance computation
// // #elif defined(USE_METAL)
// //     // Metal implementation of covariance computation
// // #else
// //     // CPU fallback
// //     size_t n = centered_data.row_count;
// //     for (size_t i = 0; i < embedding_dim; ++i)
// //         for (size_t j = 0; j < embedding_dim; ++j) {
// //             for (size_t k = 0; k < n; ++k)
// //                 covariance.rows[i][j] += centered_data.rows[k][i] * centered_data.rows[k][j];
// //             covariance.rows[i][j] /= (n - 1);
// //         }
// // #endif
// //     return covariance;
// // }

// matrix model2Vec::applyPCA(const matrix &covariance) {
//     logBMessage("applyPCA: Starting PCA computation for a covariance matrix with dimensions %zu x %zu",
//                 covariance.row_count, covariance.col_count);

//     matrix pca_matrix(pca_components, embedding_dim);

// #ifdef USE_CUDA
//     logBMessage("applyPCA: Using CUDA backend for PCA.");

//     // Allocate memory on GPU
//     float *d_covariance, *d_eigenvalues, *d_eigenvectors, *d_workspace;
//     int *devInfo;
//     size_t workspace_size;

//     cudaMalloc(&d_covariance, embedding_dim * embedding_dim * sizeof(float));
//     cudaMalloc(&d_eigenvalues, embedding_dim * sizeof(float));
//     cudaMalloc(&d_eigenvectors, embedding_dim * embedding_dim * sizeof(float));
//     cudaMalloc(&devInfo, sizeof(int));

//     logBMessage("applyPCA: Allocated GPU memory for covariance matrix, eigenvalues, and eigenvectors.");

//     // Copy covariance matrix to GPU
//     cudaMemcpy(d_covariance, covariance.rows.data()->data.data(),
//                embedding_dim * embedding_dim * sizeof(float), cudaMemcpyHostToDevice);

//     logBMessage("applyPCA: Covariance matrix copied to GPU.");

//     // Create cuSolver handle and query workspace size
//     cusolverDnHandle_t cusolver_handle;
//     cusolverDnCreate(&cusolver_handle);
//     cusolverDnSsyevd_bufferSize(cusolver_handle, CUSOLVER_EIG_MODE_VECTOR, CUBLAS_FILL_MODE_LOWER,
//                                 embedding_dim, d_covariance, embedding_dim, d_eigenvalues, &workspace_size);

//     cudaMalloc(&d_workspace, workspace_size * sizeof(float));

//     logBMessage("applyPCA: cuSolver handle created and workspace size queried.");

//     // Compute eigenvalues and eigenvectors
//     cusolverDnSsyevd(cusolver_handle, CUSOLVER_EIG_MODE_VECTOR, CUBLAS_FILL_MODE_LOWER,
//                      embedding_dim, d_covariance, embedding_dim, d_eigenvalues, d_workspace, workspace_size, devInfo);

//     logBMessage("applyPCA: Eigenvalues and eigenvectors computation completed on GPU.");

//     // Copy eigenvectors to CPU
//     cudaMemcpy(pca_matrix.rows.data()->data.data(), d_covariance,
//                pca_components * embedding_dim * sizeof(float), cudaMemcpyDeviceToHost);

//     logBMessage("applyPCA: Eigenvectors copied from GPU to host.");

//     // Clean up
//     cudaFree(d_covariance);
//     cudaFree(d_eigenvalues);
//     cudaFree(d_eigenvectors);
//     cudaFree(d_workspace);
//     cudaFree(devInfo);
//     cusolverDnDestroy(cusolver_handle);

//     logBMessage("applyPCA: GPU resources freed.");

// #elif defined(USE_METAL)
//     logBMessage("applyPCA: Using Metal backend for PCA.");

//     id<MTLDevice> device = MTLCreateSystemDefaultDevice();
//     id<MTLCommandQueue> commandQueue = [device newCommandQueue];

//     logBMessage("applyPCA: Preparing Metal buffers.");

//     // Flatten covariance matrix
//     std::vector<float> flattened_covariance;
//     for (const auto &row : covariance.rows)
//         flattened_covariance.insert(flattened_covariance.end(), row.data.begin(), row.data.end());

//     id<MTLBuffer> covarianceBuffer = [device newBufferWithBytes:flattened_covariance.data()
//                                                          length:flattened_covariance.size() * sizeof(float)
//                                                         options:MTLResourceStorageModeShared];
//     id<MTLBuffer> eigenvectorsBuffer = [device newBufferWithLength:embedding_dim * embedding_dim * sizeof(float)
//                                                            options:MTLResourceStorageModeShared];
//     id<MTLBuffer> eigenvaluesBuffer = [device newBufferWithLength:embedding_dim * sizeof(float)
//                                                           options:MTLResourceStorageModeShared];

//     logBMessage("applyPCA: Metal buffers created for covariance matrix and eigenvalues/eigenvectors.");

//     MPSMatrixDescriptor *desc = [MPSMatrixDescriptor matrixDescriptorWithRows:embedding_dim
//                                                                        columns:embedding_dim
//                                                                        rowBytes:embedding_dim * sizeof(float)
//                                                                        dataType:MPSDataTypeFloat32];
//     MPSMatrix *covarianceMatrix = [[MPSMatrix alloc] initWithBuffer:covarianceBuffer descriptor:desc];
//     MPSMatrix *eigenvectorsMatrix = [[MPSMatrix alloc] initWithBuffer:eigenvectorsBuffer descriptor:desc];
//     MPSMatrixDecomposition *decomposition = [[MPSMatrixDecomposition alloc] initWithDevice:device];

//     logBMessage("applyPCA: Metal matrix decomposition initialized.");

//     [decomposition factorizeMatrix:covarianceMatrix
//                    intoEigenvalues:eigenvaluesBuffer
//                    andEigenvectors:eigenvectorsMatrix];

//     logBMessage("applyPCA: Eigenvalues and eigenvectors computation completed on Metal.");

//     // Copy eigenvectors to pca_matrix
//     float *eigenvectorsData = static_cast<float *>([eigenvectorsBuffer contents]);
//     for (int i = 0; i < pca_components; ++i)
//         for (size_t j = 0; j < embedding_dim; ++j)
//             pca_matrix.rows[i][j] = eigenvectorsData[i * embedding_dim + j];

//     logBMessage("applyPCA: Eigenvectors copied from Metal buffer to host.");

// #else
//     logBMessage("applyPCA: Using CPU backend for PCA computation.");

//     // Simplified PCA (use top rows of covariance)
//     for (int i = 0; i < pca_components; ++i)
//         for (size_t j = 0; j < embedding_dim; ++j)
//             pca_matrix.rows[i][j] = covariance.rows[i][j];

//     logBMessage("applyPCA: CPU computation of PCA completed.");
// #endif

//     logBMessage("applyPCA: PCA computation completed.");
//     return pca_matrix;
// }


// void model2Vec::applyZipfWeighting() {
//     logBMessage("applyZipfWeighting: Starting Zipf weighting for %zu embeddings of dimension %d",
//                 distilledEmbeddings.size(), embedding_dim);

// #ifdef USE_CUDA
//     logBMessage("applyZipfWeighting: Using CUDA backend.");

//     size_t embedding_count = distilledEmbeddings.size();
//     float *d_embeddings, *d_zipf_weights;

//     // Allocate GPU memory
//     cudaMalloc(&d_embeddings, embedding_count * embedding_dim * sizeof(float));
//     cudaMalloc(&d_zipf_weights, embedding_count * sizeof(float));

//     logBMessage("applyZipfWeighting: Allocated GPU memory.");

//     // Copy embeddings to GPU
//     cudaMemcpy(d_embeddings, distilledEmbeddings.data()->data.data(),
//                embedding_count * embedding_dim * sizeof(float), cudaMemcpyHostToDevice);

//     logBMessage("applyZipfWeighting: Embeddings copied to GPU.");

//     // Generate Zipf weights on GPU
//     int blockSize = 256;
//     int gridSize = (embedding_count + blockSize - 1) / blockSize;
//     generateZipfWeightsKernel<<<gridSize, blockSize>>>(d_zipf_weights, embedding_count);

//     logBMessage("applyZipfWeighting: Zipf weights generated on GPU.");

//     // Apply weights to embeddings
//     applyZipfWeightsKernel<<<gridSize, blockSize>>>(d_embeddings, d_zipf_weights, embedding_count, embedding_dim);
//     cudaDeviceSynchronize();

//     logBMessage("applyZipfWeighting: Weights applied to embeddings on GPU.");

//     // Copy results back to CPU
//     cudaMemcpy(distilledEmbeddings.data()->data.data(), d_embeddings,
//                embedding_count * embedding_dim * sizeof(float), cudaMemcpyDeviceToHost);

//     logBMessage("applyZipfWeighting: Results copied from GPU to host.");

//     cudaFree(d_embeddings);
//     cudaFree(d_zipf_weights);

//     logBMessage("applyZipfWeighting: GPU resources freed.");

// #elif defined(USE_METAL)
//     logBMessage("applyZipfWeighting: Using Metal backend.");

//     size_t embedding_count = distilledEmbeddings.size();

//     id<MTLDevice> device = MTLCreateSystemDefaultDevice();
//     id<MTLCommandQueue> commandQueue = [device newCommandQueue];

//     logBMessage("applyZipfWeighting: Preparing Metal buffers.");

//     // Flatten embeddings
//     std::vector<float> flattened_embeddings;
//     for (const auto &vec : distilledEmbeddings)
//         flattened_embeddings.insert(flattened_embeddings.end(), vec.data.begin(), vec.data.end());

//     id<MTLBuffer> embeddingsBuffer = [device newBufferWithBytes:flattened_embeddings.data()
//                                                          length:flattened_embeddings.size() * sizeof(float)
//                                                         options:MTLResourceStorageModeShared];
//     id<MTLBuffer> zipfWeightsBuffer = [device newBufferWithLength:embedding_count * sizeof(float)
//                                                           options:MTLResourceStorageModeShared];

//     logBMessage("applyZipfWeighting: Metal buffers created.");

//     // Metal kernel to compute Zipf weights and apply them
//     id<MTLLibrary> library = [device newDefaultLibrary];
//     id<MTLFunction> function = [library newFunctionWithName:@"applyZipfWeights"];
//     id<MTLComputePipelineState> pipelineState = [device newComputePipelineStateWithFunction:function error:nil];

//     id<MTLCommandBuffer> commandBuffer = [commandQueue commandBuffer];
//     id<MTLComputeCommandEncoder> encoder = [commandBuffer computeCommandEncoder];
//     [encoder setComputePipelineState:pipelineState];
//     [encoder setBuffer:embeddingsBuffer offset:0 atIndex:0];
//     [encoder setBuffer:zipfWeightsBuffer offset:0 atIndex:1];
//     [encoder dispatchThreadgroups:MTLSizeMake((embedding_count + 255) / 256, 1, 1)
//               threadsPerThreadgroup:MTLSizeMake(256, 1, 1)];
//     [encoder endEncoding];
//     [commandBuffer commit];
//     [commandBuffer waitUntilCompleted];

//     logBMessage("applyZipfWeighting: Zipf weighting completed on Metal.");

//     // Copy results back
//     float *updatedEmbeddings = static_cast<float *>([embeddingsBuffer contents]);
//     for (size_t i = 0; i < embedding_count; ++i)
//         std::copy(updatedEmbeddings + i * embedding_dim, updatedEmbeddings + (i + 1) * embedding_dim,
//                   distilledEmbeddings[i].data.begin());

//     logBMessage("applyZipfWeighting: Results copied from Metal buffer to host.");

// #else
//     logBMessage("applyZipfWeighting: Using CPU backend.");

//     size_t count = distilledEmbeddings.size();
//     for (size_t i = 0; i < count; ++i) {
//         float weight = std::log1p(i + 1);
//         for (auto &val : distilledEmbeddings[i].data)
//             val *= weight;
//     }

//     logBMessage("applyZipfWeighting: CPU computation of Zipf weighting completed.");
// #endif

//     logBMessage("applyZipfWeighting: Zipf weighting completed for all embeddings.");
// }


// void model2Vec::distill(model2Vec *model) {
//     logBMessage("distill: Starting distillation for model with %zu embeddings of dimension %d",
//                 embeddings.size(), embedding_dim);

//     // Step 1: Compute mean vector
//     logBMessage("distill: Computing mean vector.");
//     vectorf mean_vector = computeMean(embeddings);
//     logBMessage("distill: Mean vector computed.");

//     // Step 2: Center data
//     logBMessage("distill: Centering data.");
//     matrix centered_data = centerData(embeddings, mean_vector);
//     logBMessage("distill: Data centered.");

//     // Step 3: Compute covariance
//     logBMessage("distill: Computing covariance matrix.");
//     matrix covariance = computeCovariance(centered_data);
//     logBMessage("distill: Covariance matrix computed.");

//     // Step 4: Apply PCA if necessary
//     if (pca_components > 0) {
//         logBMessage("distill: Applying PCA for dimensionality reduction.");
//         pca_matrix = applyPCA(covariance);

//         // Project data onto PCA components
//         logBMessage("distill: Projecting data onto PCA components.");
//         matrix reduced_data(centered_data.row_count, pca_components);
//         for (size_t i = 0; i < centered_data.row_count; ++i)
//             for (int j = 0; j < pca_components; ++j)
//                 for (size_t k = 0; k < embedding_dim; ++k)
//                     reduced_data.rows[i][j] += centered_data.rows[i][k] * pca_matrix.rows[j][k];

//         distilledEmbeddings = reduced_data.rows;
//         logBMessage("distill: Data projected onto PCA components.");
//     } else {
//         distilledEmbeddings = centered_data.rows;
//         logBMessage("distill: Using centered data without PCA.");
//     }

//     // Step 5: Apply Zipf weighting if enabled
//     if (apply_zipf) {
//         logBMessage("distill: Applying Zipf weighting.");
//         applyZipfWeighting();
//         logBMessage("distill: Zipf weighting applied.");
//     }

//     logBMessage("distill: Distillation process completed.");
// }






// // #include <string>

// std::string escapeJsonString(const std::string& input) {
//     std::string output;
//     for (char c : input) {
//         switch (c) {
//             case '"':  output += "\\\""; break;
//             case '\\': output += "\\\\"; break;
//             case '\b': output += "\\b"; break;
//             case '\f': output += "\\f"; break;
//             case '\n': output += "\\n"; break;
//             case '\r': output += "\\r"; break;
//             case '\t': output += "\\t"; break;
//             default:
//                 // For non-printable ASCII characters, use \uXXXX format
//                 if (c < 0x20 || c > 0x7E) {
//                     output += "\\u";
//                     char buffer[5];
//                     snprintf(buffer, sizeof(buffer), "%04x", c & 0xFF);
//                     output += buffer;
//                 } else {
//                     output += c;
//                 }
//                 break;
//         }
//     }
//     return output;
// }


// vectorf model2Vec::apply_pca(const vectorf &embedding) const
// {
//     logBMessage("Calling from %s, model2vec.cpp", __func__);
//     if (embedding.data.size() != embedding_dim)
//     {
//         throw std::invalid_argument("Embedding size mismatch for PCA");
//     }

//     vectorf result(pca_components);
//     for (int i = 0; i < pca_components; ++i)
//     {
//         for (size_t j = 0; j < embedding_dim; ++j)
//         {
//             result.data[i] += pca_matrix.rows[i].data[j] * embedding.data[j];
//         }
//     }
//     return result;
// }

// vectorf model2Vec::apply_zipf_weighting(const vectorf &embedding, int rank) const
// {
//     logBMessage("Calling from %s, model2vec.cpp", __func__);
//     if (embedding.data.size() != embedding_dim)
//     {
//         throw std::invalid_argument("Embedding size mismatch for Zipf weighting");
//     }

//     if (rank <= 0)
//     {
//         throw std::invalid_argument("Rank must be greater than 0");
//     }

//     vectorf result(embedding_dim);

//     // Calculate the Zipf weight using logarithmic scaling
//     float zipf_weight = std::log1p(rank); // log(1 + rank)
//     for (size_t i = 0; i < embedding_dim; ++i)
//     {
//         result.data[i] = embedding.data[i] * zipf_weight;
//     }

//     return result;
// }


// std::string escape_string(const std::string &input) {
//     std::ostringstream oss;
//     for (unsigned char c : input) {
//         if (c == '"' || c == '\\') {
//             oss << '\\' << c; // Escape double quotes and backslashes
//         } else if (std::isprint(c)) {
//             oss << c; // Printable ASCII characters
//         } else {
//             oss << "\\u" << std::hex << std::setw(4) << std::setfill('0') << (int)c;
//         }
//     }
//     return oss.str();
// }

// void model2Vec::save_to_file(const std::string &filepath) const {
//     std::ofstream outFile(filepath);
//     if (!outFile.is_open()) {
//         throw std::runtime_error("Failed to open file for saving");
//     }

//     logBMessage("Saving model data to file: %s", filepath.c_str());

//     outFile << "{\n";

//     // Save metadata
//     outFile << "  \"embedding_dim\": " << embedding_dim << ",\n";
//     outFile << "  \"pca_components\": " << pca_components << ",\n";
//     outFile << "  \"apply_zipf\": " << (apply_zipf ? "true" : "false") << ",\n";

//     // Save PCA matrix
//     outFile << "  \"pca_matrix\": {\n";
//     outFile << "    \"row_count\": " << pca_matrix.row_count << ",\n";
//     outFile << "    \"col_count\": " << pca_matrix.col_count << ",\n";
//     outFile << "    \"rows\": [\n";

//     for (size_t i = 0; i < pca_matrix.rows.size(); ++i) {
//         outFile << "      [";
//         for (size_t j = 0; j < pca_matrix.rows[i].data.size(); ++j) {
//             outFile << pca_matrix.rows[i].data[j];
//             if (j < pca_matrix.rows[i].data.size() - 1) outFile << ", ";
//         }
//         outFile << "]";
//         if (i < pca_matrix.rows.size() - 1) outFile << ",";
//         outFile << "\n";
//     }
//     outFile << "    ]\n";
//     outFile << "  },\n";

//     // Save tokens and embeddings
//     outFile << "  \"tokens\": [\n";
//     for (size_t i = 0; i < tokens.size(); ++i) {
//         outFile << "    {\n";
//         outFile << "      \"token\": \"" << escape_string(tokens[i]) << "\",\n";
//         outFile << "      \"dembedding\": [";
//         for (size_t j = 0; j < distilledEmbeddings[i].data.size(); ++j) {
//             // logBMessage("Embedding data: %f", embeddings[i].data[j]);
//             outFile << distilledEmbeddings[i].data[j];
//             if (j < distilledEmbeddings[i].data.size() - 1) outFile << ", ";
//         }
//         outFile << "]\n";
//         outFile << "    }";
//         if (i < tokens.size() - 1) outFile << ",";
//         outFile << "\n";
//     }
//     outFile << "  ]\n";

//     outFile << "}\n";
//     outFile.close();

//     logBMessage("Model data saved to file: %s", filepath.c_str());
// }

// std::string unescape_string(const std::string &input) {
//     std::ostringstream oss;
//     for (size_t i = 0; i < input.length(); ++i) {
//         if (input[i] == '\\' && i + 1 < input.length()) {
//             char nextChar = input[i + 1];
//             if (nextChar == 'u' && i + 5 < input.length()) {
//                 std::string hexCode = input.substr(i + 2, 4);
//                 char unicodeChar = static_cast<char>(std::stoi(hexCode, nullptr, 16));
//                 oss << unicodeChar;
//                 i += 5; // Skip the \uXXXX sequence
//             } else {
//                 switch (nextChar) {
//                     case 'n': oss << '\n'; break;
//                     case 't': oss << '\t'; break;
//                     case '\\': oss << '\\'; break;
//                     case '"': oss << '"'; break;
//                     default: oss << nextChar; break;
//                 }
//                 ++i; // Skip the escaped character
//             }
//         } else {
//             oss << input[i];
//         }
//     }
//     return oss.str();
// }


// model2Vec* model2Vec::load_from_file(const std::string &filepath) {
//     std::ifstream inFile(filepath);
//     if (!inFile.is_open()) {
//         throw std::runtime_error("Failed to open file for loading");
//     }

//     logBMessage("Loading model data from file: %s", filepath.c_str());
//     auto *model = new model2Vec(0, false, 0); // Temporary values; will be overwritten

//     std::string line;
//     while (std::getline(inFile, line)) {
//         if (line.find("\"token\":") != std::string::npos) {
//             std::string token = line.substr(line.find(":") + 2);
//             token.pop_back(); // Remove trailing comma
//             token = unescape_string(token);
//             model->tokens.push_back(token);

//             std::getline(inFile, line); // Read embedding line
//             if (line.find("\"embedding\":") != std::string::npos) {
//                 std::vector<float> embedding;
//                 size_t pos = 0;
//                 line = line.substr(line.find("[") + 1); // Remove start of array
//                 while ((pos = line.find(",")) != std::string::npos) {
//                     embedding.push_back(std::stof(line.substr(0, pos)));
//                     line.erase(0, pos + 1);
//                 }
//                 embedding.push_back(std::stof(line)); // Last value
//                 model->embeddings.push_back(vectorf(embedding.begin(), embedding.end()));
//             }
//         }
//     }

//     logBMessage("Model data loaded successfully from file: %s", filepath.c_str());
//     inFile.close();
//     return model;
// }


// void set_tokens(model2Vec *instance, const std::vector<std::string> &new_tokens)
// {
//     if (!instance)
//     {
//         logBMessage("set_tokens: Null instance provided.");
//         throw std::invalid_argument("Instance cannot be null.");
//     }

//     logBMessage("Calling set_tokens on instance: %p", static_cast<void *>(instance));
//     instance->tokens = new_tokens; // Set tokens
// }

// // Set embeddings globally
// void set_embeddings(model2Vec *instance, const std::vector<std::vector<float>> &new_embeddings)
// {
//     if (!instance)
//     {
//         logBMessage("set_embeddings: Null instance provided.");
//         throw std::invalid_argument("Instance cannot be null.");
//     }

//     logBMessage("Calling set_embeddings on instance: %p", static_cast<void *>(instance));

//     // Check that the new_embeddings match the embedding_dim
//     for (const auto &embedding : new_embeddings)
//     {
//         if (embedding.size() != static_cast<size_t>(instance->embedding_dim))
//         {
//             throw std::invalid_argument("Mismatch in embedding dimension for set_embeddings");
//         }
//     }

//     instance->embeddings.clear();
//     instance->embeddings.reserve(new_embeddings.size());

//     // Convert std::vector<float> to vectorf and store it
//     for (const auto &embedding : new_embeddings)
//     {
//         vectorf vec(instance->embedding_dim);
//         vec.data = embedding;
//         instance->embeddings.push_back(vec);
//     }
// }









#include <vector>
#include <string>
#include <cmath>
#include <iostream>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <algorithm>
#include <numeric>
#include <random>
#include <cstdarg>
#include <model2vec.h>
#include "json.hpp"
#include <thread>
#include <mutex>
#include <cmath>
#include <future>

using json = nlohmann::json;


void logBMessage(const char *format, ...)
{
    static FILE *logFile = fopen("./log.txt", "a"); // Open in append mode
    if (!logFile)
    {
        fprintf(stderr, "Error opening log file.\n");
        return;
    }

    va_list args;
    va_start(args, format);
    vfprintf(logFile, format, args); // Write the formatted message to the file
    fprintf(logFile, "\n");          // Add a newline
    va_end(args);

    fflush(logFile); // Ensure the message is immediately written to the file
}

// vectorf struct
vectorf::vectorf(size_t size) : data(size, 0.0f)
{
    // logBMessage("Calling from %s, model2vec.cpp", __func__);
}


void vectorf::normalize()
{
    logBMessage("Calling from %s, model2vec.cpp", __func__);
    float norm = std::sqrt(std::inner_product(data.begin(), data.end(), data.begin(), 0.0f));
    if (norm > 0)
    {
        for (auto &val : data)
        {
            val /= norm;
        }
    }
}

// Implementation of matrix methods
matrix::matrix(size_t rows, size_t cols) : row_count(rows), col_count(cols), rows(rows, vectorf(cols))
{
    // logBMessage("Calling from %s, model2vec.cpp", __func__);
}

matrix::matrix(const std::vector<vectorf> &vectors)
    : row_count(vectors.size()),
      col_count(vectors.empty() ? 0 : vectors[0].data.size()),
      rows(vectors)
{
    // logBMessage("Calling from %s, model2vec.cpp", __func__);
}

matrix matrix::transpose() const
{
    logBMessage("Calling from %s, model2vec.cpp", __func__);
    matrix result(col_count, row_count);
    for (size_t i = 0; i < row_count; ++i)
    {
        for (size_t j = 0; j < col_count; ++j)
        {
            result.rows[j].data[i] = rows[i].data[j];
        }
    }
    return result;
}

matrix matrix::multiply(const matrix &other) const
{
    logBMessage("Calling from %s, model2vec.cpp", __func__);
    if (col_count != other.row_count)
    {
        throw std::invalid_argument("matrix dimension mismatch for multiplication");
    }

    matrix result(row_count, other.col_count);
    for (size_t i = 0; i < row_count; ++i)
    {
        for (size_t j = 0; j < other.col_count; ++j)
        {
            for (size_t k = 0; k < col_count; ++k)
            {
                result.rows[i].data[j] += rows[i].data[k] * other.rows[k].data[j];
            }
        }
    }
    return result;
}

// Implementation of model2Vec methods
// model2Vec::model2Vec(int dim, bool zipf, int pca)
//     : embedding_dim(dim), apply_zipf(zipf), pca_components(pca), pca_matrix(0, 0)
// {
//     logBMessage("Calling from %s, model2vec.cpp", __func__);
// }

// matrix* model2Vec::post_process_embeddings(const matrix& embeddings, int pca_dims, bool apply_zipf) {
//     // PCA
//     if (pca_dims > 0) {
//         embeddings = apply_pca(embeddings, pca_dims);
//     }

//     // Zipf weighting
//     if (apply_zipf) {
//         for (size_t i = 0; i < embeddings.row_count; ++i) {
//             float zipf_weight = log1p(i + 1);
//             for (size_t j = 0; j < embeddings.col_count; ++j) {
//                 embeddings.rows[i].data[j] *= zipf_weight;
//             }
//         }
//     }
//     return embeddings;
// }


void model2Vec::initialize(const matrix &precomputed_embeddings, const std::vector<std::string> &token_list)
{
    logBMessage("Calling from %s, model2vec.cpp", __func__);
    if (precomputed_embeddings.row_count != token_list.size())
    {
        throw std::invalid_argument("Mismatch between embeddings and tokens size");
    }

    tokens = token_list;
    embeddings.reserve(token_list.size());
    for (size_t i = 0; i < precomputed_embeddings.row_count; ++i)
    {
        embeddings.push_back(precomputed_embeddings.rows[i]);
    }
}

// Function to compute mean vector
void compute_mean_vector(const std::vector<vectorf> &embeddings, vectorf &mean_vector, int embedding_dim, size_t start, size_t end) {
    for (size_t i = start; i < end; ++i) {
        for (size_t j = 0; j < embedding_dim; ++j) {
            mean_vector.data[j] += embeddings[i].data[j];
        }
    }
}

matrix centerDataGPU(const std::vector<vectorf> &embeddings, const vectorf &mean_vector, int embedding_dim) {
    size_t embedding_count = embeddings.size();
    matrix centered_data(embedding_count, embedding_dim);

#ifdef USE_CUDA
    // Allocate GPU memory and transfer data
    float *d_embeddings, *d_mean_vector, *d_centered_data;
    cudaMalloc(&d_embeddings, embedding_count * embedding_dim * sizeof(float));
    cudaMalloc(&d_mean_vector, embedding_dim * sizeof(float));
    cudaMalloc(&d_centered_data, embedding_count * embedding_dim * sizeof(float));

    cudaMemcpy(d_embeddings, embeddings.data(), embedding_count * embedding_dim * sizeof(float), cudaMemcpyHostToDevice);
    cudaMemcpy(d_mean_vector, mean_vector.data(), embedding_dim * sizeof(float), cudaMemcpyHostToDevice);

    // Launch a CUDA kernel to perform centering
    int blockSize = 256;
    int numBlocks = (embedding_count * embedding_dim + blockSize - 1) / blockSize;
    centerKernel<<<numBlocks, blockSize>>>(d_embeddings, d_mean_vector, d_centered_data, embedding_count, embedding_dim);

    // Copy the result back to host
    cudaMemcpy(centered_data.data(), d_centered_data, embedding_count * embedding_dim * sizeof(float), cudaMemcpyDeviceToHost);

    cudaFree(d_embeddings);
    cudaFree(d_mean_vector);
    cudaFree(d_centered_data);
#else
    // CPU fallback (parallelized)
    size_t num_threads = std::thread::hardware_concurrency();
    size_t chunk_size = embedding_count / num_threads;
    std::vector<std::future<void>> futures;

    for (size_t t = 0; t < num_threads; ++t) {
        size_t start = t * chunk_size;
        size_t end = (t == num_threads - 1) ? embedding_count : start + chunk_size;

        futures.emplace_back(std::async(std::launch::async, [&embeddings, &centered_data, &mean_vector, start, end, embedding_dim]() {
            for (size_t i = start; i < end; ++i) {
                for (int j = 0; j < embedding_dim; ++j) {
                    centered_data.rows[i].data[j] = embeddings[i].data[j] - mean_vector.data[j];
                }
            }
        }));
    }

    for (auto &f : futures) {
        f.get();
    }
#endif
    return centered_data;
}


matrix computeCovarianceGPU(const matrix &centered_data, int embedding_dim) {
    matrix covariance(embedding_dim, embedding_dim);

#ifdef USE_CUDA
    // Use GPU matrix multiplication to calculate covariance: C = (X^T * X) / (n - 1)
    float *d_centered_data, *d_covariance;
    size_t embedding_count = centered_data.rows.size();
    cudaMalloc(&d_centered_data, embedding_count * embedding_dim * sizeof(float));
    cudaMalloc(&d_covariance, embedding_dim * embedding_dim * sizeof(float));

    cudaMemcpy(d_centered_data, centered_data.data(), embedding_count * embedding_dim * sizeof(float), cudaMemcpyHostToDevice);

    // Use cuBLAS for matrix multiplication
    cublasHandle_t handle;
    cublasCreate(&handle);
    const float alpha = 1.0f / (embedding_count - 1);
    const float beta = 0.0f;
    cublasSgemm(handle, CUBLAS_OP_T, CUBLAS_OP_N, embedding_dim, embedding_dim, embedding_count,
                &alpha, d_centered_data, embedding_dim, d_centered_data, embedding_dim, &beta, d_covariance, embedding_dim);

    cudaMemcpy(covariance.data(), d_covariance, embedding_dim * embedding_dim * sizeof(float), cudaMemcpyDeviceToHost);

    cudaFree(d_centered_data);
    cudaFree(d_covariance);
    cublasDestroy(handle);
#else
    // CPU fallback (parallelized)
    size_t num_threads = std::thread::hardware_concurrency();
    size_t chunk_size = embedding_dim / num_threads;
    std::vector<std::future<void>> futures;

    for (size_t t = 0; t < num_threads; ++t) {
        size_t start = t * chunk_size;
        size_t end = (t == num_threads - 1) ? embedding_dim : start + chunk_size;

        futures.emplace_back(std::async(std::launch::async, [&centered_data, &covariance, start, end, embedding_dim]() {
            size_t embedding_count = centered_data.rows.size();
            for (size_t i = start; i < end; ++i) {
                for (size_t j = 0; j < embedding_dim; ++j) {
                    for (size_t k = 0; k < embedding_count; ++k) {
                        covariance.rows[i].data[j] += centered_data.rows[k].data[i] * centered_data.rows[k].data[j];
                    }
                    covariance.rows[i].data[j] /= (embedding_count - 1);
                }
            }
        }));
    }

    for (auto &f : futures) {
        f.get();
    }
#endif
    return covariance;
}

void applyZipfWeightingParallel(std::vector<vectorf> &embeddings, size_t num_threads) {
    size_t embedding_count = embeddings.size();
    size_t chunk_size = embedding_count / num_threads;
    std::vector<std::future<void>> futures;

    for (size_t t = 0; t < num_threads; ++t) {
        size_t start = t * chunk_size;
        size_t end = (t == num_threads - 1) ? embedding_count : start + chunk_size;

        futures.emplace_back(std::async(std::launch::async, [&embeddings, start, end]() {
            for (size_t i = start; i < end; ++i) {
                float zipf_weight = log1p(i + 1); // log(1 + rank)
                for (auto &val : embeddings[i].data) {
                    val *= zipf_weight;
                }
            }
        }));
    }

    for (auto &f : futures) {
        f.get();
    }
}



vectorf computeMeanParallel(const std::vector<vectorf> &embeddings, int embedding_dim, size_t num_threads) {
    vectorf mean_vector(embedding_dim, 0.0f);
    size_t embedding_count = embeddings.size();

    // Divide data into chunks for each thread
    size_t chunk_size = embedding_count / num_threads;
    std::vector<std::future<void>> futures;

    // Accumulate sums in parallel
    std::vector<vectorf> thread_sums(num_threads, vectorf(embedding_dim, 0.0f));
    for (size_t t = 0; t < num_threads; ++t) {
        size_t start = t * chunk_size;
        size_t end = (t == num_threads - 1) ? embedding_count : start + chunk_size;

        futures.emplace_back(std::async(std::launch::async, [&embeddings, &thread_sums, t, start, end, embedding_dim]() {
            for (size_t i = start; i < end; ++i) {
                for (int j = 0; j < embedding_dim; ++j) {
                    thread_sums[t][j] += embeddings[i][j];
                }
            }
        }));
    }

    for (auto &f : futures) {
        f.get();
    }

    // Combine results
    for (size_t t = 0; t < num_threads; ++t) {
        for (int j = 0; j < embedding_dim; ++j) {
            mean_vector[j] += thread_sums[t][j];
        }
    }

    // Divide by the total number of embeddings to get the mean
    for (int j = 0; j < embedding_dim; ++j) {
        mean_vector[j] /= embedding_count;
    }

    return mean_vector;
}


void model2Vec::distill(model2Vec *instance) {
    logBMessage("Starting distillation in %s, model2vec.cpp", __func__);

    if (instance->embeddings.empty() || instance->tokens.empty()) {
        throw std::invalid_argument("Embeddings or tokens are empty.");
    }

    size_t embedding_count = instance->embeddings.size();
    int embedding_dim = instance->embedding_dim;

    logBMessage("Embeddings count: %zu, Embedding dimensions: %d", embedding_count, embedding_dim);


    if(pca_components < 0 || pca_components > embedding_dim) {
        return;
    }
    // Step 1: Compute the mean vector (parallelized)
    vectorf mean_vector(embedding_dim, 0.0f);
    size_t num_threads = std::thread::hardware_concurrency()%4;
    size_t chunk_size = embedding_count / num_threads;
    std::vector<std::future<void>> futures;

    for (size_t t = 0; t < num_threads; ++t) {
        size_t start = t * chunk_size;
        size_t end = (t == num_threads - 1) ? embedding_count : start + chunk_size;
        futures.emplace_back(std::async(std::launch::async, compute_mean_vector, std::ref(instance->embeddings), std::ref(mean_vector), embedding_dim, start, end));
    }

    for (auto &f : futures) {
        f.get();
    }

    // Average the mean vector
    for (auto &val : mean_vector.data) {
        val /= embedding_count;
    }

    logBMessage("Mean vector computed.");

    // Step 2: Center the data (parallelized)
    matrix centered_data(embedding_count, embedding_dim);
    futures.clear();

    for (size_t t = 0; t < num_threads; ++t) {
        size_t start = t * chunk_size;
        size_t end = (t == num_threads - 1) ? embedding_count : start + chunk_size;
        futures.emplace_back(std::async(std::launch::async, [&](size_t start, size_t end) {
            for (size_t i = start; i < end; ++i) {
                for (size_t j = 0; j < embedding_dim; ++j) {
                    centered_data.rows[i].data[j] = instance->embeddings[i].data[j] - mean_vector.data[j];
                }
            }
        }, start, end));
    }

    for (auto &f : futures) {
        f.get();
    }

    logBMessage("Centered data computed.");

    // Step 3: Compute covariance matrix (parallelized)
    matrix covariance(embedding_dim, embedding_dim);
    futures.clear();

    for (size_t i = 0; i < embedding_dim; ++i) {
        futures.emplace_back(std::async(std::launch::async, [&](size_t row) {
            for (size_t col = 0; col < embedding_dim; ++col) {
                for (size_t k = 0; k < embedding_count; ++k) {
                    covariance.rows[row].data[col] += centered_data.rows[k].data[row] * centered_data.rows[k].data[col];
                }
                covariance.rows[row].data[col] /= (embedding_count - 1);
            }
        }, i));
    }

    for (auto &f : futures) {
        f.get();
    }

    logBMessage("Covariance matrix computed.");

    // Step 4: PCA computation and projection
    if (instance->pca_components > 0) {
        logBMessage("Applying PCA for dimensionality reduction.");

        instance->pca_matrix = matrix(instance->pca_components, embedding_dim);

        // Simplified PCA: copying the first rows of covariance matrix
        for (int i = 0; i < instance->pca_components; ++i) {
            for (size_t j = 0; j < embedding_dim; ++j) {
                instance->pca_matrix.rows[i].data[j] = covariance.rows[i].data[j];
            }
        }

        // Project centered data to PCA dimensions
        matrix reduced_data(embedding_count, instance->pca_components);
        futures.clear();

        for (size_t t = 0; t < num_threads; ++t) {
            size_t start = t * chunk_size;
            size_t end = (t == num_threads - 1) ? embedding_count : start + chunk_size;
            futures.emplace_back(std::async(std::launch::async, [&](size_t start, size_t end) {
                for (size_t i = start; i < end; ++i) {
                    for (int j = 0; j < instance->pca_components; ++j) {
                        for (size_t k = 0; k < embedding_dim; ++k) {
                            reduced_data.rows[i].data[j] += instance->pca_matrix.rows[j].data[k] * centered_data.rows[i].data[k];
                        }
                    }
                }
            }, start, end));
        }

        for (auto &f : futures) {
            f.get();
        }

        instance->distilledEmbeddings = reduced_data.rows; // Save reduced embeddings
        logBMessage("PCA dimensionality reduction applied.");
    } else {
        instance->distilledEmbeddings = centered_data.rows; // Save centered embeddings
        logBMessage("Centered data used without PCA.");
    }

    // Step 5: Apply Zipf weighting
    if (instance->apply_zipf) {
        logBMessage("Applying Zipf weighting.");
        for (size_t i = 0; i < instance->distilledEmbeddings.size(); ++i) {
            float zipf_weight = log1p(i + 1); // log(1 + rank)
            for (auto &val : instance->distilledEmbeddings[i].data) {
                val *= zipf_weight;
            }
        }
    }

    logBMessage("Distillation completed. Final embeddings size: %zu", instance->distilledEmbeddings.size());
}

// void model2Vec::distill(model2Vec *instance) {
//     logBMessage("Starting optimized distillation in %s, model2vec.cpp", __func__);

//     if (instance->embeddings.empty() || instance->tokens.empty()) {
//         throw std::invalid_argument("Embeddings or tokens are empty.");
//     }

//     size_t embedding_count = instance->embeddings.size();
//     int embedding_dim = instance->embedding_dim;
//     size_t num_threads = std::thread::hardware_concurrency()%4;

//     logBMessage("Embeddings count: %zu, Embedding dimensions: %d", embedding_count, embedding_dim);

//     // Step 1: Compute mean vector (parallelized)
//     vectorf mean_vector = computeMeanParallel(instance->embeddings, embedding_dim, num_threads);

//     // Step 2: Center the data (GPU optimized)
//     matrix centered_data = centerDataGPU(instance->embeddings, mean_vector, embedding_dim);

//     // Step 3: Compute covariance matrix (GPU optimized)
//     matrix covariance = computeCovarianceGPU(centered_data, embedding_dim);

//     // Step 4: PCA computation (Randomized or GPU-accelerated)
//     if (instance->pca_components > 0) {
//         matrix pca_matrix = computePCA_GPU(covariance, instance->pca_components);

//         // Project data onto PCA components
//         matrix reduced_data = projectDataGPU(centered_data, pca_matrix);

//         instance->distilledEmbeddings = reduced_data.rows;
//     } else {
//         instance->distilledEmbeddings = centered_data.rows;
//     }

//     // Step 5: Apply Zipf weighting (parallelized)
//     applyZipfWeightingParallel(instance->distilledEmbeddings, num_threads);

//     logBMessage("Optimized distillation completed. Final embeddings size: %zu", instance->distilledEmbeddings.size());
// }




#include <string>

std::string escapeJsonString(const std::string& input) {
    std::string output;
    for (char c : input) {
        switch (c) {
            case '"':  output += "\\\""; break;
            case '\\': output += "\\\\"; break;
            case '\b': output += "\\b"; break;
            case '\f': output += "\\f"; break;
            case '\n': output += "\\n"; break;
            case '\r': output += "\\r"; break;
            case '\t': output += "\\t"; break;
            default:
                // For non-printable ASCII characters, use \uXXXX format
                if (c < 0x20 || c > 0x7E) {
                    output += "\\u";
                    char buffer[5];
                    snprintf(buffer, sizeof(buffer), "%04x", c & 0xFF);
                    output += buffer;
                } else {
                    output += c;
                }
                break;
        }
    }
    return output;
}


vectorf model2Vec::apply_pca(const vectorf &embedding) const
{
    logBMessage("Calling from %s, model2vec.cpp", __func__);
    if (embedding.data.size() != embedding_dim)
    {
        throw std::invalid_argument("Embedding size mismatch for PCA");
    }

    vectorf result(pca_components);
    for (int i = 0; i < pca_components; ++i)
    {
        for (size_t j = 0; j < embedding_dim; ++j)
        {
            result.data[i] += pca_matrix.rows[i].data[j] * embedding.data[j];
        }
    }
    return result;
}

vectorf model2Vec::apply_zipf_weighting(const vectorf &embedding, int rank) const
{
    logBMessage("Calling from %s, model2vec.cpp", __func__);
    if (embedding.data.size() != embedding_dim)
    {
        throw std::invalid_argument("Embedding size mismatch for Zipf weighting");
    }

    if (rank <= 0)
    {
        throw std::invalid_argument("Rank must be greater than 0");
    }

    vectorf result(embedding_dim);

    // Calculate the Zipf weight using logarithmic scaling
    float zipf_weight = std::log1p(rank); // log(1 + rank)
    for (size_t i = 0; i < embedding_dim; ++i)
    {
        result.data[i] = embedding.data[i] * zipf_weight;
    }

    return result;
}

// void model2Vec::save_to_file(const std::string &filepath) const
// {
//     logBMessage("Calling from %s, model2vec.cpp", __func__);
//     std::ofstream outFile(filepath, std::ios::binary);
//     if (!outFile.is_open() || !outFile) {
//         throw std::runtime_error("Failed to open file for saving");
//     }

//     logBMessage("Saving model data to file: %s", filepath.c_str());

//     // Save embedding dimension, PCA components, apply_zipf flag
//     outFile.write(reinterpret_cast<const char *>(&embedding_dim), sizeof(embedding_dim));
//     outFile.write(reinterpret_cast<const char *>(&pca_components), sizeof(pca_components));
//     outFile.write(reinterpret_cast<const char *>(&apply_zipf), sizeof(apply_zipf));

//     logBMessage("Embedding dimension: %d, PCA components: %d, Apply Zipf: %d", embedding_dim, pca_components, apply_zipf);

//     // Save PCA matrix
//     if (!pca_matrix.rows.empty()) {
//         outFile.write(reinterpret_cast<const char *>(&pca_matrix.row_count), sizeof(pca_matrix.row_count));
//         outFile.write(reinterpret_cast<const char *>(&pca_matrix.col_count), sizeof(pca_matrix.col_count));
//         for (const auto &row : pca_matrix.rows) {
//             if (!row.data.empty()) {
//                 outFile.write(reinterpret_cast<const char *>(row.data.data()), row.data.size() * sizeof(float));
//             }
//         }
//     }

//     logBMessage("PCA matrix saved");

//     // Save tokens and embeddings
//     // if (tokens.size() != embeddings.size()) {
//     //     throw std::runtime_error("Mismatch between tokens and embeddings sizes");
//     // }

//     size_t token_count = tokens.size();
//     outFile.write(reinterpret_cast<const char *>(&token_count), sizeof(token_count));

//     logBMessage("Token count: %zu", token_count);

//     for (size_t i = 0; i < token_count; ++i) {
//         size_t token_length = tokens[i].length();
//         outFile.write(reinterpret_cast<const char *>(&token_length), sizeof(token_length));
//         if (token_length > 0) {
//             outFile.write(tokens[i].c_str(), token_length);
//         }

//         // Check for null embeddings
//         if (embeddings[i].data.empty()) {
//             // logBMessage("Null embedding detected for token: %s", tokens[i].c_str());
//             std::vector<float> zero_embedding(embedding_dim, 0.0f); // Use zero vector as placeholder
//             outFile.write(reinterpret_cast<const char *>(zero_embedding.data()), zero_embedding.size() * sizeof(float));
//         } else {
//             outFile.write(reinterpret_cast<const char *>(embeddings[i].data.data()), embeddings[i].data.size() * sizeof(float));
//         }
//     }

//     logBMessage("Tokens and embeddings saved");

//     logBMessage("Model data saved to file: %s", filepath.c_str());

//     outFile.close();
// }


std::string escape_string(const std::string &input) {
    std::ostringstream oss;
    for (unsigned char c : input) {
        if (c == '"' || c == '\\') {
            oss << '\\' << c; // Escape double quotes and backslashes
        } else if (std::isprint(c)) {
            oss << c; // Printable ASCII characters
        } else {
            oss << "\\u" << std::hex << std::setw(4) << std::setfill('0') << (int)c;
        }
    }
    return oss.str();
}

void model2Vec::save_to_file(const std::string &filepath) const {
    std::ofstream outFile(filepath);
    if (!outFile.is_open()) {
        throw std::runtime_error("Failed to open file for saving");
    }

    logBMessage("Saving model data to file: %s", filepath.c_str());
    logBMessage("Embedding dimension: %d, PCA components: %d, Apply Zipf: %d", embedding_dim, pca_components, apply_zipf);

    outFile << "{\n";

    // Save metadata
    outFile << "  \"embedding_dim\": " << embedding_dim << ",\n";
    outFile << "  \"pca_components\": " << pca_components << ",\n";
    outFile << "  \"apply_zipf\": " << (apply_zipf ? "true" : "false") << ",\n";

    // Save PCA matrix
    outFile << "  \"pca_matrix\": {\n";
    outFile << "    \"row_count\": " << pca_matrix.row_count << ",\n";
    outFile << "    \"col_count\": " << pca_matrix.col_count << ",\n";
    outFile << "    \"rows\": [\n";

    for (size_t i = 0; i < pca_matrix.rows.size(); ++i) {
        outFile << "      [";
        for (size_t j = 0; j < pca_matrix.rows[i].data.size(); ++j) {
            outFile << pca_matrix.rows[i].data[j];
            if (j < pca_matrix.rows[i].data.size() - 1) outFile << ", ";
        }
        outFile << "]";
        if (i < pca_matrix.rows.size() - 1) outFile << ",";
        outFile << "\n";
    }
    outFile << "    ]\n";
    outFile << "  },\n";

    logBMessage("Embedding size %zu, token size %zu", tokens.size(), embeddings.size());

    // Save tokens and embeddings
    outFile << "  \"tokens\": [\n";
    for (size_t i = 0; i < tokens.size(); ++i) {
        outFile << "    {\n";
        outFile << "      \"token_id\": " << i << ",\n"; // Save token ID
        outFile << "      \"token\": \"" << escape_string(tokens[i]) << "\",\n"; // Save token
        outFile << "      \"embedding\": [";
        for (size_t j = 0; j < embeddings[i].data.size(); ++j) {
            outFile << embeddings[i].data[j];
            if (j < embeddings[i].data.size() - 1) outFile << ", ";
        }
        outFile << "]\n";
        outFile << "    }";
        if (i < tokens.size() - 1) outFile << ",";
        outFile << "\n";
    }
    outFile << "  ]\n";

    outFile << "}\n";
    outFile.close();

    logBMessage("Model data saved to file: %s", filepath.c_str());
}




// model2Vec *model2Vec::load_from_file(const std::string &filepath)
// {
//     logBMessage("Calling from %s, model2vec.cpp", __func__);
//     std::ifstream inFile(filepath, std::ios::binary);
//     if (!inFile.is_open() || !inFile) {
//         throw std::runtime_error("Failed to open file for loading");
//     }

//     auto *model = new model2Vec(0, false, 0); // Temporary values; will be overwritten


//     logBMessage("Loading model data from file: %s", filepath.c_str());
//     // Load embedding dimension, PCA components, apply_zipf flag
//     inFile.read(reinterpret_cast<char *>(&model->embedding_dim), sizeof(model->embedding_dim));
//     inFile.read(reinterpret_cast<char *>(&model->pca_components), sizeof(model->pca_components));
//     inFile.read(reinterpret_cast<char *>(&model->apply_zipf), sizeof(model->apply_zipf));

//     logBMessage("Embedding dimension: %d, PCA components: %d, Apply Zipf: %d", model->embedding_dim, model->pca_components, model->apply_zipf);
//     // Load PCA matrix
//     size_t pca_row_count, pca_col_count;
//     inFile.read(reinterpret_cast<char *>(&pca_row_count), sizeof(pca_row_count));
//     inFile.read(reinterpret_cast<char *>(&pca_col_count), sizeof(pca_col_count));
//     if (pca_row_count > 0 && pca_col_count > 0) {
//         model->pca_matrix = matrix(pca_row_count, pca_col_count);
//         for (size_t i = 0; i < pca_row_count; ++i) {
//             inFile.read(reinterpret_cast<char *>(model->pca_matrix.rows[i].data.data()), pca_col_count * sizeof(float));
//         }
//     }

//     logBMessage("PCA matrix loaded");

//     // Load tokens and embeddings
//     size_t token_count;
//     inFile.read(reinterpret_cast<char *>(&token_count), sizeof(token_count));
//     model->tokens.resize(token_count);
//     model->embeddings.resize(token_count, vectorf(model->embedding_dim));

//     logBMessage("Token count: %zu", token_count);

//     for (size_t i = 0; i < token_count; ++i) {
//         size_t token_length;
//         inFile.read(reinterpret_cast<char *>(&token_length), sizeof(token_length));
//         // if (token_length > 0 && token_length < 1024) { // Ensure token_length is reasonable
//             model->tokens[i].resize(token_length);
//             inFile.read(&model->tokens[i][0], token_length);
//         // } else {
//         //     throw std::runtime_error("Invalid token length encountered during loading");
//         // }

//         std::vector<float> embedding(model->embedding_dim, 0.0f);
//         inFile.read(reinterpret_cast<char *>(embedding.data()), model->embedding_dim * sizeof(float));
//         if (embedding.empty()) {
//             logBMessage("Null embedding encountered for token: %s. Using zero vector.", model->tokens[i].c_str());
//             embedding.assign(model->embedding_dim, 0.0f); // Assign zero vector for null embeddings
//         }
//         model->embeddings[i] = vectorf(embedding.begin(), embedding.end());
//     }

//     logBMessage("Tokens and embeddings loaded");

//     inFile.close();
//     return model;
// }


std::string unescape_string(const std::string &input) {
    std::ostringstream oss;
    for (size_t i = 0; i < input.length(); ++i) {
        if (input[i] == '\\' && i + 1 < input.length()) {
            char nextChar = input[i + 1];
            if (nextChar == 'u' && i + 5 < input.length()) {
                std::string hexCode = input.substr(i + 2, 4);
                char unicodeChar = static_cast<char>(std::stoi(hexCode, nullptr, 16));
                oss << unicodeChar;
                i += 5; // Skip the \uXXXX sequence
            } else {
                switch (nextChar) {
                    case 'n': oss << '\n'; break;
                    case 't': oss << '\t'; break;
                    case '\\': oss << '\\'; break;
                    case '"': oss << '"'; break;
                    default: oss << nextChar; break;
                }
                ++i; // Skip the escaped character
            }
        } else {
            oss << input[i];
        }
    }
    return oss.str();
}


model2Vec* model2Vec::load_from_file(const std::string &filepath) {
    std::ifstream inFile(filepath);
    if (!inFile.is_open()) {
        throw std::runtime_error("Failed to open file for loading");
    }

    logBMessage("Loading model data from file: %s", filepath.c_str());

    auto *model = new model2Vec(0, false, 0); // Temporary values; will be overwritten

    std::string line;
    bool insideTokens = false;

    while (std::getline(inFile, line)) {
        // Trim leading/trailing whitespace
        line.erase(0, line.find_first_not_of(" \t"));
        line.erase(line.find_last_not_of(" \t") + 1);

        if (line.find("\"embedding_dim\":") != std::string::npos) {
            model->embedding_dim = std::stoi(line.substr(line.find(":") + 1));
        } else if (line.find("\"pca_components\":") != std::string::npos) {
            model->pca_components = std::stoi(line.substr(line.find(":") + 1));
        } else if (line.find("\"apply_zipf\":") != std::string::npos) {
            model->apply_zipf = (line.find("true") != std::string::npos);
        } else if (line.find("\"tokens\":") != std::string::npos) {
            insideTokens = true;
        } else if (insideTokens && line.find("{") != std::string::npos) {
            // Start of a token object
            std::string token;
            std::vector<float> embedding;

            while (std::getline(inFile, line)) {
                line.erase(0, line.find_first_not_of(" \t"));
                line.erase(line.find_last_not_of(" \t") + 1);

                if (line.find("\"token_id\":") != std::string::npos) {
                    // Parse token_id (ignored here, as it's implied by the order)
                } else if (line.find("\"token\":") != std::string::npos) {
                    token = line.substr(line.find(":") + 2);
                    token.pop_back(); // Remove trailing comma or quote
                    token = unescape_string(token);
                } else if (line.find("\"embedding\":") != std::string::npos) {
                    // Parse embedding array
                    size_t pos = 0;
                    line = line.substr(line.find("[") + 1); // Remove start of array
                    while ((pos = line.find(",")) != std::string::npos) {
                        embedding.push_back(std::stof(line.substr(0, pos)));
                        line.erase(0, pos + 1);
                    }
                    embedding.push_back(std::stof(line.substr(0, line.find("]")))); // Last value
                } else if (line.find("}") != std::string::npos) {
                    // End of token object
                    model->tokens.push_back(token);
                    model->embeddings.push_back(vectorf(embedding.begin(), embedding.end()));
                    break;
                }
            }
        }
    }

    logBMessage("Model data loaded successfully from file: %s", filepath.c_str());
    inFile.close();
    return model;
}


bool model2Vec::load_token_by_id(const std::string &filepath, int token_id, std::string &token, vectorf &embedding) {
    std::ifstream inFile(filepath);
    if (!inFile.is_open()) {
        throw std::runtime_error("Failed to open file for loading");
    }

    logBMessage("Searching for token_id: %d in file: %s", token_id, filepath.c_str());

    std::string line;
    bool insideTokens = false;
    int current_token_id = -1;

    while (std::getline(inFile, line)) {
        // Trim leading/trailing whitespace
        line.erase(0, line.find_first_not_of(" \t"));
        line.erase(line.find_last_not_of(" \t") + 1);

        if (line.find("\"tokens\":") != std::string::npos) {
            insideTokens = true;
        } else if (insideTokens && line.find("{") != std::string::npos) {
            // Start of a token object
            std::string current_token;
            std::vector<float> current_embedding;

            while (std::getline(inFile, line)) {
                line.erase(0, line.find_first_not_of(" \t"));
                line.erase(line.find_last_not_of(" \t") + 1);

                if (line.find("\"token_id\":") != std::string::npos) {
                    // Parse token_id
                    current_token_id = std::stoi(line.substr(line.find(":") + 1));
                } else if (line.find("\"token\":") != std::string::npos) {
                    // Parse token
                    current_token = line.substr(line.find(":") + 2);
                    current_token.pop_back(); // Remove trailing comma or quote
                    current_token = unescape_string(current_token);
                } else if (line.find("\"embedding\":") != std::string::npos) {
                    // Parse embedding array
                    size_t pos = 0;
                    line = line.substr(line.find("[") + 1); // Remove start of array
                    while ((pos = line.find(",")) != std::string::npos) {
                        current_embedding.push_back(std::stof(line.substr(0, pos)));
                        line.erase(0, pos + 1);
                    }
                    current_embedding.push_back(std::stof(line.substr(0, line.find("]")))); // Last value
                } else if (line.find("}") != std::string::npos) {
                    // End of token object
                    if (current_token_id == token_id) {
                        token = current_token;
                        embedding = vectorf(current_embedding.begin(), current_embedding.end());

                        logBMessage("Found token_id: %d with token: %s", token_id, token.c_str());
                        inFile.close();
                        return true; // Return as soon as the matching token_id is found
                    }
                    break;
                }
            }
        }
    }

    logBMessage("Token with token_id: %d not found in file: %s", token_id, filepath.c_str());
    inFile.close();
    return false; // Token with the given token_id was not found
}



vectorf* model2Vec::get_embedding_by_token_id(const std::string &filepath, int token_id) {
    std::ifstream inFile(filepath);
    if (!inFile.is_open()) {
        throw std::runtime_error("Failed to open file for loading");
    }

    logBMessage("Searching for embedding with token_id: %d in file: %s", token_id, filepath.c_str());

    std::string line;
    bool insideTokens = false;
    int current_token_id = -1;

    while (std::getline(inFile, line)) {
        // Trim leading/trailing whitespace
        line.erase(0, line.find_first_not_of(" \t"));
        line.erase(line.find_last_not_of(" \t") + 1);

        if (line.find("\"tokens\":") != std::string::npos) {
            insideTokens = true;
        } else if (insideTokens && line.find("{") != std::string::npos) {
            // Start of a token object
            auto *current_embedding = new vectorf();

            while (std::getline(inFile, line)) {
                line.erase(0, line.find_first_not_of(" \t"));
                line.erase(line.find_last_not_of(" \t") + 1);

                if (line.find("\"token_id\":") != std::string::npos) {
                    // Parse token_id
                    current_token_id = std::stoi(line.substr(line.find(":") + 1));
                } else if (line.find("\"embedding\":") != std::string::npos) {
                    // Parse embedding array
                    std::string embedding_data = line.substr(line.find("[") + 1); // Extract array string
                    embedding_data.erase(embedding_data.find_last_of("]")); // Remove closing bracket

                    std::istringstream stream(embedding_data);
                    std::string number;
                    while (std::getline(stream, number, ',')) {
                        current_embedding->data.push_back(std::stof(number)); // Convert and add to vector
                    }
                } else if (line.find("}") != std::string::npos) {
                    // End of token object
                    if (current_token_id == token_id) {
                        logBMessage("Found embedding for token_id: %d", token_id);
                        inFile.close();
                        return current_embedding;
                    }
                    delete current_embedding; // Clean up if not matched
                    break;
                }
            }
        }
    }

    logBMessage("Embedding with token_id: %d not found in file: %s", token_id, filepath.c_str());
    inFile.close();
    return nullptr;
}






// model2Vec* model2Vec::load_from_file(const std::string& filepath) {
//     std::ifstream inFile(filepath);
//     if (!inFile.is_open()) {
//         throw std::runtime_error("Failed to open file for loading");
//     }

//     auto* model = new model2Vec(0, false, 0); // Temporary values

//     try {
//         json jsonData;
//         inFile >> jsonData;

//         // Parse metadata
//         model->embedding_dim = jsonData.value("embedding_dim", 0);
//         model->pca_components = jsonData.value("pca_components", 0);
//         model->apply_zipf = jsonData.value("apply_zipf", false);

//         // Parse PCA matrix
//         auto pcaMatrix = jsonData.at("pca_matrix");
//         model->pca_matrix.row_count = pcaMatrix.value("row_count", 0);
//         model->pca_matrix.col_count = pcaMatrix.value("col_count", 0);
//         model->pca_matrix.rows.resize(model->pca_matrix.row_count);

//         const auto& rows = pcaMatrix.at("rows");
//         if (rows.size() != model->pca_matrix.row_count) {
//             throw std::runtime_error("Row count mismatch in PCA matrix");
//         }

//         for (size_t i = 0; i < rows.size(); ++i) {
//             const auto& row = rows[i];
//             if (row.size() != model->pca_matrix.col_count) {
//                 throw std::runtime_error("Column count mismatch in PCA matrix");
//             }
//             model->pca_matrix.rows[i] = vectorf(row.get<std::vector<float>>());
//         }

//         // Parse tokens and embeddings
//         const auto& tokensData = jsonData.at("tokens");
//         for (const auto& tokenObj : tokensData) {
//             std::string token = tokenObj.at("token");
//             model->tokens.push_back(token);

//             std::vector<float> embedding = tokenObj.at("embedding").get<std::vector<float>>();
//             model->embeddings.push_back(vectorf(embedding));
//         }

//     } catch (const json::exception& e) {
//         delete model;
//         throw std::runtime_error("JSON parsing error: " + std::string(e.what()));
//     }

//     return model;
// }

// model2Vec *model2Vec::load_from_file(const std::string &filepath)
// {
//     logBMessage("Calling from %s, model2vec.cpp", __func__);
//     std::ifstream inFile(filepath, std::ios::binary);
//     if (!inFile.is_open())
//     {
//         throw std::runtime_error("Failed to open file for loading");
//     }

//     auto *model = new model2Vec(0, false, 0); // Temporary values; will be overwritten

//     // Load embedding dimension
//     inFile.read(reinterpret_cast<char *>(&model->embedding_dim), sizeof(model->embedding_dim));

//     // Load PCA components
//     inFile.read(reinterpret_cast<char *>(&model->pca_components), sizeof(model->pca_components));

//     // Load apply_zipf flag
//     inFile.read(reinterpret_cast<char *>(&model->apply_zipf), sizeof(model->apply_zipf));

//     // Load PCA matrix
//     size_t pca_row_count, pca_col_count;
//     inFile.read(reinterpret_cast<char *>(&pca_row_count), sizeof(pca_row_count));
//     inFile.read(reinterpret_cast<char *>(&pca_col_count), sizeof(pca_col_count));
//     model->pca_matrix = matrix(pca_row_count, pca_col_count);
//     for (size_t i = 0; i < pca_row_count; ++i)
//     {
//         inFile.read(reinterpret_cast<char *>(model->pca_matrix.rows[i].data.data()), pca_col_count * sizeof(float));
//     }

//     // Load tokens and embeddings
//     size_t token_count;
//     inFile.read(reinterpret_cast<char *>(&token_count), sizeof(token_count));

//     model->tokens.resize(token_count);
//     model->embeddings.resize(token_count, vectorf(model->embedding_dim));
//     for (size_t i = 0; i < token_count; ++i)
//     {
//         // Load token
//         size_t token_length;
//         inFile.read(reinterpret_cast<char *>(&token_length), sizeof(token_length));
//         model->tokens[i].resize(token_length);
//         inFile.read(&model->tokens[i][0], token_length);

//         // Load corresponding embedding
//         inFile.read(reinterpret_cast<char *>(model->embeddings[i].data.data()), model->embedding_dim * sizeof(float));
//     }

//     inFile.close();
//     return model;
// }

void set_tokens(model2Vec *instance, const std::vector<std::string> &new_tokens)
{
    if (!instance)
    {
        logBMessage("set_tokens: Null instance provided.");
        throw std::invalid_argument("Instance cannot be null.");
    }

    logBMessage("Calling set_tokens on instance: %p", static_cast<void *>(instance));
    instance->tokens = new_tokens; // Set tokens
}

// Set embeddings globally
void set_embeddings(model2Vec *instance, const std::vector<std::vector<float>> &new_embeddings)
{
    if (!instance)
    {
        logBMessage("set_embeddings: Null instance provided.");
        throw std::invalid_argument("Instance cannot be null.");
    }

    logBMessage("Calling set_embeddings on instance: %p", static_cast<void *>(instance));

    // Check that the new_embeddings match the embedding_dim
    for (const auto &embedding : new_embeddings)
    {
        if (embedding.size() != static_cast<size_t>(instance->embedding_dim))
        {
            throw std::invalid_argument("Mismatch in embedding dimension for set_embeddings");
        }
    }

    instance->embeddings.clear();
    instance->embeddings.reserve(new_embeddings.size());

    // Convert std::vector<float> to vectorf and store it
    for (const auto &embedding : new_embeddings)
    {
        vectorf vec(instance->embedding_dim);
        vec.data = embedding;
        instance->embeddings.push_back(vec);
    }
}