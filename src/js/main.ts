import { capitalize, calculateSum, formatDate } from './scripts/utils'

// Sample TypeScript code rendered by ChatGPT-3

class Person {
  private name: string;
  private age: number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }

  greet(): void {
    console.log(`Hello, my name is ${this.name} and I am ${this.age} years old.`);
  }
}

// Creating an instance of the Person class
const person = new Person("Stamat", new Date().getFullYear() - 1988);

// Accessing properties and calling methods
person.greet();


console.log(capitalize('hello')); // Output: Hello
console.log(calculateSum([1, 2, 3, 4, 5])); // Output: 15

const today = new Date();
console.log(formatDate(today)); // Output: YYYY-MM-DD
