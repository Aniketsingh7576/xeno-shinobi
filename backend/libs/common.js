const async = require("async");
const fetch = require("node-fetch");
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
}
const getBuffer = async (url) => {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    return { error };
  }
};
function addCredentialsToUrl(options){
    const streamUrl = options.url
    const username = options.username
    const password = options.password
    const urlParts = streamUrl.split('://')
    return [urlParts[0],'://',`${username}:${password}@`,urlParts[1]].join('')
}
function humanReadableToMb(str) {
  const cleanedStr = `${str}`.toUpperCase().replace(/ /g, '').trim();
  const pattern = /^([\d.]+)(MB|GB|TB|PB|EB)$/i;
  let match = cleanedStr.match(pattern);

  if (!match) {
    const numericMatch = cleanedStr.match(/[\d.]+/);
    if (!numericMatch) {
      return 10000;
    }
    let value = parseFloat(numericMatch[0]);
    if (isNaN(value)) {
      return 10000;
    }
    return value;
  }

  let [ , numericPart, unit ] = match;
  let value = parseFloat(numericPart);
  switch (unit) {
    case "MB":
      break;
    case "GB":
      value *= 1000;
      break;
    case "TB":
      value *= 1000 * 1000;
      break;
    case "PB":
      value *= 1000 * 1000 * 1000;
      break;
    case "EB":
      value *= 1000 * 1000 * 1000 * 1000;
      break;
    default:
      break;
  }

  return value;
}
function mbToHumanReadable(mb) {
  const units = ["MB", "GB", "TB", "PB", "EB"];  // Extend if needed
  let unitIndex = 0;
  let value = parseInt(mb);
  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex++;
  }
  value = parseFloat(value.toFixed(2));
  return `${value} ${units[unitIndex]}`;
}
module.exports = {
    humanReadableToMb,
    mbToHumanReadable,
    addCredentialsToUrl,
    getBuffer: getBuffer,
    mergeDeep: mergeDeep,
    validateIntValue: (value) => {
        const newValue = !isNaN(parseInt(value)) ? parseInt(value) : null
        return newValue
    },
    arrayContains: (query,theArray) => {
        var foundQuery = false
        theArray.forEach((value) => {
            if(value.indexOf(query) > -1)foundQuery = true
        })
        return foundQuery
    },
    createQueue: (timeoutInSeconds, queueItemsRunningInParallel) => {
        return async.queue(function(action, callback) {
            setTimeout(function(){
                action(callback)
            },timeoutInSeconds * 1000 || 1000)
        },queueItemsRunningInParallel || 3)
    },
    createQueueAwaited: (timeoutInSeconds, queueItemsRunningInParallel) => {
        return async.queue(function(action, callback) {
            setTimeout(function(){
                action().then(callback)
            },timeoutInSeconds * 1000 || 1000)
        },queueItemsRunningInParallel || 3)
    },
    copyObject: (obj) => {
        return Object.assign({},obj)
    },
    stringContains: (find,string,toLowerCase) => {
        var newString = string + ''
        if(toLowerCase)newString = newString.toLowerCase()
        return newString.indexOf(find) > -1
    },
    stringToSqlTime: (value) => {
        newValue = new Date(value.replace('T',' '))
        return newValue
    },
    queryStringToObject: (string) => {
        const newObject = {}
        string.split('&').forEach((piece) => {
            const parts = piece.split('=')
            const key = parts[0]
            const value = parts[1]
            newObject[key] = value
        })
        return newObject
    },
    createQueryStringFromObject: (theObject) => {
       const string = []
       const keys = Object.keys(theObject)
       keys.forEach((key) => {
          const value = theObject[key]
          if(value)string.push(`${key}=${value}`)
       })
       return string.join('&')
    }

}
