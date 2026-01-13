class ContextPrompt:
    concept_json_template = """
```json{{
  "concepts": [
    "concept1",
    "concept2",
    ...
    "concept5"
  ]
}}```"""

    @staticmethod
    def systemPromptTemplate(mainTopic: str, researchQuestions: str, additionalInfo: str):
        return [
            f"""
You are an expert in qualitative research.

Your task is to assist in an analysis by gaining a holistic understanding of the main topic and research questions, and extracting related concepts from the provided textual data. The concepts should illuminate the topic and help answer the research questions.

Context:
- Main Topic: {mainTopic}
- Research Questions: {researchQuestions}
- Additional Information: {additionalInfo}
""",
"""- \nTextual Data: \n{context}\n\n""",
f"""
Step-by-Step Process Guidance:
- Focus on concepts frequently mentioned or significant to the research questions.
- Keep each concept to 1-3 words.
- Represent the diversity of perspectives in the data.
- Base extraction primarily on the textual data; integrate additional info only to contextualize.

Output Format & Constraints:
- Return exactly 10 distinct, relevant concepts.
- Present them as a simple list (one per line or comma-separated).

Additional Notes:
- Concepts must not overlap with each other or duplicate the main topic.
            """,
        ]

    @staticmethod
    def context_builder(mainTopic: str, researchQuestions: str, additionalInfo: str):
        return f"""
Carefully review the textual data and extract 10 related concepts that will help us better understand the main topic and answer research questions. 

Main Topic: {mainTopic}
Research Questions: {researchQuestions}
Additional Information: {additionalInfo}

Present the concepts in a JSON object with the following structure:
```json{{
  "concepts": [
    "concept1",
    "concept2",
    ...
    "concept10"
  ]
}}```


Important:
- Only return the JSON object—no explanations, summaries, or additional text.
- Ensure the JSON is valid and contains exactly 10 distinct concepts. 
"""

    @staticmethod
    def regenerationPromptTemplate(mainTopic: str,
                                   researchQuestions: str,
                                   additionalInfo: str,
                                   selectedConcepts: str,
                                   unselectedConcepts: str,
                                   extraFeedback: str):

        return [
            f"""
You are an expert in qualitative research. 

Your task is to support the analysis by developing a holistic understanding of the main topic and research questions, and by refining previously generated related concepts based on the user's selections and feedback. 
User feedback, when provided, is crucial and should serve as the primary guide for improving concept selection.

Context:
- Main Topic: {mainTopic}
- Research Questions: {researchQuestions}
- Additional Information: {additionalInfo}
- Selected Concepts (retain these): {selectedConcepts}
- Unselected Concepts (exclude these): {unselectedConcepts}
- Extra Feedback: {extraFeedback}

Step-by-Step Process Guidance:
1. Re-evaluate the Context
- Consider the main topic, research questions, and additional information to ensure the concepts align with the research objectives.

2. Refine the Concepts
- Retain the selected concepts as they are.
- Exclude the unselected concepts from the new set.
- Use the extra feedback to generate new concepts that address the user's concerns and suggestions.
- Ensure the new concepts are distinct from both the selected, unselected concepts, and main topic.
- Aim for concepts that are relevant, insightful, and aligned with the research context and user's feedback.

Output Format & Constraints:
- Provide exactly 5 refined concepts in the following JSON format:

{ContextPrompt.concept_json_template}

Important Notes
- Only return the JSON object with the refined concepts.
- Do not include any explanations, summaries, or additional text.
- Ensure the JSON is valid and properly formatted.
- The refined concepts should clearly reflect the user's feedback and the research context.
""",
            """\nTextual Data: \n{context}\n\n"""
        ]

    @staticmethod
    def refined_context_builder(mainTopic: str,
                                    researchQuestions: str,
                                    additionalInfo: str,
                                    selectedConcepts: str,
                                    unselectedConcepts: str,
                                    extraFeedback: str):

        return f"""
I need a refined list of exactly 5 concepts based on the following research inputs:

- Main Topic: {mainTopic}
- Research Questions: {researchQuestions}
- Additional Information: {additionalInfo}
- Selected Concepts (retain these): {selectedConcepts}
- Unselected Concepts (exclude these): {unselectedConcepts}
- Extra Feedback: {extraFeedback}

Output Format:
```json{{
  "concepts": [
    "concept1",
    "concept2",
    ...
    "concept5"
  ]
}}```

Important Notes:
- Return only the JSON object with the refined list of 5 concepts.
- Do not include explanations, notes, or additional text beyond the JSON.
- Ensure the JSON is valid and properly formatted.
"""


class InitialCodePrompts:
    @staticmethod
    def initial_code_prompt(main_topic: str,
                            additional_info: str,
                            research_questions: str,
                            concept_table: str,
                            post_transcript: str) -> str:
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis. 

