/* poops v1.0.15 | https://github.com/stamat/poops | MIT License */
"use strict";
(() => {
  // example/src/js/scripts/utils.ts
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  function calculateSum(numbers) {
    return numbers.reduce((acc, num) => acc + num, 0);
  }
  function formatDate(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // example/src/js/main.ts
  var Person = class {
    constructor(name, age) {
      this.name = name;
      this.age = age;
    }
    greet() {
      console.log(`Hello, my name is ${this.name} and I am ${this.age} years old.`);
    }
  };
  var person = new Person("Stamat", (/* @__PURE__ */ new Date()).getFullYear() - 1988);
  person.greet();
  console.log(capitalize("hello"));
  console.log(calculateSum([1, 2, 3, 4, 5]));
  var today = /* @__PURE__ */ new Date();
  console.log(formatDate(today));
})();
//# sourceMappingURL=scripts.js.map
