export enum ROUTES {
    HOME = '#/',
    BASIS = '#/basis',
    WORD_CLOUD = '#/word_cloud',
    NOT_FOUND = '*',
    GENERATION = '#/generation',
    INITIAL_CODING = '#/initial_coding',
    CODING_VALIDATION = '#/coding_validation',
    FINAL = '#/final'
}

export const WORD_CLOUD_MIN_THRESHOLD = 10;

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
