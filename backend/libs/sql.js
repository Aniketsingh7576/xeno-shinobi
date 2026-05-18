var fs = require('fs');
module.exports = function(s,config){
    //sql/database connection with knex
    s.databaseOptions = {
        client: config.databaseType,
        connection: config.db,
        pool: {
            min: config.databasePoolMin || 0,
            max: config.databasePoolMax || 10,
            propagateCreateError: true
        }
    }
    const {
        knexQuery,
        knexQueryPromise,
        knexError,
        cleanSqlWhereObject,
        processSimpleWhereCondition,
        processWhereCondition,
        mergeQueryValues,
        getDatabaseRows,
        sqlQuery,
        connectDatabase,
        sqlQueryBetweenTimesWithPermissions,
    } = require('./database/utils.js')(s,config)
    s.onBeforeDatabaseLoadExtensions.forEach(function(extender){
        extender(config)
    })
    s.knexQuery = knexQuery
    s.knexQueryPromise = knexQueryPromise
    s.getDatabaseRows = getDatabaseRows
    s.sqlQuery = sqlQuery
    s.connectDatabase = connectDatabase
    s.sqlQueryBetweenTimesWithPermissions = sqlQueryBetweenTimesWithPermissions
    require('./database/preQueries.js')(s,config)
}
