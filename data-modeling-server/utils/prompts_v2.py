class ContextPrompt:
    keyword_json_template = """
{
  "keywords": [
    {
      "word": "ExtractedKeyword",
      "description": "Explanation of the word and its relevance to the main topic and additional information.",
      "inclusion_criteria": ["Criteria 1", "Criteria 2", "..."],
      "exclusion_criteria": ["Criteria 1", "Criteria 2", "..."]
    },
    ...
  ]
}"""

    @staticmethod
    def systemPromptTemplate(mainTopic: str, researchQuestions: str, additionalInfo: str):
        return [
            f"""You are an AI researcher using Braun & Clarke's 6-phase thematic analysis. Follow these PHASE 1 (Familiarization) steps:

1. DATA IMMERSION:
   - Read all textual data 3 times while:
     a) First pass: Holistic understanding of {mainTopic}
     b) Second pass: Note interesting features
     c) Third pass: Pattern identification
   - Generate "immersion_notes" for each keyword

2. INITIAL OBSERVATION DOCUMENTATION:
   - Flag content related to {researchQuestions}
   - Mark both manifest and latent content
   - Note contradictions in {additionalInfo}

3. SEMANTIC/LATENT CODING PREPARATION:
   - Distinguish between:
     • Semantic: Surface-level meanings
     • Latent: Underlying ideas/assumptions
   - Tag each keyword with "code_type"

You are also instructed to identify 20 highly relevant keywords that will serve as the foundation for building context in a qualitative research study.

Each keyword should come with:
- A clear description explaining its relevance to the main topic.
- Inclusion criteria specifying when the keyword should be applied in coding.
- Exclusion criteria specifying when the keyword should not be applied to prevent misclassification.

Output must be strictly in the JSON format described.""",
            """\nTextual Data: \n{context}\n\n"""
        ]

    @staticmethod
    def context_builder(mainTopic: str, researchQuestions: str, additionalInfo: str):
        return f"""
PHASE 1 EXECUTION: Generate 20 initial codes with:

- Semantic Codes (Visible Content):
  • Direct participant phrases
  • Explicit mentions of {mainTopic}

- Latent Codes (Conceptual Content):
  • Underlying assumptions
  • Cultural/social frameworks

Include in JSON:
1. immersion_notes from 3 readings
2. code_type classification
3. Data excerpts supporting inclusion/exclusion

I need a structured list of 20 keywords with coding guidelines to establish context for deductive thematic analysis, based on:
- Main Topic: {mainTopic}
- Research Questions: {researchQuestions}
- Additional Information: {additionalInfo}

Return exactly 20 keywords in the following JSON format:

```json
{{
  "keywords": [
    {{
      "word": "ExtractedKeyword",
      "description": "Explanation of the word and its relevance to the main topic and additional information.",
      "inclusion_criteria": ["Criteria 1", "Criteria 2", "..."],
      "exclusion_criteria": ["Criteria 1", "Criteria 2", "..."]
    }},
    ...
  ]
}}
```
Important:
- Only return the JSON object—no explanations, summaries, or additional text.
- Valid JSON is required. 
"""

    @staticmethod
    def regenerationPromptTemplate(mainTopic: str,
                                   researchQuestions: str,
                                   additionalInfo: str,
                                   selectedKeywords: str,
                                   unselectedKeywords: str,
                                   extraFeedback: str):

        return [
            f"""You are an advanced AI specializing in qualitative research and thematic coding. Your task is to refine previously generated keywords based on selected themes, unselected themes, and new feedback.

### New Inputs:
- Selected Keywords (DO NOT include these keywords): {selectedKeywords}
- Unselected Keywords (DO NOT include these keywords): {unselectedKeywords}
- Extra Feedback: {extraFeedback}

### Process
1. Re-evaluating the Context
   - Analyze the main topic, research questions, and additional information.
   - Use selected themes as a basis for improving keyword selection.
   - REMOVE any keywords related to unselected themes.

2. Improving Keyword Selection
   - Modify existing keywords based on feedback.
   - Remove irrelevant or redundant keywords.
   - Introduce new keywords if necessary.
   - Ensure keywords align with selected themes while excluding unselected ones.

3. Providing Updated Information for Each Keyword
   - Description: Explain the revised keyword's relevance.
   - Inclusion Criteria: When should this keyword be applied?
   - Exclusion Criteria: When should it not be applied?

4. Output Formatting
   Your response must be strictly in JSON format, following this structure:

```json
{ContextPrompt.keyword_json_template}
```

### Important Notes
- DO NOT include explanations, summaries, or additional text.
- Ensure JSON is valid and properly formatted.
- Provide exactly 5 refined keywords.
- REMOVE keywords related to unselected themes.

Proceed with refining the keywords.
""",
            """\nTextual Data: \n{context}\n\n"""
        ]

    @staticmethod
    def refined_context_builder(mainTopic: str,
                                    researchQuestions: str,
                                    additionalInfo: str,
                                    selectedKeywords: str,
                                    unselectedKeywords: str,
                                    extraFeedback: str):

        return f"""
I need a refined list of 5 keywords based on the following research inputs:

- Main Topic: {mainTopic}
- Research Questions: {researchQuestions}
- Additional Information: {additionalInfo}
- Selected Keywords: {selectedKeywords}
- Unselected Keywords (DO NOT include keywords related to these themes): {unselectedKeywords}
- Extra Feedback: {extraFeedback}

Instructions:
- Modify existing keywords based on feedback.
- Adjust descriptions, inclusion, and exclusion criteria.
- REMOVE any keywords related to unselected themes.
- Keep JSON format strict.

Output Format:
```json
{{
  "keywords": [
    {{
      "word": "RefinedKeyword",
      "description": "Updated explanation...",
      "inclusion_criteria": ["Criteria 1", "Criteria 2"],
      "exclusion_criteria": ["Criteria 1", "Criteria 2"]
    }},
    ...
  ]
}}
```

Proceed with the refinement.
"""


