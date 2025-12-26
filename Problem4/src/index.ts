/*---
# Task

Provide 3 unique implementations of the following function in TypeScript.

- Comment on the complexity or efficiency of each function.

**Input**: `n` - any integer

*Assuming this input will always produce a result lesser than `Number.MAX_SAFE_INTEGER`*.

**Output**: `return` - summation to `n`, i.e. `sum_to_n(5) === 1 + 2 + 3 + 4 + 5 === 15`.
---*/


function proceed(n:number): boolean {
  
  if (Number.isInteger(n) && n >= 0) return true;
  
  console.log("Invalid input for n:number: need to be more than 0 and has to be interger.");
  return false;
}


// Most efficient implementation of summing numbers up to n
function sum_to_n_a(n: number): number {
	if(!proceed(n)) return 0;
  const sum = (n * (n + 1)) / 2;
  return sum > Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : sum;
}

// This function uses a loop to calculate the sum of numbers up to n
// Slow but still will finish the job
function sum_to_n_b(n: number): number {
  if(!proceed(n)) return 0;
	let sum = 0;
  for(let i=1; i<=n; i++){
    sum += i;
  }
  return sum > Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : sum;
}

// This function uses an array and reduce to calculate the sum of numbers up to n
// Will have error when the number it too big (JS stack)
function sum_to_n_c(n: number): number {
	if(!proceed(n)) return 0;
  try {
    const sum = Array.from<number,number>({length:n},(_,i)=>i+1).reduce((acc,r)=>acc+r,0);
    return sum > Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : sum;
    
  } catch (error) {
    console.error(error);
    return Number.MAX_SAFE_INTEGER;
  }
}


console.log('sum_to_n_a(5): ',sum_to_n_a(5));
console.log('sum_to_n_b(5): ',sum_to_n_b(5));
console.log('sum_to_n_c(5): ',sum_to_n_c(5));

console.log('sum_to_n_a(-5): ',sum_to_n_a(-5));
console.log('sum_to_n_b(-5): ',sum_to_n_b(-5));
console.log('sum_to_n_c(-5): ',sum_to_n_c(-5));

console.log('sum_to_n_a(5.1): ',sum_to_n_a(5.1));
console.log('sum_to_n_b(5.1): ',sum_to_n_b(5.1));
console.log('sum_to_n_c(5.1): ',sum_to_n_c(5.1));

console.log('sum_to_n_a(1e9): ',sum_to_n_a(1e9));
console.log('sum_to_n_b(1e9): ',sum_to_n_b(1e9));
console.log('sum_to_n_c(1e9): ',sum_to_n_c(1e9));