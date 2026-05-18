const fs = require('fs');
const fsP = require('fs').promises;
const path = require('path');
const moment = require('moment');
const fetch  = require('node-fetch');
const FormData = require('form-data');
const { AbortController } = require('node-abort-controller')
const DigestFetch = require('digest-fetch')
const https = require('https');
module.exports = (processCwd,config) => {
    let httpsAgent = new https.Agent({
        rejectUnauthorized: false,
    });
    const parseJSON = (string) => {
        var parsed
        try{
            parsed = JSON.parse(string)
        }catch(err){

        }
        if(!parsed)parsed = string
        return parsed
    }
    const stringJSON = (json) => {
        try{
            if(json instanceof Object){
                json = JSON.stringify(json)
            }
        }catch(err){

        }
        return json
    }
    const stringContains = (find,string,toLowerCase) => {
        var newString = string + ''
        if(toLowerCase)newString = newString.toLowerCase()
        return newString.indexOf(find) > -1
    }
    function getFileDirectory(filePath){
        const fileParts = filePath.split('/')
        fileParts.pop();
        return fileParts.join('/') + '/';
    }
    const checkCorrectPathEnding = (x) => {
        var length=x.length
        if(x.charAt(length-1)!=='/'){
            x=x+'/'
        }
        return x.replace('__DIR__',processCwd)
    }
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
    const nameToTime = (x) => {
        x = x.split('.')[0].split('T')
        if(x[1])x[1] = x[1].replace(/-/g,':')
        x = x.join(' ')
        return x
    }
    const generateRandomId = (x) => {
        if(!x){x=10};var t = "";var p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for( var i=0; i < x; i++ )
            t += p.charAt(Math.floor(Math.random() * p.length));
        return t;
    }
    const utcToLocal = (time) => {
        return moment.utc(time).utcOffset(s.utcOffset).format()
    }
    const localToUtc = (time) => {
        return moment(time).utc()
    }
    const formattedTime = (e,x) => {
        if(!e){e=new Date};if(!x){x='YYYY-MM-DDTHH-mm-ss'};
        return moment(e).format(x);
    }
    const fetchTimeout = (url, ms, { signal, ...options } = {}) => {
        const controller = new AbortController();
        const promise = fetch(url, { signal: controller.signal, agent: httpsAgent, ...options });
        if (signal) signal.addEventListener("abort", () => controller.abort());
        const timeout = setTimeout(() => controller.abort(), ms);
        return promise.finally(() => clearTimeout(timeout));
    }
    async function fetchDownloadAndWrite(downloadUrl,outputPath,readFileAfterWrite,options){
        const writeStream = fs.createWriteStream(outputPath);
        const downloadBuffer = await fetch(downloadUrl,options).then((res) => res.buffer());
        writeStream.write(downloadBuffer);
        writeStream.end();
        if(readFileAfterWrite === 1){
            return fs.createReadStream(outputPath)
        }else if(readFileAfterWrite === 2){
            return downloadBuffer
        }
        return null
    }
    function fetchWithAuthentication(requestUrl,options,callback){
        let hasDigestAuthEnabled = options.digestAuth;
        let theRequester;
        const hasUsernameAndPassword = options.username && typeof options.password === 'string'
        const requestOptions = {
            method : options.method || 'GET',
            headers: {'Content-Type': 'application/json'}
        }
        if(requestOptions.method !== 'GET'){
            if(typeof options.postData === 'object'){
                requestOptions.body = JSON.stringify(options.postData)
            }else if(options.postData && typeof options.postData === 'string'){
                try{
                    JSON.parse(options.postData)
                    requestOptions.body = options.postData
                }catch(err){

                }
            }
        }
        if(hasUsernameAndPassword && hasDigestAuthEnabled){
            theRequester = (new DigestFetch(options.username, options.password)).fetch
        }else if(hasUsernameAndPassword){
            theRequester = (new DigestFetch(options.username, options.password, { basic: true })).fetch
        }else{
            theRequester = fetch
        }
        return theRequester(requestUrl,requestOptions)
    }
    function isEven(value) {
        if (value%2 == 0)
            return true;
        else
            return false;
    }
    function asyncSetTimeout(timeoutAmount) {
        return new Promise((resolve,reject) => {
            setTimeout(function(){
                resolve()
            },timeoutAmount)
        })
    }
    function copyFile(inputFilePath,outputFilePath) {
        const response = {ok: true}
        return new Promise((resolve,reject) => {
            function failed(err){
                response.ok = false
                response.err = err
                resolve(response)
            }
            const readStream = fs.createReadStream(inputFilePath)
            const writeStream = fs.createWriteStream(outputFilePath)
            writeStream.on('finish', () => {
                resolve(response)
            })
            writeStream.on('error', failed)
            readStream.on('error', failed)
            readStream.pipe(writeStream)
        })
    }
    async function moveFile(inputFilePath,outputFilePath) {
        try{
            await fsP.rm(outputFilePath)
        }catch(err){}
        await copyFile(inputFilePath, outputFilePath)
        await fsP.rm(inputFilePath)
    }
    function hmsToSeconds(str) {
        var p = str.split(':'),
            s = 0, m = 1;

        while (p.length > 0) {
            s += m * parseFloat(p.pop(), 10);
            m *= 60;
        }

        return s;
    }
    function setDefaultIfUndefined(config, key, defaultValue) {
        if (Array.isArray(defaultValue)) {
            if (config[key] === undefined) {
                config[key] = [...defaultValue];
            }
        } else {
            if (config[key] === undefined) {
                config[key] = defaultValue;
            }
        }
    }
    async function deleteFilesInFolder(folderPath) {
        try {
            const files = await fsP.readdir(folderPath);
            for (const file of files) {
                const filePath = path.join(folderPath, file);
                await fsP.rm(filePath, { recursive: true });
            }
        } catch (error) {
            console.error(`Error deleting files: ${error.message}`);
        }
    }
    function setTimeoutPromise(theTime){
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve()
            },theTime)
        })
    }
    function cleanStringsInObject(obj, isWithinDetectorFilters = false) {
      for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
          // Check if we're entering the detector_filters structure
          const enteringDetectorFilters = !isWithinDetectorFilters &&
                                       (key === 'detector_filters' ||
                                       (key === 'details' &&
                                        typeof obj[key] === 'object' &&
                                        obj[key].hasOwnProperty('detector_filters')));

          // Determine if we're currently within detector_filters
          let currentIsWithinDetectorFilters = isWithinDetectorFilters || enteringDetectorFilters;

          // Special handling for stringified detector_filters
          if ((key === 'detector_filters' || (key === 'details' && obj[key].hasOwnProperty('detector_filters')))) {
            const detectorFiltersTarget = key === 'details' ? obj[key] : obj;
            const detectorFiltersKey = key === 'details' ? 'detector_filters' : key;

            if (typeof detectorFiltersTarget[detectorFiltersKey] === 'string') {
              try {
                const parsed = JSON.parse(detectorFiltersTarget[detectorFiltersKey]);
                detectorFiltersTarget[detectorFiltersKey] = cleanStringsInObject(parsed, true);
                continue; // Skip further processing as we've replaced and cleaned it
              } catch (e) {
                currentIsWithinDetectorFilters = true;
              }
            }
          }

          if (typeof obj[key] === 'string') {
            try {
              const parsed = JSON.parse(obj[key]);
              obj[key] = cleanStringsInObject(parsed, currentIsWithinDetectorFilters);
            } catch (e) {
              if (currentIsWithinDetectorFilters) {
                // Special handling for detector_filters - allow comparison operators
                obj[key] = obj[key].replace(/[^\w\s.\-=+(){}\[\]*$@!`^%#:?\/&,><=!'|"]/gi, '');
              } else {
                // Normal string cleaning
                obj[key] = obj[key].replace(/[^\w\s.\-=+(){}\[\]*$@!`^%#:?\/&,'|"]/gi, '');
              }
            }
          }
          else if (typeof obj[key] === 'object' && obj[key] !== null) {
            if (enteringDetectorFilters && key === 'details') {
              cleanStringsInObject(obj[key].detector_filters, true);
              cleanStringsInObject(obj[key], false);
            } else {
              cleanStringsInObject(obj[key], currentIsWithinDetectorFilters);
            }
          }
          else if (Array.isArray(obj[key])) {
            obj[key].forEach((item, index) => {
              if (typeof item === 'string') {
                try {
                  const parsed = JSON.parse(item);
                  obj[key][index] = cleanStringsInObject(parsed, currentIsWithinDetectorFilters);
                } catch (e) {
                  if (currentIsWithinDetectorFilters) {
                    obj[key][index] = item.replace(/[^\w\s.\-=+(){}\[\]*$@!`^%#:?\/&,><=!'|"]/gi, '');
                  } else {
                    obj[key][index] = item.replace(/[^\w\s.\-=+(){}\[\]*$@!`^%#:?\/&,'|"]/gi, '');
                  }
                }
              } else if (typeof item === 'object' && item !== null) {
                cleanStringsInObject(item, currentIsWithinDetectorFilters);
              }
            });
          }
        }
      }
      return obj;
    }
    function convertNumbersToStrings(form) {
        if (!form || !form.details || typeof form.details !== 'object') {
            return form;
        }
        for (let key in form.details) {
            if (typeof form.details[key] === 'number') {
                form.details[key] = form.details[key].toString();
            }
        }
        return form;
    }
    return {
        parseJSON: parseJSON,
        stringJSON: stringJSON,
        stringContains: stringContains,
        getFileDirectory: getFileDirectory,
        checkCorrectPathEnding: checkCorrectPathEnding,
        nameToTime: nameToTime,
        mergeDeep: mergeDeep,
        generateRandomId: generateRandomId,
        utcToLocal: utcToLocal,
        localToUtc: localToUtc,
        formattedTime: formattedTime,
        isEven: isEven,
        fetchTimeout: fetchTimeout,
        fetchDownloadAndWrite: fetchDownloadAndWrite,
        fetchWithAuthentication: fetchWithAuthentication,
        asyncSetTimeout: asyncSetTimeout,
        copyFile: copyFile,
        hmsToSeconds,
        setDefaultIfUndefined,
        deleteFilesInFolder,
        moveFile,
        setTimeoutPromise,
        cleanStringsInObject,
        convertNumbersToStrings,
    }
}
