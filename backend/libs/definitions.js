var fs = require('fs')
var express = require('express')
const {
    mergeDeep
} = require('./common.js')
const frameworkBase = require(`../definitions/base.js`)
module.exports = function(s,config,lang,app,io){
    function getFramework(languageFile){
        return frameworkBase(s,config,languageFile)
    }
    const defaultFramework = getFramework(lang)
    //load defintions dynamically
    s.definitions = defaultFramework
    s.copySystemDefaultDefinitions = function(){
        //en_CA
        return Object.assign({},defaultFramework)
    }
    s.loadedDefinitons={}
    s.loadedDefinitons[config.language] = s.copySystemDefaultDefinitions()
    s.getDefinitonFile = function(rule){
        if(rule && rule !== ''){
            var file = s.loadedDefinitons[rule]
            if(!file){
                try{
                    // console.log(getFramework(lang))
                    s.loadedDefinitons[rule] = Object.assign(
                        {},
                        s.copySystemDefaultDefinitions(),
                        getFramework(s.getLanguageFile(rule))
                    );
                    file = s.loadedDefinitons[rule]
                }catch(err){
                    console.error(err)
                    file = s.copySystemDefaultDefinitions()
                }
            }
        }else{
            file = s.copySystemDefaultDefinitions()
        }
        return file
    }
    s.reloadDefinitions = function(){
        s.loadedDefinitons = {};
        s.loadedDefinitons[config.language] = s.copySystemDefaultDefinitions()
    }
    return defaultFramework
}
