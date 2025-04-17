def generate_transcript(post):
    transcript = f"Title: {post['title']}\n\n{post['selftext']}\n\n"

    def process_comments(comments, prefix=""):
        result = ""
        if not comments:
            return ""
        for i, comment in enumerate(comments, start=1):
            current_number = prefix + str(i)
            label = "comment " + current_number + ": "
            result += label + comment['body'] + "\n"
            if 'comments' in comment and comment['comments']:
                result += process_comments(comment['comments'], prefix=current_number + ".")
        return result

    if 'comments' in post and post['comments']:
        transcript += "Comments:\n"
        transcript += process_comments(post['comments'])

    return transcript.strip()

def generate_context_with_codebook(references, main_code, codebook):
    context = ""
    context += f"Main Code:\n{main_code}\n\n"
    if codebook:
        context += "Codebook:\n"
        for code_data in codebook:
            context += f'Word: {code_data["word"]}\n'
            context += f'Description: {code_data["description"]}\n'
            context += f'Inclusion criteria: {", ".join(code_data["inclusion_criteria"])}\n\n'
            context += f'Exclusion criteria: {", ".join(code_data["exclusion_criteria"])}\n\n'
    if references:
        context += "References:\n"
        for code, ref_list in references.items():
            context += f"Code: {code}\n"
            for ref in ref_list:
                context += f"- {ref['text']}\n"
            context += "\n"

    return context.strip()



def generate_feedback(feedback):
    result = ""
    for f in feedback:
        result += f"Feedback: The following code was {'correct' if f['isMarked'] else 'wrong'} - for \"{f['sentence']}\"\n"
        if 'comment' in f and f['comment']:
            result += f"Comment: {f['comment']}\n"
    return result
