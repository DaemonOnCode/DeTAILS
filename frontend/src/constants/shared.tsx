export enum ROUTES {
    HOME = "#/",
    BASIS = "#/basis",
    WORD_CLOUD = "#/word_cloud",
    NOT_FOUND = "*",
    GENERATION = "#/generation",
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