Your task is to generate codes by extracting meaningful quotes from the transcript that link to the main topic, that are evidence to answer research questions, support additional information, and concept table.

Context: 
- **Main Topic:** {main_topic}  
- **Additional Information:** {additional_info}  
- **Research Questions:** {research_questions}  
- **Concept Table (JSON):** {concept_table}  
- **Transcript:** {post_transcript}

Step-by-Step Process Guidance:
1. Read the Transcript
First, read the entire transcript to understand its overall content and context. Only code the post if it contains quotes that link to the main topic, that are evidence to answer research questions, support additional information, and concept table; otherwise, skip it.

2. Line-by-Line Coding
- **Extract:** For each relevant segment, copy the complete, exact quote.
- **Code:** Assign a concise label that reflects its meaning relative to the main topic, additional information, research questions, and concept table.
- **Skip:** Do *not* code irrelevant or off-topic content. Avoid generic labels like “irrelevant,” “off-topic,” etc.
- Generate each code as a natural phrase - just as a expert human qualitative researcher would. Each word in the code should be seperated by a space.
     
Output Format and Constraints:
Return **only** valid JSON, exactly matching this structure:

```json
{{
  "codes": [
    {{
      "quote": "Complete and exact phrase from the transcript (from the start to the end of the sentence).",
      "explanation": "How this quote supports the research focus.",
      "code": "Assigned code label.",
      "source": {{
        "type": "comment", // "comment" or "post"
        "comment_id": "1.2", // required if type is "comment"
        "title": false // required if type is "post": true = title, false = body
      }}
    }}
    // …additional code objects…
  ]
}}
````
  
* If a quote fits multiple codes, list each as a separate entry.
* Omit quotes that do not align with any valid codes.
* If no codes apply, return:

  ```json
  {{ "codes": [] }}
  ```
* **Do not** include any text outside the JSON.
"""


class FinalCoding:
    @staticmethod
    def final_coding_prompt(final_codebook: str,
                            post_transcript: str,
                            concept_table: str,
                            main_topic: str,
                            additional_info: str = "",
                            research_questions: str = ""):
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis. 

Your task is to assign codes — either by selecting existing codes from the final codebook or generating new ones directly from the data — to meaningful quotes from the transcript that link to the main topic, that are evidence to answer research questions, support additional information, and concept table.

Context:
- **Main Topic:** {main_topic}
- **Additional Information:** {additional_info}
- **Research Questions:** {research_questions}
- **Concept Table (JSON):** {concept_table}
- **Final Codebook:** {final_codebook}
- **Transcript:** {post_transcript}

Step-by-Step Process Guidance:
1. Read the Transcript
First, read the entire transcript to understand its overall content and context. Only code the post if it contains quotes that link to the main topic, that are evidence to answer research questions, support additional information, and concept table; otherwise, skip it.

2. Line-by-Line Coding
- **Extract:** For each relevant segment, copy the complete, exact quote.
- **Code:** Assign a label from the final codebook or generate a concise new label that reflects its meaning relative to the main topic, additional information, research questions, concept table and final codebook.
- **Skip:** Do *not* code irrelevant or off-topic content. Avoid generic labels like “irrelevant,” “off-topic,” etc.
- Generate each code as a natural phrase - just as a expert human qualitative researcher would. Each word in the code should be seperated by a space.


Output Format and Constraints:
Return **only** valid JSON, exactly matching this structure:

```json
{{
  "codes": [
    {{
      "quote": "Complete and exact phrase from the transcript (from the start to the end of the sentence).",
      "explanation": "How this quote supports the research focus and fits the assigned code.",
      "code": "Assigned code from the final codebook.",
      "source": {{
        "type": "comment", // "comment" or "post"
        "comment_id": "1.2", // required if type is "comment"
        "title": false // required if type is "post": true = title, false = body
      }}
    }}
    // …additional code objects…
  ]
}}
```

* If a quote fits multiple codes, list each as a separate entry.
* Omit quotes that do not align with any valid codes from the final codebook.
* If no codes apply, return:

  ```json
  {{ "codes": [] }}
  ```
***Do not** include any text outside the JSON.
"""



class ThemeGeneration:

    @staticmethod
    def theme_generation_prompt(qec_table: str, unique_codes: str):
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis. 

Your task is to analyze a provided list of unique codes along with a QEC (Quote-Explanation-Code) data, and then generate higher-level themes based on this information. 
These themes should be directly linked to the Main topic and research questions.

Context:
1. **List of Unique Codes:**  
   A separate list containing all the unique codes extracted from the QEC data.

   Codes:
    {unique_codes}

2. **QEC Data (JSON):**
  The Code and summary table contains the rationale summary (summary), and the assigned code.
   - Example structure in JSON:
     ```json
     [
        {{
          "code": "CodeName",
          "summary": "Summary of multiple explanations signifying the meaning of the code."
        }}
        // Additional instances...
      ]
     ```

   Data:
   {qec_table}

Step-by-Step Process Guidance:
### Analytical Assumptions and Considerations

- **Dual Processes of Quality Analysis:**  
  Good quality codes and themes result from both immersive, in-depth engagement with the dataset and from giving the developing analysis some reflective distance—often achieved by taking breaks during the process.

- **Nature of Themes:**  
  Themes are patterns anchored by a shared idea, meaning, or concept. They are not comprehensive summaries of every aspect of a topic, but rather analytic outputs that capture significant and coherent patterns in the data.

- **Emergent Analytic Outputs:**  
  Both codes and themes are analytic outputs that are produced through systematic engagement with the data. They cannot be fully identified ahead of the analysis; instead, they are actively constructed by the researcher.

- **Active Production:**  
  Themes do not passively 'emerge' from the data; they are the result of deliberate, reflective, and systematic analysis, combining both immediate engagement and thoughtful analysis.

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

**Output Format and Constraints:**
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
   No additional text outside the JSON.
"""
    @staticmethod
    def redo_theme_generation_prompt(qec_table: str, unique_codes: str, previous_themes: str, feedback: str):
        return f"""
    You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis. Previously, you generated themes based on a provided list of unique codes and a QEC (Quote-Explanation-Code) data. Now, you are tasked with refining those themes by incorporating optional feedback and re-analyzing the original data to produce improved higher-level themes. These themes should be directly linked to the Main topic and research questions.


Context:
1. **Previous Themes:**  
   The themes generated in the previous run, which the user did not like and wants to be changed, provided in JSON format:

   {previous_themes}

2. **Feedback:**  
   Optional feedback on the previous themes to guide refinement:

   {feedback}

3. **List of Unique Codes:**  
   A separate list containing all the unique codes extracted from the QEC data.

   Codes:
   {unique_codes}

4. **QEC Data (JSON):**
  The Code and summary table contains the rationale summary (summary), and the assigned code.
   - Example structure in JSON:
     ```json
     [
        {{
          "code": "CodeName",
          "summary": "Summary of multiple explanations signifying the meaning of the code."
        }}
        // Additional instances...
      ]
     ```

   Data:
   {qec_table}

Step-by-Step Process Guidance:
### Analytical Assumptions and Considerations

- **Dual Processes of Quality Analysis:**  
  Good quality codes and themes result from both immersive, in-depth engagement with the dataset and from giving the developing analysis some reflective distance—often achieved by taking breaks during the process.

- **Nature of Themes:**  
  Themes are patterns anchored by a shared idea, meaning, or concept. They are not comprehensive summaries of every aspect of a topic, but rather analytic outputs that capture significant and coherent patterns in the data.

- **Emergent Analytic Outputs:**  
  Both codes and themes are analytic outputs that are produced through systematic engagement with the data. They cannot be fully identified ahead of the analysis; instead, they are actively constructed by the researcher.

- **Active Production:**  
  Themes do not passively 'emerge' from the data; they are the result of deliberate, reflective, and systematic analysis, combining both immediate engagement and thoughtful distance.

### Instructions

1. **Review Previous Themes and Feedback:**
   - Examine the previous themes and the feedback provided.
   - Assess the strengths and weaknesses of the previous themes, identifying areas for improvement based on the feedback (e.g., missed patterns, unclear groupings, or misaligned interpretations).

2. **Familiarization with the Data:**
   - Re-examine the list of unique codes and the QEC data to refresh your understanding of the dataset.
   - Consider both the explicit (semantic) content and the underlying (latent) meanings conveyed by the quotes and explanations.

3. **Theme Refinement and Generation:**
   - Actively construct new or refined themes by identifying patterns and shared meanings among the codes, informed by the previous themes and feedback.
   - Modify existing themes, merge overlapping ones, separate themes that conflate distinct ideas, or create entirely new themes as needed to better capture significant and coherent patterns.
   - Validate each theme's coherence and relevance against the quotes and explanations in the QEC data.

4. **Theme Naming:**
   - Assign concise, evocative names to each theme that accurately reflect the central ideas of the grouped codes.

**Output Format and Constraints:**
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
No additional text outside the JSON.
"""


    @staticmethod
    def theme_generation_continuation_prompt(
        unique_codes: str,
        qec_table: str,
        existing_clusters: str
    ) -> str:
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis. You have already generated the following themes from earlier batches:
```json
{existing_clusters}
````

