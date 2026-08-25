export type ChapterTemplate = {
  era: string;
  title: string;
  subtitle: string;
  questions: string[];
};

export const THEMES = [
  { id: "parchment", label: "Parchment", swatch: "#f5ecdd", ink: "#2b2118" },
  { id: "ink", label: "Ink", swatch: "#1c1a17", ink: "#ece4d4" },
  { id: "sage", label: "Sage", swatch: "#e7ecdf", ink: "#2c3327" },
] as const;

export const CHAPTER_TEMPLATES: ChapterTemplate[] = [
  {
    era: "Roots",
    title: "Where You Began",
    subtitle: "The place and time that formed you",
    questions: [
      "Describe the home you grew up in — walk through it room by room, as if you were a camera.",
      "What did your street or town sound like on an ordinary morning?",
      "What is your earliest memory? Don't worry about accuracy — describe how it feels.",
      "What meal or smell can still take you back to childhood instantly?",
    ],
  },
  {
    era: "Roots",
    title: "The People Who Raised You",
    subtitle: "Family, in all its forms",
    questions: [
      "Describe each of your parents or guardians the way you saw them as a child.",
      "What is a small thing a parent or grandparent used to do or say that you still remember word for word?",
      "Were there traditions in your family — Sunday rituals, holiday customs, rules of the house?",
    ],
  },
  {
    era: "Roots",
    title: "Lessons Learned Early",
    subtitle: "What childhood quietly taught you",
    questions: [
      "What is something you got in trouble for that, in hindsight, taught you something real?",
      "Who was your first best friend, and what did you do together?",
      "What belief about the world did you carry out of childhood that turned out to be true?",
    ],
  },
  {
    era: "Becoming",
    title: "First Independence",
    subtitle: "The first time the world was yours",
    questions: [
      "Describe the day you first left home or felt truly on your own. Where were you, and what did you feel?",
      "What was your first job, and what did it teach you about people?",
      "What was the first thing you ever saved up for and bought yourself?",
    ],
  },
  {
    era: "Becoming",
    title: "Love & Friendship",
    subtitle: "The people you chose",
    questions: [
      "Tell the story of how you met someone who changed your life. Set the scene — the season, the place, small details.",
      "What did love look like when you were young? Has your definition changed?",
      "Is there a friendship you lost or let go of that you still think about?",
    ],
  },
  {
    era: "Becoming",
    title: "The Work That Shaped You",
    subtitle: "What you gave your years to",
    questions: [
      "How did you end up doing the work you did? Was it the plan, or an accident?",
      "Describe a day at work that you are quietly proud of, even if no one noticed.",
      "What did work cost you, and what did it give you?",
    ],
  },
  {
    era: "Turning Points",
    title: "A Decision That Changed Everything",
    subtitle: "The fork in the road",
    questions: [
      "Describe a moment when you had to choose between two very different lives.",
      "What did you almost do instead? Do you ever wonder about that other path?",
      "Who or what gave you the courage — or pushed you — to decide?",
    ],
  },
  {
    era: "Turning Points",
    title: "The Hardest Season",
    subtitle: "What you survived",
    questions: [
      "What was the hardest period of your life, and how did you describe it to yourself while you were inside it?",
      "Who helped you through it — and how, specifically?",
      "What did surviving that season change in you permanently?",
    ],
  },
  {
    era: "Turning Points",
    title: "Your Proudest Hour",
    subtitle: "When you surprised yourself",
    questions: [
      "Describe the moment you were proudest of yourself — the full scene, not just the headline.",
      "Did anyone witness it that day, or was it a private victory?",
      "What would the younger version of you have thought of it?",
    ],
  },
  {
    era: "Legacy",
    title: "What You Believe Now",
    subtitle: "The view from here",
    questions: [
      "What do you believe now that you didn't believe at twenty-five?",
      "What is something everyone seems to believe that you quietly disagree with?",
      "What has gotten more important to you with age? What has fallen away?",
    ],
  },
  {
    era: "Legacy",
    title: "A Message to the Future",
    subtitle: "For the ones who come after",
    questions: [
      "If your great-grandchildren could read only one page of this book, what should it say?",
      "What mistake would you save them from, if you could?",
      "What do you hope they keep — a value, a tradition, a way of being?",
    ],
  },
  {
    era: "Legacy",
    title: "The Story Only You Can Tell",
    subtitle: "What has never been written down",
    questions: [
      "What is a story your family tells at gatherings that has never once been written down?",
      "Is there something you've never told anyone, or almost anyone, that belongs in this book?",
      "Finish the sentence: 'Before it is forgotten, I want it known that…'",
    ],
  },
];

export const HARDCOVER_PAGE_GOAL = 12;
