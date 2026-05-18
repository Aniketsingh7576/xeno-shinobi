module.exports = function(s,config,lang,app){
    const {
        getCustomSetting,
        addCustomSetting,
        updateCustomSetting,
        editCustomSetting,
        deleteCustomSetting,
    } = require('../user/customSettings.js')(s,config,lang)
    /**
    * API : Permission Set : Get
    */
    app.get([
        config.webPaths.apiPrefix+':auth/customSettings/:ke',
        config.webPaths.apiPrefix+':auth/customSettings/:ke/:name',
    ], function (req,res){
        s.auth(req.params, async function(user){
            const response = { ok: true }
            const groupKey = req.params.ke;
            const userId = user.uid;
            const name = req.params.name;
            const rows = await getCustomSetting({ ke: groupKey, uid: userId, name })
            if(name){
                response.row = rows[0];
            }else{
                response.rows = rows;
            }
            s.closeJsonResponse(res,response)
        },res,req)
    })
    /**
    * API : Permission Set : Edit
    */
    app.post(config.webPaths.apiPrefix+':auth/customSettings/:ke', function (req,res){
        s.auth(req.params, async function(user){
            let response = { ok: false }
            const groupKey = req.params.ke;
            const form = req.body || {};
            form.ke = groupKey;
            form.uid = user.uid;
            if(form.name && form.details){
                response = await editCustomSetting(form)
            }else{
                response.msg = lang['Invalid Data'];
            }
            s.closeJsonResponse(res,response)
        },res,req)
    })
    /**
    * API : Permission Set : Delete
    */
    app.get(config.webPaths.apiPrefix+':auth/customSettings/:ke/:name/delete', function (req,res){
        s.auth(req.params, async function(user){
            const response = { ok: false }
            const groupKey = req.params.ke;
            const userId = user.uid;
            const name = req.params.name;
            try{
                response.deleteResponse = await deleteCustomSetting({ ke: groupKey, uid: userId, name })
                response.ok = true;
            }catch(err){
                response.err = err.toString()
            }
            s.closeJsonResponse(res,response)
        },res,req)
    })
}
