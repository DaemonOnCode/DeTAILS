const { ipcMain } = require('electron');
// const pdfParser = require('pdf-parse'); // Peer dep
// global.ReadableStream = require('web-streams-polyfill').ReadableStream;

const { PDFLoader } = require('@langchain/community/document_loaders/fs/pdf');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { Chroma } = require('@langchain/community/vectorstores/chroma');
const { OllamaEmbeddings, Ollama } = require('@langchain/ollama');
const { createRetrievalChain } = require('langchain/chains/retrieval');
const { createStuffDocumentsChain } = require('langchain/chains/combine_documents');
const { ChatPromptTemplate } = require('@langchain/core/prompts');

const langchainHandler = () => {
    ipcMain.handle(
        'add-documents-langchain',
        async (event, documents, model, mainCode, additionalInfo) => {
            console.log('documentPaths', documents);
            if (!documents || typeof documents !== 'object') {
                return;
            }

            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200
            });

            let allResults = [];

            for (const key in documents) {
                console.log('document', documents[key]);
                const loader = new PDFLoader(key);

                const docs = await loader.load();

                console.log(key, docs.length);

                console.log('docs', docs, 'docs.length', docs.length);

                const splits = await textSplitter.splitDocuments(docs);

                console.log('splits', splits, 'splits.length', splits.length);

                const embeddings = new OllamaEmbeddings({
                    model,
                    baseUrl: 'http://localhost:11434'
                });

                const vectorStore = new Chroma(embeddings, {
                    collectionName: 'a-test-collection'
                });

                const addedDocs = await vectorStore.addDocuments(splits);

                console.log('addedDocs', addedDocs, 'addedDocs.length', addedDocs.length);

                const retriever = vectorStore.asRetriever();

                const systemTemplate = [
                    `You are an assistant for question-answering tasks. `,
                    `Use the following pieces of retrieved context to answer `,
                    `the question. If you don't know the answer, say that you `,
                    `don't know. Use three sentences maximum and keep the `,
                    `answer concise.`,
                    `\n\n`,
                    `{context}`
                ].join('');

                const prompt = ChatPromptTemplate.fromMessages([
                    ['system', systemTemplate],
                    ['human', '{input}']
                ]);

                const questionAnswerChain = await createStuffDocumentsChain({
                    llm: new Ollama({
                        model: 'llama3.2:3b',
                        numCtx: 8192,
                        maxNumTokens: 8192
                    }),
                    prompt
                });
                const ragChain = await createRetrievalChain({
                    retriever,
                    combineDocsChain: questionAnswerChain
                });

                const results = await ragChain.invoke({
                    input: `To build context for the user, find sentences related to ${mainCode} with the following context ${additionalInfo}. 
                Build 20 flashcards based on the above information in the format of xml tags such as 
                <flashcards>
                    <flashcard>...</flashcard>
                    <flashcard>...</flashcard>
                </flashcards>`
                });
                allResults.push(results);

                console.log('results', results);
            }

            return allResults;
        }
    );
};

module.exports = { langchainHandler };
