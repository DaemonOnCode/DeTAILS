const codePrompts = {
    systemPrompt: `You are a senior qualitative researcher refining codes based on feedback and/or context.

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
`,

    generate: (
        transcript,
        context
    ) => `You are a highly skilled qualitative researcher specializing in thematic coding.

**Your task** is to generate codes from the provided transcript, following these guidelines:

### Output Format:

Provide the codes in **strict JSON format** adhering to the following structure:

{
    "codes": [
        {
            "code": "Code text here...",
            "evidence": "Relevant excerpt from the transcript..."
        }
        // Repeat this structure for all identified codes
    ]
}

### Requirements:

1. The JSON must be valid, properly formatted, and parseable.
2. Codes should accurately represent key themes in the transcript.
3. Each code must be accompanied by a relevant excerpt (evidence) from the transcript.
4. Consider the provided context to enhance the accuracy and relevance of the codes.
5. The provided context is just a sample and may not contain all relevant themes.

### Provided Transcript:

${transcript}

### Context:

${context}

### Guidelines:

- Use the context, including examples and user-selected words, as reference/sample to inform your coding.
- Ensure codes are concise, meaningful, and non-redundant.
- **Do not include any output other than the JSON object.**

**Return only the JSON object in the specified format.**
`,
    judgeValidate: (
        codes_json1,
        codes_json2,
        transcript,
        mainCode
    ) => `You are a senior qualitative researcher facilitating the integration of codes from two colleagues.

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

{
    "unified_codebook": [
        {
            "code": "Unified code text here...",
            "definition": "Definition of the code...",
            "examples": ["Example excerpt from the transcript..."]
        }
        // Repeat this structure for all codes in the codebook
    ],
    "recoded_transcript": [
        {
            "segment": "Segment of the transcript...",
            "code": "Assigned code from the unified codebook...",
            "reasoning": "Reasoning behind the coding decision..."
        }
        // Repeat this structure for all segments
    ]
}

### Requirements:

1. The JSON must be valid, properly formatted, and parseable.
2. The unified codebook should reflect a consensus between the two sets of codes, considering the reasoning provided by each researcher.
3. Recode the transcript segments based on the unified codebook.
4. Ensure that the codes and assigned segments accurately reflect the themes in the transcript and consider the provided main code.

### Codes and Reasoning from Researcher 1:

**Codes:**

${codes_json1}

### Codes and Reasoning from Researcher 2:

**Codes:**

${codes_json2}


### Provided Transcript:

${transcript}

### Main code:

${mainCode}

### Guidelines:

- Carefully consider the reasoning provided by both researchers to reach a consensus.
- Maintain objectivity and ensure that the unified codebook is comprehensive and coherent.
- Use the main code to inform your decisions.
- **Do not include any output other than the JSON object.**

**Return only the JSON object in the specified format.**
`,
    validate: (codes_json, transcript, mainCode) => `
You are a senior qualitative researcher reviewing codes generated by a colleague.

**Your task** is to validate the provided codes against the transcript and main code, adhering to the following guidelines:

### Output Format:

Provide the validated codes in **strict JSON format** adhering to the following structure:

{
    "validated_codes": [
        {
            "code": "Code text here...",
            "status": "Accepted" or "Rejected",
            "reason": "Reason for acceptance or rejection...",
            "suggestions": "Suggestions for improvement (if any)..."
        }
        // Include an entry for each code provided
    ]
}

### Requirements:

1. The JSON must be valid, properly formatted, and parseable.
2. For each code:
   - Indicate whether it is **"Accepted"** or **"Rejected"**.
   - Provide clear reasons for your decision.
   - Offer suggestions for improvement if rejected.
3. Ensure your validation is thorough, objective, and based on the transcript and context.

### Codes to Validate:

${JSON.stringify(codes_json, null, 2)}

### Provided Transcript:

${transcript}

### Context:

${context}

### Guidelines:

- Cross-reference each code with the transcript to assess accuracy.
- Utilize the context, including examples and flashcards, to inform your validation.
- **Do not include any output other than the JSON object.**

**Return only the JSON object in the specified format.**
`,
    generateWithFeedback: (transcript, context, feedback) => `
You are a highly skilled qualitative researcher specializing in thematic coding.

**Your task** is to generate codes from the provided transcript, considering the feedback on previous codes, and following these guidelines:

### Output Format:

Provide the updated codes in **strict JSON format** adhering to the following structure:

{
    "codes": [
        {
            "code": "Updated code text here...",
            "evidence": "Relevant excerpt from the transcript..."
        }
        // Repeat this structure for all updated codes
    ]
}

### Requirements:

1. The JSON must be valid, properly formatted, and parseable.
2. Revise the codes to address the feedback on the previous codes.
3. Ensure the updated codes accurately reflect the themes in the transcript.
4. Each code must be accompanied by a relevant excerpt (evidence) from the transcript.
5. Consider the provided context as a reference, not as ground truth to enhance the accuracy and relevance of the codes.

### User Feedback on Previous Codes:

${feedback}

### Provided Transcript:

${transcript}

### Context:

${context}

### Guidelines:

- Carefully consider each point in the user's feedback on the previous codes.
- Use the context, including examples and user-selected words, as a sample reference to inform your coding.
- Ensure codes are concise, meaningful, and non-redundant.
- **Do not include any output other than the JSON object.**

**Return only the JSON object in the specified format.**
`,
    judgeValidateWithFeedback: (codes_json1, codes_json2, transcript, mainCode, feedback) => `
You are a senior qualitative researcher facilitating the integration of codes from two colleagues.

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

{
    "unified_codebook": [
        {
            "code": "Unified code text here...",
            "definition": "Definition of the code...",
            "examples": ["Example excerpt from the transcript..."]
        }
        // Repeat this structure for all codes in the codebook
    ],
    "recoded_transcript": [
        {
            "segment": "Segment of the transcript...",
            "code": "Assigned code from the unified codebook...",
            "reasoning": "Reasoning behind the assignment..."
        }
        // Repeat this structure for all segments
    ]
}

### Requirements:

1. The JSON must be valid, properly formatted, and parseable.
2. The unified codebook should reflect a consensus between the two sets of codes, considering the feedback.
3. Recode the transcript segments based on the unified codebook.
4. Ensure that the codes and assigned segments accurately reflect the themes in the transcript and consider the provided main code and user feedback.

### Feedback on Previous Codes:

${feedback}

### Codes from Researcher 1:

${codes_json1}

### Codes from Researcher 2:

${codes_json2}

### Provided Transcript:

${transcript}

### Main code:

${mainCode}

### Guidelines:

- Carefully consider the reasoning provided by both researchers and the feedback to reach a consensus.
- Maintain objectivity and ensure that the unified codebook is comprehensive and coherent.
- Use the main code and feedback to inform your decisions.
- **Do not include any output other than the JSON object.**

**Return only the JSON object in the specified format.**
`
};
//     reValidateAfterFeedback: (feedback, current_codes_json, transcript, context) => `
// You are a senior qualitative researcher reviewing codes after feedback has been provided.

