import asyncio
import json
from typing import Any, Callable, Dict, List, Optional, Tuple


def process_comments(
    comments: List[Dict[str, Any]],
    prefix: str = ""
) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    comment_list: List[Dict[str, Any]] = []
    label_map: Dict[str, str] = {}

    for i, comment in enumerate(comments, start=1):
        current = prefix + str(i)
        label = f"comment {current}"
        label_map[label] = comment["id"]
        comment_dict = {
            "id": comment["id"],
            "body": comment["body"]
        }
        if comment.get("comments"):
            child_comments, child_map = process_comments(
                comment["comments"],
                prefix=current + "."
            )
            comment_dict["comments"] = child_comments
            label_map.update(child_map)
        else:
            comment_dict["comments"] = []
        comment_list.append(comment_dict)

    return comment_list, label_map

async def _generate_whole_transcript_async(
    post: Dict[str, Any]
) -> Any:
    comment_list, comment_map = process_comments(post.get("comments", []))
    transcript_dict = {
        "title": post["title"],
        "body": post["selftext"],
        "comments": comment_list
    }
    transcript_json = json.dumps(transcript_dict)
    await asyncio.sleep(0)
    yield {
        "transcript": transcript_json,
        "comment_map": comment_map
    }

async def _generate_chunks_async(
    post: Dict[str, Any],
    token_checker: Callable[[str], int],
    max_tokens: int
) -> Any:
    header = {
        "title": post["title"],
        "selftext": post["selftext"]
    }
    comment_list, comment_map = process_comments(post.get("comments", []))
    
    if not comment_list:
        transcript_dict = {**header, "comments": []}
        transcript_json = json.dumps(transcript_dict)
        yield {
            "transcript": transcript_json,
            "comment_map": comment_map
        }
    else:
        current_comments: List[Dict[str, Any]] = []
        for comment in comment_list:
            temp = current_comments + [comment]
            chunk_dict = {**header, "comments": temp}
            chunk_json = json.dumps(chunk_dict)
            if token_checker(chunk_json) <= max_tokens:
                current_comments = temp
            else:
                if current_comments:
                    yield {
                        "transcript": json.dumps({**header, "comments": current_comments}),
                        "comment_map": comment_map
                    }
                current_comments = [comment]
        if current_comments:
            yield {
                "transcript": json.dumps({**header, "comments": current_comments}),
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
