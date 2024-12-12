import json


systemTemplateFlashcards = [
    """
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
""",
    """{context}\n\n"""
]

flashcardTemplate = lambda mainCode, additionalInfo: f"""
Using the context provided, generate 20 flashcards related to {mainCode} and {additionalInfo}. Provide the output as a JSON object in the following format:

{{
"flashcards": [
    {{
        "question": "Question 1 text here...",
        "answer": "Answer 1 text here..."
    }},
    {{
        "question": "Question 2 text here...",
        "answer": "Answer 2 text here..."
    }}
    // Continue this format for all 20 flashcards
]
}}

Ensure the JSON is valid, properly formatted, and includes diverse, relevant questions and detailed answers.
"""

flashcardRegenerationTemplate = lambda mainCode, additionalInfo, feedback, selectedFlashcards: f"""
Using the provided context and correctly generated flashcards as references, generate 20 new flashcards relevant to {mainCode} and {additionalInfo}. 

### Instructions:
1. Create each flashcard as an object in a valid JSON array.
2. Structure the output precisely as follows:
{{
  "flashcards": [
    {{
      "question": "Question 1 text here...",
      "answer": "Answer 1 text here..."
    }},
    {{
      "question": "Question 2 text here...",
      "answer": "Answer 2 text here..."
    }}
    // Continue this format for all 20 flashcards
  ]
}}
3. Ensure:
   - Questions are diverse and relevant to the provided context.
   - Answers are detailed and accurate.
   - JSON is properly formatted and parsable.
   - Questions and answers are unique and not repeated from the reference flashcards below.

### Reference Flashcards:
Use these examples to guide your response and maintain consistency:
{selectedFlashcards}

### Requirements:
- Generate 20 unique flashcards.
- Leverage both {mainCode} and {additionalInfo} topics thoroughly.
{feedback and f"- Incorporate the feedback provided on the selected flashcards and why they were selected. Feedback: {feedback}"}
- Validate the JSON format before returning.

Respond ONLY with the JSON object, nothing else."""


wordsJsonTemplate = """
{{
  "words": [
    "word1",
    "word2",
    "word3",
    "...",
    "word20"
  ]
}}"""

systemTemplateWordCloud = lambda mainCode: f"""
You are an advanced AI model skilled in analyzing text and extracting structured data. Your task is to extract 20 unique and diverse words relevant to a specific topic referred to as "{mainCode}". 

To perform this task optimally, follow these principles:
1. Understand Context: Thoroughly analyze the content of the provided PDFs and flashcards. Focus on understanding the intent behind "{mainCode}" to ensure extracted words are directly related to the topic. You will be provided with some more references, use them to enhance your understanding of the context of {mainCode}.
2. Ensure Relevance: Select words that reflect core, tangential, and diverse aspects of "{mainCode}", avoiding redundancy.
3. Prioritize Diversity: Aim to cover a broad range of concepts, ensuring the words span different subtopics or dimensions of "{mainCode}".
4. Validate Output: Format your response as a JSON object. Before returning, validate the JSON to ensure it adheres to the required structure and contains exactly 20 words.

Your response should adhere to the following format:
{wordsJsonTemplate}

Respond ONLY with the JSON object. Avoid any additional text, explanations, or comments.

{{context}}"""

wordCloudTemplate = lambda mainCode, flashcards: f"""
Please analyze the provided PDFs and use the flashcards to extract 20 unique and diverse words that are directly related to "{mainCode}". 

Approach the task in the following steps:
1. **Analyze the Content**: Carefully review the PDFs and flashcards to understand the core and contextual meaning of "{mainCode}".
2. **Extract Relevant Words**: Identify words that represent critical, supporting, or contrasting elements of "{mainCode}".
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

Reference context, selected by user show the context of {mainCode}.
- Use the provided flashcards to enhance your understanding of the topic and ensure the extracted words are relevant. {flashcards}

Return only the JSON object and ensure it is correctly formatted.
"""

