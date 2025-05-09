import asyncio
import time
from typing import Any, Callable, Dict, List, Optional, Tuple


def process_comments(
    comments: List[Dict[str, Any]],
    prefix: str = ""
) -> Tuple[List[str], Dict[str, str]]:
    lines: List[str] = []
    label_map: Dict[str, str] = {}

    for i, comment in enumerate(comments, start=1):
        current = prefix + str(i)
        label = f"comment {current}"
        label_map[label] = comment["id"]
        lines.append(f"{label}: {comment['body']}")
        if comment.get("comments"):
            child_lines, child_map = process_comments(
                comment["comments"],
                prefix=current + "."
            )
            lines.extend(child_lines)
            label_map.update(child_map)

    return lines, label_map

async def _generate_whole_transcript_async(
    post: Dict[str, Any]
) -> Any:
    header = f"Title: {post['title']}\n\n{post['selftext']}\n\n"
    comment_strings, comment_map = process_comments(post.get("comments", []))
    await asyncio.sleep(0)

    if comment_strings:
        transcript = header + "Comments:\n" + "\n".join(comment_strings) + "\n"
    else:
        transcript = header.strip()

    yield {
        "transcript": transcript,
        "comment_map": comment_map
    }

async def _generate_chunks_async(
    post: Dict[str, Any],
    token_checker: Callable[[str], int],
    max_tokens: int
) -> Any:
    header = f"Title: {post['title']}\n\n{post['selftext']}\n\n"
    comment_strings, comment_map = process_comments(post.get("comments", []))
    current_comments: List[str] = []

    for comment_str in comment_strings:
        temp = current_comments + [comment_str]
        chunk_text = header + "Comments:\n" + "\n".join(temp) + "\n"
        start_time = time.time()

        if token_checker(chunk_text) <= max_tokens:
            await asyncio.sleep(0)
            current_comments = temp
        else:
            await asyncio.sleep(0)
            yield {
                "transcript": header + "Comments:\n" + "\n".join(current_comments) + "\n",
                "comment_map": comment_map
            }
            current_comments = [comment_str]

        print(f"Chunk generation took {time.time() - start_time:.2f} seconds")

    if current_comments:
        await asyncio.sleep(0)
        yield {
            "transcript": header + "Comments:\n" + "\n".join(current_comments) + "\n",
            "comment_map": comment_map
        }
    elif not comment_strings:
        await asyncio.sleep(0)
        yield {
            "transcript": header.strip(),
            "comment_map": comment_map
        }

async def generate_transcript(
    post: Dict[str, Any],
    token_checker: Optional[Callable[[str], int]] = None,
    max_tokens: int = 1_000_000
):
    if token_checker is None:
        async for item in _generate_whole_transcript_async(post):
            await asyncio.sleep(0)
            yield item
    else:
        async for item in _generate_chunks_async(post, token_checker, max_tokens):
            await asyncio.sleep(0)
            yield item

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
