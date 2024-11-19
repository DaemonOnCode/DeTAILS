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

const systemTemplateFlashcards = [
    `
You are a helpful assistant specializing in generating structured data for flashcards.
Your task is to generate exactly 20 flashcards in **strict JSON format**, adhering to the following structure:

{{
    "flashcards": [
        {{
            "question": "Question text here...",
            "answer": "Answer text here..."
        }},
        {{
            "question": "Question text here...",
            "answer": "Answer text here..."
        }}
        // Repeat this structure for a total of 20 flashcards
    ]
}}

### Requirements:
1. The JSON must be valid, properly formatted, and parseable.
2. Questions should be diverse, contextually relevant, and cover a wide range of topics within the provided context.
3. Answers must be detailed, clear, and factually accurate.

### Provided Context:
{context}

### Guidelines:
- Use the context to craft questions and answers.
- Ensure a variety of question types (e.g., definitions, applications, explanations).
- Do not include any output other than the JSON object.

Return only the JSON object in the specified format.
`,
    `{context}\n\n`
];

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

            const embeddings = new OllamaEmbeddings({
                model,
                baseUrl: 'http://localhost:11434'
            });

            const vectorStore = new Chroma(embeddings, {
                collectionName: 'a-test-collection'
            });

            for (const key in documents) {
                console.log('document', documents[key]);
                const loader = new PDFLoader(key);

                const docs = await loader.load();

                console.log(key, docs.length);

                console.log('docs', docs, 'docs.length', docs.length);

                const splits = await textSplitter.splitDocuments(docs);

                console.log('splits', splits, 'splits.length', splits.length);

                const addedDocs = await vectorStore.addDocuments(splits);

                console.log('addedDocs', addedDocs, 'addedDocs.length', addedDocs.length);
            }

            const retriever = vectorStore.asRetriever();

            const prompt = ChatPromptTemplate.fromMessages([
                ['system', systemTemplateFlashcards.join('\n')],
                ['human', '{input}']
            ]);

            const questionAnswerChain = await createStuffDocumentsChain({
                llm: new Ollama({
                    model,
                    numCtx: 8192,
                    maxNumTokens: 8192,
                    temperature: 0.3
                }),
                prompt
            });
            const ragChain = await createRetrievalChain({
                retriever,
                combineDocsChain: questionAnswerChain
            });

            const results = await ragChain.invoke({
                input: `Using the context provided, generate 20 flashcards related to ${mainCode} and ${additionalInfo}. Provide the output as a JSON object in the following format:

{
"flashcards": [
    {
        "question": "Question 1 text here...",
        "answer": "Answer 1 text here..."
    },
    {
        "question": "Question 2 text here...",
        "answer": "Answer 2 text here..."
    }
    // Continue this format for all 20 flashcards
]
}

Ensure the JSON is valid, properly formatted, and includes diverse, relevant questions and detailed answers.
`
            });

            console.log('results', results);

            const jsonMatch = results.answer.match(
                /(?<!\S)(?:```(?:json)?\n)?\s*(?<json>\{\s*"flashcards"\s*:\s*\[(?:[^\]]*?)\]\s*\})(?:\n```)?/
            );

            console.log('jsonMatch', jsonMatch);
            if (!jsonMatch) {
                return JSON.stringify({ flashcards: [] });
            }

            return jsonMatch.groups.json;
        }
    );

    ipcMain.handle(
        'generate-additional-flashcards',
        async (event, model, mainCode, additionalInfo, selectedFlashcards, feedback) => {
            console.log(
                'selectedFlashcards',
                selectedFlashcards,
                mainCode,
                additionalInfo,
                model,
                feedback
            );

            const embeddings = new OllamaEmbeddings({
                model,
                baseUrl: 'http://localhost:11434'
            });

            const vectorStore = new Chroma(embeddings, {
                collectionName: 'a-test-collection'
            });

            const retriever = vectorStore.asRetriever();

            const prompt = ChatPromptTemplate.fromMessages([
                ['system', systemTemplateFlashcards.join('\n')],
                ['human', '{input}']
            ]);

            const questionAnswerChain = await createStuffDocumentsChain({
                llm: new Ollama({
                    model,
                    numCtx: 8192,
                    maxNumTokens: 8192,
                    temperature: 0.3
                }),
                prompt
            });
            const ragChain = await createRetrievalChain({
                retriever,
                combineDocsChain: questionAnswerChain
            });

            const results = await ragChain.invoke({
                input: `
Using the provided context and correctly generated flashcards as references, generate 20 new flashcards relevant to ${mainCode} and ${additionalInfo}. 

### Instructions:
1. Create each flashcard as an object in a valid JSON array.
2. Structure the output precisely as follows:
{
  "flashcards": [
    {
      "question": "Question 1 text here...",
      "answer": "Answer 1 text here..."
    },
    {
      "question": "Question 2 text here...",
      "answer": "Answer 2 text here..."
    }
    // Continue this format for all 20 flashcards
  ]
}
3. Ensure:
   - Questions are diverse and relevant to the provided context.
   - Answers are detailed and accurate.
   - JSON is properly formatted and parsable.
   - Questions and answers are unique and not repeated from the reference flashcards below.

### Reference Flashcards:
Use these examples to guide your response and maintain consistency:
${JSON.stringify(
    {
        flashcards: selectedFlashcards
    },
    null,
    2
)}

### Requirements:
- Generate 20 unique flashcards.
- Leverage both ${mainCode} and ${additionalInfo} topics thoroughly.
${feedback && `- Incorporate the feedback provided on the selected flashcards and why they were selected. Feedback: ${feedback}`}
- Validate the JSON format before returning.

Respond ONLY with the JSON object, nothing else.
`
            });
            console.log(
                'results all',
                results,
                model,
                mainCode,
                additionalInfo,
                feedback,
                selectedFlashcards
            );

            // console.log('results', results.answer);

            const jsonMatch = results.answer.match(
                /(?<!\S)(?:```(?:json)?\n)?\s*(?<json>\{\s*"flashcards"\s*:\s*\[(?:[^\]]*?)\]\s*\})(?:\n```)?/
            );
            // console.log('jsonMatch', jsonMatch);
            if (!jsonMatch) {
                return JSON.stringify({ flashcards: [] });
            }

            return jsonMatch.groups.json;
        }
    );
};

module.exports = { langchainHandler };
