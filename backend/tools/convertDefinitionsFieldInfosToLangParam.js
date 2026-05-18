const fs = require('fs')
const path = require('path')
const backendDir = path.resolve(__dirname, '..')
const sharedDir = path.resolve(backendDir, '..', 'shared')
const definitionFile = path.join(backendDir, 'definitions/en_CA.js')
const newDefinitionFile = path.join(backendDir, 'tools/en_CA.js')
const languagesFile = path.join(sharedDir, 'languages/en_CA.json')
const newLanguagesFile = path.join(backendDir, 'tools/en_CA.json')
const languagesData = require(languagesFile)
var definitonsRawData = fs.readFileSync(definitionFile).toString()
const definitionData = require(definitionFile)({
        gid: () => {return 'randomId'},
        listOfStorage: [],
    },
    {
        timeZones: [
               {
                  "text": "UTC−12:00, Y",
                  "value": -720
               },
               {
                  "text": "UTC−11:00, X",
                  "value": -660
               },
               {
                  "text": "UTC−10:00, W",
                  "value": -600
               },
               {
                  "text": "UTC−09:30, V†",
                  "value": -570
               },
               {
                  "text": "UTC−09:00, V",
                  "value": -540
               },
               {
                  "text": "UTC−08:00, U",
                  "value": -480
               },
               {
                  "text": "UTC−07:00, T",
                  "value": -420
               },
               {
                  "text": "UTC−06:00, S",
                  "value": -360
               },
               {
                  "text": "UTC−05:00, R",
                  "value": -300
               },
               {
                  "text": "UTC−04:00, Q",
                  "value": -240
               },
               {
                  "text": "UTC−03:30, P†",
                  "value": -210
               },
               {
                  "text": "UTC−03:00, P",
                  "value": -180
               },
               {
                  "text": "UTC−02:00, O",
                  "value": -120
               },
               {
                  "text": "UTC−01:00, N",
                  "value": -60
               },
               {
                  "text": "UTC±00:00, Z",
                  "value": 0,
                  "selected": true
               },
               {
                  "text": "UTC+01:00, A",
                  "value": 60
               },
               {
                  "text": "UTC+02:00, B",
                  "value": 120
               },
               {
                  "text": "UTC+03:00, C",
                  "value": 180
               },
               {
                  "text": "UTC+03:30, C†",
                  "value": 210
               },
               {
                  "text": "UTC+04:00, D",
                  "value": 240
               },
               {
                  "text": "UTC+04:30, D†",
                  "value": 270
               },
               {
                  "text": "UTC+05:00, E",
                  "value": 300
               },
               {
                  "text": "UTC+05:30, E†",
                  "value": 330
               },
               {
                  "text": "UTC+05:45, E*",
                  "value": 345
               },
               {
                  "text": "UTC+06:00, F",
                  "value": 360
               },
               {
                  "text": "UTC+06:30, F†",
                  "value": 390
               },
               {
                  "text": "UTC+07:00, G",
                  "value": 420
               },
               {
                  "text": "UTC+08:00, H",
                  "value": 480
               },
               {
                  "text": "UTC+08:45, H*",
                  "value": 525
               },
               {
                  "text": "UTC+09:00, I",
                  "value": 540
               },
               {
                  "text": "UTC+09:30, I†",
                  "value": 570
               },
               {
                  "text": "UTC+10:00, K",
                  "value": 600
               },
               {
                  "text": "UTC+10:30, K†",
                  "value": 630
               },
               {
                  "text": "UTC+11:00, L",
                  "value": 660
               },
               {
                  "text": "UTC+12:00, M",
                  "value": 720
               },
               {
                  "text": "UTC+12:45, M*",
                  "value": 765
               },
               {
                  "text": "UTC+13:00, M†",
                  "value": 780
               },
               {
                  "text": "UTC+14:00, M†",
                  "value": 840
               }
        ]
    },
    languagesData
);

const capitalize = (s) => {
  if (typeof s !== 'string') return ''
  return (s.charAt(0).toUpperCase() + s.slice(1))
}
const capitalizeAllWords = (string) => {
    let firstPart = ``
    let secondPart = ``
    let thirdPart = ``
    let newString = ``
    string
    .replace(/"/g,'')
    .split(' ').forEach((part) => {
        firstPart += capitalize(part)
    })
    firstPart.split('_').forEach((part) => {
        secondPart += capitalize(part)
    })
    secondPart.split('-').forEach((part) => {
        thirdPart += capitalize(part)
    })
    thirdPart.split('=').forEach((part) => {
        newString += capitalize(part)
    })
    return newString
}
function replaceTextWithLandParam(langText,langParam){
    if(definitonsRawData.indexOf(`"${langText}"`) > -1){
        definitonsRawData = definitonsRawData.replace(`"${langText}"`,`lang["${langParam}"]`)
        console.log('Replacing : ',definitonsRawData.indexOf(`"${langText}"`),`"${langText}"`,langParam)
    }else if(definitonsRawData.indexOf(`'${langText}'`) > -1){
        definitonsRawData = definitonsRawData.replace(`'${langText}'`,`lang["${langParam}"]`)
        console.log('Replacing : ',definitonsRawData.indexOf(`'${langText}'`),`'${langText}'`,langParam)
    }
}
const processSection = (section) => {
    try{
        if(section.info){
            section.info.forEach((field) => {
                if(field.isSection){
                    processSection(field)
                }else{
                    if(field.name){
                        const cleanName = field.name.replace('detail=','')
                        if(field.description){
                            const langParam = `fieldText` + capitalizeAllWords(cleanName)
                            const langText = field.description
                            newLangParams[langParam] = langText
                            replaceTextWithLandParam(langText,langParam)
                        }
                        if(field.possible instanceof Array){
                            field.possible.forEach((possibility) => {
                                if(possibility.info){
                                    const langParam = `fieldText` + capitalizeAllWords(cleanName) + capitalizeAllWords(possibility.name)
                                    const langText = possibility.info
                                    newLangParams[langParam] = langText
                                    replaceTextWithLandParam(langText,langParam)
                                }
                            })
                        }
                    }
                }
            })
        }
    }catch(err){
        console.log(err)
        console.error(section)
        console.error(err)
    }
}

const newLangParams = {}
const pageKeys = Object.keys(definitionData)
pageKeys.forEach((pageKey) => {
    const page = definitionData[pageKey]
    if(page.blocks){
        const pageData = Object.keys(page.blocks)
        pageData.forEach((sectionKey) => {
            const section = page.blocks[sectionKey]
            processSection(section)
        })
    }else{
        // console.log(page)
    }
})
const newLanguageFile = Object.assign(languagesData,newLangParams)
// console.log(definitonsRawData)
console.log(newLanguageFile)
setTimeout(() => {
    try{
        console.log('Writing New Definitions File, en_CA.js')
        fs.writeFileSync(newDefinitionFile,definitonsRawData)
        console.log('Writing New Language File, en_CA.json')
        fs.writeFileSync(newLanguagesFile,JSON.stringify(newLanguageFile,null,3))
    }catch(err){
        console.log(err)
    }
},2000)
