module.exports = async function(s,config){
    s.debugLog('Updating database to 2025-03-05')
    const {
        addColumn,
    } = require('../utils.js')(s,config)
    await addColumn('Alarms',[
        {name: 'videos', type: 'text'},
    ])
}