Now integrate this new batch of data:

1. **List of Unique Codes:**

```json
{unique_codes}
```

2. **QEC Data (JSON):**

```json
{qec_table}
```

Follow the same analytic process:

* Identify patterns and shared meanings among codes.
* Integrate each new code into an existing theme or create new themes as needed.
* Merge overlapping themes or split those conflating distinct ideas.
* Validate coherence of each theme against the QEC data.
* Assign concise, evocative names to any new themes.

**Output Format**
Return **only** this JSON object, with no extra commentary:

```json
{{
  "themes": [
    {{
      "theme": "Theme Name 1",
      "codes": ["CodeA", "CodeB"]
    }},
    {{
      "theme": "Theme Name 2",
      "codes": ["CodeC"]
    }}
    // …
  ]
}}
```

"""

    @staticmethod
    def redo_theme_generation_continuation_prompt(
        previous_themes: str,
        feedback: str,
        unique_codes: str,
        qec_table: str,
        existing_themes: str
    ) -> str:
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis. Previously you generated these themes:

```json
{previous_themes}
```

User feedback:
{feedback}

So far, after integrating earlier batches, you have:

```json
{existing_themes}
```

Now refine and extend using this full dataset:

1. **List of Unique Codes:**

```json
{unique_codes}
```

2. **QEC Data (JSON):**

```json
{qec_table}
```

Your tasks:

* Incorporate the feedback into your existing themes.
* Integrate any codes not yet assigned, adding or modifying themes as needed.
* Merge, split, rename, or discard themes to improve coherence and distinctness.
* Validate each theme against the QEC data.

**Output Format**
Return **only** this JSON object, with no extra commentary:

```json
{{
  "themes": [
    {{
      "theme": "Refined Theme 1",
      "codes": ["CodeX", "CodeY"]
    }},
    // ...
  ]
}}
```

"""



