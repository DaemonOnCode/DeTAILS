import config
from errors.credential_errors import MissingCredentialError
from models import Comment


def get_credential_path(settings: config.CustomSettings):
    if not settings.ai.googleCredentialsPath:
        return MissingCredentialError("Google credentials path not set.")
    return settings.ai.googleCredentialsPath

def normalize_text(text: str) -> str:
    return ' '.join(text.lower().split()) if text else ""

def search_slice(comment: Comment, normalized_comment_slice: str) -> str | None:
        # Recursively search for the text slice in comments
        if not normalized_comment_slice:
            return None

        normalized_body = normalize_text(comment.get('body', ''))

        if normalized_comment_slice in normalized_body:
            print(f"Found in comment: {comment.get('body')}")
            return comment.get('id')

        for sub_comment in comment.get('comments', []):
            result = search_slice(sub_comment, normalized_comment_slice)
            if result:
                return result

        return None

def link_creator(id, type, postId, subreddit):
    if (type == 'post') :
        return f"https://www.reddit.com/r/{subreddit}/comments/{postId}/"
    elif (type == 'comment') :
        return f"https://www.reddit.com/r/{subreddit}/comments/{postId}/{id}/"