// **Your task** is to validate the codes considering the provided feedback, adhering to these guidelines:

// ### Output Format:

// Provide the validated codes in **strict JSON format** adhering to the following structure:

// {
//     "validated_codes": [
//         {
//             "code": "Code text here...",
//             "status": "Accepted" or "Rejected",
//             "reason": "Reason for acceptance or rejection...",
//             "suggestions": "Suggestions for improvement (if any)..."
//         }
//         // Repeat this structure for all codes
//     ]
// }

// ### Requirements:

// 1. The JSON must be valid, properly formatted, and parseable.
// 2. Address the feedback in your validation.
// 3. Ensure the validated codes accurately reflect the themes in the transcript.

// ### Feedback:

// ${feedback}

// ### Current Codes:

// ${JSON.stringify(current_codes_json, null, 2)}

// ### Provided Transcript:

// ${transcript}

// ### Context:

// ${context}

// ### Guidelines:

// - Carefully consider each point in the feedback during validation.
// - Maintain consistency with the context and transcript.
// - **Do not include any output other than the JSON object.**

// **Return only the JSON object in the specified format.**
// `
// };
//     regenerateAfterFeedback: (feedback, current_codes_json, transcript, context) => `
// You are a qualitative researcher refining your codes based on feedback.

// **Your task** is to update the codes considering the provided feedback, adhering to these guidelines:

// ### Output Format:

// Provide the updated codes in **strict JSON format** adhering to the following structure:

// {
//     "codes": [
//         {
//             "code": "Updated code text here...",
//             "evidence": "Relevant excerpt from the transcript..."
//         }
//         // Repeat this structure for all updated codes
//     ]
// }

// ### Requirements:

