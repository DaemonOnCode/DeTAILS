from fastapi import APIRouter, HTTPException, File, UploadFile, Form, Body
from typing import List
from uuid import uuid4
from pydantic import BaseModel
from controllers.collection_controller import create_dataset, delete_dataset, get_reddit_post_by_id, get_reddit_post_titles, get_reddit_posts_by_batch, list_datasets, parse_reddit_files, stream_upload_file, upload_dataset_file
from decorators.execution_time_logger import log_execution_time
from models.collection_models import ParseDatasetRequest, ParseRedditPostByIdRequest, ParseRedditPostsRequest


router = APIRouter()


@router.post("/datasets")
@log_execution_time()
async def upload_dataset(file: UploadFile = File(...), description: str = Form(None), dataset_id: str = Form(None), workspace_id: str = Form(...)):
    """Upload a dataset file and save metadata."""
    if not dataset_id:
        dataset_id = create_dataset(description, dataset_id, workspace_id)
    file_path = await upload_dataset_file(file, dataset_id)
    return {"message": f"File uploaded successfully", "dataset_id": dataset_id, "file_path": file_path}

@router.get("/datasets")
@log_execution_time()
async def get_datasets():
    """List all datasets."""
    return list_datasets()

@router.delete("/datasets/{dataset_id}")
@log_execution_time()
async def remove_dataset(dataset_id: str):
    """Delete a dataset."""
    return delete_dataset(dataset_id)


@router.post("/parse-reddit-dataset")
@log_execution_time()
async def parse_reddit_dataset(request: ParseDatasetRequest = Body(...)):
    """Parse a Reddit dataset from uploaded JSON files."""
    dataset_id = request.dataset_id
    return parse_reddit_files(dataset_id)


@router.post("/reddit-posts-by-batch")
@log_execution_time()
async def get_reddit_posts(request: ParseRedditPostsRequest = Body(...)):
    """Fetch Reddit posts from a dataset with pagination."""
    dataset_id = request.dataset_id
    batch = request.batch
    offset = request.offset
    all = request.all
    posts = get_reddit_posts_by_batch(dataset_id, batch, offset, all)
    return {post["id"]: post for post in posts}

@router.post("/reddit-posts-titles")
@log_execution_time()
async def get_reddit_titles(request: ParseRedditPostsRequest = Body(...)):
    """Get Reddit post titles for a dataset."""
    dataset_id = request.dataset_id
    return get_reddit_post_titles(dataset_id)

@router.post("/reddit-post-by-id")
@log_execution_time()
async def get_reddit_post(request: ParseRedditPostByIdRequest = Body(...)):
    """Fetch a Reddit post along with its comments."""
    dataset_id = request.datasetId
    post_id = request.postId
    return get_reddit_post_by_id(dataset_id, post_id)


@router.post("/stream-upload")
@log_execution_time()
async def stream_upload(file: UploadFile = File(...)):
    """Stream upload a file in chunks."""
    return await stream_upload_file(file)

# # Helper Functions
# def run_query(query: str, params: tuple = ()) -> list:
#     """
#     Run a SQLite query and return the result.
#     """
#     with sqlite3.connect(DATABASE_PATH) as conn:
#         cursor = conn.cursor()
#         cursor.execute(query, params)
#         conn.commit()
#         return cursor.fetchall()
    
# def run_query_with_columns(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
#     """
#     Run a SQLite query and return the result as a list of dictionaries with column names as keys.
#     """
#     with sqlite3.connect(DATABASE_PATH) as conn:
#         conn.row_factory = sqlite3.Row  # Set row factory to get column names
#         cursor = conn.cursor()
#         cursor.execute(query, params)
#         result = cursor.fetchall()
#         # Convert each row to a dictionary
#         return [dict(row) for row in result]

