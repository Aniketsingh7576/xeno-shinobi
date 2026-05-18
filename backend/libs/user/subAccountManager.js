module.exports = function(s,config,lang){
    const { createApiKey } = require('./apiKeys.js')(s,config,lang)
    async function getSubAccounts({ ke: groupKey, uid }){
        const whereQuery = [
            ['ke','=', groupKey],
            ['details','LIKE','%"sub"%'],
        ];
        if(uid){
            whereQuery.push(['uid','=', uid])
        }
        const { rows } = await s.knexQueryPromise({
            action: "select",
            columns: "ke,uid,mail,details",
            table: "Users",
            where: whereQuery
        });
        for(row of rows){
            row.details = JSON.parse(row.details);
        }
        return rows
    }
    async function addSubAccount({ ke: groupKey, mail, pass, password_again = '', pass_again = '', details, alsoCreateApiKey = false }){
        const response = { ok: false }
        if(mail !== '' && pass !== ''){
            if(pass === password_again || pass === pass_again){
                const { rows: foundUsers } = await s.knexQueryPromise({
                    action: "select",
                    columns: "*",
                    table: "Users",
                    where: [
                        ['mail','=',mail],
                    ]
                })
                if(foundUsers && foundUsers[0]){
                    response.msg = lang['Email address is in use.']
                }else{
                    const uid = s.gid()
                    const postDetails = Object.assign({
                        allmonitors: "1"
                    },s.parseJSON(details) || {});
                    postDetails.sub = 1
                    const insertQuery = {
                        ke: groupKey,
                        uid: uid,
                        mail: mail,
                        pass: s.createHash(pass),
                        details: JSON.stringify(postDetails),
                    };
                    await s.knexQueryPromise({
                        action: "insert",
                        table: "Users",
                        insert: insertQuery
                    });
                    if(alsoCreateApiKey){
                        response.apiKey = await createApiKey({ ke: groupKey, uid });
                    }
                    response.msg = lang.accountAddedText
                    response.ok = true
                    response.user = insertQuery
                }
            }else{
                response.msg = lang["Passwords Don't Match"]
            }
        }else{
            response.msg = lang['Fields cannot be empty']
        }
        return response
    }
    async function updateSubAccount({ ke: groupKey, mail, uid, pass, password_again, pass_again, details }){
        const response = { ok: false }
        details = s.parseJSON(details) || {"sub": 1, "allmonitors": "1"}
        details.sub = 1
        if(mail){
            const { rows: foundUsers } = await s.knexQueryPromise({
                action: "select",
                columns: "*",
                table: "Users",
                where: [
                    ['mail','=', mail],
                ]
            })
            const foundUser = foundUsers[0];
            if(foundUser){
                const passwordsMatch = pass && (pass === password_again || pass === pass_again);
                if(!pass || passwordsMatch){
                    const updateQuery = {
                        details: s.stringJSON(details)
                    }
                    if(passwordsMatch){
                        updateQuery.pass = s.createHash(pass)
                    }
                    if(foundUser.uid === uid){
                        updateQuery.mail = mail
                        await s.knexQueryPromise({
                            action: "update",
                            table: "Users",
                            update: updateQuery,
                            where: [
                                ['ke','=', groupKey],
                                ['uid','=', uid],
                            ]
                        })
                        const { rows: apiKeys } = await s.knexQueryPromise({
                            action: "select",
                            columns: "*",
                            table: "API",
                            where: [
                                ['ke','=', groupKey],
                                ['uid','=', uid],
                            ]
                        });
                        if(apiKeys && apiKeys[0]){
                            apiKeys.forEach(function(apiKey){
                                delete(s.api[apiKey.code])
                            })
                        }
                        response.ok = true
                    }else{
                        response.msg = lang['Invalid Data']
                    }
                }else{
                    response.msg = lang["Passwords Don't Match"]
                }
            }
        }else{
            response.msg = lang['Invalid Data']
        }
        return response
    }
    async function deleteSubAccount({ ke: groupKey, uid }){
        const response = { ok: false }
        const usersFound = await getSubAccounts({ ke: groupKey, uid });
        const theUserUpForDeletion = usersFound[0]
        if(theUserUpForDeletion){
            await s.knexQueryPromise({
                action: "delete",
                table: "Users",
                where: {
                    ke: groupKey,
                    uid: uid,
                }
            })
            const { err, rows } = await s.knexQueryPromise({
                action: "select",
                columns: "*",
                table: "API",
                where: [
                    ['ke','=',groupKey],
                    ['uid','=',uid],
                ]
            });
            if(rows && rows[0]){
                for(row of rows){
                    delete(s.api[row.code])
                }
                await s.knexQueryPromise({
                    action: "delete",
                    table: "API",
                    where: {
                        ke: groupKey,
                        uid: uid,
                    }
                })
            }
            response.ok = true
        }else{
            response.msg = lang['User Not Found']
        }
        return response
    }
    return {
        addSubAccount,
        getSubAccounts,
        deleteSubAccount,
        updateSubAccount,
    }
}