// 1. The JSON must be valid, properly formatted, and parseable.
// 2. Revise the codes to address the feedback.
// 3. Ensure the updated codes accurately reflect the themes in the transcript.

// ### Feedback:

// ${feedback}

// ### Current Codes:

// ${JSON.stringify(current_codes_json, null, 2)}

// ### Provided Transcript:

// ${transcript}

// ### Context:

// ${context}

// ### Guidelines:

// - Carefully consider each point in the feedback.
// - Maintain consistency with the context and transcript.
// - **Do not include any output other than the JSON object.**

// **Return only the JSON object in the specified format.**
// `,

//     regenerateAfterValidation: (feedback, transcript, context) => `
// You are a qualitative researcher regenerating codes based on feedback from a fellow researcher.

// **Your task** is to regenerate the codes considering the provided feedback, adhering to these guidelines:

// ### Output Format:

// Provide the regenerated codes in **strict JSON format** adhering to the following structure:

// {
//     "codes": [
//         {
//             "code": "Regenerated code text here...",
//             "evidence": "Relevant excerpt from the transcript..."
//         }
//         // Repeat this structure for all regenerated codes
//     ]
// }

// ### Requirements:

// 1. The JSON must be valid, properly formatted, and parseable.
// 2. Address the feedback in your regenerated codes.
// 3. Ensure the regenerated codes accurately reflect the themes in the transcript.

// ### Feedback:

// ${feedback}

// ### Provided Transcript:

// ${transcript}

// ### Context:

// ${context}

// ### Guidelines:

// - Carefully consider the feedback provided.
// - Use the context to inform your coding.
// - **Do not include any output other than the JSON object.**

// **Return only the JSON object in the specified format.**
// `,

//     reValidateAfterValidation: (codes_json, transcript, context) => `
// You are a senior qualitative researcher reviewing codes generated by a colleague.

// **Your task** is to validate the provided codes, adhering to the following guidelines:

// ### Output Format:

// Provide the validation in **strict JSON format** adhering to the following structure:

// {
//     "validated_codes": [
//         {
//             "code": "Code text here...",
//             "status": "Accepted" or "Rejected",
//             "reason": "Reason for acceptance or rejection...",
//             "suggestions": "Suggestions for improvement (if any)..."
//         }
//         // Repeat this structure for all codes
//     ]
// }

// ### Requirements:

// 1. The JSON must be valid, properly formatted, and parseable.
// 2. Provide clear and objective validation of each code.
// 3. Ensure the validated codes accurately reflect the themes in the transcript.

// ### Codes to Validate:

// ${JSON.stringify(codes_json, null, 2)}

// ### Provided Transcript:

// ${transcript}

// ### Context:

// ${context}

// ### Guidelines:

// - Cross-reference each code with the transcript.
// - Use the context to inform your validation.
// - **Do not include any output other than the JSON object.**

// **Return only the JSON object in the specified format.**
// `
// };

module.exports = {
    codePrompts
};

// const generateCodesPrompt = (transcript, context) => `
// You are a qualitative researcher. Based on the following transcript, generate codes that represent the key themes:

// Transcript:
// ${transcript}

// Context:
// ${context}

// Provide the codes in JSON format.
// `;

// const validateCodesPrompt = (codes, transcript, context) => `
// You are a senior qualitative researcher reviewing codes generated by a colleague.

// Codes to validate:
// ${JSON.stringify(codes, null, 2)}

// Transcript:
// ${transcript}

// Context:
// ${context}

// Validate the codes, provide reasons for acceptance or rejection, and return the validated codes in JSON format.
// `;

// const context = `
// Examples of human-coded data:
// - Example 1: ...
// - Example 2: ...

// Flashcards:
// Q: What is thematic coding?
// A: ...

// User-selected similar words:
// - Word1
// - Word2
// `;

// const regenerateCodesPrompt = (codes, feedback, transcript, context) => {
//     return `
// Based on the following feedback, update the codes:

// Feedback:
// ${feedback}

// Current Codes:
// ${JSON.stringify(codes, null, 2)}

// Transcript:
// ${transcript}

// Context:
// ${context}

// Return the updated codes in JSON format.
// `;
// };

// const updatedGenerateCodesPrompt = (transcript, context, feedback) => `
// You are a qualitative researcher. Based on the transcript, generate codes.

// Please address the following feedback from a peer reviewer:
// ${feedback}

// Transcript:
// ${transcript}

// Context:
// ${context}