class RefineSingleCode:
    @staticmethod
    def refine_single_code_prompt(chat_history: str,
                                  code: str,
                                  quote: str,
                                  user_comment: str,
                                  transcript: str):
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis. Your task is to evaluate a previously generated code and its corresponding quote in light of a user's comment from the chat history. You must determine whether you agree or disagree with the user's comment regarding the provided code and quote, provide a clear explanation for your stance, and output a command indicating the appropriate action. The available commands are:
- REMOVE_QUOTE: if the code/quote is deemed inappropriate or not representative.
- ACCEPT_QUOTE: if the code/quote is deemed appropriate and well-supported.
- EDIT_QUOTE: if you believe that the code/quote needs revision. In this case, provide a list of alternative code suggestions along with your explanation.
- REVERT_TO_INITIAL: if you believe that the initial code (before any modifications) is more appropriate than the current one, especially after considering the user's comment and chat history.

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
   - Use REVERT_TO_INITIAL if you believe that the initial code is more suitable than the current one or the user specifically requests it to be reverted.
   
### Output Requirements
Return your output strictly in valid JSON format:
```json
{{
  "agreement": "AGREE" or "DISAGREE",
  "explanation": "Your explanation text here",
  "command": "REMOVE_QUOTE" or "ACCEPT_QUOTE" or "EDIT_QUOTE" or "REVERT_TO_INITIAL",
  "alternate_codes": [ "alternative code suggestion 1", "alternative code suggestion 2", ... ] // This field should contain a list of revised code suggestions if command is EDIT_QUOTE; otherwise, it can be an empty list.
}}
```

No additional commentary outside the JSON object.
"""

class RemakerPrompts:
    @staticmethod
    def redo_initial_coding_prompt(main_topic: str,
                                   additional_info: str,
                                   research_questions: str,
                                   concept_table: str,
                                   post_transcript: str,
                                   current_codebook: str,
                                   feedback: str):
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis. 

Your task is to generate codes by extracting meaningful quotes from the transcript that link to the main topic, that are evidence to answer research questions, support additional information, and concept table.

Context: 
- **Main Topic:** {main_topic}  
- **Additional Information:** {additional_info}  
- **Research Questions:** {research_questions}  
- **Concept Table (JSON):** {concept_table}  
- **Initial Codebook:** {current_codebook}
- **Feedback:** {feedback}
- **Transcript:** {post_transcript}

Step-by-Step Process Guidance:
1. Read the Transcript
First, read the entire transcript to understand its overall content and context. Only code the post if it contains quotes that link to the main topic, that are evidence to answer research questions, support additional information, and concept table; otherwise, skip it.

2. Review and Integrate Feedback
The initial coding was completed once, but the user found the resulting codebook underwhelming.
   - **Examine the initial codebook**, Initial codebook
   - **Consider the optional feedback**, Feedback
   - **Identify issues**: What might have led the user to find the original codes less than satisfactory?

3. Line-by-Line Coding
- **Extract:** For each relevant segment, copy the complete, exact quote.
- **Code:** Assign a concise label that reflects its meaning relative to the main topic, additional information, research questions, and concept table.
  - Adjust for the identified issues.
- **Skip:** Do *not* code irrelevant or off-topic content. Avoid generic labels like “irrelevant,” “off-topic,” etc.
- Generate each code as a natural phrase - just as a expert human qualitative researcher would. Each word in the phrase should be seperated by a space.

Output Format and Constraints:
Return **only** valid JSON, exactly matching this structure:

```json
{{
  "codes": [
    {{
      "quote": "Complete and exact phrase from the transcript (from the start to the end of the sentence).",
      "explanation": "How this quote supports the research focus.",
      "code": "Assigned code label.",
      "source": {{
        "type": "comment", // "comment" or "post"
        "comment_id": "1.2", // required if type is "comment"
        "title": false // required if type is "post": true = title, false = body
      }}
    }}
    // …additional code objects…
  ]
}}
````
  
* If a quote fits multiple codes, list each as a separate entry.
* Omit quotes that do not align with any valid codes.
* If no codes apply, return:

  ```json
  {{ "codes": [] }}
  ```
* **Do not** include any text outside the JSON.
"""






    @staticmethod
    def redo_final_coding_prompt(main_topic: str,
                                additional_info: str,
                                research_questions: str,
                                final_codebook: str,
                                current_codebook: str,
                                concept_table: str,
                                post_transcript: str,
                                feedback: str):
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis. 

