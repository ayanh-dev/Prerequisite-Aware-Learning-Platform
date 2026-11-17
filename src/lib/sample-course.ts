import type { LearningConcept, PrerequisiteEdge } from "./learning-graph";

export type SampleConcept = LearningConcept & {
  description: string;
  lesson: string;
  quiz: {
    prompt: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
  };
};

export const sampleConcepts: SampleConcept[] = [
  {
    id: "intro",
    title: "Introduction to C",
    description: "Meet the C language, its compiler, and the shape of a small C program.",
    durationMinutes: 20,
    order: 1,
    lesson: "C programs are compiled into machine code. A basic program starts execution in main and commonly includes standard library headers.",
    quiz: { prompt: "Which function is the usual entry point of a C program?", options: ["start()", "main()", "run()", "init()"], correctOptionIndex: 1, explanation: "Execution of a hosted C program begins in main." },
  },
  {
    id: "variables",
    title: "Variables",
    description: "Store, name, and update values as a program runs.",
    durationMinutes: 20,
    order: 2,
    lesson: "A variable is a named object with a type and a lifetime. Declare it before use, and initialize it before reading its value.",
    quiz: { prompt: "What does int count = 3; do?", options: ["Declares and initializes an integer", "Creates a function", "Prints 3", "Declares a character"], correctOptionIndex: 0, explanation: "The statement declares an int named count and initializes it to 3." },
  },
  {
    id: "data-types",
    title: "Data Types",
    description: "Choose integer, floating-point, and character types for your data.",
    durationMinutes: 25,
    order: 3,
    lesson: "C's fundamental types include char, integer types such as int, and floating-point types such as float and double.",
    quiz: { prompt: "Which type is intended for a single character?", options: ["int", "char", "double", "void"], correctOptionIndex: 1, explanation: "char stores a character-sized integer value, commonly used for character data." },
  },
  {
    id: "operators",
    title: "Operators",
    description: "Combine and compare values with arithmetic, logical, and relational operators.",
    durationMinutes: 25,
    order: 4,
    lesson: "Operators form expressions. Precedence controls grouping, while parentheses make intended evaluation explicit.",
    quiz: { prompt: "What is the result of 7 / 2 when both operands are int?", options: ["3", "3.5", "4", "Undefined"], correctOptionIndex: 0, explanation: "Integer division discards the fractional part, producing 3." },
  },
  {
    id: "input-output",
    title: "Input and Output",
    description: "Read input and format output using standard I/O functions.",
    durationMinutes: 30,
    order: 5,
    lesson: "printf formats output and scanf reads formatted input. Match each conversion specifier to the type of the corresponding argument.",
    quiz: { prompt: "Which printf conversion specifier prints an int?", options: ["%s", "%d", "%f", "%c"], correctOptionIndex: 1, explanation: "%d is used to format an int in printf." },
  },
  {
    id: "conditionals",
    title: "Conditional Statements",
    description: "Choose which statements run with if, else if, and switch.",
    durationMinutes: 25,
    order: 6,
    lesson: "Use if and else to branch on a condition. A switch is useful when comparing one integral expression against several case labels.",
    quiz: { prompt: "Which keyword provides an alternate branch when an if condition is false?", options: ["otherwise", "else", "case", "default"], correctOptionIndex: 1, explanation: "The else branch runs when the associated if condition is false." },
  },
  {
    id: "loops",
    title: "Loops",
    description: "Repeat work with for, while, and do-while loops.",
    durationMinutes: 30,
    order: 7,
    lesson: "A loop repeats a statement while its condition allows. Update loop state so the condition eventually becomes false.",
    quiz: { prompt: "Which loop checks its condition before the first iteration?", options: ["do-while only", "while", "Neither", "Both while and for"], correctOptionIndex: 3, explanation: "Both while and for evaluate their condition before each iteration." },
  },
  {
    id: "arrays",
    title: "Arrays",
    description: "Work with fixed-size, contiguous collections of same-typed elements.",
    durationMinutes: 30,
    order: 8,
    lesson: "Array indexes begin at zero. Access only elements within the declared bounds because C does not perform automatic bounds checks.",
    quiz: { prompt: "What is the index of the first element in a C array?", options: ["0", "1", "-1", "It depends on the type"], correctOptionIndex: 0, explanation: "C arrays are zero-indexed." },
  },
  {
    id: "strings",
    title: "Strings",
    description: "Represent text with null-terminated character arrays.",
    durationMinutes: 30,
    order: 9,
    lesson: "A C string is a sequence of char values terminated by the null character '\\0'. Allocate space for the terminator as well as the visible characters.",
    quiz: { prompt: "What marks the end of a C string?", options: ["A newline", "The null character", "A space", "The last array index"], correctOptionIndex: 1, explanation: "C string functions look for the terminating null character." },
  },
  {
    id: "functions",
    title: "Functions",
    description: "Organize reusable behavior with parameters, return values, and prototypes.",
    durationMinutes: 35,
    order: 10,
    lesson: "A function declaration tells the compiler a function's name, return type, and parameters. A definition supplies its body.",
    quiz: { prompt: "Why declare a function prototype before its first call?", options: ["To tell the compiler its signature", "To run it twice", "To allocate an array", "To include a library"], correctOptionIndex: 0, explanation: "A prototype lets the compiler check calls against the function's signature." },
  },
  {
    id: "pointers",
    title: "Pointers",
    description: "Understand addresses, pointer types, and safe indirection.",
    durationMinutes: 40,
    order: 11,
    lesson: "A pointer stores an address. The address-of operator obtains an object's address; dereferencing accesses the pointed-to object.",
    quiz: { prompt: "What does the expression &value produce?", options: ["The address of value", "The value squared", "A reference count", "The size of value"], correctOptionIndex: 0, explanation: "The unary & operator returns the address of its operand." },
  },
  {
    id: "recursion",
    title: "Recursion",
    description: "Solve a problem through smaller calls with a correct base case.",
    durationMinutes: 35,
    order: 12,
    lesson: "A recursive function calls itself on a smaller problem. A base case stops further calls and prevents unbounded recursion.",
    quiz: { prompt: "What prevents a recursive function from calling itself forever?", options: ["A base case", "A global variable", "A header file", "A pointer"], correctOptionIndex: 0, explanation: "A base case returns without making another recursive call." },
  },
  {
    id: "structures",
    title: "Structures",
    description: "Group related fields of different types into one struct.",
    durationMinutes: 35,
    order: 13,
    lesson: "A struct defines a composite type whose named members can have different types. Use the dot operator to access a member through a struct value.",
    quiz: { prompt: "Which operator accesses a member through a struct variable?", options: ["->", ".", "::", "&"], correctOptionIndex: 1, explanation: "The dot operator accesses a member of a struct value." },
  },
  {
    id: "file-handling",
    title: "File Handling",
    description: "Open, read, write, and close files using the standard I/O library.",
    durationMinutes: 40,
    order: 14,
    lesson: "The stdio library provides FILE streams and functions such as fopen, fgets, fprintf, and fclose. Check for errors when opening a file.",
    quiz: { prompt: "Which function closes a file stream?", options: ["fclose", "fopen", "fread", "fprintf"], correctOptionIndex: 0, explanation: "fclose releases a stream opened with fopen." },
  },
];

