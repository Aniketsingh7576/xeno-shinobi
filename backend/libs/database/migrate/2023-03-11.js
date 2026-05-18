module.exports = async function(s,config){
    s.debugLog('Updating database to 2023-03-11')
    const {
        alterColumn,
    } = require('../utils.js')(s,config)
    await alterColumn('Monitors',[
        {name: 'path', length: 255, type: 'string'},
    ])
    await alterColumn('Videos',[
        {name: 'size', length: 15, type: 'bigInteger'},
    ])
    await alterColumn('Cloud Videos',[
        {name: 'size', length: 15, type: 'bigInteger'},
    ])
    await alterColumn('Files',[
        {name: 'size', length: 15, type: 'bigInteger'},
    ])
}
