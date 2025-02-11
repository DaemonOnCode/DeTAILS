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
    def systemPromptTemplate(mainTopic: str, researchQuestions: str, additionalInfo: str):
        return [
        f"""You are an advanced AI model specializing in qualitative research and deductive thematic coding. Your task is to **identify 20 highly relevant keywords** that will serve as the foundation for **building context** in a qualitative research study.

Each keyword should come with:
- **A clear description** explaining its relevance to the main topic.
- **Inclusion criteria** specifying when the keyword should be applied in coding.
- **Exclusion criteria** specifying when the keyword should *not* be applied to prevent misclassification.

### **Process**
1. **Understanding Research Context**  
   - Analyze the **main topic**, **research questions**, **additional information**, and **textual data** from provided PDFs and references.  
   - Identify **keywords that best represent** the themes present in {mainTopic}, {researchQuestions}, and {additionalInfo}.  

2. **Extracting High-Quality Keywords**  
   - Generate **exactly 20 unique keywords** relevant to {mainTopic} and {researchQuestions}.  
   - Consider **additionalInfo** to refine keyword selection.
   - Keywords should **cover different dimensions** of the topic and avoid redundancy.

3. **Providing Detailed Information for Each Keyword**  
   For each keyword, generate:
   - **Description**: A clear explanation of how the keyword relates to the main topic and research context.
   - **Inclusion Criteria**: When this keyword should be used in thematic coding.
   - **Exclusion Criteria**: When this keyword *should not* be used to prevent overlap with other themes.

4. **Output Formatting**  
   Your response must be **strictly in JSON format**, following this structure:

```json
{ContextPrompt.keyword_json_template}
```
""",
        """\nTextual Data: \n{context}\n\n"""
    ]

    @staticmethod
    def context_builder(mainTopic: str, researchQuestions: str, additionalInfo: str):
        return f"""
I need **a structured list of 20 keywords** with coding guidelines to establish context for **deductive thematic analysis**, based on the following research inputs:

- **Main Topic**: {mainTopic}
- **Research Questions**: {researchQuestions}
- **Additional Information**: {additionalInfo}  
- **Context**: Textual data (from PDFs and reference materials)

### **Instructions**
1. **Extract 20 Unique Keywords**  
   - Carefully analyze the **context** provided in Textual data.  
   - Identify **exactly 20 keywords** that are **highly relevant** to {mainTopic} and {researchQuestions}.  
   - Consider **additionalInfo** to refine keyword selection.
   - Ensure the words **span different aspects** of the research to **build a strong context** for later analysis.

2. **Provide Details for Each Keyword**  
   - **Description**: A clear explanation of the keyword and its relevance to {mainTopic} and {additionalInfo}.
   - **Inclusion Criteria**: Specify the **types of textual evidence** that should be coded under this keyword.
   - **Exclusion Criteria**: Define what **should not** be coded under this keyword to prevent overlap.

### **Output Format**  
Your response should be **strictly a JSON object** in the following format:

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
}}```

### Important Notes
    - Only return the JSON object—no explanations, summaries, or additional text.
    - Ensure the JSON is valid and properly formatted.
    - Provide exactly 20 keywords—no more, no less.

Proceed with extracting the keywords.
"""
    @staticmethod
    def regenerationPromptTemplate(mainTopic: str, researchQuestions: str, additionalInfo: str, selectedKeywords: str, unselectedKeywords: str, extraFeedback: str):
        return [
        f"""You are an advanced AI specializing in **qualitative research** and **thematic coding**. Your task is to **refine previously generated keywords** based on **selected themes, unselected themes, and new feedback**.

### **New Inputs:**
- **Selected Keywords** (DO NOT include these keywords): {selectedKeywords}
- **Unselected Keywords** (DO NOT include these keywords): {unselectedKeywords}
- **Extra Feedback**: {extraFeedback}

### **Process**
1. **Re-evaluating the Context**
   - Analyze the **main topic**, **research questions**, and **additional information**.
   - Use **selected themes** as a basis for improving keyword selection.
   - **REMOVE any keywords related to unselected themes**.

2. **Improving Keyword Selection**
   - Modify **existing keywords** based on feedback.
   - Remove **irrelevant or redundant keywords**.
   - Introduce **new keywords** if necessary.
   - Ensure keywords **align with selected themes** while excluding unselected ones.

3. **Providing Updated Information for Each Keyword**
   - **Description**: Explain the **revised** keyword's relevance.
   - **Inclusion Criteria**: When should this keyword be applied?
   - **Exclusion Criteria**: When should it **not** be applied?

4. **Output Formatting**
   Your response must be **strictly in JSON format**, following this structure:

```json
{ContextPrompt.keyword_json_template}
```

### **Important Notes**
- **DO NOT** include explanations, summaries, or additional text.
- Ensure JSON is **valid** and properly formatted.
- Provide **exactly 5 refined keywords**.
- **REMOVE keywords related to unselected themes**.

Proceed with refining the keywords.
""",
        """\nTextual Data: \n{context}\n\n"""
    ]

    @staticmethod
    def refined_context_builder(mainTopic: str, researchQuestions: str, additionalInfo: str, selectedKeywords: str, unselectedKeywords: str, extraFeedback: str):
        return f"""
I need **a refined list of 5 keywords** based on the following research inputs:

- **Main Topic**: {mainTopic}
- **Research Questions**: {researchQuestions}
- **Additional Information**: {additionalInfo}
- **Selected Keywords**: {selectedKeywords}
- **Unselected Keywords** (DO NOT include keywords related to these themes): {unselectedKeywords}
- **Extra Feedback**: {extraFeedback}

### **Instructions**
- Modify existing keywords based on feedback.
- Adjust descriptions, inclusion, and exclusion criteria.
- **REMOVE any keywords related to unselected themes**.
- Keep JSON format **strict**.

### **Output Format**
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
}}```

Proceed with the refinement.
"""

