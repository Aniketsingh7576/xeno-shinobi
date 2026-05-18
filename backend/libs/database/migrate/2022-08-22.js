module.exports = async function(s,config){
    s.debugLog('Updating database to 2022-08-22')
    const {
        addColumn,
    } = require('../utils.js')(s,config)
    await addColumn('Videos',[
        {name: 'archive', length: 1, type: 'tinyint', defaultTo: 0},
        {name: 'objects', type: 'string'},
        {name: 'saveDir', length: 255, type: 'string'},
    ])
    await addColumn('Monitors',[
        {name: 'saveDir', length: 255, type: 'string'},
    ])
    await addColumn('Timelapse Frames',[
        {name: 'archive', length: 1, type: 'tinyint', defaultTo: 0},
        {name: 'saveDir', length: 255, type: 'string'},
    ])
    await addColumn('Events',[
        {name: 'archive', length: 1, type: 'tinyint', defaultTo: 0},
    ])
    await addColumn('Files',[
        {name: 'archive', length: 1, type: 'tinyint', defaultTo: 0},
    ])
}
