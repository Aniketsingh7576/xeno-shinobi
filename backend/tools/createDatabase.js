// run these inside the Shinobi folder to use the script.
//// npm install git+https://github.com/SoakDigital/knex-db-manager.git#feature/mysql2-lib-support
//// npm install mysql2
//
// Usage : node tools/createDatabase.js
//
// it throws a "ER_DBACCESS_DENIED_ERROR" error
// but Shinobi still seems to run when I start it right after running this script.


const config = require('../conf.json')
async function createDatabase(){
    try{
        const conn = {
            knex: {
                client: config.databaseType || 'mysql2',
                connection: {
                    host: config.db.host || '127.0.0.1',
                    user: config.db.user || 'majesticflame',
                    password: config.db.password || '',
                    port: config.db.port,
                },
                pool: {
                    min: 0,
                    max: 10,
                },
            },
            dbManager: {
                collate: ['utf8_general_ci'],
                superUser: config.db.creatorUser || 'majesticflame',
                superPassword: config.db.creatorPassword || '',
            },
        };
        const dbManager = require('knex-db-manager').databaseManagerFactory(conn);
        await dbManager.createDb(config.db.database);
        await dbManager.close();
    }catch(err){
        console.error('createDatabase Error',err)
    }
}
createDatabase().then(() => {
    console.log('Done!')
    process.exit()
})
