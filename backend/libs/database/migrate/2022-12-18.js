module.exports = async function(s,config){
    s.debugLog('Updating database to 2022-12-18')
    const {
        addColumn,
    } = require('../utils.js')(s,config)
    await addColumn('Monitors',[
        {name: 'tags', length: 500, type: 'string'},
    ])
    await addColumn('Cloud Videos',[
        {name: 'type', type: 'string', length: 15, defaultTo: 's3'},
        {name: 'ext', type: 'string', length: 10, defaultTo: 'mp4'},
    ])
    await addColumn('Cloud Timelapse Frames',[
        {name: 'type', type: 'string', length: 15, defaultTo: 's3'},
    ])
}
