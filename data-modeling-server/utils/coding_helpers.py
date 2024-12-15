def generate_transcript(post):
    # Start with the post title and selftext
    transcript = f"Title: {post['title']}\n\n{post['selftext']}\n\n"

    print('post', post)

    # Helper function to recursively process comments
    def process_comments(comments, depth=0):
        result = ""
        print('comments', comments, type(comments))

        if not comments:
            return ""

        for comment in comments:
            indent = "  " * depth  # Indentation for nested comments
            result += f"{indent}- {comment['body']}\n"
            if 'comments' in comment and comment['comments']:
                result += process_comments(comment['comments'], depth + 1)
        return result

    # If there are comments, process them
    if 'comments' in post and post['comments']:
        transcript += "Comments:\n"
        transcript += process_comments(post['comments'])

    return transcript.strip()


def generate_context(references, main_code, selected_flashcards, selected_words):
    context = ""

    # Add the main code
    context += f"Main Code:\n{main_code}\n\n"

    # Add selected words
    if selected_words:
        context += f"Selected Words:\n- " + "\n- ".join(selected_words) + "\n\n"

    # Add selected flashcards
    if selected_flashcards:
        context += "Flashcards:\n"
        for flashcard in selected_flashcards:
            context += f"Q: {flashcard['question']}\nA: {flashcard['answer']}\n\n"

    # Add references
    if references:
        context += "References:\n"
        print('references', references)
        for code, ref_list in references.items():
            context += f"Code: {code}\n"
            print('refList', ref_list, len(ref_list), type(ref_list))
            for ref in ref_list:
                context += f"- {ref['text']}\n"
            context += "\n"

    return context.strip()

def generate_context_with_codebook(references, main_code, codebook):
    context = ""

    # Add the main code
    context += f"Main Code:\n{main_code}\n\n"

    # Add codebook
    if codebook:
        context += "Codebook:\n"
        for code_data in codebook:
            context += f'Word: {code_data["word"]}\n'
            context += f'Description: {code_data["description"]}\n'
            context += f'Inclusion criteria: {", ".join(code_data["inclusion_criteria"])}\n\n'
            context += f'Exclusion criteria: {", ".join(code_data["exclusion_criteria"])}\n\n'

    # Add references
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