wordCloudRegenerationTemplate = lambda mainCode, feedback, selectedWords: f"""
Please analyze the provided PDFs and use the flashcards to extract 20 unique and diverse words that are directly related to "{mainCode}". 

Approach the task in the following steps:
1. **Analyze the Content**: Carefully review the PDFs and flashcards to understand the core and contextual meaning of "{mainCode}".
2. **Extract Relevant Words**: Identify words that represent critical, supporting, or contrasting elements of "{mainCode}".
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

Reference context, selected by user show the context of {mainCode}.
- Use the provided selected words to enhance your understanding of the topic and ensure the extracted words are relevant. {selectedWords.join(', ')}
{feedback and f"- Incorporate the feedback provided on the selected words and why the other words were not selected. Feedback: {feedback}"}

Return only the JSON object and ensure it is correctly formatted."""


class CodePrompts:
    @staticmethod
    def system_prompt():
        return """You are a senior qualitative researcher refining codes based on feedback and/or context.

**Your task** is to provide codes considering the provided feedback and/or context, adhering to these guidelines:

### Output Format:

Provide the updated codes in **strict JSON format** adhering to the following structure:

{{
    "codes": [
        {{
            "code": "Updated code text here...",
            "evidence": "Relevant excerpt from the transcript..."
        }}
        // Repeat this structure for all updated codes
    ]
}}

### Requirements:

1. The JSON must be valid, properly formatted, and parseable.
2. Ensure the codes address the feedback and/or context and accurately reflect the themes in the transcript.
3. Each code must be accompanied by a relevant excerpt (evidence) from the transcript.

### Guidelines:

- Carefully consider each point in the feedback.
- Maintain consistency with the context and transcript.
- **Do not include any output other than the JSON object.**

**Return only the JSON object in the specified format.**
"""

    @staticmethod
    def generate(transcript, context):
        return f"""You are a highly skilled qualitative researcher specializing in thematic coding.

**Your task** is to generate codes from the provided transcript, following these guidelines:

### Output Format:

Provide the codes in **strict JSON format** adhering to the following structure:

{{
    "codes": [
        {{
            "code": "Code text here...",
            "evidence": "Relevant excerpt from the transcript..."
        }}
        // Repeat this structure for all identified codes
    ]
}}

### Requirements:

1. The JSON must be valid, properly formatted, and parseable.
2. Codes should accurately represent key themes in the transcript.
3. Each code must be accompanied by a relevant excerpt (evidence) from the transcript.
4. Consider the provided context to enhance the accuracy and relevance of the codes.
5. The provided context is just a sample and may not contain all relevant themes.

### Provided Transcript:

{transcript}

### Context:

{context}

### Guidelines:

- Use the context, including examples and user-selected words, as reference/sample to inform your coding.
- Ensure codes are concise, meaningful, and non-redundant.
- **Do not include any output other than the JSON object.**

**Return only the JSON object in the specified format.**
"""

    @staticmethod
    def judge_validate(codes_json1, codes_json2, transcript, main_code):
        return f"""You are a senior qualitative researcher facilitating the integration of codes from two colleagues.

**Your task** is to:

1. **Define a unified codebook** by reaching a consensus on how to code the segments, understanding the rationale behind each coding decision based on the codes given by each researcher and the reasoning provided by them.
2. **Recode the transcript** based on this unified codebook.

### Steps:

- Analyze both sets of codes and their associated reasoning.
- Identify common codes, conflicting codes, and unique codes.
- Understand the rationale behind each coding decision to reach a consensus.
- Create a unified codebook that accurately reflects the themes in the transcript.

### Output Format:

Provide the following in **strict JSON format**:

{{
    "unified_codebook": [
        {{
            "code": "Unified code text here...",
            "definition": "Definition of the code...",
            "examples": ["Example excerpt from the transcript..."]
        }}
        // Repeat this structure for all codes in the codebook
    ],
    "recoded_transcript": [
        {{
            "segment": "Segment of the transcript...",
            "code": "Assigned code from the unified codebook...",
            "reasoning": "Reasoning behind the coding decision..."
        }}
        // Repeat this structure for all segments
    ]
}}

### Requirements:

1. The JSON must be valid, properly formatted, and parseable.
2. The unified codebook should reflect a consensus between the two sets of codes, considering the reasoning provided by each researcher.
3. Recode the transcript segments based on the unified codebook.
4. Ensure that the codes and assigned segments accurately reflect the themes in the transcript and consider the provided main code.

### Codes and Reasoning from Researcher 1:

**Codes:**

{codes_json1}

### Codes and Reasoning from Researcher 2:

**Codes:**

{codes_json2}

### Provided Transcript:

{transcript}

### Main code:

{main_code}

### Guidelines:

- Carefully consider the reasoning provided by both researchers to reach a consensus.
- Maintain objectivity and ensure that the unified codebook is comprehensive and coherent.
- Use the main code to inform your decisions.
- **Do not include any output other than the JSON object.**

**Return only the JSON object in the specified format.**
"""

    @staticmethod
    def generate_with_feedback(transcript, context, feedback):
        return f"""You are a highly skilled qualitative researcher specializing in thematic coding.

**Your task** is to generate codes from the provided transcript, considering the feedback on previous codes, and following these guidelines:

### Output Format:

Provide the updated codes in **strict JSON format** adhering to the following structure:

{{
    "codes": [
        {{
            "code": "Updated code text here...",
            "evidence": "Relevant excerpt from the transcript..."
        }}
        // Repeat this structure for all updated codes
    ]
}}

### Requirements:

1. The JSON must be valid, properly formatted, and parseable.
2. Revise the codes to address the feedback on the previous codes.
3. Ensure the updated codes accurately reflect the themes in the transcript.
4. Each code must be accompanied by a relevant excerpt (evidence) from the transcript.
5. Consider the provided context as a reference, not as ground truth to enhance the accuracy and relevance of the codes.

### User Feedback on Previous Codes:

{feedback}

### Provided Transcript:

{transcript}

### Context:

{context}

### Guidelines:

- Carefully consider each point in the user's feedback on the previous codes.
- Use the context, including examples and user-selected words, as a sample reference to inform your coding.
- Ensure codes are concise, meaningful, and non-redundant.
- **Do not include any output other than the JSON object.**

**Return only the JSON object in the specified format.**
"""

    @staticmethod
    def judge_validate_with_feedback(codes_json1, codes_json2, transcript, main_code, feedback):
        return f"""You are a senior qualitative researcher facilitating the integration of codes from two colleagues.

**Your task** is to:

1. **Define a unified codebook** by reaching a consensus on how to code the segments, understanding the rationale behind each coding decision based on the codes given by each researcher and the feedback on the previous codes.
2. **Recode the transcript** based on this unified codebook.

### Steps:

- Analyze both sets of codes.
- Carefully consider the feedback on the previous codes.
- Identify common codes, conflicting codes, and unique codes.
- Understand the rationale behind each coding decision to reach a consensus.
- Create a unified codebook that accurately reflects the themes in the transcript.

### Output Format:

Provide the following in **strict JSON format**:

{{
    "unified_codebook": [
        {{
            "code": "Unified code text here...",
            "definition": "Definition of the code...",
            "examples": ["Example excerpt from the transcript..."]
        }}
        // Repeat this structure for all codes in the codebook
    ],
    "recoded_transcript": [
        {{
            "segment": "Segment of the transcript...",
            "code": "Assigned code from the unified codebook...",
            "reasoning": "Reasoning behind the assignment..."
        }}
        // Repeat this structure for all segments
    ]
}}

### Feedback on Previous Codes:

{feedback}

### Codes from Researcher 1:

{codes_json1}

### Codes from Researcher 2:

{codes_json2}

### Provided Transcript:

{transcript}

### Main code:

{main_code}

### Guidelines:

- Carefully consider the reasoning provided by both researchers and the feedback to reach a consensus.
- Maintain objectivity and ensure that the unified codebook is comprehensive and coherent.
- Use the main code and feedback to inform your decisions.
- **Do not include any output other than the JSON object.**

**Return only the JSON object in the specified format.**
"""
