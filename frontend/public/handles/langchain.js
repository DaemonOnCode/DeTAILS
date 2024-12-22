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
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

const { codePrompts } = require('../utils/code_helper');
const { getPostById, initDatabase } = require('../utils/db-helpers');
const logger = require('../utils/logger');
const { createTimer } = require('../utils/timer');

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

const generateTranscript = (post) => {
    // Start with the post title and selftext
    let transcript = `Title: ${post.title}\n\n${post.selftext}\n\n`;

    console.log('post', post);

    // Helper function to recursively process comments
    const processComments = (comments, depth = 0) => {
        let result = '';
        console.log('comments', comments, typeof comments);

        if (!comments) {
            return '';
        }

        comments.forEach((comment) => {
            const indent = '  '.repeat(depth); // Indentation for nested comments
            result += `${indent}- ${comment.body}\n`;
            if (comment.comments && comment.comments.length > 0) {
                result += processComments(comment.comments, depth + 1);
            }
        });
        return result;
    };

    // If there are comments, process them
    if (post.comments && post.comments.length > 0) {
        transcript += `Comments:\n`;
        transcript += processComments(post.comments);
    }

    return transcript.trim();
};

const generateContext = (references, mainCode, selectedFlashcards, selectedWords) => {
    let context = '';

    // Add the main code
    context += `Main Code:\n${mainCode}\n\n`;

    // Add selected words
    if (selectedWords && selectedWords.length > 0) {
        context += `Selected Words:\n- ${selectedWords.join('\n- ')}\n\n`;
    }

    // Add selected flashcards
    if (selectedFlashcards && selectedFlashcards.length > 0) {
        context += `Flashcards:\n`;
        selectedFlashcards.forEach((flashcard) => {
            context += `Q: ${flashcard.question}\nA: ${flashcard.answer}\n\n`;
        });
    }

    // Add references
    if (references && Object.keys(references).length > 0) {
        context += `References:\n`;
        console.log('references', references);
        for (const [code, refList] of Object.entries(references)) {
            context += `Code: ${code}\n`;
            console.log('refList', refList, refList.length, typeof refList);
            refList.forEach((ref) => {
                context += `- ${ref.text}\n`;
            });
            context += '\n';
        }
    }

    return context.trim();
};

const generateFeedback = (feedback) => {
    let string = ``;
    for (let f of feedback) {
        string += `Feedback: The following code was ${!f.isMarked ? 'wrong' : 'correct'} - for "${f.sentence}"\n`;
        if (f.comment) {
            string += `Comment: ${f.comment}\n`;
        }
    }
    return string;
};

const chromaBasisCollection = 'a-test-collection';