class InitialCodePrompts:
    @staticmethod
    def initial_code_prompt(main_topic: str,
                            additional_info: str,
                            research_questions: str,
                            keyword_table: str,
                            post_transcript: str):
        return f"""
PHASE 2 (Generating Initial Codes) Requirements:

1. LINE-BY-LINE CODING:
   - Assign codes to every data element
   - Use both:
     • In-vivo codes (participant language)
     • Conceptual codes (researcher-generated)

2. CONSTANT COMPARISON:
   - Compare with previous codes in {keyword_table}
   - Note similarities/differences in {main_topic} handling

3. DUAL CODING:
   - Semantic: Code surface meaning
     Example: "I hate Monday mornings" → "Negative time perception"
   - Latent: Code underlying meaning
     Example: Same quote → "Capitalist time construct resistance"

Include in JSON output:
- "code_type" classification
- "comparison_notes" showing code relationships
- "data_position" (line numbers)

You are an advanced AI model specializing in qualitative research and deductive thematic analysis.
Your task is to extract thematic codes from a given post transcript using a predefined keyword table.

Main Topic: {main_topic}
Additional Information: {additional_info}
Research Questions: {research_questions}

Keyword Table (JSON): {keyword_table}

Post transcript: {post_transcript}

Generate your output strictly in valid JSON format as follows:

```json
{{
  "codes": [
    {{
      "quote": "Exact phrase from the transcript.",
      "explanation": "How it relates to the code.",
      "code": "Relevant keyword or code.",
      "code_type": "semantic or latent",
      "comparison_notes": "...",
      "data_position": "Line X"
    }},
    ...
  ]
}}
```

No additional text outside the JSON.
"""


class DeductiveCoding:
    @staticmethod
    def deductive_coding_prompt(final_codebook: str,
                                post_transcript: str,
                                keyword_table: str,
                                main_topic: str,
                                additional_info: str = "",
                                research_questions: str = ""):
        return f"""
You are an advanced AI model specializing in qualitative research and deductive thematic coding. Your task is to analyze a post transcript and apply thematic codes based on predefined criteria.

---

### Context and Input Information
- Main Topic of Interest: {main_topic}
- Additional Information: {additional_info}
- Research Questions: {research_questions}

- Codebook (Structured thematic codes in JSON format):
{final_codebook}

- Keyword Table (Structured list of keywords in JSON format):
{keyword_table}

- Post Transcript:
{post_transcript}

---

### Instructions
1. Analyze the Post Transcript:
   - Carefully read and interpret the transcript.
   - Compare phrases from the transcript with:
     * Thematic codes (from the codebook)
     * Relevant keywords (from the keyword table)
   - Use the inclusion/exclusion criteria of the keyword table for accurate application.
   - Consider the main topic and research questions when extracting codes.

2. Generate Output in Valid JSON Format:
   ```json
   {{
     "codes": [
       {{
         "quote": "Exact phrase from the transcript.",
         "explanation": "Concise rationale for how it matches the code.",
         "code": "Assigned code from the codebook"
       }},
       ...
     ]
   }}
   ```

3. Ensure Accuracy:
   - If a phrase fits multiple codes, list them separately.
   - Avoid forced classifications—only use codes/keywords that match.
   - If no valid codes apply, return {{ "codes": [] }}.
"""