class InitialCodePrompts:
    @staticmethod
    def initial_code_prompt(main_topic: str, additional_info: str, research_questions: str, keyword_table: str, post_transcript: str):
        return f"""
You are an advanced AI model specializing in **qualitative research and deductive thematic analysis**. Your task is to **extract thematic codes** from a given **post transcript** using a predefined **keyword table**.

---

### **Context and Input Information**  
You will be provided with:
- **Main Topic**: `{main_topic}`
- **Additional Information**: `{additional_info}`
- **Research Questions**: `{research_questions}`
- **Keyword Table**: A structured list of **keywords**, in JSON format, each containing:
  - **word**: The keyword.
  - **description**: Explanation of its meaning and relevance.
  - **inclusion_criteria**: When this keyword should be applied.
  - **exclusion_criteria**: When this keyword should *not* be applied.
`{keyword_table}`
- **Post transcript**: `{post_transcript}`

---

### **Your Task: Extract and Assign Thematic Codes**
1. **Analyze the Post transcript**  
   - Carefully read the post transcript and identify **relevant themes** using the **keyword table**.
   - Match **phrases from the response** to **keywords** based on their **description** and **inclusion criteria**.
   - Ensure **exclusion criteria** are respected—**do not apply keywords incorrectly**.

2. **Generate Output in Valid JSON Format**  
   - Each identified code must include:
     - `"quote"`: The **exact phrase** from the response.
     - `"explanation"`: A **clear explanation** of how the phrase relates to the keyword.
     - `"code"`: The **assigned keyword** from the table.
   - **Strictly return output in this JSON format**:
   
   ```json
   {{
     "codes": [
       {{
         "quote": "Extracted phrase from the response.",
         "explanation": "Explanation of how this phrase relates to the keyword.",
         "code": "Assigned code from the keyword table."
       }},
       ...
     ]
   }}
   ```

3. **Ensure Comprehensive and Accurate Coding**  
   - If multiple **keywords** apply to the same **quote**, list each separately.
   - Only use **keywords that fit the response**—avoid forced classifications.
   - If no valid codes apply, return an empty JSON object: `{{ "codes": [] }}`.

---

### **Example Response and Expected Output**
##### **Input Response:**
> `"I remember really liking this song when it came out and dancing to it."`

##### **Correct JSON Output:**
```json
{{
  "codes": [
    {{
      "quote": "I remember really liking this song when it came out and dancing to it",
      "explanation": "This phrase reflects a positive emotional connection with the song.",
      "code": "Positive"
    }},
    {{
      "quote": "I remember really liking this song when it came out and dancing to it",
      "explanation": "This phrase refers to recalling past events related to the song.",
      "code": "Memory"
    }},
    {{
      "quote": "I remember really liking this song when it came out and dancing to it",
      "explanation": "This phrase explicitly mentions dancing, which is a form of physical engagement with the music.",
      "code": "Dancing"
    }}
  ]
}}
```

---

### **Output Requirements**
- **Return only the JSON object.** No explanations, summaries, or extra text.
- **Ensure the JSON is valid and properly formatted.**
- **Do not generate more than necessary—each quote should have only relevant codes.**

Now, analyze the response and generate the thematic codes in JSON format.
"""
    

