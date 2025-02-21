"""
Integrated Thematic Analysis Prompt Classes

This module provides a set of classes and static methods for guiding an AI model
through a deductive thematic analysis process, based on Braun & Clarke's 6-phase framework,
augmented with detailed instructions, example I/O formats, and extended functionality.

--------------------------------------------------------------------------------------------
TABLE OF CONTENTS:
1. ContextPrompt
    - PHASE 1 (Familiarization) - Generating and Refining Keywords
2. InitialCodePrompts
    - PHASE 2 (Generating Initial Codes)
3. DeductiveCoding
    - PHASE 3 (Theme Development) & PHASE 4 (Review) - Applying Codes
4. ThemeGeneration
    - PHASE 5 (Theme Definition) - Generating Themes
5. RefineCodebook
    - PHASE 6 (Report Production) - Refining Codebook
6. RefineSingleCode
    - Single Code Refinement Utility

--------------------------------------------------------------------------------------------
USAGE EXAMPLE:

1) PHASE 1 (Familiarization) - Extract Keywords
-----------------------------------------------
Use the methods in `ContextPrompt` to generate a JSON list of 20 keywords based on
the main topic, research questions, additional context, and textual data.

Example:
--------
main_topic = "User engagement with social media"
research_questions = "How do users describe their emotional connections to social platforms?"
additional_info = "Focus on daily usage patterns, negative/positive sentiments, cross-cultural nuances"
textual_data = "Long textual data from PDFs, articles, or transcripts."

prompt_list = ContextPrompt.systemPromptTemplate(main_topic, research_questions, additional_info)
# This returns a list of two prompt strings that you can feed into your AI model.

You can further refine or re-generate the keyword list using:
ContextPrompt.regenerationPromptTemplate(...)

--------------------------------------------------------------------------------------------
2) PHASE 2 (Generating Initial Codes)
-------------------------------------
Use the `InitialCodePrompts.initial_code_prompt` to analyze a given transcript
(line-by-line coding) and produce a JSON output with each coded excerpt.

--------------------------------------------------------------------------------------------
3) PHASE 3 & PHASE 4 (Theme Development & Review)
-------------------------------------------------
Use `DeductiveCoding.deductive_coding_prompt` to analyze a transcript using a final
codebook or a keyword table. This will produce a JSON object of coded quotes.

--------------------------------------------------------------------------------------------
4) PHASE 5 (Theme Definition)
-----------------------------
Use `ThemeGeneration.theme_generation_prompt` to group the assigned codes
into higher-level themes and return them in JSON format.

--------------------------------------------------------------------------------------------
5) PHASE 6 (Report Production)
------------------------------
Use `RefineCodebook.refine_codebook_prompt` to refine and finalize
the codebook by comparing the previous version to the current one, capturing
disagreements and producing a new, revised codebook in JSON.

--------------------------------------------------------------------------------------------
Additional Utility - RefineSingleCode
-------------------------------------
`RefineSingleCode.refine_single_code_prompt` is a helper for reevaluating a single code
and quote pair against user feedback, to either remove or accept the quote.

--------------------------------------------------------------------------------------------
NOTE:
1. All returned prompts are designed to instruct an AI model. The AI model's
   response should strictly follow the JSON format requested.
2. These classes and methods are meant to be modular. You can integrate them
   into a larger data pipeline or call them as needed.
3. The `keyword_json_template` is a base JSON structure for how
   extracted keywords should be formatted. Modify or extend as necessary.
"""


