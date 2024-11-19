export enum ROUTES {
    HOME = '#/',
    BASIS = '#/basis',
    WORD_CLOUD = '#/word_cloud',
    FLASHCARDS = '#/flashcards',
    NOT_FOUND = '*',
    GENERATION = '#/generation',
    INITIAL_CODING = '#/initial_coding',
    CODING_VALIDATION = '#/coding_validation',
    FINAL = '#/final'
}

export enum LOADER_ROUTES {
    FLASHCARDS_LOADER = '#/flashcardsloader'
}

export const WORD_CLOUD_MIN_THRESHOLD = 10;

export const FLASHCARDS_MIN_THRESHOLD = 10;

export const initialWords = [
    'JavaScript',
    'SVG',
    'CSS',
    'HTML',
    'Node',
    'TypeScript',
    'GraphQL',
    'Redux',
    'Python',
    'Ruby',
    'Java',
    'C++',
    'Go',
    'Swift',
    'Kotlin',
    'Rust',
    'PHP',
    'SQL',
    'Django'
];

export const newWordsPool = [
    'Angular',
    'Vue',
    'Svelte',
    'Ember',
    'Backbone',
    'JQuery',
    'Bootstrap',
    'Tailwind',
    'Materialize',
    'Bulma',
    'Foundation',
    'Semantic',
    'Ant',
    'Chakra',
    'styled-components',
    'Emotion',
    'JSS',
    'CSS Modules',
    'Sass',
    'Less',
    'Stylus'
];

export const initialResponses = [
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' },
    { sentence: 'This is the first sentence.', coded_word: 'first', comment: '' },
    { sentence: 'Another example sentence.', coded_word: 'example', comment: '' },
    { sentence: 'The validation example continues.', coded_word: 'validation', comment: '' }
];

export const mockPosts = [
    {
        id: 1,
        title: 'First Post',
        body: 'This is the first post content.',
        comments: [
            {
                id: 101,
                body: 'First comment on first post.',
                comments: [
                    {
                        id: 1011,
                        body: 'First reply on first comment.',
                        comments: [
                            {
                                id: 10111,
                                body: 'First reply on first reply.',
                                comments: [
                                    {
                                        id: 101111,
                                        body: 'First reply on first reply on first reply.'
                                    }
                                ]
                            },
                            { id: 10112, body: 'Second reply on first reply.' }
                        ]
                    },
                    {
                        id: 1012,
                        body: 'Second reply on first comment.',
                        comments: [
                            { id: 10121, body: 'First reply on second reply.' },
                            { id: 10122, body: 'Second reply on second reply.' }
                        ]
                    }
                ]
            },
            { id: 102, body: 'Second comment on first post.' }
        ]
    },
    {
        id: 2,
        title: 'Second Post',
        body: 'This is the second post content.',
        comments: [
            { id: 201, body: 'First comment on second post.' },
            { id: 202, body: 'Second comment on second post.' }
        ]
    }
];

export const exampleData = [
    {
        sentence: "Oh this'll be fun with a destroyed FDA and CDC",
        word: 'JavaScript',
        link: 'https://www.reddit.com/r/HermanCainAward/comments/1gnh2e1/bird_flu_begins_its_human_spread_as_health/',
        reason: 'Highly discussed technology in web development.',
        context: 'JavaScript is a core language for building interactive web applications.'
    },
    {
        sentence: 'Trump',
        word: 'Python',
        link: 'https://www.reddit.com/r/HermanCainAward/comments/1gnh2e1/comment/lwciyij/',
        reason: 'Popular for its ease of use and libraries for AI.',
        context: "Reddit posts highlight Python's dominance in AI-related tasks."
    },
    {
        sentence: 'God help us',
        word: 'React',
        link: 'https://www.reddit.com/r/HermanCainAward/comments/1gnh2e1/bird_flu_begins_its_human_spread_as_health/',
        reason: 'Frequently chosen for component-based web architecture.',
        context: "Posts often emphasize React's role in frontend frameworks."
    }
];

export const initialFlashcards = [
    {
        question: 'What is Blame?',
        answer: 'Blame is a command-line tool used to track changes made by Git.'
    },
    {
        question: 'How does Blame work?',
        answer: 'Blame shows the author and date of each line in a file, allowing you to see who made changes and when.'
    },
    {
        question: 'What is the purpose of the --porcelain option with Blame?',
        answer: "The --porcelain option produces a more compact output format that's easier to parse programmatically."
    },
    {
        question: 'How can you use Blame to identify the author of a specific line in a file?',
        answer: "You can use the 'git blame' command with the '-L' option followed by the range of lines you're interested in, e.g., 'git blame -L 10-20'."
    },
    {
        question: "What is the difference between Blame and Git's built-in diff output?",
        answer: 'Blame provides more detailed information about the changes made to a file, including the author and date of each line.'
    },
    {
        question: 'Can you use Blame with other Git commands?',
        answer: "Yes, Blame can be used in conjunction with other Git commands like 'git status' or 'git log'."
    },
    {
        question: 'How does Blame handle merge commits?',
        answer: 'Blame shows the author and date of each line in a file, even if it was modified by multiple people during a merge commit.'
    },
    {
        question: 'Can you use Blame with Git submodules?',
        answer: 'Yes, Blame can be used to track changes made to files within a Git submodule.'
    },
    {
        question: 'What is the --first-base option with Blame?',
        answer: 'The --first-base option shows the first base commit that was modified in a file, even if there were multiple merge commits.'
    },
    {
        question: 'How can you use Blame to identify the changes made by a specific person?',
        answer: "You can use the 'git blame' command with the '-C' option followed by the name of the person you're interested in, e.g., 'git blame -C JohnDoe'."
    },
    {
        question: 'Can you use Blame to track changes made to a specific file?',
        answer: 'Yes, Blame can be used to track changes made to a specific file over time.'
    },
    {
        question: 'How does Blame handle files that have been deleted or renamed?',
        answer: 'Blame shows the author and date of each line in a file, even if it was deleted or renamed during a merge commit.'
    },
    {
        question: "Can you use Blame with Git's cherry-pick feature?",
        answer: 'Yes, Blame can be used to track changes made by cherry-picking commits.'
    },
    {
        question: 'What is the --statistic option with Blame?',
        answer: 'The --statistic option shows statistics about the number of lines added or removed in a file during each commit.'
    },
    {
        question: 'How can you use Blame to identify the most recent changes made to a file?',
        answer: "You can use the 'git blame' command with the '-L' option followed by the range of lines you're interested in, e.g., 'git blame -L 0-'."
    },
    {
        question: "Can you use Blame with Git's merge feature?",
        answer: 'Yes, Blame can be used to track changes made during a merge commit.'
    },
    {
        question: 'What is the --show-signature option with Blame?',
        answer: 'The --show-signature option shows the author and date of each line in a file, along with their signature information.'
    },
    {
        question: 'How can you use Blame to identify the changes made by multiple people?',
        answer: "You can use the 'git blame' command with the '-C' option followed by the names of the people you're interested in, e.g., 'git blame -C JohnDoe JaneSmith'."
    },
    {
        question: 'Can you use Blame to track changes made to a specific branch?',
        answer: 'Yes, Blame can be used to track changes made to a specific branch over time.'
    }
];
