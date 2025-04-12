import json

class FlashcardPrompts:
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
    @staticmethod
    def flashcardTemplate(mainCode, additionalInfo): 
        return f"""
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

    @staticmethod
    def flashcardRegenerationTemplate(mainCode, additionalInfo, feedback, selectedFlashcards): 
        return f"""
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

class WordCloudPrompts:
    @staticmethod
    def systemTemplateWordCloud(mainCode): 
        return f"""
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
    @staticmethod
    def wordCloudTemplate(mainCode, flashcards): 
        return f"""
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
    @staticmethod
    def wordCloudRegenerationTemplate(mainCode, feedback, selectedWords): 
        return f"""
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

{context}
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


class ThemePrompts:
  systemTemplateThemes = ["""
  You are a highly skilled qualitative researcher specializing in thematic analysis. Your role is to analyze data and use the given main concept and additional context to generate related themes. Your responses must be concise, diverse, and inclusive, reflecting nuanced patterns within the data.
                          
  ### Provided context:
  {context}
  """, """\n\n{context}\n\n"""]

  @staticmethod
  def themesTemplate(mainCode, additionalInfo): 
      return f"""
Using the following inputs:

Main Code: {mainCode}
{f"Additional Info: {additionalInfo}" if additionalInfo else ""}

Generate 20 related themes. Each theme must be:
- A single descriptive word that aligns with the given main concept and additional context.
- Diverse, inclusive, and reflective of the input.

Provide the output as a JSON object in the following format:
{{
  "themes": [
    "Theme1",
    "Theme2",
    "Theme3",
    ...
    "Theme20"
  ]
}}
Respond with only the JSON object.
"""
  @staticmethod
  def themesRegenerationTemplate(mainCode, additionalInfo, feedback, selectedThemes): 
      return f"""
Using the following inputs:

Main Code: {mainCode}
{f"Additional Info: {additionalInfo}" if additionalInfo else ""}
Feedback: {feedback}
Correct or User-Selected Themes: {selectedThemes}

Regenerate 10 more themes based on the feedback. Ensure:
- Each new theme is a single word that aligns with the given main concept and additional context.
- Themes align closely with the main concept ({mainCode}) and optional additional context.
- Themes address the specific issues outlined in the feedback.
- The new themes are aligned with the User-selected themes but are not same.
- The new themes are diverse, inclusive, and more satisfactory than the original.

Provide the refined output as a JSON object in the following format:
{{
  "themes": [
    "Theme1",
    "Theme2",
    "Theme3",
    ...
    "Theme20"
  ]
}}
Respond with only the JSON object.
"""

class CodebookPrompts:
    systemTemplateCodebook = ["""
You are an advanced qualitative researcher and coding expert specializing in thematic analysis and codebook development. Your task is to generate a comprehensive codebook from user-provided themes. You will first receive a set of themes, and then you will create multiple related codes derived from those themes. Each code should clearly reflect an aspect of its originating theme, while providing a distinct definition, inclusion criteria, and exclusion criteria.

Follow these instructions for each code you produce:
1. The code should be a unique concept related to the originating theme.
2. Provide a clear, concise description of the code and how it relates back to the theme.
3. Specify inclusion criteria detailing the types of textual evidence or instances that should be coded under this code.
4. Specify exclusion criteria detailing what should not be included to avoid confusion or overlap with other codes.

### Provided context:
{context}                          

The output must be formatted as a JSON object, following this structure:
{{
  "codebook": [
    {{
      "word": "Word",
      "description": "Description of the word and its related codes.",
      "inclusion_criteria": ["Criteria 1", "Criteria 2", ...],
      "exclusion_criteria": ["Criteria 1", "Criteria 2", ...]
    }},
    ...
  ]
}}
""","""\n\n{context}\n\n"""]

    @staticmethod
    def codebookTemplate(mainCode, additionalInfo, selectedThemes): 
        return f"""
Below are the themes I want you to work with: {selectedThemes}

Use Main Code: {mainCode} and Additional Info: {additionalInfo} to generate a codebook. 

Please generate a codebook of only 20 words. For each provided theme, create multiple codes derived from that theme. 
Do not treat the themes as codes directly; instead, create codes that reflect different facets or dimensions of each theme. 
Make sure to include a clear description, inclusion criteria, and exclusion criteria for each code.

Return the codebook as a JSON object in the following structure:

{{
  "codebook": [
    {{
      "word": "CodeName",
      "description": "Description of the code and its relation to the originating theme.",
      "inclusion_criteria": ["Example inclusion", "..."],
      "exclusion_criteria": ["Example exclusion", "..."]
    }},
    ...
  ]
}}

Respond with only the JSON object.
"""

    @staticmethod
    def codebookRegenerationTemplate(mainCode, additionalInfo, selectedThemes, currentCodebook): 
        return f"""
Use the current state of the codebook below to generate additional codes.

Provided Codebook:
{json.dumps(currentCodebook)}

Below are the themes I want you to work with: {selectedThemes}

Use Main Code: {mainCode} and Additional Info: {additionalInfo} to generate **additional codes** that align with the existing entries in the codebook.

For each provided theme:
- Analyze the existing codes to identify gaps or areas for further expansion.
- Generate additional codes that are related to the theme or existing codes but cover a distinct focus or facet.
- Ensure each new code includes a clear description, inclusion criteria, and exclusion criteria.

Return the updated codebook (including only new codes) in the following JSON format:

{{
  "new_codes": [
    {{
      "word": "NewCodeName",
      "description": "Description of the new code and its relationship to the originating theme or code.",
      "inclusion_criteria": ["Specific criteria for what this code includes."],
      "exclusion_criteria": ["Specific criteria for what this code excludes."]
    }},
    ...
  ]
}}
"""