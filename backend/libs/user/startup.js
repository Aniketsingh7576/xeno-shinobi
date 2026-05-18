module.exports = function(s,config,lang,io){
    const {
        createAdminUser
    } = require("./utils.js")(s,config,lang);
    function checkStaticUser(staticUser){
        return new Promise((resolve,reject) => {
            const whereQuery = {
                mail: staticUser.mail
            }
            if(staticUser.ke)whereQuery.ke = staticUser.ke
            s.knexQuery({
                action: "select",
                columns: "mail,ke,uid",
                table: "Users",
                where: whereQuery,
                limit: 1,
            },function(err,users) {
                resolve(users[0])
            })
        })
    }
    async function checkForStaticUsers(){
        if(config.staticUsers){
            try{
                for (let i = 0; i < config.staticUsers.length; i++) {
                    const staticUser = config.staticUsers[i]
                    s.debugLog(`Checking Static User...`,staticUser.mail)
                    const userExists = await checkStaticUser(staticUser)
                    if(!userExists){
                        s.debugLog(`Static User does not exist, creating...`)
                        const creationResponse = await createAdminUser(staticUser)
                        s.debugLog(`Static User created!`,creationResponse)
                    }else{
                        s.debugLog(`Static User exists!`)
                    }
                }
            }catch(err){
                s.debugLog(`Static User check error!`,err)
            }
        }
    }
    return {
        checkForStaticUsers,
    }
}
