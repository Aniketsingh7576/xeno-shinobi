const fs = require("fs").promises
module.exports = (s,config,lang) => {
    const { getNewApiKey } = require('../../user/apiKeys.js')(s,config,lang)
    const configPath = s.location.super;
    const requiredApiKeyPermissions = {
        "auth_socket": "1",
        "create_api_keys": "1",
        "edit_user": "1",
        "edit_permissions": "1",
        "get_monitors": "1",
        "edit_monitors": "1",
        "control_monitors": "1",
        "get_logs": "1",
        "watch_stream": "1",
        "watch_snapshot": "1",
        "watch_videos": "1",
        "delete_videos": "1",
        "get_alarms": "1",
        "edit_alarms": "1",
    };
    async function generateSuperUserJson(){
        const baseConfig = [
           {
              "mail": `${s.gid(6)}@${s.gid(6)}.${s.gid(3)}`,
              "pass": s.gid(32),
              "tokens": [
                 s.gid(30)
              ]
           }
        ];
        await fs.writeFile(configPath, JSON.stringify(baseConfig,null,3))
        return baseConfig[0]
    }
    async function getFirstSuperUser(){
        let superUser = JSON.parse(await fs.readFile(configPath))[0]
        if(!superUser){
            superUser = await generateSuperUserJson()
        }
        if(!superUser.tokens || !superUser.tokens[0]){
            const newToken = await applySuperApiKey()
            superUser.tokens = [newToken]
        }
        return superUser
    }
    async function applySuperApiKey(){
        const superUserList = JSON.parse(await fs.readFile(configPath))
        const newToken = s.gid(30)
        superUserList[0].tokens = [newToken]
        await fs.writeFile(configPath, JSON.stringify(superUserList,null,3))
        return newToken;
    }
    async function getFirstSuperApiKey(){
        const superUser = await getFirstSuperUser()
        const apiKey = superUser.tokens[0];
        return apiKey
    }
    async function getFirstAdminApiKey(){
        const { rows } = await s.knexQueryPromise({
            action: "select",
            columns: "*",
            table: "Users",
            limit: 1,
        });
        const user = rows[0];
        const apiKey = await getFirstApiKey(user.ke, user.uid)
        return { groupKey: user.ke, apiKey }
    }
    async function getFirstApiKey(groupKey, userId){
        const { rows } = await s.knexQueryPromise({
            action: "select",
            columns: "*",
            table: "API",
            where: { ke: groupKey, uid: userId }
        });
        var requiredPermissions = Object.keys(requiredApiKeyPermissions);
        let suitableKey = null;
        for(row of rows){
            var details = JSON.parse(row.details)
            var cantUse = details.permissionSet || details.treatAsSub === '1' || details.monitorsRestricted === '1';
            if(!cantUse){
                var canUse = true;
                for(permission of requiredPermissions){
                    if(details[permission] !== '1')canUse = false;
                }
                if(canUse){
                    suitableKey = row.code
                    break;
                }
            }
        };
        if(!suitableKey){
            suitableKey = await createApiKey(groupKey, userId)
        }
        return suitableKey;
    }
    async function createApiKey(groupKey, userId){
        const newApiKey = await getNewApiKey(groupKey);
        await s.knexQueryPromise({
            action: "insert",
            table: "API",
            insert: {
                ke: groupKey,
                uid: userId,
                code: newApiKey,
                ip: '0.0.0.0',
                details: s.stringJSON(requiredApiKeyPermissions)
            }
        });
        return newApiKey
    }
    async function getConnectionDetails(){
        const superApiKey = await getFirstSuperApiKey()
        const { groupKey, apiKey } = await getFirstAdminApiKey()
        return {
            superApiKey,
            groupKey,
            apiKey,
        }
    }
    return {
        getConnectionDetails
    }
}
