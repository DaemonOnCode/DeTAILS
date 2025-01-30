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

