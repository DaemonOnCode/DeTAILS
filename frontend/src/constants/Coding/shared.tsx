export enum ROUTES {
    HOME = 'home',
    // BASIS = 'basis',
    CONTEXT_V2 = 'context-v2',
    // FLASHCARDS = 'flashcards',
    KEYWORD_CLOUD = 'keyword-cloud',
    // WORD_CLOUD = 'word-cloud',
    KEYWORD_TABLE = 'keyword-table',
    //  GENERATION = 'generation',
    // INITIAL_CODING = 'initial-coding',
    // CODING_VALIDATION = 'coding-validation',
    // CODING_VALIDATION_V2 = 'coding-validation-v2',
    // CODING_OVERVIEW = 'coding-overview',
    CODES_REVIEW = 'codes-review',
    CODEBOOK_REFINEMENT = 'codebook-refinement',
    THEMES = 'themes',
    FINAL_CODEBOOK = 'final-codebook',
    // CODE_VALIDATION = 'code-validation',
    SPLIT_CHECK = 'split-check',
    ENCODED_DATA = 'encoded-data',
    FINAL = 'final',
    TRANSCRIPT = 'transcript/:id/:state',
    TRANSCRIPTS = 'transcripts'
}

export enum LOADER_ROUTES {
    FLASHCARDS_LOADER = 'flashcards-loader',
    WORD_CLOUD_LOADER = 'word-cloud-loader',
    CODEBOOK_LOADER = 'codebook-loader',
    CODING_VALIDATION_LOADER = 'coding-validation-loader',
    FINAL_LOADER = 'final-loader',
    THEME_LOADER = 'theme-loader',
    KEYWORD_TABLE_LOADER = 'keyword-table-loader'
}

export const DB_PATH = '../executables/test.db';

export const WORD_CLOUD_MIN_THRESHOLD = 10;

export const FLASHCARDS_MIN_THRESHOLD = 10;

export const SELECTED_POSTS_MIN_THRESHOLD = 3;

export const initialWords = [
    'accommodation',
    'alternative',
    'building',
    'campus',
    'centre',
    'email',
    'format',
    'library',
    'meeting',
    'office',
    'parking',
    'portal',
    'professor',
    'records',
    'semester',
    'student',
    'union',
    'workshop'
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
        question: 'What is the best way to get to campus from downtown Waterloo?',
        answer: 'The most convenient way to get to campus from downtown Waterloo is by using public transportation, such as bus 7 or 8, or taking a taxi/ride-hailing service.'
    },
    {
        question:
            'How do I request accommodations for my course materials in an alternative format?',
        answer: 'To request accommodations for your course materials in an alternative format, please contact the Centre for Teaching Excellence at cte@uwaterloo.ca and provide us with your accommodation needs as soon as possible.'
    },
    {
        question: 'What is the location of the East Campus 3 building?',
        answer: 'The East Campus 3 building is located at 200 University Avenue West, Waterloo, ON N2L 3G1.'
    },
    {
        question: 'How do I access my student email account?',
        answer: 'To access your student email account, please log in to the UWaterloo email portal using your university username and password.'
    },
    {
        question: 'What are the office hours for the Centre for Teaching Excellence?',
        answer: 'The office hours for the Centre for Teaching Excellence are Monday to Friday, 9:00 am - 5:00 pm. Please note that these hours may be subject to change.'
    },
    {
        question: 'How do I request a parking permit?',
        answer: "To request a parking permit, please visit the University of Waterloo's Parking Services website and follow the online application process."
    },
    {
        question: 'What is the best way to get around campus without a car?',
        answer: 'The best way to get around campus without a car is by using public transportation, walking, or biking. There are also several bike-sharing programs available on campus.'
    },
    {
        question: 'How do I access my student records online?',
        answer: 'To access your student records online, please log in to the UWaterloo Student Portal using your university username and password.'
    },
    {
        question: 'What are the hours of operation for the University Library?',
        answer: "The hours of operation for the University Library vary depending on the semester. Please check the library's website for specific hours during your term."
    },
    {
        question: 'How do I request a meeting with a professor?',
        answer: 'To request a meeting with a professor, please email them directly or visit their office hours. Be sure to include your name, course number, and reason for the meeting in your email.'
    },
    {
        question: 'What is the location of the Student Union Building?',
        answer: 'The Student Union Building is located at 200 University Avenue West, Waterloo, ON N2L 3G1.'
    },
    {
        question: 'How do I access my student financial aid information?',
        answer: 'To access your student financial aid information, please log in to the UWaterloo Financial Aid Portal using your university username and password.'
    },
    {
        question: 'What are the hours of operation for the University Centre?',
        answer: "The hours of operation for the University Centre vary depending on the semester. Please check the centre's website for specific hours during your term."
    },
    {
        question: 'How do I request a accommodation for a disability?',
        answer: 'To request an accommodation for a disability, please contact the Accessibility Office at accessibility@uwaterloo.ca and provide us with documentation of your disability as soon as possible.'
    },
    {
        question: "What is the location of the University's main campus?",
        answer: "The University of Waterloo's main campus is located at 200 University Avenue West, Waterloo, ON N2L 3G1."
    },
    {
        question: 'How do I access my student email account on my phone?',
        answer: 'To access your student email account on your phone, please download the UWaterloo email app or log in to your email account using a mobile browser.'
    },
    {
        question: "What are the hours of operation for the University's IT department?",
        answer: "The hours of operation for the University's IT department vary depending on the semester. Please check the IT department's website for specific hours during your term."
    },
    {
        question: 'How do I request a meeting with a teaching assistant?',
        answer: 'To request a meeting with a teaching assistant, please email them directly or visit their office hours. Be sure to include your name, course number, and reason for the meeting in your email.'
    },
    {
        question: "What is the location of the University's career services?",
        answer: "The University of Waterloo's career services are located at 200 University Avenue West, Waterloo, ON N2L 3G1."
    },
    {
        question: 'How do I access my student transcript online?',
        answer: 'To access your student transcript online, please log in to the UWaterloo Student Portal using your university username and password.'
    },
    {
        question: "What are the hours of operation for the University's recreation centre?",
        answer: "The hours of operation for the University's recreation centre vary depending on the semester. Please check the recreation centre's website for specific hours during your term."
    },
    {
        question: 'How do I request a accommodation for a medical condition?',
        answer: 'To request an accommodation for a medical condition, please contact the Accessibility Office at accessibility@uwaterloo.ca and provide us with documentation of your medical condition as soon as possible.'
    }
];

export const codes = [
    'Career Preparation',
    'Application Timeline Concerns',
    'Technical Issues',
    'Community Feedback',
    'Humor and Sarcasm',
    'Linguistic Observations',
    'Co-op Job Search',
    'First-Year Challenges',
    'Advice on Applications',
    'Reassurance',
    'Administrative Notes',
    'Housing Dilemma',
    'Subletting Questions',
    'University Housing Policies',
    'Advice on Problem-Solving',
    'Expressions of Emotion',
    'Course Recommendations',
    'Course Content',
    'Course Workload',
    'Prerequisites and Preparedness',
    'Encouragement',
    'Personal Experience',
    'Numerical Observations',
    'Personal Reflections',
    'Community Humor',
    'Mathematical Insights'
];