export const samplePrerequisites: PrerequisiteEdge[] = [
  { conceptId: "variables", prerequisiteId: "intro" },
  { conceptId: "data-types", prerequisiteId: "variables" },
  { conceptId: "operators", prerequisiteId: "data-types" },
  { conceptId: "input-output", prerequisiteId: "variables" },
  { conceptId: "conditionals", prerequisiteId: "operators" },
  { conceptId: "conditionals", prerequisiteId: "input-output" },
  { conceptId: "loops", prerequisiteId: "conditionals" },
  { conceptId: "arrays", prerequisiteId: "loops" },
  { conceptId: "arrays", prerequisiteId: "data-types" },
  { conceptId: "strings", prerequisiteId: "arrays" },
  { conceptId: "functions", prerequisiteId: "variables" },
  { conceptId: "functions", prerequisiteId: "data-types" },
  { conceptId: "pointers", prerequisiteId: "variables" },
  { conceptId: "pointers", prerequisiteId: "data-types" },
  { conceptId: "recursion", prerequisiteId: "functions" },
  { conceptId: "recursion", prerequisiteId: "conditionals" },
  { conceptId: "structures", prerequisiteId: "data-types" },
  { conceptId: "structures", prerequisiteId: "arrays" },
  { conceptId: "file-handling", prerequisiteId: "functions" },
  { conceptId: "file-handling", prerequisiteId: "input-output" },
];