Your task is to assign codes — either by selecting existing codes from the final codebook or generating new ones directly from the data — to meaningful quotes in the transcriptthat link to the main topic, that are evidence to answer research questions, support additional information, and concept table.


Context:
- **Main Topic:** {main_topic}
- **Additional Information:** {additional_info}
- **Research Questions:** {research_questions}
- **Final Codebook:** {final_codebook}
- **Current Codebook:** {current_codebook}
- **Concept Table (JSON):** {concept_table}
- **Feedback:** {feedback}
- **Transcript:** {post_transcript}

Step-by-Step Process Guidance:
1. Read the Transcript
First, read the entire transcript to understand its overall content and context. Only code the post if it contains quotes that link to the main topic, that are evidence to answer research questions, support additional information, and concept table; otherwise, skip it.

2. Review and Integrate Feedback
The final coding was completed once, but the user found the resulting codebook underwhelming.
  - **Examine the current code assignments from the current codebook**
  - **Consider the optional feedback**
  - **Identify issues**: What might have led the user to find the original codes less than satisfactory?

3. Line-by-Line Coding
- **Extract:** For each relevant segment, copy the complete, exact quote.
- **Code:** Assign a concise label that reflects its meaning relative to:
  - Adjust for the identified issues.
  - Use existing codes from the final codebook, or update/propose new codes if the predefined ones do not fit the data well.
- **Skip:** Do *not* code irrelevant or off-topic content. Avoid generic labels like “irrelevant,” “off-topic,” etc.
- Generate each code as a natural phrase - just as a expert human qualitative researcher would. Each word in the code should be seperated by a space.

Output Format and Constraints:
Return **only** valid JSON, exactly matching this structure:

```json
{{
  "codes": [
    {{
      "quote": "Complete and exact phrase from the transcript (from the start to the end of the sentence).",
      "explanation": "How this quote supports the research focus and justifies the assigned code (note if it's updated or new).",
      "code": "Assigned code (from final codebook or updated/new).",
      "source": {{
        "type": "comment", // "comment" or "post"
        "comment_id": "1.2", // required if type is "comment"
        "title": false // required if type is "post": true = title, false = body
      }}
    }}
    // …additional code objects…
  ]
}}
```

* If a quote fits multiple codes, list each as a separate entry.
* Omit quotes that do not align with any valid codes.
* If no codes apply, return:

  ```json
  {{ "codes": [] }}
  ```
