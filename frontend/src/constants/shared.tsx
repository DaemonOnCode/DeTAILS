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
    FLASHCARDS_LOADER = '#/flashcardsloader',
    WORD_CLOUD_LOADER = '#/wordcloudloader',
    CODING_VALIDATION_LOADER = '#/codingvalidationloader',
    FINAL_LOADER = '#/finalloader'
}

export const WORD_CLOUD_MIN_THRESHOLD = 10;

export const FLASHCARDS_MIN_THRESHOLD = 10;

export const SELECTED_POSTS_MIN_THRESHOLD = 10;

export const initialWords = [
    'object-oriented',
    'classes',
    'structures',
    'pointers',
    'functions',
    'variables',
    'constants',
    'namespace',
    'constexpr',
    'using',
    'auto',
    'explicit',
    'stdvector',
    'array',
    'map',
    'iterators',
    'destructors',
    'relational',
    'operators',
    'paradigm',
    'programming'
];

export const newWordsPool = [
    'Object-Oriented',
    'Template',
    'Inheritance',
    'Polymorphism',
    'Encapsulation',
    'Abstraction',
    'Class',
    'Struct',
    'Namespace',
    'Include',
    'Header',
    'Library',
    'Compiler',
    'Interpreter',
    'Syntax',
    'Semantics',
    'Type',
    'Operator',
    'Function',
    'Method',
    'Constructor'
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
        question: 'What is C++?',
        answer: 'C++ is a high-performance, compiled, general-purpose programming language that was developed by Bjarne Stroustrup as an extension of the C programming language.'
    },
    {
        question: 'What is object-oriented programming (OOP) in C++?',
        answer: 'In C++, OOP is a programming paradigm that organizes software design around objects and classes, which have properties and behaviors.'
    },
    {
        question: 'What are the main types of user-defined data types in C++?',
        answer: 'The main types of user-defined data types in C++ are structures, unions, enumerations, classes, and pointers.'
    },
    {
        question: 'What is a function in C++?',
        answer: 'In C++, a function is a block of code that can be executed multiple times from different parts of a program.'
    },
    {
        question: 'What is the difference between a variable and a constant in C++?',
        answer: 'In C++, a variable is a storage location for a value, while a constant is a value that cannot be changed once it is initialized.'
    },
    {
        question: 'What is the purpose of the `#include` directive in C++?',
        answer: 'The `#include` directive in C++ is used to include the contents of another file into the current file.'
    },
    {
        question: 'What is a namespace in C++?',
        answer: 'In C++, a namespace is a way to group named entities (such as functions, variables, and classes) that otherwise would have global scope into a separate scope.'
    },
    {
        question: 'What is the difference between `const` and `constexpr` in C++?',
        answer: 'In C++, `const` means that a variable or function cannot be changed once it is initialized, while `constexpr` means that a function can be evaluated at compile-time.'
    },
    {
        question: 'What is the purpose of the `using` directive in C++?',
        answer: 'The `using` directive in C++ is used to bring a name into scope from another namespace or to define an alias for a type, function, or variable.'
    },
    {
        question: 'What is the difference between `auto` and `explicit` in C++?',
        answer: 'In C++, `auto` means that the type of a variable will be deduced automatically at compile-time, while `explicit` means that a function or constructor cannot be used for implicit conversions.'
    },
    {
        question: 'What is the purpose of the `std::vector` class in C++?',
        answer: 'The `std::vector` class in C++ is a dynamic array that can grow or shrink at runtime.'
    },
    {
        question: 'What is the difference between `std::array` and `std::vector` in C++?',
        answer: 'In C++, `std::array` is a fixed-size array, while `std::vector` is a dynamic array that can grow or shrink at runtime.'
    },
    {
        question: 'What is the purpose of the `std::map` class in C++?',
        answer: 'The `std::map` class in C++ is an associative container that stores elements in a sorted order based on their keys.'
    },
    {
        question: 'What is the difference between `std::set` and `std::map` in C++?',
        answer: 'In C++, `std::set` is an unordered collection of unique elements, while `std::map` is an ordered collection of key-value pairs.'
    },
    {
        question: 'What is the purpose of the `std::queue` class in C++?',
        answer: 'The `std::queue` class in C++ is a First-In-First-Out (FIFO) container that follows the principle of least astonishment.'
    },
    {
        question: 'What is the difference between `std::stack` and `std::queue` in C++?',
        answer: 'In C++, `std::stack` is a Last-In-First-Out (LIFO) container, while `std::queue` is a FIFO container.'
    },
    {
        question: 'What is the purpose of the `std::algorithm` library in C++?',
        answer: 'The `std::algorithm` library in C++ provides a set of generic algorithms for manipulating containers and other data structures.'
    },
    {
        question: 'What is the difference between `std::sort` and `std::stable_sort` in C++?',
        answer: 'In C++, `std::sort` is an unstable sorting algorithm, while `std::stable_sort` is a stable sorting algorithm that preserves the relative order of equal elements.'
    },
    {
        question: 'What is the purpose of the `std::function` class in C++?',
        answer: 'The `std::function` class in C++ provides a way to represent functions as objects, allowing for more flexibility and generic programming.'
    },
    {
        question: 'What is the difference between `std::bind` and `std::function` in C++?',
        answer: 'In C++, `std::bind` is a function that creates a new bound object from an existing function and arguments, while `std::function` is a class template that can represent any callable object.'
    },
    {
        question: 'What is the purpose of the `std::thread` class in C++?',
        answer: 'The `std::thread` class in C++ provides a way to create and manage threads in a program, allowing for concurrent execution of tasks.'
    },
    {
        question: 'What is the difference between `std::mutex` and `std::lock_guard` in C++?',
        answer: 'In C++, `std::mutex` is a mutex class that provides mutual exclusion, while `std::lock_guard` is a lock guard class that automatically locks and unlocks a mutex.'
    },
    {
        question: 'What is the purpose of the `std::atomic` class in C++?',
        answer: 'The `std::atomic` class in C++ provides a way to create atomic objects, allowing for thread-safe access to shared variables.'
    }
];
