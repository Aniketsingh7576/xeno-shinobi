module.exports = (s,config,lang,app) => {
    if(config.xtreamCodesAPI){
        function authenticateRequest(req, res, next){
            let user = getRequestSession(req)
            if(user){
                req.user = user
                await resetUserSession(user.sessionId, res)
            }else{
                const username = req.query.username
                const password = req.query.password
                if(username && password){
                    const loginResponse = await login(username, password)
                    user = loginResponse.user
                    if(user){
                        req.user = user
                        await createUserSession(user, res)
                        await resetUserSession(user.sessionId, res)
                    }
                }
            }
            next()
        }
        // m3u8 live streams
        app.get('/get.php', authenticateRequest, function(req,res){
            const user = req.user
            if(user){

            }else{
                res.end('Not Authorized')
            }
        })
        // EPG
        app.get('/xmltv.php', authenticateRequest, function(req,res){
            const user = req.user
            if(user){
            }
        })
        // player_api
        app.get('/player_api.php', authenticateRequest, function(req,res){
            const user = req.user
            if(user){
                const theAction = req.query.action
                switch(theAction){
                    // live streams
                    case'get_live_streams':

                    break;
                    case'get_live_categories':

                    break;
                    case'get_live_streams':
                        let categoryId = req.query.category_id
                    break;
                    // movies
                    case'get_vod_streams':
                        var moviesList = await listMovies()
                        res.json(moviesList)
                    break;
                    case'get_vod_categories':

                    break;
                    case'get_vod_streams':
                        let categoryId = req.query.category_id
                    break;
                    case'get_vod_info':
                        let vodId = req.query.vod_id
                    break;
                    // tv shows
                    case'get_series':

                    break;
                    case'get_series_categories':

                    break;
                    case'get_series':
                        let categoryId = req.query.category_id
                    break;
                    case'get_series_info':
                        let series = req.query.series
                    break;
                    // EPG
                    case'get_short_epg':
                        let streamId = req.query.stream_id
                    break;
                    case'get_simple_date_table':
                        let streamId = req.query.stream_id
                    break;
                }
            }
        })
    }
}