// Provide the updated codes in JSON format.
// `;

// const codePrompts = {
//     systemPrompt: `You are a senior qualitative researcher refining your codes based on feedback or other contexts.

// **Your task** is to give codes considering the provided feedback and other contexts, adhering to these guidelines:

// ### Output Format:

// Provide the updated codes in **strict JSON format** adhering to the following structure:

// {{
//     "codes": [
//         {{
//             "code": "Updated code text here...",
//             "evidence": "Relevant excerpt from the transcript..."
//         }}
//         // Repeat this structure for all updated codes
//     ]
// }}

// ### Requirements:

// 1. The JSON must be valid, properly formatted, and parseable.
// 2. Revise the codes to address the feedback.
// 3. Ensure the updated codes accurately reflect the themes in the transcript.

// ### Guidelines:

// - Carefully consider each point in the feedback.
// - Maintain consistency with the context and transcript.
// - Do not include any output other than the JSON object.

// **Return only the JSON object in the specified format.**
// `,
//     generate: ``,
//     validate: ``,
//     reValidateAfterFeedback: (feedback, current_codes_json, transcript, context) => `
// **Your task** is to validate the codes considering the provided feedback, adhering to these guidelines:

// ### Output Format:

// Provide the validated codes in **strict JSON format** adhering to the following structure:

// {
//     feedback: [
//         {
//             "code": "Code text here...",
//             "evidence": "Relevant excerpt from the transcript...",
//             "result": "accept" or "reject",
//             "reasoning": "Relevant reasoning..."
//         }
//         // Repeat this structure for all codes
//     ]
// }

// ### Requirements:

// 1. The JSON must be valid, properly formatted, and parseable.
// 2. Revise the codes to address the feedback.
// 3. Ensure the updated codes accurately reflect the themes in the transcript.

// ### Feedback:

// ${feedback}

// ### Current Codes:

// ${current_codes_json}

// ### Provided Transcript:

// ${transcript}

// ### Context:

// ${context}

// ### Guidelines:

// - Carefully consider each point in the feedback.
// - Maintain consistency with the context and transcript.
// - Do not include any output other than the JSON object.

// **Return only the JSON object in the specified format.**
// `,
//     regenerateAfterFeedback: (feedback, current_codes_json, transcript, context) => `
// **Your task** is to update the codes considering the provided feedback, adhering to these guidelines:

// ### Output Format:

// Provide the updated codes in **strict JSON format** adhering to the following structure:

// {
//     "codes": [
//         {
//             "code": "Updated code text here...",
//             "evidence": "Relevant excerpt from the transcript..."
//         }
//         // Repeat this structure for all updated codes
//     ]
// }

// ### Requirements:

// 1. The JSON must be valid, properly formatted, and parseable.
// 2. Revise the codes to address the feedback.
// 3. Ensure the updated codes accurately reflect the themes in the transcript.

// ### Feedback:

// ${feedback}

// ### Current Codes:

// ${current_codes_json}

// ### Provided Transcript:

// ${transcript}

// ### Context:

// ${context}

// ### Guidelines:

// - Carefully consider each point in the feedback.
// - Maintain consistency with the context and transcript.
// - Do not include any output other than the JSON object.

// **Return only the JSON object in the specified format.**
// `,
//     regenerateAfterValidation: (
//         feedback,
//         transcript,
//         context
//     ) => `You are a qualitative researcher regenerating codes on a given transcript, after receiving feedback from a fellow researcher.

// ### Feedback:
// ${feedback}

// Transcript:
// ${transcript}

// Context:
// ${context}

// Validate the feedback and regenerate the codes, and return the regenerated codes in JSON format.`,
//     reValidateAfterValidation: (codes, transcript, context) =>
//         `You are a senior qualitative researcher reviewing codes generated by a colleague.

// ### Output Format:

// Provide the feedback in **strict JSON format** adhering to the following structure:

// {
//     feedback: [
//         {
//             "code": "Code text here...",
//             "evidence": "Relevant excerpt from the transcript...",
//             "result": "accept" or "reject",
//             "reasoning": "Relevant reasoning..."
//         }
//         // Repeat this structure for all codes
//     ]
// }

// Codes to validate:
// ${JSON.stringify(codes, null, 2)}

// Transcript:
// ${transcript}

// Context:
// ${context}

// Validate the codes, provide reasons for acceptance or rejection, and return the validated codes in JSON format.`
// };