class DeductiveCoding:
    @staticmethod
    def deductive_coding_prompt(final_codebook: str, post_transcript: str, keyword_table: str, main_topic: str, additional_info: str = "", research_questions: str = ""):
        
        print(final_codebook, post_transcript, keyword_table, main_topic, additional_info, research_questions)
        return f"""
You are an advanced AI model specializing in **qualitative research and deductive thematic coding**. Your task is to **analyze a post transcript** and apply thematic codes based on predefined criteria.

---

### **Context and Input Information**  
You will be provided with:

- **Main Topic of Interest**:  
  `{main_topic}`

- **Additional Information** *(for deeper context of the main topic of interest)*:  
  `{additional_info}`

- **Research Questions** *(to guide the analysis)*:  
  {research_questions}

- **Codebook** *(Structured thematic codes in JSON format)*:
  - **code**: The thematic code.
  - **quote**: The quote related to the code
  - **explanation**: An explanation on why the code was chosen for the quote
  {final_codebook}

- **Keyword Table** *(Structured list of keywords in JSON format)*:
  - **word**: The keyword.
  - **description**: Explanation of its meaning and relevance.
  - **inclusion_criteria**: When this keyword should be applied.
  - **exclusion_criteria**: When this keyword should *not* be applied.
  {keyword_table}

- **Post Transcript** *(The raw text that needs to be analyzed)*:  
  {post_transcript}

---

### **Your Task: Extract and Assign Thematic Codes**
1. **Analyze the Post Transcript**  
   - Carefully **read and interpret** the transcript.
   - Compare **phrases from the transcript** with:
     - **Thematic codes (from the codebook)**
     - **Relevant keywords (from the keyword table)**
   - Use the **inclusion/exclusion criteria** of the keyword table to ensure accurate application.
   - Consider the **main topic and research questions** when extracting codes.

2. **Generate Output in Valid JSON Format**  
   - Each identified **code and keyword** must include:
     - `"quote"`: The **exact phrase** from the transcript.
     - `"explanation"`: A **concise rationale** explaining how the phrase relates to the assigned code.
     - `"code"` *(if applicable)*: The **assigned thematic code** from the codebook or assign new and relevant code
     for the quote derived from the Keyword table, main topic of interest, additional information about the main topic, and research questions.

   - **Strictly follow this JSON structure**:
   ```json
   {{
     "codes": [
       {{
         "quote": "Extracted phrase from the transcript.",
         "explanation": "Explanation of how this phrase relates to the assigned code.",
         "code": "Assigned code from the codebook (if applicable).",
       }},
       ...
     ]
   }}
   ```

3. **Ensure Accuracy and Consistency in Coding**  
   - If a **phrase fits multiple codes**, list them separately.
   - Avoid forced classifications—**only use codes/keywords that directly match the content**.
   - If no valid codes or keywords apply, return an empty JSON object:  
     ```json
     {{ "codes": [] }}
     ```

---

### **Example Response and Expected Output**
##### **Post Transcript Example:**
> `"I always get nervous before public speaking, and I feel like I mess up every time."`

##### **Correct JSON Output:**
```json
{{
  "codes": [
    {{
      "quote": "I always get nervous before public speaking",
      "explanation": "The phrase describes feelings of anxiety before a social activity.",
      "code": "Social Anxiety",
    }},
    {{
      "quote": "I feel like I mess up every time",
      "explanation": "The phrase reflects self-doubt and perceived personal failure.",
      "code": "Self-Doubt",
    }}
  ]
}}
```

---

### **Output Requirements**
- **Return only the JSON object.** No explanations, summaries, or extra text.
- **Ensure the JSON is valid and correctly formatted.**
- **Each quote should only have relevant codes—do not over-code or misapply them.**

Now, analyze the given post transcript and apply the thematic codes based on the provided criteria, returning the results in JSON format.
"""

