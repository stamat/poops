// Sample TypeScript code rendered by ChatGPT-3

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function calculateSum(numbers: number[]): number {
  return numbers.reduce((acc, num) => acc + num, 0);
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
