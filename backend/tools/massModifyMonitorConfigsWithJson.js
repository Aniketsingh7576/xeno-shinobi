#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read file paths from the command line.
const [,, arrayPath, objectPath, outputPath] = process.argv;

// Validate that first two parameters exist
if (!arrayPath || !objectPath) {
  console.error('Usage: node mergeObjects.js <path-to-JSON-array> <path-to-JSON-object> [path-to-output.json]');
  process.exit(1);
}

// The merge function, as provided
const mergeDeep = function(...objects) {
  const isObject = obj => obj && typeof obj === 'object';

  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach(key => {
      const pVal = prev[key];
      const oVal = obj[key];

      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        prev[key] = pVal.concat(...oVal);
      }
      else if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal);
      }
      else {
        prev[key] = oVal;
      }
    });

    return prev;
  }, {});
};

try {
  // Read and parse the JSON from each file
  const arrayData = JSON.parse(fs.readFileSync(path.resolve(arrayPath), 'utf-8'));
  const objectData = JSON.parse(fs.readFileSync(path.resolve(objectPath), 'utf-8'));

  // Ensure the first file's JSON is indeed an array
  if (!Array.isArray(arrayData)) {
    throw new Error('The first JSON file must contain an array of objects');
  }

  // Merge the second object into each element of the array
  const mergedArray = arrayData.map(item => mergeDeep(item, objectData));

  // If an outputPath is given, write the merged result there;
  // otherwise, print to stdout.
  if (outputPath) {
    fs.writeFileSync(
      path.resolve(outputPath),
      JSON.stringify(mergedArray, null, 2),
      'utf-8'
    );
    console.log(`Merged JSON saved to: ${outputPath}`);
  } else {
    console.log(JSON.stringify(mergedArray, null, 2));
  }

} catch (err) {
  console.error('Error reading or processing files:', err.message);
  process.exit(1);
}