class ThemeGeneration:
    @staticmethod
    def theme_generation_prompt(qec_table: str):
        return f"""
You are an advanced AI model specializing in **qualitative research and thematic analysis**. Your task is to **identify themes** based on a provided Quote-Explanation-Code (QEC) table.

---

### **Context and Input Information**  
You will be provided with:
- **QEC Table**: A structured JSON object containing:
  - **quote**: The exact phrase from the transcript.
  - **explanation**: The reason why the quote was assigned a specific code.
  - **code**: The thematic code assigned to the quote.
  
  `{qec_table}`

---

### **Your Task: Identify and Organize Themes**
1. **Group Thematic Codes into Higher-Level Themes**  
   - Identify **patterns** among the provided codes.
   - Group similar or related codes into **themes** based on their meaning.
   - Each **theme** should represent a **broader category** that unifies multiple codes.

2. **Generate Output in Valid JSON Format**  
   - The output should be a **JSON object** with:
     - **theme**: The overarching theme name.
     - **codes**: A list of codes that belong to that theme.
   - **Strictly follow this JSON structure**:
   
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

---

### **Example Input (QEC Table)**  
```json
{{
  "codes": [
    {{
      "quote": "I always get nervous before public speaking",
      "explanation": "The phrase describes feelings of anxiety before a social activity.",
      "code": "Social Anxiety"
    }},
    {{
      "quote": "I feel like I mess up every time",
      "explanation": "The phrase reflects self-doubt and perceived personal failure.",
      "code": "Self Doubt"
    }},
    {{
      "quote": "I hate when people judge me for my mistakes",
      "explanation": "This reflects the fear of negative social evaluation.",
      "code": "Fear of Judgment"
    }},
    {{
      "quote": "I need to improve my skills before I apply for the job",
      "explanation": "This indicates the pressure to meet external expectations.",
      "code": "Performance Pressure"
    }}
  ]
}}
```

---

### **Expected Output (Thematic Organization)**  
```json
{{
  "themes": [
    {{
      "theme": "Anxiety & Self-Perception",
      "codes": ["Social Anxiety", "Self Doubt", "Fear of Judgment"]
    }},
    {{
      "theme": "External Pressures",
      "codes": ["Performance Pressure"]
    }}
  ]
}}
```

---

### **Output Requirements**
- **Return only the JSON object.** No explanations, summaries, or extra text.
- **Ensure the JSON is valid and properly formatted.**
- **Group codes logically into themes—avoid forced connections.**
- **Each theme should have at least one code.**

Now, analyze the given QEC Table and generate themes based on the provided codes, returning the results in JSON format.
"""



class RefineCodebook:
    @staticmethod
    def refine_codebook_prompt(prev_codebook_json: str, current_codebook_json: str):
        return f"""
You are an advanced AI specializing in **qualitative research** and **thematic coding**. Your task is to **analyze and refine coding categories** by comparing the previous codebook with the current version.

---

### ** Input Data**
- **Previous Codebook** (before human revision):
  ```json
  {prev_codebook_json}
  ```
- **Current Codebook** (after human revision, including comments for feedback):
  ```json
  {current_codebook_json}
  ```

---

## ** Your Tasks**
1. **Extract Feedback from `currentCodebook.comments`.**
   - Identify changes made by the human coder.
   - Understand why each code was added, modified, or removed.
   - Use this feedback to guide refinements.

2. **Compare `prevCodebook` and `currentCodebook`.**
   - Identify codes that remained **unchanged**.
   - Identify codes that were **modified**.
   - Identify codes that were **added or removed**.
   - Skip this if previous codebook is not available or empty.

3. **List Disagreements in JSON Format.**
   - Specify which codes and quotes **you disagree with** from the human evaluation and comment and what needs revision.
   - If you disagree with the human's evaluation or comment, give your disagreements using **feedback from `currentCodebook.comments`** as human explanation and is marked false as human evaluation.

4. **Generate a Revised Codebook.**
   - Modify **existing codes** based on human feedback.
   - Add **new codes** where necessary.
   - Remove or refine **problematic codes** to improve clarity.
   - Each revised code should **include a quote and an explanation**.

---

## ** Output Format**
### **1 Disagreements and new revised codebook (JSON)**
```json
{{
  "disagreements": [
    {{
      "code": "Code Name",
      "explanation": "Why do you disagree with the human's suggestion if given (extracted from `currentCodebook.comments`) or evaluation (is marked false).",
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

---

## ** Important Guidelines**
- **Extract feedback directly from `currentCodebook.comments`** to guide refinements.
- **DO NOT** add explanations or comments outside the JSON output.
- **STRICTLY follow the JSON format.**
- **Ensure all revised codes align with human feedback.**
- **Each revised code must include a code name, a quote, and an explanation.**

Proceed with refining the codebook.
"""