export const codeReferences = {
    'Career Preparation': [
        {
            text: "Would you guys mind sharing your dev portfolios? I'm looking to give mine an overhaul...",
            postId: '1019969',
            isComment: false
        },
        {
            text: "Damn :(( Been applying since Sept tho, got a couple OA's but not a single interview...",
            postId: '1019969',
            isComment: true
        }
    ],
    'Application Timeline Concerns': [
        {
            text: "you're already really late to the game for summer 2023 internships...",
            postId: '1019969',
            isComment: true
        }
    ],
    'Technical Issues': [
        {
            text: "Are you aware that your project websites can't be accessed?",
            postId: '1019969',
            isComment: true
        },
        {
            text: 'just found out free tier of Heroku is not a thing anymore. wtf',
            postId: '1019969',
            isComment: true
        }
    ],
    'Community Feedback': [
        {
            text: 'In order to get your website on GitHub to use HTTPS instead of HTTP...',
            postId: '1019969',
            isComment: true
        }
    ],
    'Humor and Sarcasm': [
        {
            text: "its like one of those websites thats like 'download elden ring for android'...",
            postId: '1019969',
            isComment: true
        },
        {
            text: 'math competition participants scrambling to find the prime factorization of 2023...',
            postId: '100c5lc',
            isComment: true
        }
    ],
    'Linguistic Observations': [
        {
            text: 'ur the first person on earth that ive seen who abbreviates thanks as thnx',
            postId: '1019969',
            isComment: true
        }
    ],
    'Co-op Job Search': [
        {
            text: "I'm going into my first year of environmental engineering this September...",
            postId: '1008z9h',
            isComment: false
        },
        {
            text: 'Most people get co-op jobs, traditionally speaking...',
            postId: '1008z9h',
            isComment: true
        }
    ],
    'First-Year Challenges': [
        {
            text: 'How difficult is it to land a coop in first year if you have no practical work experience...',
            postId: '1008z9h',
            isComment: false
        },
        {
            text: 'It’s a little harder for Stream-4 programs than Stream-8 ones...',
            postId: '1008z9h',
            isComment: true
        }
    ],
    'Advice on Applications': [
        {
            text: 'You’d just have to apply to jobs as early as possible and tailor your resume...',
            postId: '1008z9h',
            isComment: true
        },
        {
            text: 'Max out your apps each cycle (50) since the first 2 rounds have the best jobs...',
            postId: '1008z9h',
            isComment: true
        }
    ],
    Reassurance: [
        {
            text: 'You should be fine! There are a few jobs specifically for env eng...',
            postId: '1008z9h',
            isComment: true
        },
        {
            text: 'Hope 2023 gets better for ya',
            postId: '100c5lc',
            isComment: true
        }
    ],
    'Administrative Notes': [
        {
            text: "AutoModerator thinks you're asking about admissions...",
            postId: '1008z9h',
            isComment: true
        }
    ],
    'Housing Dilemma': [
        {
            text: 'I’ve already rent a place for winter term, not knowing my contract was for entire year...',
            postId: '100axnj',
            isComment: false
        },
        {
            text: 'society 145',
            postId: '100axnj',
            isComment: true
        }
    ],
    'Subletting Questions': [
        {
            text: 'Is it possible to give someone rent for V1(single room)? I’m willing to give it in cheaper price.',
            postId: '100axnj',
            isComment: false
        },
        {
            text: 'I have a friend in lives in V1 but is suppose to be in REV...',
            postId: '100axnj',
            isComment: true
        }
    ],
    'University Housing Policies': [
        {
            text: 'Perhaps the housing contract is a good starting place? 5.3 Subletting...',
            postId: '100axnj',
            isComment: true
        },
        {
            text: "Sublet the other res cause you can't sublet university residence.",
            postId: '100axnj',
            isComment: true
        }
    ],
    'Advice on Problem-Solving': [
        {
            text: 'Realistically no one is going to know unless they draw enough attention...',
            postId: '100axnj',
            isComment: true
        }
    ],
    'Expressions of Emotion': [
        {
            text: 'T ^ T',
            postId: '100axnj',
            isComment: true
        }
    ],
    'Course Recommendations': [
        {
            text: 'Therefore, I was wondering which CO courses...are useful in learning machine learning?',
            postId: '100b8t3',
            isComment: false
        },
        {
            text: 'Would you recommend taking CO 367 or taking one of CO 466 or 463 instead...',
            postId: '100b8t3',
            isComment: true
        }
    ],
    'Course Content': [
        {
            text: 'CO 466(continuous optimization) teaches about unconstrained, constrained...',
            postId: '100b8t3',
            isComment: true
        }
    ],
    'Course Workload': [
        {
            text: 'CO 367 - decent as you would expect from a 3rd year CO course...',
            postId: '100b8t3',
            isComment: true
        }
    ],
    'Prerequisites and Preparedness': [
        {
            text: 'Would you know if the 80% average as a prerequisite is strictly enforced?',
            postId: '100b8t3',
            isComment: true
        },
        {
            text: 'Dw too much about first year. I did terrible too...',
            postId: '100b8t3',
            isComment: true
        }
    ],
    Encouragement: [
        {
            text: 'If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!',
            postId: '100b8t3',
            isComment: true
        }
    ],
    'Personal Experience': [
        {
            text: 'The thing is I am a student of statistics with main interest in statistical learning...',
            postId: '100b8t3',
            isComment: true
        }
    ],
    'Numerical Observations': [
        {
            text: '2023 is not a prime number. Sorry not sorry to spoil the beginning of a new year 😘🤓',
            postId: '100c5lc',
            isComment: false
        }
    ],
    'Personal Reflections': [
        {
            text: '2022 was not a good year either, at least for me.',
            postId: '100c5lc',
            isComment: true
        }
    ],
    'Community Humor': [
        {
            text: 'math competition participants scrambling to find the prime factorization of 2023...',
            postId: '100c5lc',
            isComment: true
        }
    ],
    'Mathematical Insights': [
        {
            text: 'Oop 17 x 17 x 7',
            postId: '100c5lc',
            isComment: true
        },
        {
            text: 'But 1/1/23 is a Fibonacci date. Happy Fibonacci new year',
            postId: '100c5lc',
            isComment: true
        }
    ]
};