* **Do not** include any text outside the JSON.
"""

    
class GroupCodes:
    @staticmethod
    def group_codes_prompt(codes: str, qec_table: str):
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis. 

Your task is to follow instructions to group the provided codes into higher-level codes based on the associated QEC (Quote-Explanation-Code) data. 
These higher-level codes should be directly linked to the Main topic and research questions.


Context:
Code and summary Data: 
```json
{qec_table}
```
Unique Codes:
```json
{codes}
```

Step-by-Step Process Guidance:
- Assess the provisional groupings for coherence and fit with the data.
- Check if each emerging higher-level code tells a convincing story about the dataset.
- Determine whether any candidate codes should be merged, split, or discarded.
 
- Fine-tune and finalize higher-level codes so each has a clear central concept.
- Write a concise definition capturing the essence of each grouping.
- Ensure the groupings form a coherent overall story about the data.

Your tasks:
1. **Review the Code and summary Data**:  
   - The Code and summary table contains the rationale summary (summary), and the assigned code.
   - Example structure in JSON:
     ```json
     [
        {{
          "code": "CodeName",
          "summary": "Summary of multiple explanations signifying the meaning of the code."
        }}
        // Additional instances...
      ]
     ```
    
2. **Examine the List of Unique Codes**:  
   - This is a simple array of code names extracted from the Code and summary table, e.g.:
     ```json
     ["Code1", "Code2", "Code3", ...]
     ```
   - These are the existing lower-level codes that may need to be merged or refined into broader categories.

3. **Develop Higher-Level Codes**:  
   - Group related lower-level codes under more encompassing, conceptual headings.
   - Name each higher-level code in a succinct, meaningful way.

4. **Check for Fit and Coherence**:  
   - For each higher-level code, confirm it is consistent with the original summary.
   - If any code doesn't fit or contradicts the grouping, consider re-grouping it.
   - Be prepared to revise (split, merge, rename) during this review.

5. **Ensure Distinctness**:  
   - Make sure each higher-level code is meaningfully different from the others.
   - Avoid overlapping definitions or repeated coverage of the same pattern.

6. **Finalize Output**:  
   - Return the result in **valid JSON** only, following the same structure given below.
   - Do **not** include any text outside the JSON object.

Output Format and Constraints
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
- Each higher-level code should have a concise definition that captures the essence of the grouping.
- Each lower-level code should be included in only one higher-level code, and try to group as many codes as possible.
- Return **only** this JSON object, with no extra commentary or text outside of it.
"""
    @staticmethod
    def regroup_codes_prompt(codes: str, qec_table: str, previous_higher_level_codes: str, feedback: str):
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis. 

Your task is to follow instructions to refine the previous grouping of codes into higher-level codes based on the provided optional feedback and a re-examination of the data. 
These higher-level codes should be directly linked to the Main topic and research questions.


Context:
1. **Previous Higher-Level Codes:**  
   The higher-level codes generated in the previous run, which the user did not like and wants to be changed, provided in JSON format:  
   {previous_higher_level_codes}

2. **Feedback:**  
   Optional feedback on the previous higher-level codes to guide refinement, try to stick to the feedback at all times (if there is one):  
   {feedback}

3. **Code and Summary Data (JSON):**  
   A list of codes with their summaries:  
   {qec_table}

4. **List of Unique Codes:**  
   A list of unique codes extracted from the Code and Summary Data:  
   {codes}


Step-by-Step Process Guidance:
1. **Review Previous Higher-Level Codes and Feedback:**  
   - Examine the previous higher-level codes and the optional feedback.  
   - Identify areas where the groupings can be changed based on the feedback.

2. **Review the Code and Summary Data:**  
   - Re-examine the Code and Summary Data to understand the context and meanings of the codes.

3. **Examine the List of Unique Codes:**  
   - Consider the full set of unique codes that need to be grouped.

4. **Refine Higher-Level Codes:**  
   - Integrate insights from the previous higher-level codes, the feedback, and a re-examination of the Code and Summary Data to refine the groupings.  
   - Address the specific points raised in the feedback to change the higher-level codes.  
   - Modify the groupings as needed:  
     - Merge higher-level codes that are too similar or overlapping.  
     - Split higher-level codes that cover multiple distinct concepts.  
     - Add new higher-level codes if necessary to better capture patterns in the data.  
     - Remove higher-level codes that are no longer relevant or supported by the data.  
   - For each higher-level code, ensure it has a clear, concise name and a short definition that captures the essence of the grouping (for internal reasoning).

5. **Check for Fit and Coherence:**  
   - Ensure that each higher-level code is coherent and fits well with the codes it contains, based on their summaries.  
   - Validate that the groupings align with the feedback and the data.  
   - Be prepared to further revise (split, merge, rename) during this review.

6. **Ensure Distinctness:**  
   - Make sure each higher-level code is distinct and does not overlap significantly with others.

7. **Finalize Output:**  
   - Provide the refined higher-level codes in valid JSON format, following the structure below.  
   - Do not include any additional text outside the JSON object.