# def insert_dataset(dataset_id: str, name: str, description: str):
#     try:
#         with sqlite3.connect(DATABASE_PATH) as conn:
#             cursor = conn.cursor()
#             cursor.execute("""
#                 INSERT INTO datasets (id, name, description)
#                 VALUES (?, ?, ?)
#             """, (dataset_id, name, description))
#             conn.commit()
#     except sqlite3.Error as e:
#         raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
# def update_dataset(dataset_id: str, name: str = "", description: str = ""):
#     try:
#         with sqlite3.connect(DATABASE_PATH) as conn:
#             cursor = conn.cursor()
#             cursor.execute("""
#                 UPDATE datasets SET name = ?, description = ?
#                 WHERE id = ?
#             """, (name, description, dataset_id))
#             conn.commit()
#     except sqlite3.Error as e:
#         raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# def save_temp_file(file: UploadFile, prefix: str) -> str:
#     """
#     Save an uploaded file temporarily and return the file path.
#     """
#     file_path = os.path.join(UPLOAD_DIR, f"{prefix}_{uuid4().hex}.json")
#     with open(file_path, "wb") as f:
#         f.write(file.file.read())
#     return file_path

# def omit_first_if_matches_structure(data: list) -> list:
#     """
#     Omit the first element in a list if it doesn't match the expected structure.
#     """
#     if data and isinstance(data[0], dict) and "id" not in data[0]:
#         return data[1:]
#     return data

# def parse_submissions_and_comments(files: List[Dict[str,str]], dataset_id: str):
#     """
#     Parse submissions and comments from provided files and build a hierarchical structure.
#     """
#     posts = {}
#     comments = {}

#     subreddit = ""

#     for file in files:
#         file_type = file.get("type")
#         file_path = file.get("path")
#         with open(file_path, "r") as f:
#             raw_data = json.load(f)
        
#         filtered_data = omit_first_if_matches_structure(raw_data)

#         parsed_data = []
#         if file_type == "submissions":
#             for post in filtered_data:
#                 post_id = post.get("id")
#                 if  subreddit !="" and "subreddit" in post:
#                     subreddit = post.get("subreddit")
#                 if post_id:
#                     posts[post_id] = {**post, "comments": {}}
#                 parsed_data.append((
#                     post.get("id"),
#                     post.get("over_18", 0),
#                     post.get("subreddit", ""),
#                     post.get("score", 0),
#                     post.get("thumbnail", ""),
#                     post.get("permalink", ""),
#                     post.get("is_self", 0),
#                     post.get("domain", ""),
#                     post.get("created_utc", 0),
#                     post.get("url", ""),
#                     post.get("num_comments", 0),
#                     post.get("title", ""),
#                     post.get("selftext", ""),
#                     post.get("author", ""),
#                     post.get("hide_score", 0),
#                     post.get("subreddit_id", ""),
#                     dataset_id
#                 ))
#             batch_insert_posts(parsed_data)
#         elif file_type == "comments":
#             for comment in filtered_data:
#                 if subreddit !="" and "subreddit" in comment:
#                     subreddit = comment.get("subreddit")
#                 comment_id = comment.get("id")
#                 parent_id = comment.get("parent_id", "").split("_")[1] if "parent_id" in comment else None
#                 post_id = comment.get("link_id", "").split("_")[1] if "link_id" in comment else None

#                 if comment_id and post_id:
#                     comments[comment_id] = {
#                         **comment,
#                         "parent_id": parent_id,
#                         "link_id": post_id,
#                         "comments": {},
#                         "dataset_id": dataset_id
#                     }
                
#                 parsed_data.append((
#                     comment.get("id"),
#                     comment.get("body", ""),
#                     comment.get("author", ""),
#                     comment.get("created_utc", 0),
#                     comment.get("link_id", "").split("_")[1] if "link_id" in comment else None,
#                     comment.get("parent_id", "").split("_")[1] if "parent_id" in comment else None,
#                     comment.get("controversiality", 0),
#                     comment.get("score_hidden", 0),
#                     comment.get("score", 0),
#                     comment.get("subreddit_id", ""),
#                     comment.get("retrieved_on", 0),
#                     comment.get("gilded", 0),
#                     dataset_id
#                 ))
#             batch_insert_comments(parsed_data)
            