class ContextPrompt:
    """
    PHASE 1 (Familiarization):
    - Generating keywords to build context for thematic analysis.
    - Familiarizing the model with the data, research questions, and
      additional context.

    Methods:
    --------
    1) keyword_json_template:
       - A base JSON structure for keyword extraction.

    2) systemPromptTemplate(mainTopic, researchQuestions, additionalInfo):
       - Returns a list of prompts (strings) guiding the AI to:
         a) Familiarize itself with the textual data.
         b) Extract 20 high-level keywords relevant to the research context.
         c) Provide descriptions, inclusion, and exclusion criteria.

    3) context_builder(mainTopic, researchQuestions, additionalInfo):
       - A supplementary prompt urging the AI to provide 20 keywords,
         including details like:
         - Description
         - Inclusion Criteria
         - Exclusion Criteria
       - Returns a single string prompt.

    4) regenerationPromptTemplate(...) and refined_context_builder(...):
       - Additional utility prompts for refining the keyword list based
         on selected/unselected keywords and user feedback.

    JSON Output Format:
    -------------------
    {
      "keywords": [
        {
          "word": "ExtractedKeyword",
          "description": "Explanation of the word and its relevance.",
          "inclusion_criteria": ["Criteria 1", "Criteria 2", "..."],
          "exclusion_criteria": ["Criteria 1", "Criteria 2", "..."]
        },
        ...
      ]
    }
    """

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
        """
        Returns two-part prompts for Phase 1:
        1) Detailed instructions for extracting keywords.
        2) Insert textual data after the instructions.

        Example Usage:
        --------------
        prompts = ContextPrompt.systemPromptTemplate(
            "Workplace Culture",
            "How do employees describe their work environment?",
            "Focus on hybrid vs. in-office settings"
        )

        feed these prompts into your AI model sequentially along with the actual data.
        """
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
        """
        Returns a prompt instructing the AI to provide exactly 20 keywords
        in strict JSON format, including descriptions, inclusion, and exclusion criteria.
        """
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
        """
        Returns prompts for regenerating or refining a set of keywords,
        removing unselected keywords, and incorporating new feedback.
        """
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
        """
        Returns a prompt for refining the keyword list down to exactly 5 items,
        applying the new feedback and removing any references to unselected keywords.
        """
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
    """
    PHASE 2 (Generating Initial Codes):
    - Line-by-line coding
    - Applying both in-vivo codes (participant language) and researcher-generated codes.
    - Incorporating the keyword table to ensure consistent and accurate coding.

    Methods:
    --------
    initial_code_prompt(main_topic, additional_info, research_questions, keyword_table, post_transcript):
      - Returns a prompt instructing the AI to output a JSON with coded quotes.
    """

    @staticmethod
    def initial_code_prompt(main_topic: str,
                            additional_info: str,
                            research_questions: str,
                            keyword_table: str,
                            post_transcript: str):
        """
        Instructs the AI to extract codes from the provided transcript using
        the provided keyword table, ensuring:
        - Both in-vivo and conceptual codes
        - Respecting inclusion and exclusion criteria
        - Returning results in a strict JSON format

        JSON Output Example:
        {
          "codes": [
            {
              "quote": "Extracted phrase from the response.",
              "explanation": "Why this phrase was coded.",
              "code": "Assigned code from the keyword table"
            },
            ...
          ]
        }
        """
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
    """
    PHASE 3 (Theme Development) & PHASE 4 (Review):
    - Thematic clustering and theme validation.
    - Applying codes to new transcripts or data, checking for consistency.

    Methods:
    --------
    deductive_coding_prompt(final_codebook, post_transcript, keyword_table, main_topic, additional_info, research_questions):
      - Returns a prompt instructing the AI to analyze the transcript using the final codebook and the keyword table,
        ensuring a strictly formatted JSON output of coded quotes.
    """

    @staticmethod
    def deductive_coding_prompt(final_codebook: str,
                                post_transcript: str,
                                keyword_table: str,
                                main_topic: str,
                                additional_info: str = "",
                                research_questions: str = ""):
        """
        Instructs the AI to apply existing thematic codes from a final codebook
        to new data, cross-referencing with a keyword table for consistency.

        JSON Output Example:
        {
          "codes": [
            {
              "quote": "Text from the transcript.",
              "explanation": "Reason for applying this code.",
              "code": "Assigned code from the final codebook"
            },
            ...
          ]
        }
        """
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
    """
    PHASE 5 (Theme Definition):
    - Identifying and organizing broader themes from the extracted codes.

    Methods:
    --------
    theme_generation_prompt(qec_table):
      - Takes a QEC (Quote-Explanation-Code) table and instructs the AI to cluster
        similar codes into themes, returning a strict JSON output with
        'theme' and 'codes' fields.
    """

    @staticmethod
    def theme_generation_prompt(qec_table: str):
        """
        Returns a prompt that instructs the AI to group similar codes
        into higher-level themes and output them in a structured JSON format.

        Example JSON Output:
        {
          "themes": [
            {
              "theme": "Theme Name",
              "codes": ["Code1", "Code2", "Code3"]
            },
            ...
          ]
        }
        """
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
    """
    PHASE 6 (Report Production):
    - Finalizing the codebook and documenting the coding process.

    Methods:
    --------
    refine_codebook_prompt(prev_codebook_json, current_codebook_json):
      - Produces a prompt to compare a previous codebook with a current one,
        extract disagreements, and produce a revised codebook in JSON format.
    """

    @staticmethod
    def refine_codebook_prompt(prev_codebook_json: str, current_codebook_json: str):
        """
        Instructs the AI to compare two versions of a codebook, note disagreements,
        and produce a revised codebook. The output JSON includes 'disagreements'
        and 'revised_codebook' arrays.

        Example JSON Output:
        {
          "disagreements": [
            {
              "code": "Code Name",
              "explanation": "Reason for disagreement",
              "quote": "Relevant quote"
            },
            ...
          ],
          "revised_codebook": [
            {
              "code": "Refined Code Name",
              "quote": "Example quote",
              "explanation": "Updated explanation"
            },
            ...
          ]
        }
        """
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
    """
    Additional Utility - Single Code Refinement
    - Evaluates a single code and quote pair against user feedback.

    Methods:
    --------
    refine_single_code_prompt(chat_history, code, quote, user_comment, transcript):
      - Returns a prompt instructing the AI to either remove or accept the quote
        based on the user comment and context from the transcript.
    """

    @staticmethod
    def refine_single_code_prompt(chat_history: str,
                                  code: str,
                                  quote: str,
                                  user_comment: str,
                                  transcript: str):
        """
        Instructs the AI to:
        1) Decide whether it agrees or disagrees with the user comment regarding
           the given code and quote.
        2) Provide a concise explanation.
        3) Output a command: REMOVE_QUOTE or ACCEPT_QUOTE.

        JSON Output Example:
        {
          "agreement": "AGREE" or "DISAGREE",
          "explanation": "Reason for decision.",
          "command": "REMOVE_QUOTE" or "ACCEPT_QUOTE"
        }
        """
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