### Output Format
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
- Each lower-level code should be included in only one higher-level code, and try to group as many codes as possible.  
- Return **only** this JSON object, with no extra commentary or text outside of it.
"""
    
    @staticmethod
    def group_codes_continuation_prompt(
        codes: str,
        qec_table: str,
        existing_clusters: str
    ) -> str:
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis. 

Your task is to refine existing higher-level codes and integrate a new batch of codes based on the provided QEC (Quote-Explanation-Code) data. 
These higher-level codes should remain directly linked to the Main topic and research questions.
- Assess the provisional groupings for coherence and fit with the data.  
- Check if each emerging higher-level code tells a convincing story about the dataset.  
- Determine whether any candidate codes should be merged, split, or discarded.  
- Fine-tune and finalize higher-level codes so each has a clear central concept.  
- Write a concise definition capturing the essence of each grouping.  
- Ensure the groupings form a coherent overall story about the data.

Context:
1. **Existing Higher-Level Codes**  
   ```json
   {existing_clusters}
````

2. **New Code and Summary Data**

   ```json
   {qec_table}
   ```

3. **List of Unique Codes**

   ```json
   {codes}
   ```

Step-by-Step Process Guidance:
1. **Review** the existing higher-level codes above.
2. **Integrate** each new code into one of those existing groups, or create new higher-level codes if needed.
3. **Apply** all thematic-analysis checks (fit, coherence, distinctness) and refine names/definitions internally.

Output Format and Constraints:
Return **only** this JSON object, with no extra text:

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
        "RelevantLowerLevelCodeC"
      ]
    }}
    // ...
  ]
}}
```

"""

    @staticmethod
    def regroup_codes_continuation_prompt(
        codes: str,
        qec_table: str,
        existing_higher_level_codes: str,
        previous_higher_level_codes: str,
        feedback: str
    ) -> str:
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis. 

Your task is to refine the previous higher-level codes using the provided feedback, then integrate a new batch of codes. 
These higher-level codes should remain directly linked to the Main topic and research questions.
* Review and refine group coherence, narrative, and distinctness.
* Merge, split, or discard codes as needed.
* Refine names and definitions internally.
* Ensure a coherent overall story about the data.


Context:
1. **Previous Higher-Level Codes**

   ```json
   {previous_higher_level_codes}
   ```

2. **User Feedback**

   ```json
   {feedback}
   ```

3. **Existing Higher-Level Codes** (so far)

   ```json
   {existing_higher_level_codes}
   ```

4. **New Code and Summary Data**

   ```json
   {qec_table}
   ```

5. **List of Unique Codes**

   ```json
   {codes}
   ```

Step-by-Step Process Guidance:
1. **Incorporate** the feedback into your refinements of the previous codes.
2. **Assign** each new code into an existing group or create new ones as needed.
3. **Apply** all thematic-analysis checks (fit, coherence, distinctness) and refine names/definitions internally.

Output Format and Constraints:
Return **only** this JSON object, with no extra text:

```json
{{
  "higher_level_codes": [
    {{
      "name": "NameOfHigherLevelCode1",
      "codes": [
        "codeA",
        "codeB"
      ]
    }},
    // ...
  ]
}}
"""





class GenerateCodebookWithoutQuotes:
    @staticmethod
    def generate_codebook_without_quotes_prompt(codes: str):
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis. 

Your task is to summarize multiple explanations for various codes and merge them into a single definition for each code.

Context:
1. **List of Codes and Explanations (JSON):**
{codes}

The input JSON object will be structured as follows:
```json
{{
  "code1": ["Explanation1", "Explanation2", ...],
  "code2": ["Explanation1", "Explanation2", ...],
  ...
}}
```

Step-by-Step Process Guidance:
For each code in the JSON object, analyze all the provided explanations. Identify the common key points, and any notable differences or contradictions among the explanations.

Based on your analysis, create a single, coherent definition for each code that captures the essence of all its explanations. The definition should be concise, clear, and representative of the various perspectives presented. If there are contradictions, acknowledge them in the definition or provide a definition that encompasses the different viewpoints. Aim for definitions that are approximately a few sentences long, but ensure they are comprehensive enough to cover the main points.

Do not simply select one explanation as the definition; instead, create a new definition that integrates the key elements from all explanations for each code.

Output Format and Constraints:
Present your results in a JSON object where each key is a code and each value is the corresponding definition. The format should be:
```json
{{
  "code1": "definition1",
  "code2": "definition2",
  ...
}}
```

Your response should consist solely of the JSON object containing the definitions for each code. Do not include any additional text, explanations, or commentary.
"""
    @staticmethod
    def regenerate_codebook_without_quotes_prompt(codes: str, previous_codebook: str, feedback: str):
        return f"""
You are an expert in qualitative research, tasked with refining code definitions based on previous outputs and feedback. 

Previously, you generated definitions for various codes by summarizing multiple explanations. 
Now, you will refine those definitions using feedback and by re-examining the original explanations.

Context:
1. **Previous Codebook:**  
   The definitions generated in the previous run, which the user did not prefer so wants them to be changed and need to keep in mind to avoid while generating a new version, provided in JSON format:

   {previous_codebook}

2. **Feedback:**  
   Feedback on the previous codebook to guide refinement:

   {feedback}

3. **Original Explanations (JSON):**  
   The original data containing codes and their explanations, structured as follows:
   ```json
   {{
     "code1": ["Explanation1", "Explanation2", ...],
     "code2": ["Explanation1", "Explanation2", ...],
     ...
   }}
   ```
   The input JSON object is:

   {codes}

Step-by-Step Process Guidance:
1. **Review the Previous Codebook and Feedback:**  
   - Examine the previous definitions and the feedback provided.  
   - Identify specific areas where the definitions can be improved based on the feedback.  
   - If the feedback indicates that a definition is already satisfactory, you may keep it as is or make minor adjustments as needed.

2. **Re-examine the Original Explanations:**  
   - Review the original explanations for each code to ensure the refined definitions capture the common themes, key points, and any notable differences or contradictions.

3. **Refine the Definitions:**  
   - For each code, refine the definition by addressing the feedback while maintaining the essence of the original definition where appropriate.  
   - Ensure that the refined definition remains grounded in the original explanations, integrating their key elements while addressing the feedback.  
   - The refined definition should be concise (a few sentences), clear, and representative of the various perspectives in the explanations.  
   - If there are contradictions in the explanations, acknowledge them or provide a definition that encompasses the different viewpoints.  
   - Do not simply select one explanation as the definition; instead, create a new definition that integrates the key elements from all explanations, refined based on the feedback.

Output Format and Constraints:
   - Provide the refined definitions in a JSON object where each key is a code and each value is the corresponding refined definition.  
   - The format should be:

   ```json
   {{
     "code1": "refined_definition1",
     "code2": "refined_definition2",
     ...
   }}
   ```

Your response should consist solely of the JSON object containing the refined definitions for each code. Do not include any additional text, explanations, or commentary.
"""


class TopicClustering:
    @staticmethod
    def begin_topic_clustering_prompt(words_json: str) -> str:
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis.  

Your task is to review the list of initial codes and merge any that share the same meaning into a single, more abstract code. Aim for a balanced set of clusters—neither too many highly granular codes nor too few overly broad ones. Use concise, descriptive names that capture the essence of each group.
 
Context:
Codes to cluster (JSON array of strings):
{words_json}

Step-by-Step Process Guidance:
Generate each cluster code (reviewed code) as a natural phrase - just as a expert human qualitative researcher would. Each word in the code should be seperated by a space.

Output Format and Constraints:
Return **only** valid JSON (no extra text), wrapped in a markdown code block, in this format:

```json
{{
  "ClusterName1": ["codeA", "codeB", ...],
  "ClusterName2": ["codeC", "codeD", ...],
  …
}}
```
"""

    @staticmethod
    def continuation_prompt_builder(current_clusters_keys: str, words_json: str) -> str:
        return f"""
You are an expert in qualitative research, specializing in Braun & Clarke's six-phase thematic analysis.   


Your task is to review the list of **more initial codes** and either assign each one to an **existing cluster** if it fits that cluster's meaning or create a new cluster.  
- **Only** create a new cluster when a code does **not** clearly belong under any existing cluster name.  
- Each new code must appear **exactly once** in your output.  
- Generate each cluster code (reviewed code) as a natural phrase - just as a expert human qualitative researcher would. Each word in the code should be seperated by a space.
 
Context:
- **More initial codes (JSON array of strings):**
{words_json}

- **Existing Clusters (JSON array of strings):**
{current_clusters_keys} 

Output Format and Constraints:
Return **only** valid JSON (no extra text), wrapped in a markdown code block, in this format:

```json
{{
  "ClusterName1": ["newCodeA", "newCodeB", …],
  "ClusterName2": ["newCodeC", …],
  "NewClusterName3": ["newCodeD", …]
}}
````

Here are the new codes to assign (JSON array of strings):
{words_json}
"""


    
class ConceptOutline:
    @staticmethod
    def definition_prompt_builder():
        system_prompt = """
You are an expert in qualitative research. 

Your task is to provide clear, concise definitions for a list of terms based on the provided context, main topic, research questions, and additional information. 
If the context does not contain sufficient detail, you may draw on your broader domain knowledge.


Output Format and Constraints:
IMPORTANT - respond *only* in JSON, formatted as an array of objects with this schema:

```json{{
  "concepts": [
    {{
      "word": "<Term>",
      "description": "<Definition of the term, including its relevance to the main topic, research questions, or additional information>"
    }},
    ...
  ]
}}```
            \nTextual Data: \n{context}\n\n"""
        return system_prompt
            
    @staticmethod
    def input_prompt_builder(mainTopic: str, additionalInfo: str, researchQuestions: str, batch_words: list):
        return f"""
Context:
Main Topic: {mainTopic}\n
Additional information about main topic: {additionalInfo}\n\n 
Research Questions: {researchQuestions}\n
Words to define: {', '.join(batch_words)}\n\n

Output Format and Constraints:
Provide the response in JSON format.
Your response must be in JSON format as a list of objects with this schema 
```json{{
  "concepts": [
    {{
      "word": "<Term>",
      "description": "<Definition of the term, including its relevance to the main topic, research questions, or additional information>"
    }},
    ...
  ]
}}```\n
Follow the JSON format strictly. 
"""
