import asyncio
import time
from typing import Callable, Optional


def process_comments(comments, prefix=""):
    result = []
    for i, comment in enumerate(comments, start=1):
        current_number = prefix + str(i)
        label = "comment " + current_number + ": "
        result.append(label + comment['body'])
        if 'comments' in comment and comment['comments']:
            result.extend(
                process_comments(comment['comments'],
                                 prefix=current_number + ".")
            )
    return result

async def _generate_whole_transcript_async(post):
    header = f"Title: {post['title']}\n\n{post['selftext']}\n\n"
    comment_strings = process_comments(post.get('comments', []))
    await asyncio.sleep(0)
    if comment_strings:
        yield header + "Comments:\n" + "\n".join(comment_strings) + "\n"
    else:
        yield header.strip()

async def _generate_chunks_async(post, token_checker, max_tokens):
    header = f"Title: {post['title']}\n\n{post['selftext']}\n\n"
    comment_strings = process_comments(post.get('comments', []))
    current_comments = []

    for comment_str in comment_strings:
        temp = current_comments + [comment_str]
        chunk = header + "Comments:\n" + "\n".join(temp) + "\n"

        start_time = time.time()
        if token_checker(chunk) <= max_tokens:
            await asyncio.sleep(0)
            current_comments = temp
        else:
            await asyncio.sleep(0)
            yield header + "Comments:\n" + "\n".join(current_comments) + "\n"
            current_comments = [comment_str]
        print(f"Chunk generation took {time.time() - start_time:.2f} seconds")

    if current_comments:
        await asyncio.sleep(0)
        yield header + "Comments:\n" + "\n".join(current_comments) + "\n"
    elif not comment_strings:
        await asyncio.sleep(0)
        yield header

async def generate_transcript(
    post,
    token_checker: Optional[Callable[[str], int]] = None,
    max_tokens: int = 1_000_000
):
    if token_checker is None:
        async for chunk in _generate_whole_transcript_async(post):
            await asyncio.sleep(0)
            yield chunk
    else:
        async for chunk in _generate_chunks_async(post, token_checker, max_tokens):
            await asyncio.sleep(0)
            yield chunk

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