const langchainHandler = () => {
    ipcMain.handle(
        'add-documents-langchain',
        async (event, documents, model, mainCode, additionalInfo, regenerate = false) => {
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200
            });

            const embeddings = new OllamaEmbeddings({
                model
            });

            const vectorStore = new Chroma(embeddings, {
                collectionName: chromaBasisCollection
            });

            const timer = createTimer();

            if (!regenerate) {
                await logger.info('Adding documents to vector store:', { documents });
                console.log('documentPaths', documents);
                if (!documents || typeof documents !== 'object') {
                    return;
                }

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
                await logger.info('Documents added to vector store.');
                await logger.time('Adding all documents to vector store', { time: timer.end() });
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
                    temperature: 0.3,
                    callbacks: [
                        {
                            handleLLMNewToken: (token) => {
                                console.log('token', token);
                            }
                        }
                    ]
                }),
                prompt
            });
            const ragChain = await createRetrievalChain({
                retriever,
                combineDocsChain: questionAnswerChain
            });

            await logger.info('Documents loaded and chains created.');

            await logger.info('Invoking chain for flashcards generation.');
            timer.reset();
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

            await logger.time('Flashcards generated', { time: timer.end() });
            console.log('results', results);
            await logger.info('Flashcards generated:', { results });

            const combinedMatch = results.answer.match(
                /(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*"flashcards"\s*:\s*\[(?<flashcards>(?:\{\s*"question"\s*:\s*".*?"\s*,\s*"answer"\s*:\s*".*?"\s*\},?\s*)+)\]\s*\}|\[\s*(?<standalone>(?:\{\s*"question"\s*:\s*".*?"\s*,\s*"answer"\s*:\s*".*?"\s*\},?\s*)+)\s*\])(?:\n```)?/
            );

            console.log(1);

            if (!combinedMatch) {
                // Return an empty flashcards array if no match is found
                return JSON.stringify({ flashcards: [] });
            }

            console.log(2);

            // Determine which group matched: `flashcards` or `standalone`
            let rawEntries;
            if (combinedMatch.groups.flashcards) {
                rawEntries = `[${combinedMatch.groups.flashcards}]`; // Wrap entries in square brackets
            } else if (combinedMatch.groups.standalone) {
                rawEntries = `[${combinedMatch.groups.standalone}]`; // Standalone array is already valid
            } else {
                // If neither matches, return an empty array
                return JSON.stringify({ flashcards: [] });
            }

            console.log(3);

            // Parse the matched entries
            let parsedFlashcards = [];
            try {
                parsedFlashcards = JSON.parse(rawEntries);
            } catch (e) {
                console.error('Error parsing entries:', e);
                await logger.error('Error parsing flashcards:', { error: e });
                return JSON.stringify({ flashcards: [] }); // Return empty flashcards array on error
            }

            console.log(4);

            // Return the reconstructed JSON object with the parsed flashcards
            return JSON.stringify({
                flashcards: parsedFlashcards
            });
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

            await logger.info('Generating additional flashcards:', { selectedFlashcards });
            const embeddings = new OllamaEmbeddings({
                model
            });

            const vectorStore = new Chroma(embeddings, {
                collectionName: chromaBasisCollection
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
                    temperature: 0.3,
                    callbacks: [
                        {
                            handleLLMNewToken: (token) => {
                                console.log('token', token);
                            }
                        }
                    ]
                }),
                prompt
            });
            const ragChain = await createRetrievalChain({
                retriever,
                combineDocsChain: questionAnswerChain
            });

            await logger.info('Chains created for additional flashcards generation.');

            await logger.info('Invoking chain for additional flashcards generation.');

            const timer = createTimer();
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
            await logger.time('Additional flashcards generated', { time: timer.end() });

            console.log(
                'results all',
                results,
                model,
                mainCode,
                additionalInfo,
                feedback,
                selectedFlashcards
            );

            await logger.info('Additional flashcards generated:', { results });

            // console.log('results', results.answer);

            const combinedMatch = results.answer.match(
                /(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*"flashcards"\s*:\s*\[(?<flashcards>(?:\{\s*"question"\s*:\s*".*?"\s*,\s*"answer"\s*:\s*".*?"\s*\},?\s*)+)\]\s*\}|\[\s*(?<standalone>(?:\{\s*"question"\s*:\s*".*?"\s*,\s*"answer"\s*:\s*".*?"\s*\},?\s*)+)\s*\])(?:\n```)?/
            );

            console.log(1);

            if (!combinedMatch) {
                // Return an empty flashcards array if no match is found
                return JSON.stringify({ flashcards: [] });
            }

            console.log(2);

            // Determine which group matched: `flashcards` or `standalone`
            let rawEntries;
            if (combinedMatch.groups.flashcards) {
                rawEntries = `[${combinedMatch.groups.flashcards}]`; // Wrap entries in square brackets
            } else if (combinedMatch.groups.standalone) {
                rawEntries = `[${combinedMatch.groups.standalone}]`; // Standalone array is already valid
            } else {
                // If neither matches, return an empty array
                return JSON.stringify({ flashcards: [] });
            }

            console.log(3);

            // Parse the matched entries
            let parsedFlashcards = [];
            try {
                parsedFlashcards = JSON.parse(rawEntries);
            } catch (e) {
                console.error('Error parsing entries:', e);
                await logger.error('Error parsing regenerated flashcards:', { error: e });
                return JSON.stringify({ flashcards: [] }); // Return empty flashcards array on error
            }

            console.log(4);

            // Return the reconstructed JSON object with the parsed flashcards
            return JSON.stringify({
                flashcards: parsedFlashcards
            });
        }
    );

    ipcMain.handle(
        'generate-words',
        async (
            event,
            model,
            mainCode,
            flashcards = null,
            regenerate = false,
            selectedWords = [],
            feedback = ''
        ) => {
            await logger.info('Generating words:', { model, mainCode, flashcards, regenerate });
            const embeddings = new OllamaEmbeddings({
                model
            });

            const vectorStore = new Chroma(embeddings, {
                collectionName: chromaBasisCollection
            });

            const retriever = vectorStore.asRetriever();

            const prompt = ChatPromptTemplate.fromMessages([
                [
                    'system',
                    `You are an advanced AI model skilled in analyzing text and extracting structured data. Your task is to extract 20 unique and diverse words relevant to a specific topic referred to as "${mainCode}". 

To perform this task optimally, follow these principles:
1. Understand Context: Thoroughly analyze the content of the provided PDFs and flashcards. Focus on understanding the intent behind "${mainCode}" to ensure extracted words are directly related to the topic. You will be provided with some more references, use them to enhance your understanding of the context of ${mainCode}.
2. Ensure Relevance: Select words that reflect core, tangential, and diverse aspects of "${mainCode}", avoiding redundancy.
3. Prioritize Diversity: Aim to cover a broad range of concepts, ensuring the words span different subtopics or dimensions of "${mainCode}".
4. Validate Output: Format your response as a JSON object. Before returning, validate the JSON to ensure it adheres to the required structure and contains exactly 20 words.

Your response should adhere to the following format:
{{
  "words": [
    "word1",
    "word2",
    "word3",
    "...",
    "word20"
  ]
}}

Respond ONLY with the JSON object. Avoid any additional text, explanations, or comments.

{context}`
                ],
                ['human', '{input}']
            ]);

            const questionAnswerChain = await createStuffDocumentsChain({
                llm: new Ollama({
                    model,
                    numCtx: 8192,
                    maxNumTokens: 8192,
                    temperature: 0.3,
                    callbacks: [
                        {
                            handleLLMNewToken: (token) => {
                                console.log('token', token);
                            }
                        }
                    ]
                }),
                prompt
            });

            const ragChain = await createRetrievalChain({
                retriever,
                combineDocsChain: questionAnswerChain
            });

            const input = regenerate
                ? `Please analyze the provided PDFs and use the flashcards to extract 20 unique and diverse words that are directly related to "${mainCode}". 

Approach the task in the following steps:
1. **Analyze the Content**: Carefully review the PDFs and flashcards to understand the core and contextual meaning of "${mainCode}".
2. **Extract Relevant Words**: Identify words that represent critical, supporting, or contrasting elements of "${mainCode}".
3. **Diversity Check**: Ensure the 20 words reflect various dimensions of the topic, avoiding repetitive or overly similar terms.
4. **Validate Output**: Format the output as a JSON object and verify it adheres to the structure below. The response should ONLY include this JSON:

{
  "words": [
    "word1",
    "word2",
    "word3",
    "...",
    "word20"
  ]
}

Reference context, selected by user show the context of ${mainCode}.
- Use the provided selected words to enhance your understanding of the topic and ensure the extracted words are relevant. ${selectedWords.join(', ')}
${feedback && `- Incorporate the feedback provided on the selected words and why the other words were not selected. Feedback: ${feedback}`}

Return only the JSON object and ensure it is correctly formatted.`
                : `Please analyze the provided PDFs and use the flashcards to extract 20 unique and diverse words that are directly related to "${mainCode}". 

Approach the task in the following steps:
1. **Analyze the Content**: Carefully review the PDFs and flashcards to understand the core and contextual meaning of "${mainCode}".
2. **Extract Relevant Words**: Identify words that represent critical, supporting, or contrasting elements of "${mainCode}".
3. **Diversity Check**: Ensure the 20 words reflect various dimensions of the topic, avoiding repetitive or overly similar terms.
4. **Validate Output**: Format the output as a JSON object and verify it adheres to the structure below. The response should ONLY include this JSON:

{{
  "words": [
    "word1",
    "word2",
    "word3",
    "...",
    "word20"
  ]
}}

Reference context, selected by user show the context of ${mainCode}.
- Use the provided flashcards to enhance your understanding of the topic and ensure the extracted words are relevant. ${JSON.stringify(flashcards, null, 2)}

Return only the JSON object and ensure it is correctly formatted.
`;

            await logger.info('Invoking chain for words generation.');
            const timer = createTimer();
            const results = await ragChain.invoke({
                input
            });
            await logger.time('Words generated', { time: timer.end() });

            await logger.info('Words generated:', { results });

            const wordsMatch = results.answer.match(
                /(?<!\S)(?:```(?:json)?\n)?\s*(?:\{\s*"words"\s*:\s*\[(?<words>(?:\s*".*?"\s*,?)*?)\s*\}|\[\s*(?<standalone>(?:\s*".*?"\s*,?)*?)\s*\])(?:\n```)?/
            );

            console.log(1);

            if (!wordsMatch) {
                // Return an empty words array if no match is found
                return JSON.stringify({ words: [] });
            }

            console.log(2);

            // Determine which group matched: `words` or `standalone`
            let rawEntries;
            if (wordsMatch.groups.words) {
                rawEntries = `[${wordsMatch.groups.words}]`; // Wrap words entries in square brackets
            } else if (wordsMatch.groups.standalone) {
                rawEntries = `[${wordsMatch.groups.standalone}]`; // Standalone array is already valid
            } else {
                // If neither matches, return an empty array
                return JSON.stringify({ words: [] });
            }

            console.log(3);

            // Parse the matched entries
            let parsedWords = [];
            try {
                parsedWords = JSON.parse(rawEntries);
            } catch (e) {
                console.error('Error parsing words entries:', e);
                await logger.error('Error parsing words entries:', { error: e });
                return JSON.stringify({ words: [] }); // Return empty words array on error
            }

            console.log(4);

            // Return the reconstructed JSON object with the parsed words
            return JSON.stringify({
                words: parsedWords
            });
        }
    );

    ipcMain.handle(
        'generate-codes',
        async (
            event,
            model,
            references,
            mainCode,
            selectedFlashcards,
            selectedWords,
            selectedPosts,
            dbPath
        ) => {
            console.log(
                model,
                references,
                mainCode,
                selectedFlashcards,
                selectedWords,
                selectedPosts,
                dbPath
            );

            await logger.info('Generating codes:', { model, mainCode, selectedPosts, dbPath });
            const llm1 = new Ollama({
                model,
                numCtx: 16384,
                maxNumTokens: 16384,
                temperature: 0.9,
                callbacks: [
                    {
                        handleLLMNewToken: (token) => {
                            console.log('token', token);
                        }
                    }
                ]
            });

            const llm2 = new Ollama({
                model,
                numCtx: 16384,
                maxNumTokens: 16384,
                temperature: 0.2,
                callbacks: [
                    {
                        handleLLMNewToken: (token) => {
                            console.log('token', token);
                        }
                    }
                ]
            });

            const judgeLlm = new Ollama({
                model,
                numCtx: 16384,
                maxNumTokens: 16384,
                temperature: 0.5,
                callbacks: [
                    {
                        handleLLMNewToken: (token) => {
                            console.log('token', token);
                        }
                    }
                ]
            });

            const finalResults = [];

            const totalTimer = createTimer();
            for (const postId of selectedPosts) {
                await logger.info('Generating codes for post:', { postId });
                console.log('post', postId);
                const timer = createTimer();

                const db = await initDatabase(dbPath);
                const postData = await getPostById(
                    db,
                    postId,
                    ['id', 'title', 'selftext'],
                    ['id', 'body', 'parent_id']
                );

                db.close();

                const transcript = generateTranscript(postData);
                const context = generateContext(
                    references,
                    mainCode,
                    selectedFlashcards,
                    selectedWords
                );

                console.log('transcript', transcript, 'context', context);

                let generationPrompt1 = codePrompts.generate(transcript, context);
                const promptGenerator1 = ChatPromptTemplate.fromMessages([
                    new SystemMessage(codePrompts.systemPrompt),
                    new HumanMessage(generationPrompt1)
                ]);
                const chain1 = promptGenerator1.pipe(llm1);
                await logger.info('Invoking chain 1 for code generation.', { postId });
                timer.reset();
                const results1 = await chain1.invoke();
                await logger.time('Generating codes for post from LLM 1', {
                    postId,
                    time: timer.end()
                });

                console.log('results 1', results1);

                let generatePrompt2 = codePrompts.generate(transcript, context);

                const promptGenerator2 = ChatPromptTemplate.fromMessages([
                    new SystemMessage(codePrompts.systemPrompt),
                    new HumanMessage(generatePrompt2)
                ]);

                const chain2 = promptGenerator2.pipe(llm2);
                await logger.info('Invoking chain 2 for code generation.', { postId });
                timer.reset();
                const results2 = await chain2.invoke();
                await logger.time('Generating codes for post from LLM 2', {
                    postId,
                    time: timer.end()
                });

                console.log('results 2', results2);

                let validatePromptFromResults = codePrompts.judgeValidate(
                    results1,
                    results2,
                    transcript,
                    mainCode
                );
                const promptValidator = ChatPromptTemplate.fromMessages([
                    new SystemMessage(codePrompts.systemPrompt),
                    new HumanMessage(validatePromptFromResults)
                ]);

                const chain3 = promptValidator.pipe(judgeLlm);
                await logger.info('Invoking chain 3 for code validation.', { postId });
                timer.reset();
                const results3 = await chain3.invoke();
                await logger.time('Validating codes for post from LLM Judge', {
                    postId,
                    time: timer.end()
                });

                console.log('results 3', results3);

                const match = results3.match(
                    /(?:```json\s*)?\{\s*"unified_codebook":\s*(?<codebook>\[[\s\S]*?\])\s*,?\s*"recoded_transcript":\s*(?<transcript>\[[\s\S]*?\])?\s*\}?/
                );

                if (!match) {
                    console.log('No match found.');
                    console.log(JSON.stringify({ unified_codebook: [], recoded_transcript: [] }));
                } else {
                    const { codebook, transcript } = match.groups; // Access named groups

                    let parsedCodebook = [];
                    let parsedTranscript = [];

                    try {
                        if (codebook) {
                            parsedCodebook = JSON.parse(codebook);
                        }
                        if (transcript) {
                            parsedTranscript = JSON.parse(transcript);
                        }
                    } catch (error) {
                        console.error('Error parsing JSON:', error);
                        await logger.error('Error parsing JSON in coding:', { error, postId });
                        console.log(
                            JSON.stringify({ unified_codebook: [], recoded_transcript: [] })
                        );
                    }

                    const result = {
                        unified_codebook: parsedCodebook,
                        recoded_transcript: parsedTranscript
                    };

                    finalResults.push(result);
                }
            }
            await logger.time('Generating codes for all posts', { time: totalTimer.end() });
            return finalResults;
        }
    );

    ipcMain.handle(
        'generate-codes-with-feedback',
        async (
            event,
            model,
            references,
            mainCode,
            selectedFlashcards,
            selectedWords,
            selectedPosts,
            feedback,
            dbPath
        ) => {
            console.log(
                model,
                references,
                mainCode,
                selectedFlashcards,
                selectedWords,
                selectedPosts,
                dbPath,
                feedback
            );

            await logger.info('Generating codes with feedback:', {
                model,
                mainCode,
                selectedPosts,
                dbPath
            });
            const llm1 = new Ollama({
                model,
                numCtx: 16384,
                maxNumTokens: 16384,
                temperature: 0.9,
                callbacks: [
                    {
                        handleLLMNewToken: (token) => {
                            console.log('token', token);
                        }
                    }
                ]
            });

            const llm2 = new Ollama({
                model,
                numCtx: 16384,
                maxNumTokens: 16384,
                temperature: 0.2,
                callbacks: [
                    {
                        handleLLMNewToken: (token) => {
                            console.log('token', token);
                        }
                    }
                ]
            });

            const judgeLlm = new Ollama({
                model,
                numCtx: 16384,
                maxNumTokens: 16384,
                temperature: 0.5,
                callbacks: [
                    {
                        handleLLMNewToken: (token) => {
                            console.log('token', token);
                        }
                    }
                ]
            });

            const finalResults = [];

            const totalTimer = createTimer();
            for (const postId of selectedPosts) {
                const timer = createTimer();
                await logger.info('Generating codes with feedback for post:', { postId });
                console.log('post', postId);

                const db = await initDatabase(dbPath);
                const postData = await getPostById(
                    db,
                    postId,
                    ['id', 'title', 'selftext'],
                    ['id', 'body', 'parent_id']
                );

                db.close();

                const transcript = generateTranscript(postData);
                const context = generateContext(
                    references,
                    mainCode,
                    selectedFlashcards,
                    selectedWords
                );

                const feedbackText = generateFeedback(feedback);

                console.log('transcript', transcript, 'context', context);

                let generationPrompt1 = codePrompts.generateWithFeedback(
                    transcript,
                    context,
                    feedbackText
                );
                const promptGenerator1 = ChatPromptTemplate.fromMessages([
                    new SystemMessage(codePrompts.systemPrompt),
                    new HumanMessage(generationPrompt1)
                ]);
                const chain1 = promptGenerator1.pipe(llm1);
                await logger.info('Invoking chain 1 for code generation with feedback.', {
                    postId
                });
                timer.reset();
                const results1 = await chain1.invoke();
                await logger.time('Regenerating codes for post from LLM 1', {
                    postId,
                    time: timer.end()
                });

                console.log('results 1', results1);

                let generatePrompt2 = codePrompts.generateWithFeedback(
                    transcript,
                    context,
                    feedbackText
                );

                const promptGenerator2 = ChatPromptTemplate.fromMessages([
                    new SystemMessage(codePrompts.systemPrompt),
                    new HumanMessage(generatePrompt2)
                ]);

                const chain2 = promptGenerator2.pipe(llm2);
                await logger.info('Invoking chain 2 for code generation with feedback.', {
                    postId
                });
                timer.reset();
                const results2 = await chain2.invoke();
                await logger.time('Regenerating codes for post from LLM 2', {
                    postId,
                    time: timer.end()
                });

                console.log('results 2', results2);

                let validatePromptFromResults = codePrompts.judgeValidateWithFeedback(
                    results1,
                    results2,
                    transcript,
                    mainCode,
                    feedbackText
                );
                const promptValidator = ChatPromptTemplate.fromMessages([
                    new SystemMessage(codePrompts.systemPrompt),
                    new HumanMessage(validatePromptFromResults)
                ]);

                const chain3 = promptValidator.pipe(judgeLlm);
                await logger.info('Invoking chain 3 for code validation with feedback.', {
                    postId
                });
                timer.reset();
                const results3 = await chain3.invoke();
                await logger.time('Validating codes for post from LLM Judge', {
                    postId,
                    time: timer.end()
                });

                console.log('results 3', results3);

                const match = results3.match(
                    /(?:```json\s*)?\{\s*"unified_codebook":\s*(?<codebook>\[[\s\S]*?\])\s*,?\s*"recoded_transcript":\s*(?<transcript>\[[\s\S]*?\])?\s*\}?/
                );

                if (!match) {
                    console.log('No match found.');
                    console.log(JSON.stringify({ unified_codebook: [], recoded_transcript: [] }));
                } else {
                    const { codebook, transcript } = match.groups; // Access named groups

                    let parsedCodebook = [];
                    let parsedTranscript = [];

                    try {
                        if (codebook) {
                            parsedCodebook = JSON.parse(codebook);
                        }
                        if (transcript) {
                            parsedTranscript = JSON.parse(transcript);
                        }
                    } catch (error) {
                        console.error('Error parsing JSON:', error);
                        await logger.error('Error parsing JSON in recoding:', { error, postId });
                        console.log(
                            JSON.stringify({ unified_codebook: [], recoded_transcript: [] })
                        );
                    }

                    const result = {
                        unified_codebook: parsedCodebook,
                        recoded_transcript: parsedTranscript
                    };

                    finalResults.push(result);
                }
            }
            await logger.time('Generating codes with feedback for all posts', {
                time: totalTimer.end()
            });
            return finalResults;
        }
    );
};

module.exports = { langchainHandler };
