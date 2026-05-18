const package = require(`../package.json`)
const depKeys = Object.keys(package.dependencies)
let endText = ``
depKeys.forEach((key) => {
    endText += `${key} - https://www.npmjs.com/package/${key}\n`
})
console.log(endText)