class ThemeGeneration:

    @staticmethod
    def theme_generation_prompt(qec_table: str):
        return f"""
You are an advanced AI model specializing in qualitative research and thematic analysis. Your task is to identify themes based on a provided Quote-Explanation-Code (QEC) table.

---

### QEC Table (JSON):
{qec_table}

---

### Instructions
1. Group Thematic Codes into Higher-Level Themes:
   - Identify patterns among the provided codes.
   - Group similar or related codes under a broader theme name.

2. Generate Output in Valid JSON Format:
```json
{{
  "themes": [
    {{
      "theme": "Theme Name",
      "codes": ["Code1", "Code2", "Code3"]
    }},
    ...
  ]
}}
```

3. Ensure:
   - Logical grouping of codes into themes.
   - Valid JSON structure.
   - No additional text outside the JSON.
"""


class RefineCodebook:
    @staticmethod
    def refine_codebook_prompt(prev_codebook_json: str, current_codebook_json: str):
        return f"""
You are an advanced AI specializing in qualitative research and thematic coding. Your task is to analyze and refine coding categories by comparing the previous codebook with the current version.

---

### Input Data
- Previous Codebook (before human revision):
```json
{prev_codebook_json}
```
- Current Codebook (after human revision, including comments for feedback):
```json
{current_codebook_json}
```

---

## Your Tasks
1. Extract Feedback from `currentCodebook.comments`.
   - Identify changes made by the human coder.
   - Understand why each code was added, modified, or removed.

2. Compare `prevCodebook` and `currentCodebook`.
   - Identify codes that remained unchanged.
   - Identify codes that were modified.
   - Identify codes that were added or removed.

3. List Disagreements in JSON Format.
   - Specify which codes and quotes you disagree with from the human evaluation and what needs revision.
   - If you disagree with the human's evaluation or comment, give your disagreements using feedback from `currentCodebook.comments`.

4. Generate a Revised Codebook.
   - Modify existing codes based on human feedback.
   - Add new codes where necessary.
   - Remove or refine problematic codes to improve clarity.
   - Each revised code should include a quote and an explanation.

---

## Output Format
```json
{{
  "disagreements": [
    {{
      "code": "Code Name",
      "explanation": "Why you disagree with the human's suggestion (extracted from comments).",
      "quote": "The relevant quote."
    }},
    ...
  ],
  "revised_codebook": [
    {{
      "code": "Refined Code Name",
      "quote": "Example quote that illustrates this code.",
      "explanation": "Updated explanation based on feedback."
    }},
    ...
  ]
}}
```

No additional text outside the JSON.
"""


class RefineSingleCode:
    @staticmethod
    def refine_single_code_prompt(chat_history: str,
                                  code: str,
                                  quote: str,
                                  user_comment: str,
                                  transcript: str):
        return f"""
You are an advanced AI model specializing in qualitative research and thematic coding. Your task is to evaluate a previously generated qualitative code and its corresponding quote in light of a user's comment from the chat history. You must determine whether you agree or disagree with the user's comment regarding the provided code and quote, provide a clear explanation for your stance, and output a command indicating the appropriate action. The available commands are:
- REMOVE_QUOTE: if the code/quote is deemed inappropriate or not representative.
- ACCEPT_QUOTE: if the code/quote is deemed appropriate and well-supported.

### Input Information
- Transcript: {transcript}
- Code: {code}
- Quote: {quote}
- Chat History: {chat_history}
- User Comment: {user_comment}

### Your Task
1. Analyze the provided transcript, code, quote, and chat history.
2. Determine whether you agree or disagree with the user's comment.
3. Provide a concise explanation of your position.
4. Select the appropriate command: REMOVE_QUOTE or ACCEPT_QUOTE.

### Output Requirements
Return your output strictly in valid JSON format:
```json
{{
  "agreement": "AGREE" or "DISAGREE",
  "explanation": "Your explanation text here",
  "command": "REMOVE_QUOTE" or "ACCEPT_QUOTE"
}}
```

No additional commentary outside the JSON object. 
"""