export const beforeHumanValidation = [
    '{\n    "unified_codebook": [\n        {\n            "code": "Late to the game",\n            "definition": "Refers to the concern that someone is applying for opportunities too late, such as summer 2023 internships.",\n            "examples": ["you\'re already really late to the game for summer 2023 internships", "(Comment 1019969) you\'re already really late to the game for summer 2023 internships..."]\n        },\n        {\n            "code": "Technical issues with websites",\n            "definition": "Describes the problem of project websites being inaccessible.",\n            "examples": ["Are you aware that your project websites can\'t be accessed?", "(Comment 1019969) Are you aware that your project websites can\'t be accessed?"]\n        },\n        {\n            "code": "Confusion over free tier of Heroku",\n            "definition": "Expresses confusion and frustration about the lack of a free tier for Heroku.",\n            "examples": ["just found out free tier of Heroku is not a thing anymore. wtf", "(Comment 1019969) just found out free tier of Heroku is not a thing anymore. wtf"]\n        },\n        {\n            "code": "Abbreviated thanks",\n            "definition": "Describes the use of abbreviated forms of words, such as \'thnx\' instead of \'thank you\'.",\n            "examples": ["ur the first person on earth that ive seen who abbreviates thanks as thnx", "(Comment 1019969) ur the first person on earth that ive seen who abbreviates thanks as thnx"]\n        },\n        {\n            "code": "Co-op job search challenges",\n            "definition": "Expresses concerns about the difficulties of finding co-op jobs, particularly for those with no practical work experience.",\n            "examples": ["I\'m going into my first year of environmental engineering this September...", "(Post 1008z9h) Most people get co-op jobs, traditionally speaking..."]\n        },\n        {\n            "code": "First-year challenges",\n            "definition": "Describes the difficulties of landing a co-op job in the first year, especially for those with no practical work experience.",\n            "examples": ["How difficult is it to land a coop in first year if you have no practical work experience...", "(Post 1008z9h) How difficult is it to land a coop in first year if you have no practical work experience..."]\n        },\n        {\n            "code": "Application timeline concerns",\n            "definition": "Expresses concern about the timing of applying for opportunities, such as summer 2023 internships.",\n            "examples": ["you\'re already really late to the game for summer 2023 internships...", "(Comment 1019969) you\'re already really late to the game for summer 2023 internships..."]\n        },\n        {\n            "code": "Housing dilemma",\n            "definition": "Describes the concern about renting a place without knowing the full contract terms.",\n            "examples": ["I’ve already rent a place for winter term, not knowing my contract was for entire year...", "(Post 100axnj) I’ve already rent a place for winter term, not knowing my contract was for entire year..."]\n        },\n        {\n            "code": "Community feedback on GitHub",\n            "definition": "Describes the need for guidance on how to enable HTTPS on GitHub.",\n            "examples": ["In order to get your website on GitHub to use HTTPS instead of HTTP...", "(Comment 1019969) In order to get your website on GitHub to use HTTPS instead of HTTP..."]\n        },\n        {\n            "code": "Math competition humor",\n            "definition": "Expresses humor and sarcasm about math competitions.",\n            "examples": ["math competition participants scrambling to find the prime factorization of 2023...", "(Comment 100c5lc) math competition participants scrambling to find the prime factorization of 2023..."]\n        },\n        {\n            "code": "Linguistic observations",\n            "definition": "Describes the observation of abbreviated forms of words, such as \'thnx\' instead of \'thank you\'.",\n            "examples": ["ur the first person on earth that ive seen who abbreviates thanks as thnx", "(Comment 1019969) ur the first person on earth that ive seen who abbreviates thanks as thnx"]\n        },\n        {\n            "code": "Co-op job search stress",\n            "definition": "Expresses concern about the stress of finding co-op jobs.",\n            "examples": ["I’m going into my first year of environmental engineering this September...", "(Post 1008z9h) Most people get co-op jobs, traditionally speaking..."]\n        },\n        {\n            "code": "First-year challenges",\n            "definition": "Describes the difficulties of landing a co-op job in the first year, especially for those with no practical work experience.",\n            "examples": ["How difficult is it to land a coop in first year if you have no practical work experience...", "(Post 1008z9h) How difficult is it to land a coop in first year if you have no practical work experience..."]\n        },\n        {\n            "code": "Advice on applications",\n            "definition": "Expresses advice about applying for opportunities, such as tailoring resumes and applying early.",\n            "examples": ["You’d just have to apply to jobs as early as possible and tailor your resume...", "(Comment 1008z9h) You’d just have to apply to jobs as early as possible and tailor your resume..."]\n        },\n        {\n            "code": "Reassurance",\n            "definition": "Expresses reassurance about job prospects, particularly for those in environmental engineering.",\n            "examples": ["You should be fine! There are a few jobs specifically for env eng...", "(Comment 1008z9h) You should be fine! There are a few jobs specifically for env eng..."]\n        },\n        {\n            "code": "Subletting questions",\n            "definition": "Describes the concern about subletting in university housing.",\n            "examples": ["Is it possible to give someone rent for V1(single room)? I’m willing to give it in cheaper price...", "(Post 100axnj) Is it possible to give someone rent for V1(single room)? I’m willing to give it in cheaper price..."]\n        },\n        {\n            "code": "University housing policies",\n            "definition": "Describes the concern about university housing policies, particularly regarding subletting.",\n            "examples": ["Perhaps the housing contract is a good starting place? 5.3 Subletting...", "(Comment 100axnj) Perhaps the housing contract is a good starting place? 5.3 Subletting..."]\n        },\n        {\n            "code": "Advice on problem-solving",\n            "definition": "Expresses advice about problem-solving, particularly in the context of math competitions.",\n            "examples": ["Realistically no one is going to know unless they draw enough attention...", "(Comment 100axnj) Realistically no one is going to know unless they draw enough attention..."]\n        },\n        {\n            "code": "Expressions of emotion",\n            "definition": "Describes the expression of emotions, such as disappointment and frustration.",\n            "examples": ["T ^ T", "(Post 100b8t3) Therefore, I was wondering which CO courses...are useful in learning machine learning?"]\n        },\n        {\n            "code": "Course recommendations",\n            "definition": "Expresses the need for guidance on course recommendations, particularly for learning machine learning.",\n            "examples": ["Would you recommend taking CO 367 or taking one of CO 466 or 463 instead...", "(Post 100b8t3) Would you recommend taking CO 367 or taking one of CO 466 or 463 instead..."]\n        },\n        {\n            "code": "Course content",\n            "definition": "Describes the content of a course, particularly in the context of machine learning.",\n            "examples": ["CO 466(continuous optimization) teaches about unconstrained, constrained...", "(Comment 100b8t3) CO 466(continuous optimization) teaches about unconstrained, constrained..."]\n        },\n        {\n            "code": "Course workload",\n            "definition": "Describes the workload of a course, particularly in the context of machine learning.",\n            "examples": ["CO 367 - decent as you would expect from a 3rd year CO course...", "(Comment 100b8t3) CO 367 - decent as you would expect from a 3rd year CO course..."]\n        },\n        {\n            "code": "Prerequisites and preparedness",\n            "definition": "Expresses concern about prerequisites and preparedness for courses, particularly in the context of machine learning.",\n            "examples": ["Would you know if the 80% average as a prerequisite is strictly enforced?", "(Comment 100b8t3) Would you know if the 80% average as a prerequisite is strictly enforced?"]\n        },\n        {\n            "code": "Encouragement",\n            "definition": "Expresses encouragement and reassurance, particularly in the context of pursuing machine learning.",\n            "examples": ["If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!", "(Comment 100b8t3) If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!"]\n        },\n        {\n            "code": "Personal experience",\n            "definition": "Describes personal experiences and interests, particularly in the context of statistics and machine learning.",\n            "examples": ["The thing is I am a student of statistics with main interest in statistical learning...", "(Comment 100b8t3) The thing is I am a student of statistics with main interest in statistical learning..."]\n        },\n        {\n            "code": "Numerical observations",\n            "definition": "Describes numerical observations, particularly about the year 2023.",\n            "examples": ["2023 is not a prime number. Sorry not sorry to spoil the beginning of a new year...", "(Post 100c5lc) 2023 is not a prime number. Sorry not sorry to spoil the beginning of a new year..."]\n        },\n        {\n            "code": "Personal reflections",\n            "definition": "Describes personal reflections and experiences, particularly in the context of the previous year.",\n            "examples": ["2022 was not a good year either, at least for me.", "(Comment 100c5lc) 2022 was not a good year either, at least for me."]\n        },\n        {\n            "code": "Community humor",\n            "definition": "Describes community humor and sarcasm, particularly about math competitions.",\n            "examples": ["math competition participants scrambling to find the prime factorization of 2023...", "(Comment 100c5lc) math competition participants scrambling to find the prime factorization of 2023..."]\n        },\n        {\n            "code": "Mathematical insights",\n            "definition": "Describes mathematical insights and observations, particularly about the year 2023.",\n            "examples": ["Oop 17 x 17 x 7", "(Comment 100c5lc) Oop 17 x 17 x 7"]\n        }\n    ],\n    "recoded_transcript": [\n        {\n            "segment": "Would you guys mind sharing your dev portfolios? I\'m looking to give mine an overhaul (in prep for summer 2023 internships) and looking for some inspo. Thnxx",\n            "code": "Late to the game"\n        },\n        {\n            "segment": "(Comment 1019969) you\'re already really late to the game for summer 2023 internships your site looks beautiful but if you\'re not one of the first ~50 applicants which starts in July/August 2022 for a lot of companies btw then it\'s all for nothing",\n            "code": "Late to the game"\n        },\n        {\n            "segment": "(Comment 1019969) Damn :(( Been applying since Sept tho got a couple OA’s but not a single interview so I thought this might be the issue.",\n            "code": "Application Timeline Concerns"\n        },\n        {\n            "segment": "(Comment 1019969) Are you aware that your project websites can’t be accessed?",\n            "code": "Technical Issues with Websites"\n        },\n        {\n            "segment": "(Comment 1019969) just found out free tier of Heroku is not a thing anymore. wtf",\n            "code": "Confusion over Free Tier of Heroku"\n        },\n        {\n            "segment": "(Comment 1019969) ur the first person on earth that ive seen who abbreviates thanks as thnx",\n            "code": "Abbreviated Thanks"\n        },\n        {\n            "segment": "(Post 1008z9h) Most people get co-op jobs traditionally speaking",\n            "code": "Co-op Job Search Challenges"\n        },\n        {\n            "segment": "(Comment 1008z9h) How difficult is it to land a coop in first year if you have no practical work experience.",\n            "code": "First-Year Challenges"\n        },\n        {\n            "segment": "(Comment 1019969) you\'re already really late to the game for summer 2023 internships",\n            "code": "Application Timeline Concerns"\n        }\n    ]\n}',
    '{\n    "unified_codebook": [\n        {\n            "code": "Campus Navigation",\n            "definition": "Getting around campus without a car using public transportation, walking, or biking.",\n            "examples": ["The most convenient way to get to campus from downtown Waterloo is by using public transportation, such as bus 7 or 8, or taking a taxi/ride-hailing service."]\n        },\n        {\n            "code": "Alternative Format Request",\n            "definition": "Requesting accommodations for course materials in an alternative format.",\n            "examples": ["To request accommodations for your course materials in an alternative format, please contact the Centre for Teaching Excellence at cte@uwaterloo.ca and provide us with your accommodation needs as soon as possible."]\n        },\n        {\n            "code": "Building Location",\n            "definition": "The location of a building on campus.",\n            "examples": ["The East Campus 3 building is located at 200 University Avenue West, Waterloo, ON N2L 3G1."]\n        },\n        {\n            "code": "Student Email Access",\n            "definition": "Accessing student email account.",\n            "examples": ["To access your student email account, please log in to the UWaterloo email portal using your university username and password."]\n        },\n        {\n            "code": "Office Hours",\n            "definition": "The scheduled time for a professor to meet with students.",\n            "examples": ["The office hours for the Centre for Teaching Excellence are Monday to Friday, 9:00 am - 5:00 pm. Please note that these hours may be subject to change."]\n        },\n        {\n            "code": "Parking Permit Request",\n            "definition": "Requesting a parking permit.",\n            "examples": ["To request a parking permit, please visit the University of Waterloo\'s Parking Services website and follow the online application process."]\n        },\n        {\n            "code": "Subletting Questions",\n            "definition": "Questions about subletting university residence.",\n            "examples": ["Is it possible to give someone rent for V1(single room)? I’m willing to give it in cheaper price."]\n        },\n        {\n            "code": "University Housing Policies",\n            "definition": "Policies related to university housing.",\n            "examples": ["Perhaps the housing contract is a good starting place? 5.3 Subletting..."]\n        },\n        {\n            "code": "Campus Transportation",\n            "definition": "Transportation options available on campus.",\n            "examples": ["The best way to get around campus without a car is by using public transportation, walking, or biking."]\n        },\n        {\n            "code": "First-Year Challenges",\n            "definition": "Challenges faced by first-year students.",\n            "examples": ["How difficult is it to land a coop in first year if you have no practical work experience..."]\n        },\n        {\n            "code": "Advice on Applications",\n            "definition": "Advice for applying for jobs and internships.",\n            "examples": ["You’d just have to apply to jobs as early as possible and tailor your resume..."]\n        },\n        {\n            "code": "Co-op Job Search",\n            "definition": "Job search strategies for co-op students.",\n            "examples": ["Most people get co-op jobs, traditionally speaking..."]\n        }\n    ],\n    "recoded_transcript": [\n        {\n            "segment": "The most convenient way to get to campus from downtown Waterloo is by using public transportation, such as bus 7 or 8, or taking a taxi/ride-hailing service.",\n            "code": "Campus Navigation"\n        },\n        {\n            "segment": "To request accommodations for your course materials in an alternative format, please contact the Centre for Teaching Excellence at cte@uwaterloo.ca and provide us with your accommodation needs as soon as possible.",\n            "code": "Alternative Format Request"\n        },\n        {\n            "segment": "The East Campus 3 building is located at 200 University Avenue West, Waterloo, ON N2L 3G1.",\n            "code": "Building Location"\n        },\n        {\n            "segment": "To access your student email account, please log in to the UWaterloo email portal using your university username and password.",\n            "code": "Student Email Access"\n        },\n        {\n            "segment": "The office hours for the Centre for Teaching Excellence are Monday to Friday, 9:00 am - 5:00 pm. Please note that these hours may be subject to change.",\n            "code": "Office Hours"\n        },\n        {\n            "segment": "To request a parking permit, please visit the University of Waterloo\'s Parking Services website and follow the online application process.",\n            "code": "Parking Permit Request"\n        },\n        {\n            "segment": "Is it possible to give someone rent for V1(single room)? I’m willing to give it in cheaper price.",\n            "code": "Subletting Questions"\n        },\n        {\n            "segment": "Perhaps the housing contract is a good starting place? 5.3 Subletting...",\n            "code": "University Housing Policies"\n        },\n        {\n            "segment": "The best way to get around campus without a car is by using public transportation, walking, or biking.",\n            "code": "Campus Transportation"\n        },\n        {\n            "segment": "How difficult is it to land a coop in first year if you have no practical work experience...",\n            "code": "First-Year Challenges"\n        },\n        {\n            "segment": "You’d just have to apply to jobs as early as possible and tailor your resume...",\n            "code": "Advice on Applications"\n        },\n        {\n            "segment": "Most people get co-op jobs, traditionally speaking...",\n            "code": "Co-op Job Search"\n        }\n    ]\n}',
    '{\n    "unified_codebook": [\n        {\n            "code": "Application Timeline Pressure",\n            "definition": "Pressure or stress related to applying for jobs or internships within a specific timeline.",\n            "examples": ["you\'re already really late to the game for summer 2023 internships..."]\n        },\n        {\n            "code": "Technical Issues",\n            "definition": "Problems or difficulties encountered while using technical tools, platforms, or systems.",\n            "examples": ["Are you aware that your project websites can\'t be accessed? just found out free tier of Heroku is not a thing anymore. wtf"]\n        },\n        {\n            "code": "Importance of Clear Communication",\n            "definition": "The value and necessity of clear and effective communication in both academic and professional settings.",\n            "examples": ["\\"It\'s like one of those websites thats like \'download elden ring for android\'\\"... math competition participants scrambling to find the prime factorization of 2023..."]\n        },\n        {\n            "code": "Self-Doubt and Criticism",\n            "definition": "Negative self-talk, criticism from others, or feelings of inadequacy.",\n            "examples": ["ur the first person on earth that ive seen who abbreviates thanks as thnx"]\n        },\n        {\n            "code": "Overcoming Initial Difficulties",\n            "definition": "Strategies and approaches for overcoming initial challenges or obstacles in academic and professional pursuits.",\n            "examples": ["If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!"]\n        },\n        {\n            "code": "Importance of Perseverance",\n            "definition": "The value and necessity of perseverance and adaptability in achieving goals or overcoming obstacles.",\n            "examples": ["2023 is not a prime number. Sorry not sorry to spoil the beginning of a new year..."]\n        },\n        {\n            "code": "Community Feedback and Guidance",\n            "definition": "Support, advice, or guidance provided by others within academic or professional communities.",\n            "examples": ["In order to get your website on GitHub to use HTTPS instead of HTTP..."]\n        },\n        {\n            "code": "Humor and Sarcasm in Online Interactions",\n            "definition": "The use of humor or sarcasm in online interactions, such as social media or forums.",\n            "examples": ["its like one of those websites thats like \'download elden ring for android\'..."]\n        },\n        {\n            "code": "Linguistic Observations and Etiquette",\n            "definition": "Notices or comments about language use, etiquette, or cultural differences in online interactions.",\n            "examples": ["ur the first person on earth that ive seen who abbreviates thanks as thnx"]\n        },\n        {\n            "code": "Co-op Job Search Strategies",\n            "definition": "Methods and approaches for finding co-op jobs, such as networking, resume-building, or job search platforms.",\n            "examples": ["I\'m going into my first year of environmental engineering this September..."]\n        },\n        {\n            "code": "First-Year Challenges and Support",\n            "definition": "Strategies and resources for overcoming challenges or difficulties in the first year of academic studies.",\n            "examples": ["How difficult is it to land a coop in first year if you have no practical work experience..."]\n        },\n        {\n            "code": "Advice on Applications and Job Searching",\n            "definition": "Guidance, advice, or tips for applying for jobs or internships, such as resume-building, interview preparation, or job search strategies.",\n            "examples": ["You’d just have to apply to jobs as early as possible and tailor your resume..."]\n        },\n        {\n            "code": "Reassurance",\n            "definition": "Supportive messages or comments aimed at reassuring individuals about their abilities, progress, or future prospects.",\n            "examples": ["You should be fine! There are a few jobs specifically for env eng..."]\n        },\n        {\n            "code": "Administrative Notes and Clarifications",\n            "definition": "Notes or clarifications related to administrative procedures, policies, or systems.",\n            "examples": ["AutoModerator thinks you\'re asking about admissions..."]\n        },\n        {\n            "code": "Housing Dilemmas and Subletting Questions",\n            "definition": "Concerns or questions related to housing arrangements, subletting, or university housing policies.",\n            "examples": ["I’ve already rent a place for winter term, not knowing my contract was for entire year..."]\n        },\n        {\n            "code": "University Housing Policies and Procedures",\n            "definition": "Guidelines, regulations, or procedures related to university housing, including subletting, permits, or other relevant policies.",\n            "examples": ["Perhaps the housing contract is a good starting place? 5.3 Subletting..."]\n        },\n        {\n            "code": "Problem-Solving Strategies and Realism",\n            "definition": "Approaches or strategies for solving problems, including realistic expectations and considerations.",\n            "examples": ["Realistically no one is going to know unless they draw enough attention..."]\n        },\n        {\n            "code": "Expressions of Emotion",\n            "definition": "Emotional expressions, such as emojis, sarcasm, or humor, in online interactions.",\n            "examples": ["T ^ T"]\n        },\n        {\n            "code": "Course Recommendations and Prerequisites",\n            "definition": "Suggestions or guidelines for course selection, including prerequisites, recommendations, or warnings.",\n            "examples": ["Therefore, I was wondering which CO courses...are useful in learning machine learning?"]\n        },\n        {\n            "code": "Course Content and Workload",\n            "definition": "Descriptions or comments about the content, difficulty, or workload of specific courses.",\n            "examples": ["CO 367 - decent as you would expect from a 3rd year CO course..."]\n        },\n        {\n            "code": "Prerequisites and Preparedness for Students",\n            "definition": "Guidance or advice related to meeting prerequisites, preparing for classes, or anticipating academic challenges.",\n            "examples": ["Would you know if the 80% average as a prerequisite is strictly enforced?"]\n        },\n        {\n            "code": "Encouragement",\n            "definition": "Supportive messages or comments aimed at encouraging individuals about their abilities, progress, or future prospects.",\n            "examples": ["If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!"]\n        },\n        {\n            "code": "Personal Experience",\n            "definition": "Individual experiences, perspectives, or insights shared in online interactions.",\n            "examples": ["The thing is I am a student of statistics with main interest in statistical learning..."]\n        },\n        {\n            "code": "Numerical Observations",\n            "definition": "Notices or comments about numerical data, patterns, or observations in online interactions.",\n            "examples": ["2023 is not a prime number. Sorry not sorry to spoil the beginning of a new year..."]\n        },\n        {\n            "code": "Personal Reflections",\n            "definition": "Individual reflections, thoughts, or insights shared in online interactions.",\n            "examples": ["2022 was not a good year either, at least for me."]\n        },\n        {\n            "code": "Community Humor",\n            "definition": "Humor or lightheartedness used within online communities or social media platforms.",\n            "examples": ["math competition participants scrambling to find the prime factorization of 2023..."]\n        },\n        {\n            "code": "Mathematical Insights",\n            "definition": "Insights, observations, or comments about mathematical concepts, patterns, or relationships in online interactions.",\n            "examples": ["Oop 17 x 17 x 7 But 1/1/23 is a Fibonacci date. Happy Fibonacci new year"]\n        }\n    ],\n    "recoded_transcript": [\n        {\n            "segment": "Comments: Doesn’t matter, companies get them all at once after the deadline. Unless they make you apply externally too, in which case earlier is better, but probably still doesn’t matter much.",\n            "code": "Application Timeline Pressure"\n        },\n        {\n            "segment": "Wait where is this mentioned that companies get it after the deadline?",\n            "code": "Application Timeline Pressure"\n        },\n        {\n            "segment": "Don\'t apply to everything the night before the deadline cuz you never know if waterloo works will crash. Try to space it out and apply as you go if you can",\n            "code": "Application Timeline Pressure"\n        },\n        {\n            "segment": "It\'s always best to apply to things as early as possible. If you have to wait until the night before the deadline, that\'s okay, but make sure you give yourself enough time to submit your application and be sure to double-check all your information before submitting. It\'s also a good idea to have a plan in place in case Waterloo Works does crash. Have a backup plan ready to go, such as submitting your application directly to the organization or by email.",\n            "code": "Application Timeline Pressure"\n        },\n        {\n            "segment": "As someone who hires from UW coop, we see the times candidates apply. It may look like you’re a last minute kind of person, which could be misunderstood.",\n            "code": "Application Timeline Pressure"\n        },\n        {\n            "segment": "I recommend applying before the last day.",\n            "code": "Application Timeline Pressure"\n        }\n    ]\n}',
    '{\n    "unified_codebook": [\n        {\n            "code": "Application Timeline Concerns",\n            "definition": "Concerns about the timing of application processes, particularly for summer 2023 internships.",\n            "examples": ["(Comment 1019969) you\'re already really late to the game for summer 2023 internships..."]\n        },\n        {\n            "code": "Technical Issues with Project Websites",\n            "definition": "Problems or difficulties encountered while accessing or managing project websites.",\n            "examples": ["(Comment 1019969) Are you aware that your project websites can\'t be accessed?"]\n        },\n        {\n            "code": "Importance of Requesting Accommodations in Alternative Formats",\n            "definition": "The need for students to request accommodations for course materials in alternative formats, such as large print or digital formats.",\n            "examples": ["To request accommodations for your course materials in an alternative format, please contact the Centre for Teaching Excellence at cte@uwaterloo.ca and provide us with your accommodation needs as soon as possible."]\n        },\n        {\n            "code": "Need for Clarity on University Housing Policies",\n            "definition": "Concerns or questions about university housing policies, particularly regarding subletting.",\n            "examples": ["Perhaps the housing contract is a good starting place? 5.3 Subletting..."]\n        },\n        {\n            "code": "Difficulty in Landing Co-op Jobs as an Environmental Engineering Student",\n            "definition": "Challenges or difficulties faced by environmental engineering students in securing co-op jobs.",\n            "examples": ["Most people get co-op jobs, traditionally speaking."]\n        },\n        {\n            "code": "Importance of Practical Work Experience for First-Year Students",\n            "definition": "The value and importance of practical work experience for first-year students, particularly in fields like environmental engineering.",\n            "examples": ["It’s a little harder for Stream-4 programs than Stream-8 ones..."]\n        },\n        {\n            "code": "Struggles with Math and Statistical Learning",\n            "definition": "Challenges or difficulties faced by students in understanding math and statistical learning concepts.",\n            "examples": ["If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!"]\n        },\n        {\n            "code": "Community Feedback on GitHub",\n            "definition": "Feedback or discussions about using GitHub for project websites, including issues with HTTPS access.",\n            "examples": ["In order to get your website on GitHub to use HTTPS instead of HTTP..."]\n        },\n        {\n            "code": "Linguistic Observations on Abbreviations",\n            "definition": "Observations or comments about the use of abbreviations in language, such as \'thnx\' instead of \'thanks\'.",\n            "examples": ["ur the first person on earth that ive seen who abbreviates thanks as thnx"]\n        },\n        {\n            "code": "Housing Dilemma and Subletting Questions",\n            "definition": "Questions or concerns about university housing policies, particularly regarding subletting.",\n            "examples": ["I’ve already rent a place for winter term, not knowing my contract was for entire year..."]\n        },\n        {\n            "code": "University Housing Policies and Subletting",\n            "definition": "Concerns or questions about university housing policies, particularly regarding subletting.",\n            "examples": ["Perhaps the housing contract is a good starting place? 5.3 Subletting..."]\n        },\n        {\n            "code": "Course Recommendations for Machine Learning",\n            "definition": "Recommendations or discussions about course recommendations for machine learning, including CO courses like CO 367 or CO 466/463.",\n            "examples": ["Would you recommend taking CO 367 or taking one of CO 466 or 463 instead..."]\n        },\n        {\n            "code": "Prerequisites and Preparedness for Co-op Courses",\n            "definition": "Questions or concerns about prerequisites and preparedness for co-op courses, including the importance of having a strong foundation in math and statistics.",\n            "examples": ["Would you know if the 80% average as a prerequisite is strictly enforced?"]\n        },\n        {\n            "code": "Encouragement to Pursue Machine Learning",\n            "definition": "Encouragement or support for pursuing machine learning, particularly for students who may be intimidated by math and statistical concepts.",\n            "examples": ["If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!"]\n        }\n    ],\n    "recoded_transcript": [\n        {\n            "segment": "Can someone please share the course outline for Stat441 for Winter 2023 term?",\n            "code": "Course Recommendations for Machine Learning"\n        },\n        {\n            "segment": "(Comment 1019969) you\'re already really late to the game for summer 2023 internships...",\n            "code": "Application Timeline Concerns"\n        },\n        {\n            "segment": "(Comment 1019969) Are you aware that your project websites can\'t be accessed?",\n            "code": "Technical Issues with Project Websites"\n        },\n        {\n            "segment": "To request accommodations for your course materials in an alternative format, please contact the Centre for Teaching Excellence at cte@uwaterloo.ca and provide us with your accommodation needs as soon as possible.",\n            "code": "Importance of Requesting Accommodations in Alternative Formats"\n        },\n        {\n            "segment": "(Comment 100axnj) Perhaps the housing contract is a good starting place? 5.3 Subletting...",\n            "code": "University Housing Policies and Subletting"\n        },\n        {\n            "segment": "(Post 1008z9h) Most people get co-op jobs, traditionally speaking.",\n            "code": "Difficulty in Landing Co-op Jobs as an Environmental Engineering Student"\n        },\n        {\n            "segment": "(Comment 1008z9h) It’s a little harder for Stream-4 programs than Stream-8 ones...",\n            "code": "Importance of Practical Work Experience for First-Year Students"\n        },\n        {\n            "segment": "(Comment 100c5lc) If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!",\n            "code": "Encouragement to Pursue Machine Learning"\n        }\n    ]\n}',
    '{\n    "unified_codebook": [\n        {\n            "code": "Application Process Challenges",\n            "definition": "Challenges faced by students during the application process, including technical issues and support.",\n            "examples": ["Would you guys mind sharing your dev portfolios? I\'m looking to give mine an overhaul..."]\n        },\n        {\n            "code": "Late Submission Consequences",\n            "definition": "Consequences of late submissions, such as missing opportunities for co-op jobs or academic pressure.",\n            "examples": ["you\'re already really late to the game for summer 2023 internships..."]\n        },\n        {\n            "code": "Technical Issues and Support",\n            "definition": "Technical issues that students face during the application process, including website access and GitHub support.",\n            "examples": ["Are you aware that your project websites can\'t be accessed?"]\n        },\n        {\n            "code": "Code Reviews and Feedback",\n            "definition": "Feedback and code reviews provided by peers or mentors to improve coding skills.",\n            "examples": ["In order to get your website on GitHub to use HTTPS instead of HTTP..."]\n        },\n        {\n            "code": "Humor and Sarcasm in Code Comments",\n            "definition": "Use of humor and sarcasm in code comments, including jokes about math competitions or programming challenges.",\n            "examples": ["its like one of those websites thats like \'download elden ring for android\'..."]\n        },\n        {\n            "code": "Linguistic Observations and Abbreviations",\n            "definition": "Observations about linguistic patterns, including abbreviations or informal language used in code comments.",\n            "examples": ["ur the first person on earth that ive seen who abbreviates thanks as thnx"]\n        },\n        {\n            "code": "Co-op Job Search Challenges",\n            "definition": "Challenges faced by students during their co-op job search, including difficulty finding suitable jobs or navigating university housing policies.",\n            "examples": ["Most people get co-op jobs, traditionally speaking..."]\n        },\n        {\n            "code": "First-Year Student Challenges",\n            "definition": "Challenges faced by first-year students, including difficulties with co-op job searches or academic pressure.",\n            "examples": ["How difficult is it to land a coop in first year if you have no practical work experience..."]\n        },\n        {\n            "code": "Advice on Applications and Job Searches",\n            "definition": "Advice provided by peers or mentors on how to improve applications, including tailoring resumes or applying early.",\n            "examples": ["You’d just have to apply to jobs as early as possible and tailor your resume..."]\n        },\n        {\n            "code": "Reassurance and Confidence in the Application Process",\n            "definition": "Reassurance provided by peers or mentors to boost confidence during the application process, including encouragement to pursue interests.",\n            "examples": ["If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!"]\n        },\n        {\n            "code": "Housing Dilemma",\n            "definition": "Challenges faced by students regarding university housing policies, including difficulties with subletting or finding suitable accommodations.",\n            "examples": ["I’ve already rent a place for winter term, not knowing my contract was for entire year..."]\n        },\n        {\n            "code": "University Housing Policies",\n            "definition": "Policies and regulations related to university housing, including subletting and accommodation options.",\n            "examples": ["Perhaps the housing contract is a good starting place? 5.3 Subletting..."]\n        },\n        {\n            "code": "Course Recommendations",\n            "definition": "Recommendations provided by peers or mentors on which courses are useful for learning machine learning, including course content and prerequisites.",\n            "examples": ["Therefore, I was wondering which CO courses...are useful in learning machine learning?"]\n        },\n        {\n            "code": "Mathematical Insights",\n            "definition": "Insights gained from mathematical concepts, including prime factorization or Fibonacci sequences.",\n            "examples": ["Oop 17 x 17 x 7"]\n        }\n    ],\n    "recoded_transcript": [\n        {\n            "segment": "Was going to but tried applying to join like a day after sign up deadlines.",\n            "code": "Application Process Challenges"\n        },\n        {\n            "segment": "\\"I\'m also in CS 1b and was planning on attending. But I don\'t know anyone else going and don\'t have a team so I\'m wondering if I should still go\\".",\n            "code": "Co-op Job Search Challenges"\n        },\n        {\n            "segment": "\\"you\'re already really late to the game for summer 2023 internships...\\"",\n            "code": "Late Submission Consequences"\n        },\n        {\n            "segment": "\\"Are you aware that your project websites can\'t be accessed?\\".",\n            "code": "Technical Issues and Support"\n        }\n    ]\n}',
    '{\n    "unified_codebook": [\n        {\n            "code": "Academic Stress",\n            "definition": "Feeling overwhelmed or anxious about academic performance or future prospects.",\n            "examples": ["I’m going into my first year of environmental engineering this September... Most people get co-op jobs, traditionally speaking."]\n        },\n        {\n            "code": "Career Preparation and Application Timeline Concerns",\n            "definition": "Concerns about preparing for career opportunities and managing application timelines.",\n            "examples": ["Would you guys mind sharing your dev portfolios? I\'m looking to give mine an overhaul... you\'re already really late to the game for summer 2023 internships."]\n        },\n        {\n            "code": "Technical Issues",\n            "definition": "Frustration or difficulties with technical aspects of academic work, such as website access or software issues.",\n            "examples": ["Are you aware that your project websites can\'t be accessed? just found out free tier of Heroku is not a thing anymore. wtf"]\n        },\n        {\n            "code": "Community Feedback and Guidance",\n            "definition": "Seeking advice, feedback, or guidance from peers or online communities.",\n            "examples": ["In order to get your website on GitHub to use HTTPS instead of HTTP..."]\n        },\n        {\n            "code": "Humor and Sarcasm",\n            "definition": "Using humor or sarcasm in online interactions to cope with stress or frustration.",\n            "examples": ["its like one of those websites thats like \'download elden ring for android\'... math competition participants scrambling to find the prime factorization of 2023..."]\n        },\n        {\n            "code": "Linguistic Observations",\n            "definition": "Noticing unusual language use or abbreviations in online interactions.",\n            "examples": ["ur the first person on earth that ive seen who abbreviates thanks as thnx"]\n        },\n        {\n            "code": "Co-op Job Search and Expectations",\n            "definition": "Concerns about finding co-op jobs or managing expectations around job placement.",\n            "examples": ["Most people get co-op jobs, traditionally speaking... How difficult is it to land a coop in first year if you have no practical work experience..."]\n        },\n        {\n            "code": "First-Year Challenges",\n            "definition": "Concerns about navigating university life, including academic expectations and personal struggles.",\n            "examples": ["How difficult is it to land a coop in first year if you have no practical work experience... It’s a little harder for Stream-4 programs than Stream-8 ones."]\n        },\n        {\n            "code": "Advice on Applications",\n            "definition": "Seeking guidance or advice on applying for jobs or career opportunities.",\n            "examples": ["You’d just have to apply to jobs as early as possible and tailor your resume... Max out your apps each cycle (50) since the first 2 rounds have the best jobs."]\n        },\n        {\n            "code": "Reassurance",\n            "definition": "Seeking reassurance or encouragement from peers or online communities.",\n            "examples": ["You should be fine! There are a few jobs specifically for env eng... Hope 2023 gets better for ya"]\n        },\n        {\n            "code": "Administrative Notes",\n            "definition": "Noticing unusual or unclear information in online interactions, such as auto-moderator responses.",\n            "examples": ["AutoModerator thinks you\'re asking about admissions..."]\n        },\n        {\n            "code": "Housing Dilemma",\n            "definition": "Concerns about university housing policies and subletting arrangements.",\n            "examples": ["I’ve already rent a place for winter term, not knowing my contract was for entire year... society 145"]\n        },\n        {\n            "code": "Subletting Questions",\n            "definition": "Seeking clarification or advice on subletting university residences.",\n            "examples": ["Is it possible to give someone rent for V1(single room)? I’m willing to give it in cheaper price."]\n        },\n        {\n            "code": "University Housing Policies",\n            "definition": "Concerns about understanding and navigating university housing policies.",\n            "examples": ["Perhaps the housing contract is a good starting place? 5.3 Subletting..."]\n        },\n        {\n            "code": "Advice on Problem-Solving",\n            "definition": "Seeking guidance or advice on problem-solving strategies.",\n            "examples": ["Realistically no one is going to know unless they draw enough attention..."]\n        },\n        {\n            "code": "Expressions of Emotion",\n            "definition": "Noticing emotional expressions or language use in online interactions.",\n            "examples": ["T ^ T"]\n        },\n        {\n            "code": "Course Recommendations",\n            "definition": "Seeking advice or recommendations on course selection, particularly for machine learning courses.",\n            "examples": ["Therefore, I was wondering which CO courses...are useful in learning machine learning?"]\n        },\n        {\n            "code": "Course Content",\n            "definition": "Noticing the content or structure of courses, including their relevance to academic goals.",\n            "examples": ["CO 466(continuous optimization) teaches about unconstrained, constrained..."]\n        },\n        {\n            "code": "Course Workload",\n            "definition": "Concerns about course workload and its impact on academic performance.",\n            "examples": ["CO 367 - decent as you would expect from a 3rd year CO course..."]\n        },\n        {\n            "code": "Prerequisites and Preparedness",\n            "definition": "Concerns about prerequisites for courses or one\'s preparedness for them.",\n            "examples": ["Would you know if the 80% average as a prerequisite is strictly enforced? Dw too much about first year. I did terrible too."]\n        },\n        {\n            "code": "Encouragement",\n            "definition": "Seeking encouragement or support from peers or online communities.",\n            "examples": ["If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!"]\n        },\n        {\n            "code": "Personal Experience",\n            "definition": "Sharing personal experiences or insights related to academic challenges.",\n            "examples": ["The thing is I am a student of statistics with main interest in statistical learning..."]\n        },\n        {\n            "code": "Numerical Observations",\n            "definition": "Noticing numerical patterns or observations, such as prime numbers.",\n            "examples": ["2023 is not a prime number. Sorry not sorry to spoil the beginning of a new year"]\n        },\n        {\n            "code": "Personal Reflections",\n            "definition": "Sharing personal reflections or insights about past experiences.",\n            "examples": ["2022 was not a good year either, at least for me."]\n        },\n        {\n            "code": "Community Humor",\n            "definition": "Noticing humor or lightheartedness in online interactions.",\n            "examples": ["math competition participants scrambling to find the prime factorization of 2023..."]\n        },\n        {\n            "code": "Mathematical Insights",\n            "definition": "Noticing mathematical insights or problem-solving strategies.",\n            "examples": ["Oop 17 x 17 x 7 But 1/1/23 is a Fibonacci date. Happy Fibonacci new year"]\n        }\n    ],\n    "recoded_transcript": [\n        {\n            "segment": "Hi ! I want to prepare for phys 115 as I’ve heard it’s a particularly challenging course. Would anyone be willing to share the lecture notes for this course ? This will be very helpful to prepare from. I am willing to pay if needed. Thank you :)",\n            "code": "Academic Stress"\n        },\n        {\n            "segment": "(Comment 1019969) you\'re already really late to the game for summer 2023 internships...",\n            "code": "Career Preparation and Application Timeline Concerns"\n        },\n        {\n            "segment": "(Comment 1019969) Are you aware that your project websites can\'t be accessed? just found out free tier of Heroku is not a thing anymore. wtf",\n            "code": "Technical Issues"\n        },\n        {\n            "segment": "(Comment 100c5lc) Hope 2023 gets better for ya",\n            "code": "Reassurance"\n        },\n        {\n            "segment": "(Post 1008z9h) I’m going into my first year of environmental engineering this September...",\n            "code": "Co-op Job Search and Expectations"\n        },\n        {\n            "segment": "(Comment 100c5lc) math competition participants scrambling to find the prime factorization of 2023...",\n            "code": "Community Humor"\n        }\n    ]\n}',
    '{\n    "unified_codebook": [\n        {\n            "code": "Financial Incentives",\n            "definition": "Referral process incentives for students who refer friends to Fenwick accommodation.",\n            "examples": ["The referral process doesn’t help you get in as far I know, but it does give me money if you do get in and I “referred you”"]\n        },\n        {\n            "code": "Application Timeline Concerns",\n            "definition": "Concerns about the application timeline for summer 2023 internships.",\n            "examples": ["you\'re already really late to the game for summer 2023 internships..."]\n        },\n        {\n            "code": "Technical Issues",\n            "definition": "Technical issues with project websites, such as access problems or errors.",\n            "examples": ["Are you aware that your project websites can\'t be accessed?"]\n        },\n        {\n            "code": "Community Feedback",\n            "definition": "Feedback from students about the community and its impact on their experience.",\n            "examples": ["In order to get your website on GitHub to use HTTPS instead of HTTP..."]\n        },\n        {\n            "code": "Linguistic Observations",\n            "definition": "Observations about language usage, such as abbreviations or colloquialisms.",\n            "examples": ["ur the first person on earth that ive seen who abbreviates thanks as thnx"]\n        },\n        {\n            "code": "Co-op Job Search",\n            "definition": "Concerns and observations about co-op job search processes.",\n            "examples": ["Most people get co-op jobs, traditionally speaking..."]\n        },\n        {\n            "code": "First-Year Challenges",\n            "definition": "Challenges faced by first-year students in their academic journey.",\n            "examples": ["How difficult is it to land a coop in first year if you have no practical work experience..."]\n        },\n        {\n            "code": "Advice on Applications",\n            "definition": "Advice given to students about applying for jobs or internships.",\n            "examples": ["You’d just have to apply to jobs as early as possible and tailor your resume..."]\n        },\n        {\n            "code": "Reassurance",\n            "definition": "Statements of reassurance or encouragement from students.",\n            "examples": ["You should be fine! There are a few jobs specifically for env eng..."]\n        },\n        {\n            "code": "Administrative Notes",\n            "definition": "Notes about administrative processes, such as admissions or housing policies.",\n            "examples": ["AutoModerator thinks you\'re asking about admissions..."]\n        },\n        {\n            "code": "Housing Dilemma",\n            "definition": "Concerns and questions about housing options and subletting.",\n            "examples": ["I’ve already rent a place for winter term, not knowing my contract was for entire year..."]\n        },\n        {\n            "code": "Subletting Questions",\n            "definition": "Questions about subletting or renting out university residence.",\n            "examples": ["Is it possible to give someone rent for V1(single room)? I’m willing to give it in cheaper price."]\n        },\n        {\n            "code": "University Housing Policies",\n            "definition": "Policies and procedures related to university housing.",\n            "examples": ["Perhaps the housing contract is a good starting place? 5.3 Subletting..."]\n        },\n        {\n            "code": "Advice on Problem-Solving",\n            "definition": "Advice given to students about problem-solving or critical thinking.",\n            "examples": ["Realistically no one is going to know unless they draw enough attention..."]\n        },\n        {\n            "code": "Expressions of Emotion",\n            "definition": "Emotions expressed by students, such as excitement or frustration.",\n            "examples": ["T ^ T"]\n        },\n        {\n            "code": "Course Recommendations",\n            "definition": "Recommendations for courses that are useful for learning machine learning.",\n            "examples": ["Therefore, I was wondering which CO courses...are useful in learning machine learning?"]\n        },\n        {\n            "code": "Course Content",\n            "definition": "Content of courses related to computer science or engineering.",\n            "examples": ["CO 466(continuous optimization) teaches about unconstrained, constrained..."]\n        },\n        {\n            "code": "Course Workload",\n            "definition": "Perceptions of course workload and difficulty.",\n            "examples": ["CO 367 - decent as you would expect from a 3rd year CO course"]\n        },\n        {\n            "code": "Prerequisites and Preparedness",\n            "definition": "Concerns about prerequisites or preparedness for courses.",\n            "examples": ["Would you know if the 80% average as a prerequisite is strictly enforced?"]\n        },\n        {\n            "code": "Encouragement",\n            "definition": "Statements of encouragement or support from students.",\n            "examples": ["If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!"]\n        },\n        {\n            "code": "Personal Experience",\n            "definition": "Personal experiences and anecdotes shared by students.",\n            "examples": ["The thing is I am a student of statistics with main interest in statistical learning..."]\n        },\n        {\n            "code": "Numerical Observations",\n            "definition": "Observations about numerical data or patterns.",\n            "examples": ["2023 is not a prime number. Sorry not sorry to spoil the beginning of a new year"]\n        },\n        {\n            "code": "Personal Reflections",\n            "definition": "Personal reflections and thoughts shared by students.",\n            "examples": ["2022 was not a good year either, at least for me."]\n        },\n        {\n            "code": "Community Humor",\n            "definition": "Humor or jokes shared within the community.",\n            "examples": ["math competition participants scrambling to find the prime factorization of 2023..."]\n        },\n        {\n            "code": "Mathematical Insights",\n            "definition": "Insights or observations about mathematical concepts.",\n            "examples": ["Oop 17 x 17 x 7"]\n        },\n        {\n            "code": "Fenwick Referral Process",\n            "definition": "Referral process for Fenwick accommodation and its implications.",\n            "examples": ["Is anyone able to refer my friends and I into Fenwick for September?"]\n        }\n    ],\n    "recoded_transcript": [\n        {\n            "segment": "Is anyone able to refer my friends and I into Fenwick for September? Does the referral process make it more likely to secure a place? Thanks!",\n            "code": "Financial Incentives"\n        },\n        {\n            "segment": "(Comment 1019969) you\'re already really late to the game for summer 2023 internships...",\n            "code": "Application Timeline Concerns"\n        },\n        {\n            "segment": "(Comment 1019969) Are you aware that your project websites can\'t be accessed?",\n            "code": "Technical Issues"\n        },\n        {\n            "segment": "(Comment 1019969) In order to get your website on GitHub to use HTTPS instead of HTTP...",\n            "code": "Community Feedback"\n        },\n        {\n            "segment": "(Comment 1019969) ur the first person on earth that ive seen who abbreviates thanks as thnx",\n            "code": "Linguistic Observations"\n        },\n        {\n            "segment": "(Post 1008z9h) I\'m going into my first year of environmental engineering this September...",\n            "code": "Co-op Job Search"\n        },\n        {\n            "segment": "(Comment 1019969) How difficult is it to land a coop in first year if you have no practical work experience...",\n            "code": "First-Year Challenges"\n        },\n        {\n            "segment": "(Comment 1008z9h) You’d just have to apply to jobs as early as possible and tailor your resume...",\n            "code": "Advice on Applications"\n        },\n        {\n            "segment": "(Comment 100c5lc) You should be fine! There are a few jobs specifically for env eng...",\n            "code": "Reassurance"\n        },\n        {\n            "segment": "(Comment 1019969) AutoModerator thinks you\'re asking about admissions...",\n            "code": "Administrative Notes"\n        },\n        {\n            "segment": "(Post 100axnj) I’ve already rent a place for winter term, not knowing my contract was for entire year...",\n            "code": "Housing Dilemma"\n        },\n        {\n            "segment": "(Comment 100axnj) Is it possible to give someone rent for V1(single room)? I’m willing to give it in cheaper price.",\n            "code": "Subletting Questions"\n        },\n        {\n            "segment": "(Comment 100axnj) Perhaps the housing contract is a good starting place? 5.3 Subletting...",\n            "code": "University Housing Policies"\n        },\n        {\n            "segment": "(Comment 100b8t3) If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!",\n            "code": "Encouragement"\n        },\n        {\n            "segment": "(Post 100b8t3) Therefore, I was wondering which CO courses...are useful in learning machine learning?",\n            "code": "Course Recommendations"\n        },\n        {\n            "segment": "(Comment 100b8t3) CO 466(continuous optimization) teaches about unconstrained, constrained...",\n            "code": "Course Content"\n        },\n        {\n            "segment": "(Comment 100b8t3) CO 367 - decent as you would expect from a 3rd year CO course",\n            "code": "Course Workload"\n        },\n        {\n            "segment": "(Comment 100b8t3) Would you know if the 80% average as a prerequisite is strictly enforced?",\n            "code": "Prerequisites and Preparedness"\n        }\n    ]\n}',
    '{\n    "unified_codebook": [\n        {\n            "code": "Campus Navigation",\n            "definition": "The process of getting to campus from downtown Waterloo, including using public transportation, taxis/ride-hailing services, walking, or biking.",\n            "examples": ["The most convenient way to get to campus from downtown Waterloo is by using public transportation, such as bus 7 or 8, or taking a taxi/ride-hailing service."]\n        },\n        {\n            "code": "Accommodation Process",\n            "definition": "The process of requesting accommodations for course materials in an alternative format.",\n            "examples": ["To request accommodations for your course materials in an alternative format, please contact the Centre for Teaching Excellence at cte@uwaterloo.ca and provide us with your accommodation needs as soon as possible."]\n        },\n        {\n            "code": "Parking Permits",\n            "definition": "The process of requesting a parking permit.",\n            "examples": ["To request a parking permit, please visit the University of Waterloo\'s Parking Services website and follow the online application process."]\n        },\n        {\n            "code": "Public Transportation",\n            "definition": "The use of public transportation to get around campus without a car.",\n            "examples": ["The best way to get around campus without a car is by using public transportation, walking, or biking."]\n        },\n        {\n            "code": "Student Email",\n            "definition": "Accessing student email through the UWaterloo email portal.",\n            "examples": ["To access your student email account, please log in to the UWaterloo email portal using your university username and password."]\n        },\n        {\n            "code": "Co-op Job Search",\n            "definition": "The process of finding a co-op job, including searching for job openings and applying.",\n            "examples": ["Most people get co-op jobs, traditionally speaking..."]\n        },\n        {\n            "code": "University Library Hours",\n            "definition": "The hours of operation for the University Library, which vary depending on the semester.",\n            "examples": ["The hours of operation for the University Library vary depending on the semester. Please check the library\'s website for specific hours during your term."]\n        },\n        {\n            "code": "Meeting with Professors",\n            "definition": "Requesting a meeting with a professor, including emailing or visiting office hours.",\n            "examples": ["To request a meeting with a professor, please email them directly or visit their office hours. Be sure to include your name, course number, and reason for the meeting in your email."]\n        },\n        {\n            "code": "Housing Options",\n            "definition": "Exploring housing options, including renting and subletting.",\n            "examples": ["I’ve already rent a place for winter term, not knowing my contract was for entire year..."]\n        },\n        {\n            "code": "Subletting Restrictions",\n            "definition": "Understanding restrictions on subletting university residence.",\n            "examples": ["Perhaps the housing contract is a good starting place? 5.3 Subletting..."]\n        },\n        {\n            "code": "University Housing Policies",\n            "definition": "Familiarizing oneself with university housing policies, including subletting and accommodation processes.",\n            "examples": ["Sublet the other res cause you can\'t sublet university residence."]\n        },\n        {\n            "code": "Course Recommendations",\n            "definition": "Receiving advice on course recommendations for learning machine learning, including CO courses.",\n            "examples": ["Would you recommend taking CO 367 or taking one of CO 466 or 463 instead..."]\n        },\n        {\n            "code": "Campus Life Advice",\n            "definition": "Receiving advice on campus life, including navigating student life and co-op job search.",\n            "examples": ["If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!"]\n        }\n    ],\n    "recoded_transcript": [\n        {\n            "segment": "The most convenient way to get to campus from downtown Waterloo is by using public transportation, such as bus 7 or 8, or taking a taxi/ride-hailing service.",\n            "code": "Campus Navigation"\n        },\n        {\n            "segment": "To request accommodations for your course materials in an alternative format, please contact the Centre for Teaching Excellence at cte@uwaterloo.ca and provide us with your accommodation needs as soon as possible.",\n            "code": "Accommodation Process"\n        },\n        {\n            "segment": "To request a parking permit, please visit the University of Waterloo\'s Parking Services website and follow the online application process.",\n            "code": "Parking Permits"\n        },\n        {\n            "segment": "The best way to get around campus without a car is by using public transportation, walking, or biking.",\n            "code": "Public Transportation"\n        },\n        {\n            "segment": "To access your student email account, please log in to the UWaterloo email portal using your university username and password.",\n            "code": "Student Email"\n        },\n        {\n            "segment": "Most people get co-op jobs, traditionally speaking...",\n            "code": "Co-op Job Search"\n        },\n        {\n            "segment": "The hours of operation for the University Library vary depending on the semester. Please check the library\'s website for specific hours during your term.",\n            "code": "University Library Hours"\n        },\n        {\n            "segment": "To request a meeting with a professor, please email them directly or visit their office hours. Be sure to include your name, course number, and reason for the meeting in your email.",\n            "code": "Meeting with Professors"\n        },\n        {\n            "segment": "I’ve already rent a place for winter term, not knowing my contract was for entire year...",\n            "code": "Housing Options"\n        },\n        {\n            "segment": "Perhaps the housing contract is a good starting place? 5.3 Subletting...",\n            "code": "Subletting Restrictions"\n        },\n        {\n            "segment": "Sublet the other res cause you can\'t sublet university residence.",\n            "code": "University Housing Policies"\n        },\n        {\n            "segment": "Would you recommend taking CO 367 or taking one of CO 466 or 463 instead...",\n            "code": "Course Recommendations"\n        },\n        {\n            "segment": "If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!",\n            "code": "Campus Life Advice"\n        }\n    ]\n}',
    '{\n    "unified_codebook": [\n        {\n            "code": "Struggles with application process",\n            "definition": "Difficulty or frustration with the job application process, including late submission of applications.",\n            "examples": ["you\'re already really late to the game for summer 2023 internships..."]\n        },\n        {\n            "code": "Technical issues and frustration",\n            "definition": "Experiences with technical difficulties or frustrations related to project websites, GitHub, or other digital platforms.",\n            "examples": ["Are you aware that your project websites can\'t be accessed?"]\n        },\n        {\n            "code": "Community feedback and guidance",\n            "definition": "Receiving advice, suggestions, or support from peers or online communities regarding course materials, applications, or career development.",\n            "examples": ["In order to get your website on GitHub to use HTTPS instead of HTTP..."]\n        },\n        {\n            "code": "Humor and sarcasm in online interactions",\n            "definition": "The use of humor or sarcasm in online conversations, including social media, comments, or forums.",\n            "examples": ["its like one of those websites thats like \'download elden ring for android\'..."]\n        },\n        {\n            "code": "Linguistic observations and cultural differences",\n            "definition": "Noticing unusual language patterns, abbreviations, or cultural references in online interactions.",\n            "examples": ["ur the first person on earth that ive seen who abbreviates thanks as thnx"]\n        },\n        {\n            "code": "Co-op job search and expectations",\n            "definition": "Concerns or difficulties with finding co-op jobs, including uncertainty about job availability or preparation for the application process.",\n            "examples": ["Most people get co-op jobs, traditionally speaking..."]\n        },\n        {\n            "code": "First-year challenges and experiences",\n            "definition": "Struggles or difficulties faced by first-year students, including lack of practical work experience or uncertainty about course materials.",\n            "examples": ["How difficult is it to land a coop in first year if you have no practical work experience..."]\n        },\n        {\n            "code": "Advice on applications and preparation",\n            "definition": "Receiving guidance or advice on how to prepare for job applications, including tips on resume-building, interview skills, or networking.",\n            "examples": ["You’d just have to apply to jobs as early as possible and tailor your resume..."]\n        },\n        {\n            "code": "Reassurance and encouragement from peers",\n            "definition": "Receiving support or reassurance from peers or online communities regarding career development, including advice on overcoming challenges or staying motivated.",\n            "examples": ["If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!"]\n        },\n        {\n            "code": "Personal reflections and experiences",\n            "definition": "Sharing personal thoughts, feelings, or experiences related to the topic, including challenges, successes, or lessons learned.",\n            "examples": ["2022 was not a good year either, at least for me."]\n        }\n    ],\n    "recoded_transcript": [\n        {\n            "segment": "Bro not everyone is trying to get with you lol",\n            "code": "Humor and sarcasm in online interactions"\n        },\n        {\n            "segment": "Y’ll do anything except converse with a girl in person",\n            "code": "Overthinking and anxiety about social interactions"\n        },\n        {\n            "segment": "is this \\"girl\\" in the room with us right now?",\n            "code": "Co-op job search and expectations"\n        },\n        {\n            "segment": "It’s time for you to play out all possible scenarios in your head. Develop a virtual conversation with her in your mind, feel bad that didn’t happen, realize you are single, cry yourself to sleep, get over it and move on with your life.",\n            "code": "Advice on applications"\n        },\n        {\n            "segment": "How come attractive females dont come and talk to me?",\n            "code": "Overthinking and anxiety about social interactions"\n        },\n        {\n            "segment": "least desperate uw student",\n            "code": "Humor and sarcasm in online interactions"\n        },\n        {\n            "segment": "I’m her. It was nice to meet u but my phone is kinda broken rn.",\n            "code": "Community feedback and guidance"\n        },\n        {\n            "segment": "[deleted]",\n            "code": "Technical issues"\n        },\n        {\n            "segment": "Damn :(( Been applying since Sept tho, got a couple OA\'s but not a single interview...",\n            "code": "Application Timeline Concerns"\n        },\n        {\n            "segment": "you\'re already really late to the game for summer 2023 internships...",\n            "code": "Struggles with application process"\n        },\n        {\n            "segment": "- Are you aware that your project websites can\'t be accessed?",\n            "code": "Technical issues and frustration"\n        },\n        {\n            "segment": "just found out free tier of Heroku is not a thing anymore. wtf",\n            "code": "Technical issues"\n        },\n        {\n            "segment": "- In order to get your website on GitHub to use HTTPS instead of HTTP...",\n            "code": "Community feedback and guidance"\n        },\n        {\n            "segment": "its like one of those websites thats like \'download elden ring for android\'...",\n            "code": "Humor and sarcasm in online interactions"\n        },\n        {\n            "segment": "math competition participants scrambling to find the prime factorization of 2023...",\n            "code": "Community humor and lightheartedness"\n        },\n        {\n            "segment": "Oop 17 x 17 x 7",\n            "code": "Mathematical insights"\n        },\n        {\n            "segment": "[deleted]",\n            "code": "Administrative Notes"\n        },\n        {\n            "segment": "I’ve already rent a place for winter term, not knowing my contract was for entire year...",\n            "code": "Housing Dilemma"\n        },\n        {\n            "segment": "society 145",\n            "code": "Housing Dilemma"\n        },\n        {\n            "segment": "Is it possible to give someone rent for V1(single room)? I’m willing to give it in cheaper price.",\n            "code": "Subletting Questions"\n        },\n        {\n            "segment": "I have a friend in lives in V1 but is suppose to be in REV...",\n            "code": "Subletting Questions"\n        },\n        {\n            "segment": "Perhaps the housing contract is a good starting place? 5.3 Subletting...",\n            "code": "University Housing Policies"\n        },\n        {\n            "segment": "Sublet the other res cause you can’t sublet university residence.",\n            "code": "University Housing Policies"\n        },\n        {\n            "segment": "Realistically no one is going to know unless they draw enough attention...",\n            "code": "Advice on problem-solving"\n        },\n        {\n            "segment": "T ^ T",\n            "code": "Expressions of emotion"\n        },\n        {\n            "segment": "Therefore, I was wondering which CO courses...are useful in learning machine learning?",\n            "code": "Course recommendations"\n        },\n        {\n            "segment": "Would you recommend taking CO 367 or taking one of CO 466 or 463 instead...",\n            "code": "Course recommendations"\n        },\n        {\n            "segment": "CO 466(continuous optimization) teaches about unconstrained, constrained...",\n            "code": "Course content"\n        },\n        {\n            "segment": "CO 367 - decent as you would expect from a 3rd year CO course...",\n            "code": "Course workload"\n        },\n        {\n            "segment": "Would you know if the 80% average as a prerequisite is strictly enforced?",\n            "code": "Prerequisites and preparedness"\n        },\n        {\n            "segment": "Dw too much about first year. I did terrible too...",\n            "code": "Prerequisites and preparedness"\n        },\n        {\n            "segment": "If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!",\n            "code": "Reassurance"\n        },\n        {\n            "segment": "The thing is I am a student of statistics with main interest in statistical learning...",\n            "code": "Personal experience"\n        },\n        {\n            "segment": "2023 is not a prime number. Sorry not sorry to spoil the beginning of a new year 😘🤓",\n            "code": "Numerical observations"\n        },\n        {\n            "segment": "2022 was not a good year either, at least for me.",\n            "code": "Personal reflections"\n        }\n    ]\n}',
    '{\n    "unified_codebook": [\n        {\n            "code": "Academic Accommodations",\n            "definition": "Requests for accommodations for course materials in an alternative format.",\n            "examples": ["To request accommodations for your course materials in an alternative format, please contact the Centre for Teaching Excellence at cte@uwaterloo.ca and provide us with your accommodation needs as soon as possible."]\n        },\n        {\n            "code": "Academic Pressure",\n            "definition": "Pressure to perform academically.",\n            "examples": ["If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!"]\n        },\n        {\n            "code": "Application Timeline Concerns",\n            "definition": "Concerns about applying for jobs or internships on time.",\n            "examples": ["you\'re already really late to the game for summer 2023 internships..."]\n        },\n        {\n            "code": "Career Preparation",\n            "definition": "Preparing for a career, including developing a portfolio and applying for jobs.",\n            "examples": ["Would you guys mind sharing your dev portfolios? I\'m looking to give mine an overhaul..."]\n        },\n        {\n            "code": "Co-op Job Search Challenges",\n            "definition": "Challenges of finding co-op jobs, including lack of practical experience.",\n            "examples": ["Most people get co-op jobs, traditionally speaking..."]\n        },\n        {\n            "code": "Community Feedback and Support",\n            "definition": "Seeking feedback and support from others in a community or online forum.",\n            "examples": ["In order to get your website on GitHub to use HTTPS instead of HTTP..."]\n        },\n        {\n            "code": "Course Recommendations and Preparation",\n            "definition": "Getting recommendations for courses and preparing for them.",\n            "examples": ["Would you recommend taking CO 367 or taking one of CO 466 or 463 instead..."]\n        },\n        {\n            "code": "Finding Alternative Formats",\n            "definition": "Requesting accommodations for course materials in an alternative format.",\n            "examples": ["To request accommodations for your course materials in an alternative format, please contact the Centre for Teaching Excellence at cte@uwaterloo.ca and provide us with your accommodation needs as soon as possible."]\n        },\n        {\n            "code": "Housing Dilemmas",\n            "definition": "Dilemmas related to housing, including finding a place to live.",\n            "examples": ["I’ve already rent a place for winter term, not knowing my contract was for entire year..."]\n        },\n        {\n            "code": "Mathematical Insights and Challenges",\n            "definition": "Insights into mathematical concepts and challenges in applying them.",\n            "examples": ["Oop 17 x 17 x 7", "math competition participants scrambling to find the prime factorization of 2023..."]\n        },\n        {\n            "code": "Prerequisites and Preparedness",\n            "definition": "Concerns about prerequisites for courses and preparedness for them.",\n            "examples": ["Would you know if the 80% average as a prerequisite is strictly enforced?"]\n        },\n        {\n            "code": "Subletting Questions",\n            "definition": "Questions related to subletting, including finding someone to rent from or renting out a place.",\n            "examples": ["Is it possible to give someone rent for V1(single room)? I’m willing to give it in cheaper price."]\n        },\n        {\n            "code": "Technical Issues and Support",\n            "definition": "Issues with technology and seeking support.",\n            "examples": ["Are you aware that your project websites can\'t be accessed?"]\n        }\n    ],\n    "recoded_transcript": [\n        {\n            "segment": "To request accommodations for your course materials in an alternative format, please contact the Centre for Teaching Excellence at cte@uwaterloo.ca and provide us with your accommodation needs as soon as possible.",\n            "code": "Academic Accommodations"\n        },\n        {\n            "segment": "Most people get co-op jobs, traditionally speaking",\n            "code": "Co-op Job Search Challenges"\n        },\n        {\n            "segment": "I’ve already rent a place for winter term, not knowing my contract was for entire year...",\n            "code": "Housing Dilemmas"\n        },\n        {\n            "segment": "To request accommodations for your course materials in an alternative format, please contact the Centre for Teaching Excellence at cte@uwaterloo.ca and provide us with your accommodation needs as soon as possible.",\n            "code": "Finding Alternative Formats"\n        },\n        {\n            "segment": "If you wanna do ML, don’t let the math intimidate you. Learn it when you see it!",\n            "code": "Academic Pressure"\n        },\n        {\n            "segment": "you\'re already really late to the game for summer 2023 internships...",\n            "code": "Application Timeline Concerns"\n        },\n        {\n            "segment": "Would you guys mind sharing your dev portfolios? I\'m looking to give mine an overhaul...",\n            "code": "Career Preparation"\n        },\n        {\n            "segment": "Most people get co-op jobs, traditionally speaking",\n            "code": "Co-op Job Search Challenges"\n        },\n        {\n            "segment": "In order to get your website on GitHub to use HTTPS instead of HTTP...",\n            "code": "Community Feedback and Support"\n        },\n        {\n            "segment": "Would you recommend taking CO 367 or taking one of CO 466 or 463 instead...",\n            "code": "Course Recommendations and Preparation"\n        },\n        {\n            "segment": "I’ve already rent a place for winter term, not knowing my contract was for entire year...",\n            "code": "Housing Dilemmas"\n        },\n        {\n            "segment": "Are you aware that your project websites can\'t be accessed?",\n            "code": "Technical Issues and Support"\n        },\n        {\n            "segment": "To request a parking permit, please visit the University of Waterloo\'s Parking Services website and follow the online application process.",\n            "code": "Parking Permit Request"\n        }\n    ]\n}'
];