#     update_dataset(dataset_id, name=subreddit)
#     return {"messages": "Data parsed and inserted successfully"}


# async def parse_json_file(file_path: str):
#     """
#     Parse a JSON file and process its data.
#     """
#     try:
#         async with async_open(file_path, "r") as f:
#             data = json.loads(await f.read())

#         # Example of processing: extracting "id" and "title" fields if present
#         parsed_data = []
#         for item in data:
#             if isinstance(item, dict):
#                 parsed_data.append({
#                     "id": item.get("id"),
#                     "title": item.get("title"),
#                 })

#         return {"file": file_path, "parsed_data": parsed_data}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error parsing file {file_path}: {str(e)}")


# # Routes
# # @router.post("/datasets")
# # async def add_dataset(
# #     name: str = Form(...), description: str = Form(...), files: UploadFile = File(...)
# # ): 
# #     """
# #     Add a new dataset and save its metadata in the database.
# #     """
# #     try:
# #         file_paths = []
# #         parsed_results = []
# #         for file in files:
# #             file_path = os.path.join(DATASETS_DIR, name, file.filename)
# #             os.makedirs(DATASETS_DIR, exist_ok=True)

# #             # Save the uploaded file
# #             with open(file_path, "wb") as f:
# #                 f.write(await file.read())

# #             parsed_data = await parse_json_file(file_path)
# #             parsed_results.append(parsed_data)

# #         # Store metadata in the database
# #         run_query(
# #             """
# #             INSERT INTO datasets (name, description, file_path)
# #             VALUES (?, ?, ?)
# #             """,
# #             (name, description, ";".join(file_paths)),
# #         )
# #         return {
# #             "message": "Files uploaded and parsed successfully!",
# #             "file_paths": file_paths,
# #             "parsed_results": parsed_results,
# #         }
# #     except Exception as e:
# #         raise HTTPException(status_code=500, detail=str(e))

# @router.post("/datasets")
# @log_execution_time()
# async def upload_dataset(
#     file: UploadFile = File(...),
#     description: str = Form(None),
#     dataset_id: str = Form(None),
# ):
#     """
#     Endpoint to upload a dataset file and its metadata.
#     """
#     try:
#         if not dataset_id:
#             dataset_id = str(uuid4())
#             insert_dataset(dataset_id, "", description)
#         print(dataset_id)
#         if not file.filename.endswith(".json"):
#             raise HTTPException(status_code=400, detail="Only JSON files are allowed.")
#         file_location = f"./datasets/{dataset_id}/{file.filename}"
#         os.makedirs(os.path.dirname(file_location), exist_ok=True)

#         with open(file_location, "wb") as f:
#             f.write(await file.read())

#         return {"message": f"File {file.filename} uploaded successfully", "dataset_id": dataset_id}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# class ParseDatasetRequest(BaseModel):
#     dataset_id: str


# class ParseRedditPostsRequest(BaseModel):
#     dataset_id: str
#     batch: int = 10
#     offset: int = 0
#     all: bool = True

# @router.post("/parse-reddit-dataset")
# @log_execution_time()
# async def parse_reddit_dataset(
#     request: ParseDatasetRequest = Body(...)
# ):
#     """
#     Parse a Reddit dataset and return the structured data.
#     """

#     dataset_id = request.dataset_id
#     # try:
#     posts_path = list(filter(lambda x: x.endswith(".json") and x.startswith("RS"), os.listdir(f"datasets/{dataset_id}")))
#     comments_path = list(filter(lambda x: x.endswith(".json") and x.startswith("RC"), os.listdir(f"datasets/{dataset_id}")))

