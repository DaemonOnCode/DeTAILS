class ContextPrompt:
    keyword_json_template = """
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
}}"""

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
{ContextPrompt.keyword_json_template}
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
{ContextPrompt.keyword_json_template}
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
   - Code every data element that is directly relevant to the main topic and research questions.
   - Use both:
     • In-vivo codes (participant language)
     • Conceptual codes (researcher-generated)
   - Do not generate codes for off-topic content or segments that do not relate to the main research focus. Avoid generic labels such as "N/A", "irrelevant", "off-topic", or similar.

2. CONSTANT COMPARISON:
   - Compare newly generated codes with existing ones in the provided keyword table.
   - Highlight similarities or differences in how {main_topic} is handled.

3. DUAL CODING:
   - Semantic: Code the explicit (surface) meaning.
     Example: "I hate Monday mornings" → "Negative time perception"
   - Latent: Code the underlying (implicit) meaning.
     Example: Same quote → "Capitalist time construct resistance"

Only generate codes that directly contribute to understanding the phenomenon under study. Exclude any codes that do not have a clear link to the main topic or research questions.

Include in JSON output:
- "code_type" classification ("semantic" or "latent")
- "comparison_notes" showing code relationships relative to the keyword table
- "data_position" indicating line numbers from the transcript

You are an advanced AI model specializing in qualitative research and deductive thematic analysis using Braun and Clarke's method. Your task is to extract thematic codes from the given post transcript using the provided keyword table.

Main Topic: {main_topic}
Additional Information: {additional_info}
Research Questions: {research_questions}

Keyword Table (JSON): {keyword_table}

Post transcript: {post_transcript}

### Analytical Assumptions and Considerations

- **Quality Spectrum:**  
  Analysis and interpretation of data are inherently subjective and may range from weaker (unconvincing, underdeveloped, shallow, superficial) to stronger (compelling, insightful, thoughtful, rich, complex, deep, nuanced).

- **Deductive Orientation:**  
  This analysis is deductive, meaning it is shaped by existing theoretical constructs. These established frameworks provide the 'lens' through which you read, code, and interpret the data.

- **Focus of Meaning:**  
  - **Semantic:** Capture the explicit, surface-level meanings as expressed directly in the text.
  - **Latent:** Delve into the underlying, implicit meanings and assumptions that may not be immediately apparent.

- **Qualitative Frameworks:**  
  In deductive thematic analysis, you may consider two primary qualitative frameworks:
  1. **Experiential Framework:**  
     Focuses on capturing and exploring people’s own perspectives, experiences, and understandings as directly expressed in the data.
  2. **Critical Framework:**  
     Aims to interrogate and unpack the deeper meanings, power dynamics, and assumptions behind the data, going beyond the surface to question underlying social constructs.

- **Theoretical Frameworks:**  
  Your analysis may be informed by the following two main theoretical approaches:
  1. **Realist/Essentialist:**  
     Assumes that there is an objective truth or reality that the data reflects. This approach aims to capture and describe this reality as directly as possible.
  2. **Relativist/Constructionist:**  
     Posits that reality is subjective and constructed through social interactions. This perspective encourages exploring multiple, context-dependent interpretations of the data.

Generate your output strictly in valid JSON format as follows:

```json
{{
  "codes": [
    {{
      "quote": "Exact phrase from the transcript.",
      "explanation": "How it relates to the code and research focus.",
      "code": "Relevant keyword or code derived from the transcript.",
      "code_type": "semantic or latent",
      "comparison_notes": "Notes on how this code relates to existing codes in the keyword table.",
      "data_position": "Line X"
    }}
    // Additional code objects...
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
PHASE 2 (Deductive Thematic Coding) Requirements:

### Context and Input Information
- **Main Topic:** {main_topic}
- **Additional Information:** {additional_info}
- **Research Questions:** {research_questions}

- **Final Codebook:**  
  (Structured thematic codes in JSON format)  
  {final_codebook}

- **Keyword Table:**  
  (JSON format with inclusion/exclusion criteria)  
  {keyword_table}

- **Post Transcript:**  
  {post_transcript}

### Analytical Assumptions and Considerations

- **Quality Spectrum:**  
  Recognize that your analysis may range from superficial to deeply nuanced. Aim for compelling and insightful interpretations that are well supported by the data.

- **Deductive Orientation:**  
  Your coding is guided by pre-established theoretical constructs. Use the final codebook and keyword table as analytical lenses, ensuring that your code assignments reflect these predefined frameworks.

- **Focus of Meaning:**  
  - **Semantic:** Identify and capture the explicit, surface-level content in the transcript.
  - **Latent:** Uncover and interpret the underlying, implicit meanings that complement the surface-level analysis.

- **Theoretical Frameworks:**  
  Consider these approaches:
  - **Realist/Essentialist:** Seeks to capture objective truths within the data.
  - **Relativist/Constructionist:** Recognizes that meanings are contextually and socially constructed.

### Instructions

1. **Analyze the Post Transcript:**
   - Read the transcript carefully and compare its phrases with the codes in the final codebook.
   - Reference the relevant keywords and criteria from the keyword table.
   - Ensure that you only code transcript segments directly related to the main topic and research questions.
   - Avoid forced or generic classifications; assign codes only when they are clearly supported by the provided materials.

2. **Generate Output in Valid JSON Format:**
   ```json
   {{
     "codes": [
       {{
         "quote": "Exact phrase from the transcript.",
         "explanation": "Concise rationale explaining the code assignment based on the final codebook and keyword table.",
         "code": "Assigned code from the final codebook",
         "code_type": "semantic or latent"
       }}
       // Additional code objects...
     ]
   }}
   ```

3. **Ensure Accuracy:**
   - If a phrase fits multiple codes, list each as a separate entry.
   - Omit phrases that do not align with any valid codes.
   - If no codes are applicable across the transcript, return {{ "codes": [] }}.

No additional text outside the JSON.
"""

class ThemeGeneration:

    @staticmethod
    def theme_generation_prompt(qec_table: str, unique_codes: str):
        return f"""
You are an advanced AI model specializing in qualitative research using Braun and Clarke's (2006) thematic analysis approach. Your task is to analyze a provided list of unique codes along with a restructured QEC dataset, and then generate higher-level themes based on this information.

### Data Provided

1. **List of Unique Codes:**  
   A separate list containing all the unique codes extracted from the QEC data.

   Codes:
    {unique_codes}


2. **QEC Data (JSON):**  
   The data is organized so that for each unique code, an array of associated quotes and explanations is provided. For example, the structure for a given code is as follows:

   ```json
   {{
     "code": "CodeName",
     "instances": [
       {{
         "quote": "The quote here.",
         "explanation": "Explanation for why this code was chosen."
       }}
       // Additional instances...
     ]
   }}
   ```

   Data: 
   {qec_table}

### Analytical Assumptions and Considerations

- **Dual Processes of Quality Analysis:**  
  Good quality codes and themes result from both immersive, in-depth engagement with the dataset and from giving the developing analysis some reflective distance—often achieved by taking breaks during the process.

- **Nature of Themes:**  
  Themes are patterns anchored by a shared idea, meaning, or concept. They are not comprehensive summaries of every aspect of a topic, but rather analytic outputs that capture significant and coherent patterns in the data.

- **Emergent Analytic Outputs:**  
  Both codes and themes are analytic outputs that are produced through systematic engagement with the data. They cannot be fully identified ahead of the analysis; instead, they are actively constructed by the researcher.

- **Active Production:**  
  Themes do not passively ‘emerge’ from the data; they are the result of deliberate, reflective, and systematic analysis, combining both immediate engagement and thoughtful distance.

### Instructions

1. **Familiarization with the Data:**
   - Review the list of unique codes to understand the overall coding scheme.
   - Examine the QEC data for each code, considering both the explicit (semantic) content and the underlying (latent) meanings conveyed by the associated quotes and explanations.

2. **Theme Generation:**
   - Identify patterns and shared meanings among the codes by referring to the context provided by the quotes and explanations.
   - Actively construct higher-level themes from the codes. Remember, these themes are analytic outputs produced through both immersion in the data and reflective distancing.
   - Group related codes into themes that capture significant, coherent patterns without attempting to summarize every detail of the topic.

3. **Theme Refinement:**
   - Merge overlapping themes and separate those that conflate multiple distinct ideas.
   - Validate the coherence of each theme against the detailed context provided by the associated quotes and explanations.

4. **Theme Naming:**
   - Assign concise, evocative names to each theme that accurately reflect the central ideas of the grouped codes.

5. **Output Format:**
   - Provide your final output strictly in valid JSON format without any additional commentary.
   - The JSON structure should be as follows:

   ```json
   {{
     "themes": [
       {{
         "theme": "Theme Name",
         "codes": ["Code1", "Code2", "Code3"]
       }}
       // Additional theme objects...
     ]
   }}
   ```
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
- EDIT_QUOTE: if you believe that the code/quote needs revision. In this case, provide a list of alternative code suggestions along with your explanation.

### Input Information
- Transcript: {transcript}
- Code: {code}
- Quote: {quote}
- Chat History: {chat_history}
- User Comment: {user_comment}

### Your Task
1. Analyze the provided transcript, code, quote, and chat history.
2. Determine whether you agree or disagree with the user's comment. Defend your position or, if the user's comment seems valid, proceed accordingly.
   Since codes can be subjective, think a lot before answering if your answer would make more sense or switching to the user's comment would be better.
3. Provide a concise explanation of your assessment and indicate if the code/quote requires revision.
4. Select the appropriate command:
   - Use REMOVE_QUOTE if the code/quote is inappropriate.
   - Use ACCEPT_QUOTE if the code/quote is appropriate.
   - Use EDIT_QUOTE if you believe the code/quote should be modified. In this case, include a list of alternative code suggestions.
   
### Output Requirements
Return your output strictly in valid JSON format:
```json
{{
  "agreement": "AGREE" or "DISAGREE",
  "explanation": "Your explanation text here",
  "command": "REMOVE_QUOTE" or "ACCEPT_QUOTE" or "EDIT_QUOTE",
  "alternate_codes": [ "alternative code suggestion 1", "alternative code suggestion 2", ... ] // This field should contain a list of revised code suggestions if command is EDIT_QUOTE; otherwise, it can be an empty list.
}}
```

No additional commentary outside the JSON object.
"""

class RemakerPrompts:
    @staticmethod
    def codebook_remake_prompt(main_topic: str,
                               additional_info: str,
                               research_questions: str,
                               keyword_table: str,
                               post_transcript: str,
                               current_codebook: str,
                               feedback: str):
        return f"""
PHASE 3 (Complete Codebook Remake) Requirements:

### Integrative Analysis:
- Review all provided data from the initial coding phase.
- Consider the **Main Topic:** {main_topic}, **Additional Information:** {additional_info}, and **Research Questions:** {research_questions}.
- Analyze the Post Transcript for segments relevant to the research focus.
  Transcript: 
  {post_transcript}
- Use the Keyword Table (JSON) with its inclusion/exclusion criteria: {keyword_table}

### Analytical Assumptions and Considerations

- **Quality Spectrum:**  
  Your analysis may vary from underdeveloped to richly nuanced. Strive for thoughtful and compelling insights in your revised codebook.

- **Deductive Orientation:**  
  This process is guided by pre-existing theoretical constructs. The updated codebook should reflect these frameworks, ensuring that your codes are consistent with established deductive principles.

- **Focus of Meaning:**  
  - **Semantic:** Capture the explicit, surface-level meanings.
  - **Latent:** Identify deeper, implicit meanings that enhance understanding.

- **Qualitative & Theoretical Frameworks:**  
  Consider:
  1. **Experiential Framework:** Capturing participants’ direct perspectives.
  2. **Critical Framework:** Unpacking deeper power dynamics and social constructs.
  3. **Realist/Essentialist vs. Relativist/Constructionist:** Balancing objective truths with socially constructed interpretations.

### Codebook Remake Instructions:
1. Evaluate the **CURRENT CODEBOOK:** {current_codebook} and incorporate the **OPTIONAL FEEDBACK:** {feedback}.
2. Update existing codes, add new ones, or remove redundant entries based on an integrated review of the initial coding data, transcript, and feedback.
3. Maintain both in-vivo (participant language) and conceptual (researcher-generated) elements.
4. Apply dual coding:
   - **Semantic:** For surface-level meanings.
   - **Latent:** For underlying, implicit meanings.
5. Ensure each code directly relates to the research focus and avoid off-topic or forced classifications.

### Output Format:
Generate your output strictly in valid JSON format as follows:

```json
{{
  "codes": [
    {{
      "quote": "Exact phrase from the transcript or current codebook.",
      "explanation": "Explanation of the code and its relevance.",
      "code": "Updated or new keyword/code.",
      "code_type": "semantic or latent",
      "comparison_notes": "Notes on relationships to previous codes and feedback integration.",
      "data_position": "Reference (e.g., line numbers or section identifiers)"
    }}
    // Additional code objects...
  ]
}}
```

No additional text outside the JSON.
"""

    @staticmethod
    def deductive_codebook_remake_prompt(main_topic: str,
                                         additional_info: str,
                                         research_questions: str,
                                         final_codebook: str,
                                         current_codebook: str,
                                         keyword_table: str,
                                         post_transcript: str,
                                         feedback: str):
        return f"""
PHASE 3 (Deductive Codebook Remake) Requirements:

### Integrative Analysis:
- Review the outcomes from the final deductive coding phase.
- Consider the **Main Topic:** {main_topic} and **Additional Information:** {additional_info}.
- Address the **Research Questions:** {research_questions}.
- Utilize the **Final Codebook** (structured thematic codes in JSON format): {final_codebook}
- Evaluate the **CURRENT CODEBOOK:** {current_codebook} used in the deductive coding phase.
- Refer to the **Keyword Table** (JSON with inclusion/exclusion criteria): {keyword_table}
- Analyze the Post Transcript for segments that are directly relevant:
  {post_transcript}

### Analytical Assumptions and Considerations

- **Quality Spectrum:**  
  Aim for an analysis that is compelling, nuanced, and insightful, while acknowledging that interpretations may vary in depth.

- **Deductive Orientation:**  
  Your updated codebook should reflect the deductive framework provided by the final codebook and keyword table. Codes must align with these pre-established theoretical constructs.

- **Focus of Meaning:**  
  - **Semantic:** Capture explicit, surface-level meanings.
  - **Latent:** Uncover underlying, implicit meanings that add depth.

- **Theoretical Frameworks:**  
  Consider both:
  - **Realist/Essentialist:** For capturing objective truths in the data.
  - **Relativist/Constructionist:** For exploring the socially constructed nature of meaning.

### Deductive Codebook Remake & Feedback Integration:
1. Update existing deductive codes by integrating insights from the final coding phase, CURRENT CODEBOOK, and the **OPTIONAL FEEDBACK:** {feedback}.
2. Adjust codes by updating, adding, or removing entries as needed.
3. Ensure each code strictly adheres to the inclusion/exclusion criteria and aligns with the deductive approach.
4. Clearly differentiate between semantic (surface) and latent (underlying) meanings.
5. Avoid forced or generic codes that are not directly relevant.

### Output Format:
Generate your output strictly in valid JSON format as follows:

```json
{{
  "codes": [
    {{
      "quote": "Exact phrase from the transcript or current codebook.",
      "explanation": "Explanation of the code and its relevance.",
      "code": "Updated or new keyword/code.",
      "code_type": "semantic or latent",
      "comparison_notes": "Notes on relationships to previous codes and feedback integration.",
      "data_position": "Reference (e.g., line numbers or section identifiers)"
    }}
    // Additional code objects...
  ]
}}
```

No additional text outside the JSON.
"""
    
class GroupCodes:
    @staticmethod
    def group_codes_prompt(codes: str, qec_table: str):
        return f"""
You are an advanced AI model specialized in Braun & Clarke’s Reflexive Thematic Analysis method. Use the following instructions to group the provided codes into higher-level themes based on the associated QEC data.:

- Assess the provisional groupings for coherence and fit with the data.
- Check if each emerging higher-level code (theme) tells a convincing story about the dataset.
- Determine whether any candidate codes should be merged, split, or discarded.
 
- Fine-tune and finalize higher-level codes so each has a clear central concept.
- Write a concise definition capturing the essence of each grouping.
- Ensure the groupings form a coherent overall story about the data.

Your tasks:
1. **Review the QEC Data**:  
   - The QEC table (quote-explanation-code data) contains the detailed segments (quotes), the rationale (explanation), and the assigned code.
   - Example structure in JSON:
     ```json
     {{
        "code": "CodeName",
        "instances": [
          {{
            "quote": "The quote here.",
            "explanation": "Explanation for why this code was chosen."
          }}
          // Additional instances...
        ]
      }}
     ```
    QEC Data: 
    ```json
    {qec_table}
    ```
2. **Examine the List of Unique Codes**:  
   - This is a simple array of code names extracted from the QEC table, e.g.:
     ```json
     ["Code1", "Code2", "Code3", ...]
     ```
    - Unique Codes:
    ```json
     {codes}
     ```
   - These are the existing lower-level codes that may need to be merged or refined into broader categories.

3. **Develop Higher-Level Codes**:  
   - Group related lower-level codes under more encompassing, conceptual headings.
   - Name each higher-level code in a succinct, meaningful way.
   - Provide a **short definition** explaining the unifying concept and why these codes logically fit together.
   - Ensure that each higher-level code strictly captures not more than 5-7 lower-level codes.

4. **Check for Fit and Coherence**:  
   - For each higher-level code, confirm it is consistent with the original quotes and explanations.
   - If any code doesn’t fit or contradicts the grouping, consider re-grouping or discarding it.
   - Be prepared to revise (split, merge, rename) during this review.

5. **Ensure Distinctness**:  
   - Make sure each higher-level code is meaningfully different from the others.
   - Avoid overlapping definitions or repeated coverage of the same pattern.

6. **Finalize Output**:  
   - Return the result in **valid JSON** only, following a structure similar to the one below (you may include additional fields such as `relationship` or `notes` if needed).
   - Do **not** include any text outside the JSON object.

### **Output Format**  
```json
{{
  "higher_level_codes": [
    {{
      "name": "NameOfHigherLevelCode1",
      "codes": [
        "RelevantLowerLevelCodeA",
        "RelevantLowerLevelCodeB"
      ]
    }},
    {{
      "name": "NameOfHigherLevelCode2",
      "codes": [
        "RelevantLowerLevelCodeC",
        "RelevantLowerLevelCodeD"
      ]
    }}
    // Additional higher-level code objects...
  ]
}}
```

**Important**:
- Provide clear, compelling names for each higher-level code.
- Ensure that each higher-level code strictly captures not more than 7 lower-level codes.
- Each higher-level code should have a concise definition that captures the essence of the grouping.
- Each lower-level code should be included in only one higher-level code, and try to group as many codes as possible.
- Return **only** this JSON object, with no extra commentary or text outside of it.
"""