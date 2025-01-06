import sqlite3
from constants import DATABASE_PATH

def initialize_database():
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            user_email TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS workspace_states (
            user_email TEXT NOT NULL,
                       
            workspace_id TEXT NOT NULL,
                       
            dataset_id TEXT,
            mode_input TEXT,
            subreddit TEXT,
            selected_posts TEXT,

            models TEXT,           
            
            main_code TEXT,
            additional_info TEXT,
            basis_files TEXT,
            themes TEXT,
            selected_themes TEXT,
            codebook TEXT,
            references_data TEXT,
            code_responses TEXT,
            final_code_responses TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (workspace_id, user_email)
        )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dataset_id TEXT NOT NULL,
                step INTEGER NOT NULL,
                fields TEXT NOT NULL,
                words TEXT NOT NULL,
                pos TEXT,
                action TEXT NOT NULL
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS token_stats (
                dataset_id TEXT NOT NULL,
                removed_tokens TEXT,
                included_tokens TEXT,
                PRIMARY KEY (dataset_id)
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS token_stats_detailed (
                dataset_id TEXT NOT NULL,
                token TEXT NOT NULL,
                pos TEXT,
                count_words INTEGER,
                count_docs INTEGER,
                tfidf_min REAL,
                tfidf_max REAL,
                status TEXT,
                PRIMARY KEY (dataset_id, token, status)
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS models (
                id TEXT PRIMARY KEY,
                dataset_id TEXT,
                model_name TEXT,
                method TEXT,
                topics TEXT,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                finished_at TIMESTAMP,
                num_topics INTEGER,
                stage TEXT,
                FOREIGN KEY (dataset_id) REFERENCES datasets(id)
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS datasets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                file_path TEXT,
                workspace_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
            );
        """)

        # Create posts table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                dataset_id TEXT NOT NULL,  -- Add dataset_id as a column
                over_18 INTEGER,
                subreddit TEXT,
                score INTEGER,
                thumbnail TEXT,
                permalink TEXT,
                is_self INTEGER,
                domain TEXT,
                created_utc INTEGER,
                url TEXT,
                num_comments INTEGER,
                title TEXT,
                selftext TEXT,
                author TEXT,
                hide_score INTEGER,
                subreddit_id TEXT,
                FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
            )
        """)

        # Create comments table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id TEXT PRIMARY KEY,
                dataset_id TEXT NOT NULL,  -- Add dataset_id as a column
                body TEXT,
                author TEXT,
                created_utc INTEGER,
                post_id TEXT,
                parent_id TEXT,
                controversiality INTEGER,
                score_hidden INTEGER,
                score INTEGER,
                subreddit_id TEXT,
                retrieved_on INTEGER,
                gilded INTEGER,
                FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tokenized_posts (
                dataset_id TEXT NOT NULL,
                post_id TEXT NOT NULL,
                title TEXT,
                selftext TEXT,
                PRIMARY KEY (dataset_id, post_id), -- Composite primary key
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
            );
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tokenized_comments (
                dataset_id TEXT NOT NULL,
                comment_id TEXT NOT NULL,
                body TEXT,
                PRIMARY KEY (dataset_id, comment_id), -- Composite primary key
                FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
                FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS llm_responses (
                id TEXT PRIMARY KEY,
                dataset_id TEXT NOT NULL,
                model TEXT NOT NULL,
                post_id TEXT NOT NULL,
                response TEXT NOT NULL,
                function_id TEXT NOT NULL,
                additional_info TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (dataset_id) REFERENCES datasets (id),
                FOREIGN KEY (post_id) REFERENCES posts (id)
            );
        """)
        conn.commit()

initialize_database()
