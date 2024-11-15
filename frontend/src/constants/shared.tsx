export enum ROUTES {
    HOME = "#/",
    BASIS = "#/basis",
    WORD_CLOUD = "#/word_cloud",
    NOT_FOUND = "*",
    GENERATION = "#/generation",
    INITIAL_CODING = "#/initial_coding",
    CODING_VALIDATION = "#/coding_validation",
    FINAL = "#/final",
}

export const WORD_CLOUD_MIN_THRESHOLD = 10;

export const initialWords = [
  "JavaScript", "SVG", "CSS", "HTML", "Node", "TypeScript", "GraphQL", "Redux",
  "Python", "Ruby", "Java", "C++", "Go", "Swift", "Kotlin", "Rust", "PHP", "SQL",
  "Django"
];

export const newWordsPool = [
  "Angular", "Vue", "Svelte", "Ember", "Backbone", "JQuery", "Bootstrap",
  "Tailwind", "Materialize", "Bulma", "Foundation", "Semantic", "Ant", "Chakra",
  "styled-components", "Emotion", "JSS", "CSS Modules", "Sass", "Less", "Stylus",
];

export const initialResponses = [
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
  { sentence: "This is the first sentence.", coded_word: "first", comment: "" },
  { sentence: "Another example sentence.", coded_word: "example", comment: "" },
  { sentence: "The validation example continues.", coded_word: "validation", comment: "" },
];


export const mockPosts = [
  {
    id: 1,
    title: "First Post",
    body: "This is the first post content.",
    comments: [
      { id: 101, body: "First comment on first post.", 
        comments: [
          { id: 1011, body: "First reply on first comment.", 
            comments: [
              { id: 10111, body: "First reply on first reply.",
                comments: [
                  { id: 101111, body: "First reply on first reply on first reply." },
                ]},
              { id: 10112, body: "Second reply on first reply." },
            ]},
          { id: 1012, body: "Second reply on first comment.", 
            comments: [
              { id: 10121, body: "First reply on second reply." },
              { id: 10122, body: "Second reply on second reply." },
            ]},
        ]},
      { id: 102, body: "Second comment on first post." },
    ],
  },
  {
    id: 2,
    title: "Second Post",
    body: "This is the second post content.",
    comments: [
      { id: 201, body: "First comment on second post." },
      { id: 202, body: "Second comment on second post." },
    ],
  },
];