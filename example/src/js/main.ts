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

// Mobile nav: hamburger toggles the header dropdown, tap-outside closes it.
const navToggle = document.querySelector<HTMLButtonElement>('[data-nav-toggle]')
const siteNav = document.querySelector<HTMLElement>('[data-nav]')
if (navToggle && siteNav) {
  navToggle.addEventListener('click', (e) => {
    e.stopPropagation()
    const open = siteNav.classList.toggle('open')
    navToggle.setAttribute('aria-expanded', String(open))
  })
  document.addEventListener('click', (e) => {
    if (!siteNav.contains(e.target as Node)) {
      siteNav.classList.remove('open')
      navToggle.setAttribute('aria-expanded', 'false')
    }
  })
}
