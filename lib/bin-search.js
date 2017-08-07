/**
 * Adds a generic binary search function to the Array prototype;
 *
 * @author Stanton Parham (stanton8parham8@gmail.com)
 */

/**
 * A comparator function compares two values and returns an integer indicating how the first value compares to the second value.
 * If the first value is less than the second value, then the function should return a negative integer.
 * If the first value is equal to the second value, then the function should return 0.
 * If the first value is greater than the second value, then the function should return a positive integer.
 * @callback comparatorFunction
 * @param {*} val1 - the first value to compare (this is the value to be found)
 * @param {*} val2 - the second value to compare (this is the current array value being compared)
 * @return {number} a positive or negative integer or 0
 */

/**
 * Returns the index at which the value is found using the given comparator function;
 * Returns -1 if the value is not found;
 *
 * Note that this should only be used on sorted arrays (ascending order).
 * Note that arrays with duplicate values may produce unexpected results.
 *
 * @param {*} valToFind - the value to find in the array
 * @param {comparatorFunction} comparator - the function used to compare valToFind and a value in the array
 * @return {number} the index at which valToFind is found or -1 if valToFind is not found
 */
Array.prototype.binarySearch = function(valToFind, comparator) {
  return searchHelper(this, 0, this.length - 1);
  function searchHelper(array, left, right) {
    if (left > right) return -1;
    var mid = Math.floor((left + right) / 2);
    var comparison = comparator(valToFind, array[mid]);
    if (comparison == 0) return mid;
    if (comparison < 0) return searchHelper(array, left, mid - 1);
    return searchHelper(array, mid + 1, right);
  }
}
