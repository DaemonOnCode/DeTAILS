import asyncio
import json
from typing import Any, AsyncIterator, Callable, Dict, List, Optional, Tuple


def process_interview_turns(
    turns: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    return [
        {
            "id": t["id"],
            "speaker": t.get("speaker", ""),
            "text": t.get("text", ""),
            "turn_number": t.get("turn_number"),
            "timestamp": t.get("timestamp"),
        }
        for t in turns
    ]

async def _generate_whole_interview_async(
    turns: List[Dict[str, Any]]
) -> AsyncIterator[Dict[str, Any]]:
    transcript = {"turns": process_interview_turns(turns)}
    await asyncio.sleep(0)
    yield {"transcript": json.dumps(transcript)}

async def _generate_chunks_interview_async(
    turns: List[Dict[str, Any]],
    token_checker: Callable[[str], int],
    max_tokens: int
) -> AsyncIterator[Dict[str, Any]]:
    all_turns = process_interview_turns(turns)
    if not all_turns:
        await asyncio.sleep(0)
        yield {"transcript": json.dumps({"turns": []})}
        return

    chunk: List[Dict[str, Any]] = []
    def mk_json(c): return json.dumps({"turns": c})

    for turn in all_turns:
        trial = chunk + [turn]
        if token_checker(mk_json(trial)) <= max_tokens:
            chunk = trial
        else:
            await asyncio.sleep(0)
            yield {"transcript": mk_json(chunk)}
            chunk = [turn]

    if chunk:
        await asyncio.sleep(0)
        yield {"transcript": mk_json(chunk)}


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
) -> AsyncIterator[Dict[str, Any]]:
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
) -> AsyncIterator[Dict[str, Any]]:
    header = {"title": post["title"], "selftext": post["selftext"]}
    comment_list, comment_map = process_comments(post.get("comments", []))

    if not comment_list:
        await asyncio.sleep(0)
        yield {
            "transcript": json.dumps({**header, "comments": []}),
            "comment_map": comment_map
        }
        return

    chunk: List[Dict[str, Any]] = []
    def mk_json(c): return json.dumps({**header, "comments": c})

    for comment in comment_list:
        trial = chunk + [comment]
        if token_checker(mk_json(trial)) <= max_tokens:
            chunk = trial
        else:
            await asyncio.sleep(0)
            yield {
                "transcript": mk_json(chunk),
                "comment_map": comment_map
            }
            chunk = [comment]

    if chunk:
        await asyncio.sleep(0)
        yield {
            "transcript": mk_json(chunk),
            "comment_map": comment_map
        }

async def generate_transcript(
    record: Dict[str, Any],
    token_checker: Optional[Callable[[str], int]] = None,
    max_tokens: int = 1_000_000
) -> AsyncIterator[Dict[str, Any]]:
    if "comments" in record:
        if token_checker is None:
            async for itm in _generate_whole_transcript_async(record):
                await asyncio.sleep(0)
                yield itm
        else:
            async for itm in _generate_chunks_async(record, token_checker, max_tokens):
                await asyncio.sleep(0)
                yield itm
    elif "turns" in record:
        turns = record["turns"]
        if token_checker is None:
            async for itm in _generate_whole_interview_async(turns):
                await asyncio.sleep(0)
                yield itm
        else:
            async for itm in _generate_chunks_interview_async(turns, token_checker, max_tokens):
                await asyncio.sleep(0)
                yield itm
    else:
        raise ValueError("Record must include either 'comments' or 'turns'")


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