#     all_files = []
#     for file in posts_path:
#         all_files.append({"type": "submissions", "path": f"datasets/{dataset_id}/{file}"})
#     for file in comments_path:
#         all_files.append({"type": "comments", "path": f"datasets/{dataset_id}/{file}"})
    
#     parse_submissions_and_comments(all_files, dataset_id)

#     return {"message": "Reddit dataset parsed successfully"}
#     # except Exception as e:
#     #     print(e)
#     #     raise HTTPException(status_code=500, detail=str(e))

# @router.post("/process-reddit-json")
# @log_execution_time()
# async def process_reddit_json(
#     posts: UploadFile = File(...), comments: UploadFile = File(...)
# ):
#     try:
#         # Save files locally
#         posts_path = os.path.join(UPLOAD_DIR, f"{uuid4().hex}_posts.json")
#         comments_path = os.path.join(UPLOAD_DIR, f"{uuid4().hex}_comments.json")

#         async with open(posts_path, "wb") as f:
#             content = await posts.read()
#             await f.write(content)

#         async with open(comments_path, "wb") as f:
#             content = await comments.read()
#             await f.write(content)

#         # # Call Node.js script to process and insert data
#         # result = run(
#         #     ["node", "scripts/process_json.js", posts_path, comments_path],
#         #     capture_output=True,
#         #     text=True,
#         # )
#         # if result.returncode != 0:
#         #     raise HTTPException(
#         #         status_code=500,
#         #         detail=f"Error processing files: {result.stderr}",
#         #     )

#         return {"message": "Files processed and inserted successfully!"}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error processing JSON: {str(e)}")



# @router.post("/datasets/multiple/streaming")
# @log_execution_time()
# async def add_multiple_files_streaming(
#     name: str = Form(...),
#     description: str = Form(...),
#     files: List[UploadFile] = File(...),
# ):
#     """
#     Handle multiple file uploads as streams and save metadata in the database.
#     """
#     try:
#         file_paths = []
#         for file in files:
#             # Generate a unique filename
#             unique_filename = f"{uuid4().hex}_{file.filename}"
#             file_path = os.path.join(DATASETS_DIR, unique_filename)
#             file_paths.append(file_path)

#             # Save the file as a stream
#             async with async_open(file_path, "wb") as f:
#                 async for chunk in file.stream(1024 * 1024):  # Read in chunks of 1MB
#                     await f.write(chunk)

#         # Store metadata in the database
#         run_query(
#             """
#             INSERT INTO datasets (name, description, file_path)
#             VALUES (?, ?, ?)
#             """,
#             (name, description, ";".join(file_paths)),
#         )

#         return {
#             "message": "Files uploaded successfully!",
#             "file_paths": file_paths,
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to upload files: {str(e)}")


# @router.post("/stream-upload")
# @log_execution_time()
# async def stream_upload(file: UploadFile = File(...)):
#     """
#     Stream and save an uploaded file in chunks.
#     """
#     try:
#         # Generate a unique filename for storage
#         filename = f"{uuid4().hex}_{file.filename}"
#         file_path = os.path.join(UPLOAD_DIR, filename)

#         # Stream and save file data to disk
#         async with open(file_path, "wb") as out_file:
#             while chunk := await file.read(1024 * 1024):  # Read 1MB chunks
#                 await out_file.write(chunk)

#         return {"message": f"File {file.filename} uploaded successfully.", "path": file_path}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


# @router.get("/datasets")
# @log_execution_time()
# def list_datasets():
#     """
#     List all datasets stored in the database.
#     """
#     try:
#         datasets = run_query("SELECT * FROM datasets")
#         return {"datasets": datasets}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @router.get("/datasets/export")
# @log_execution_time()
# def export_datasets():
#     """
#     Export all dataset metadata to a JSON file.
#     """
#     try:
#         datasets = run_query("SELECT * FROM datasets")
#         json_path = os.path.join(DATASETS_DIR, "datasets_metadata.json")
#         with open(json_path, "w") as json_file:
#             json.dump(datasets, json_file, indent=4)
#         return {"message": "Datasets exported successfully!", "json_path": json_path}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @router.delete("/datasets/{dataset_id}")
# @log_execution_time()
# def delete_dataset(dataset_id: int):
#     """
#     Delete a dataset by its ID.
#     """
#     try:
#         run_query("DELETE FROM datasets WHERE id = ?", (dataset_id,))
#         return {"message": "Dataset deleted successfully!"}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @router.post("/reddit-posts-by-batch")
# @log_execution_time()
# def get_reddit_posts(request: ParseRedditPostsRequest = Body(...)):
#     """
#     Get a dataset by its ID.
#     """
#     try:
#         dataset_id = request.dataset_id
#         offset = request.offset
#         batch = request.batch
#         all = request.all
#         if all:
#             posts = run_query_with_columns("SELECT * FROM posts WHERE dataset_id = ?", (dataset_id,))
#         else:
#             posts = run_query_with_columns("SELECT * FROM posts WHERE dataset_id = ? LIMIT ? OFFSET ?", (dataset_id, batch, offset))
#         return {post["id"]: post for post in posts}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# class ParseRedditPostsRequest(BaseModel):
#     dataset_id: str

# @router.post("/reddit-posts-titles")
# @log_execution_time()
# def get_reddit_posts(request: ParseRedditPostsRequest = Body(...)):
#     """
#     Get a dataset by its ID.
#     """
#     try:
#         dataset_id = request.dataset_id
#         posts = run_query_with_columns("SELECT id, title FROM posts WHERE dataset_id = ?", (dataset_id,))
#         return posts
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
    

# def get_comments_recursive(post_id: str, dataset_id: str):
#     """
#     Get comments recursively for a post.
#     """
#     comments = run_query_with_columns("SELECT * FROM comments WHERE post_id = ? AND dataset_id = ?", (post_id, dataset_id))

#     print(comments, "from get_comments_recursive")
#     comment_map = {comment["id"]: comment for comment in comments}
#     for comment in comments:
#         if comment["parent_id"] and comment["parent_id"] in comment_map:
#             parent = comment_map[comment["parent_id"]]
#             parent.setdefault("comments", []).append(comment)

#     top_level_comments = [comment for comment in comments if comment["parent_id"] == post_id]

#     return top_level_comments

# class ParseRedditPostByIdRequest(BaseModel):
#     datasetId: str
#     postId: str

# @router.post("/reddit-post-by-id")
# @log_execution_time()
# def get_reddit_post_by_id(request: ParseRedditPostByIdRequest = Body(...)):
#     """
#     Get a dataset by its ID.
#     """
#     try:
#         dataset_id = request.datasetId
#         post_id = request.postId

#         print(dataset_id, post_id, "from get_reddit_post_by_id")
#         posts = run_query_with_columns("SELECT * FROM posts WHERE dataset_id = ? AND id = ?", (dataset_id, post_id))

#         comments = get_comments_recursive(post_id, dataset_id)
#         print(comments, "from get_reddit_post_by_id")
#         return {**posts[0], "comments": comments} if posts else {}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))









# # @router.post("/process-reddit-json")
# # async def process_json_files(
# #     submissions: UploadFile = File(...),
# #     comments: UploadFile = File(...)
# # ):
# #     """
# #     Handle JSON file uploads for submissions and comments and return structured data.
# #     """
# #     try:
# #         submissions_path = save_temp_file(submissions, "submissions")
# #         comments_path = save_temp_file(comments, "comments")

# #         structured_data = parse_submissions_and_comments({
# #             "submissions": submissions_path,
# #             "comments": comments_path
# #         })

# #         os.remove(submissions_path)
# #         os.remove(comments_path)

# #         return {"message": "Files processed successfully", "data": structured_data}
# #     except Exception as e:
# #         raise HTTPException(status_code=500, detail=f"Error processing files: {str(e)}")
