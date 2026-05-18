module.exports = function(s,config,lang){
    const Theme = {
        isDark: true,
    }
    const mainBackgroundColor = Theme.isDark ? 'bg-dark' : Theme.isDarkDefaultBg || 'bg-light'
    const textWhiteOnBgDark = Theme.isDark ? 'text-white' : ''
    return Object.assign({
        Theme: Theme,
    },{
        "Monitor Status Codes": {
            "0": lang["Disabled"],
            "1": lang["Starting"],
            "2": lang["Watching"],
            "3": lang["Recording"],
            "4": lang["Restarting"],
            "5": lang["Stopped"],
            "6": lang["Idle"],
            "7": lang["Died"],
            "8": lang["Stopping"],
            "9": lang["Started"],
        },
        "Monitor Settings": require('./monitorSettings.js')(s,config,lang),
       "Account Settings": {
          "section": "Account Settings",
          "blocks": {
             "XenocipherHub": {
                 "evaluation": "!details.sub && details.use_shinobihub !== '0'",
                 "name": lang["XenocipherHub"],
                 "color": "purple",
                 "info": [
                     {
                        "name": "detail=shinobihub",
                        "selector":"autosave_shinobihub",
                        "field": lang.Autosave,
                        "description": "",
                        "default": "0",
                        "example": "",
                        "fieldType": "select",
                        "possible": [
                            {
                               "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            }
                        ]
                     },
                     {
                        "hidden": true,
                        "field": lang['API Key'],
                        "name": "detail=shinobihub_key",
                        "placeholder": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                        "form-group-class": "autosave_shinobihub_input autosave_shinobihub_1",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                 ]
             },
             "AlternateLogins": {
                 "name": lang["Alternate Logins"],
                 "color": "orange",
                 "info": [
                     {
                         "form-group-class-pre-layer": "form-group",
                         "fieldType": 'div',
                         "id": "alternate-logins"
                     },
                     {
                        "fieldType": "btn-group",
                        "forForm": true,
                        "btns": [],
                     },
                 ]
             },
             "2-Factor Authentication": {
                 "name": lang['2-Factor Authentication'],
                 "color": "grey",
                 "info": [
                    {
                       "name": "detail=factorAuth",
                       "field": lang.Enabled,
                       "description": lang["fieldTextFactorAuth"],
                       "default": "0",
                       "example": "",
                       "fieldType": "select",
                       "possible": [
                          {
                             "name": lang.No,
                             "value": "0"
                          },
                          {
                             "name": lang.Yes,
                             "value": "1"
                          }
                       ]
                   },
                ]
             },
             "Profile": {
                "name": lang.Profile,
                "color": "grey",
                "info": [
                   {
                      "name": "mail",
                      "field": lang.Email,
                      "description": lang["fieldTextMail"],
                      "default": "",
                      "example": "ccio@m03.ca",
                      "possible": ""
                   },
                   {
                      "name": "pass",
                      "field": lang.Password,
                      "fieldType": "password",
                      "description": lang["fieldTextPass"],
                      "fieldType": "password",
                      "default": "",
                      "example": "",
                      "possible": ""
                   },
                   {
                      "name": "password_again",
                      "field": lang["Password Again"],
                      "fieldType": "password",
                      "description": lang["fieldTextPasswordAgain"],
                      "default": "",
                      "example": "",
                      "possible": ""
                   },
                   {
                      "attribute": `size-adjust='[detail="size"]'`,
                      "field": lang["Max Storage Amount"],
                      "default": "10 GB",
                      "notForSubAccount": true,
                      "evaluation": "details.edit_size !== '0'"
                   },
                   {
                       hidden: true,
                      "name": "detail=size",
                      "field": lang["Max Storage Amount"],
                      "description": lang["fieldTextSize"],
                      "default": "10000",
                      "example": "600000",
                      "possible": "Up to 95% of your maximum storage space if only one master account exists.",
                      "notForSubAccount": true,
                      "evaluation": "details.edit_size !== '0'"
                   },
                   {
                      "name": "detail=size_video_percent",
                      "field": lang["Video Share"],
                      "description": lang["fieldTextSizeVideoPercent"],
                      "default": "90",
                      "notForSubAccount": true,
                   },
                   {
                      "name": "detail=size_timelapse_percent",
                      "field": lang["Timelapse Frames Share"],
                      "description": lang["fieldTextSizeTimelapsePercent"],
                      "default": "5",
                      "notForSubAccount": true,
                   },
                   {
                      "name": "detail=size_filebin_percent",
                      "field": lang["FileBin Share"],
                      "description": lang["fieldTextSizeFilebinPercent"],
                      "default": "5",
                      "notForSubAccount": true,
                   },
                   {
                       hidden:true,
                      "name": "detail=addStorage",
                      "default": "{}",
                      "notForSubAccount": true,
                   },
                   {
                       "fieldType": 'div',
                       "id": "add_storage_max_amounts"
                   },
                   {
                      "name": "detail=days",
                      "field": lang["Number of Days to keep"] + ' ' + lang['Videos'],
                      "description": lang["fieldTextDays"],
                      "default": "5",
                      "example": "30",
                      "possible": "",
                      "notForSubAccount": true,
                      "evaluation": "details.edit_days !== '0'"
                   },
                   {
                      "name": "detail=event_days",
                      "field": lang["Number of Days to keep"] + ' ' + lang['Events'],
                      "description": lang["fieldTextEventDays"],
                      "default": "10",
                      "example": "30",
                      "possible": "",
                      "notForSubAccount": true,
                      "evaluation": "details.edit_event_days !== '0'"
                   },
                   {
                      "name": "detail=timelapseFrames_days",
                      "field": lang["Number of Days to keep"] + ' ' + lang['Timelapse'],
                      "description": lang["fieldTextEventDays"],
                      "default": "60",
                      "notForSubAccount": true,
                      "evaluation": "details.edit_timelapseFrames_days !== '0'"
                   },
                   {
                      "name": "detail=log_days",
                      "field": lang["Number of Days to keep"] + ' ' + lang['Logs'],
                      "description": lang["fieldTextLogDays"],
                      "default": "10",
                      "example": "30",
                      "possible": "",
                      "notForSubAccount": true,
                      "evaluation": "details.edit_log_days !== '0'"
                  },
                 {
                     "name": "detail=audio_note",
                     "field": lang["Notification Sound"],
                     "description": lang["fieldTextAudioNote"],
                     "fieldType": "select",
                     "possible": s.listOfAudioFiles
                 },
                 {
                     "name": "detail=audio_alert",
                     "field": lang["Alert Sound"],
                     "description": lang["fieldTextAudioAlert"],
                     "fieldType": "select",
                     "possible": s.listOfAudioFiles
                 },
                 {
                     "name": "detail=audio_delay",
                     "field": lang["Alert Sound Delay"],
                     "description": lang["fieldTextAudioDelay"],
                     "default": "1",
                 },
                 {
                     "name": "detail=event_mon_pop",
                     "field": lang["Popout Monitor on Event"],
                     "description": lang["fieldTextEventMonPop"],
                     "default": "en_CA",
                     "fieldType": "select",
                     "possible": [
                        {
                           "name": lang.No,
                           "value": "0"
                        },
                        {
                           "name": lang.Yes,
                           "value": "1"
                        }
                     ]
                  }
                ]
             },
             "Uploaders": {
                "name": lang["Uploaders"],
                "color": "forestgreen",
                "info": []
             },
             "Live Grid": {
                "name": lang['Live Grid'],
                "color": "navy",
                "info": [
                    {
                          "field": lang.hlsOptions,
                          "name": "localStorage=hlsOptions",
                          fieldType:"textarea",
                          "placeholder": "{}",
                    },
                ]
             },
             "Preferences": {
                "name": lang.Preferences,
                "color": "navy",
                "info": [
                   {
                        "field": lang['Clock Format'],
                        "name": "detail=clock_date_format",
                        "placeholder": "$DAYNAME $DAY $MONTHNAME $YEAR",
                   },
                   {
                        "field": lang.CSS,
                        "name": "detail=css",
                        fieldType:"textarea",
                        "placeholder": "#main_header{background:#b59f00}",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                  },
                  {
                      "field": lang['Browser Console Log'],
                      attribute:'localStorage="browserLog"',
                      "description": "",
                      "default": "0",
                      "example": "",
                      "fieldType": "select",
                      "possible": [
                          {
                             "name": lang.No,
                             "value": "0"
                          },
                          {
                             "name": lang.Yes,
                             "value": "1"
                          }
                      ]
                  },
                  {
                      "field": lang['Get Logs to Client'],
                      attribute:'localStorage="get_server_log"',
                      "description": "",
                      "default": "1",
                      "example": "",
                      "fieldType": "select",
                      "possible": [
                          {
                             "name": lang.No,
                             "value": "0"
                          },
                          {
                             "name": lang.Yes,
                             "value": "1"
                          }
                      ]
                  },
                  {
                      "field": lang['Use 24 Hour Time in Videos Table'],
                      attribute:'localStorage="use24HourTime"',
                      "description": "",
                      "default": "0",
                      "example": "",
                      "fieldType": "select",
                      "possible": [
                          {
                             "name": lang.No,
                             "value": "0"
                          },
                          {
                             "name": lang.Yes,
                             "value": "1"
                          }
                      ]
                  },
                  {
                      "field": lang.Themes,
                      "name": "detail=theme",
                      "description": "",
                      "default": "0",
                      "example": "",
                      "fieldType": "select",
                      "possible": s.listOfThemes
                  },
                ]
            },
          }
      },
       "ONVIF Device Manager": {
          "section": "ONVIF Device Manager",
          "blocks": {
             "Notice": {
                 "id": "Notice",
                 "name": lang["Notice"],
                 "color": "warning",
                 "blockquoteClass": "global_tip",
                 "blockquote": lang.onvifdeviceManagerGlobalTip,
                 "info": [
                     {
                         "field": lang["Monitor"],
                         "fieldType": "select",
                         "class": "monitors_list",
                         "possible": []
                     },
                     {
                        "fieldType": "btn",
                        "class": `btn-warning onvif-device-reboot`,
                        "btnContent": `<i class="fa fa-refresh"></i> &nbsp; ${lang['Reboot Camera']}`,
                     },
                     {
                         "fieldType": "div",
                         "class": "p-2",
                         "divContent": `<pre class="bg-dark text-white" style="max-height: 400px;overflow: auto;" id="onvifDeviceManagerInfo"></pre>`,
                     }
                 ]
             },
             "Network": {
                 "id": "Network",
                 "name": lang["Network"],
                 "color": "purple",
                 "info": [
                     {
                        "name": "setNetworkInterface:DHCP",
                        "selector":"onvif_dhcp",
                        "field": lang.DHCP,
                        "description": "",
                        "default": "true",
                        "example": "",
                        "fieldType": "select",
                        "possible": [
                            {
                               "name": lang.Yes,
                               "value": "true"
                            },
                            {
                               "name": lang.No,
                               "value": "false"
                            }
                        ]
                     },
                     {
                        "field": lang['IP Address'],
                        "name": "setNetworkInterface:ipv4",
                        "placeholder": "xxx.xxx.xxx.xxx",
                        "form-group-class": "onvif_dhcp_input onvif_dhcp_1",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                        "field": lang['Gateway'],
                        "name": "setGateway:ipv4",
                        "placeholder": "xxx.xxx.xxx.xxx",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                        "field": lang['Hostname'],
                        "name": "setHostname:name",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                        "field": lang['DNS'],
                        "name": "setDNS:dns",
                        "placeholder": "1.1.1.1,8.8.8.8",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                        "field": lang['HTTP'] + ' ' + lang['Port'],
                        "name": "setProtocols:HTTP",
                        "placeholder": "80",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                        "field": lang['RTSP'] + ' ' + lang['Port'],
                        "name": "setProtocols:RTSP",
                        "placeholder": "554",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                 ]
             },
             "Date and Time": {
                 "id": "DateandTime",
                 "name": lang["Date and Time"],
                 "color": "purple",
                 "info": [
                     {
                        "field": lang['UTCDateTime'],
                        "name": "utcDateTime",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                        "field": lang['NTP Servers'],
                        "name": "setNTP:ipv4",
                        "placeholder": "1.1.1.1,8.8.8.8",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                        "field": lang['DateTimeType'],
                        "name": "dateTimeType",
                        "fieldType": "select",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": [
                            {
                               "name": lang.NTP,
                               "value": "NTP"
                            },
                            {
                               "name": lang.Manual,
                               "value": "Manual"
                            }
                        ]
                     },
                     {
                         "field": lang.DaylightSavings,
                        "name": "daylightSavings",
                        "selector":"onvif_dhcp",
                        "description": "",
                        "default": "true",
                        "example": "",
                        "fieldType": "select",
                        "possible": [
                            {
                               "name": lang.Yes,
                               "value": "true"
                            },
                            {
                               "name": lang.No,
                               "value": "false"
                            }
                        ]
                     },
                     {
                         hidden: true,
                         "field": lang.TimeZone,
                        "name": "timezone",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                 ]
             },
             "Imaging": {
                 "id": "Imaging",
                 "name": lang["Imaging"],
                 "color": "purple",
                 "info": [
                     {
                        "field": lang['IrCutFilter'],
                        "name": "IrCutFilter",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "form-group-class": "imaging-field",
                        "fieldType": "select",
                        "possible": [
                           {
                              "name": lang.On,
                              "value": "ON",
                              "info": lang["fieldTextIrCutFilterOn"]
                           },
                           {
                              "name": lang.Off,
                              "value": "OFF",
                              "info": lang["fieldTextIrCutFilterOff"]
                           },
                           {
                              "name": lang.Auto,
                              "value": "AUTO",
                              "info": lang["fieldTextIrCutFilterAuto"]
                           },
                       ]
                     },
                     {
                        "field": lang['Brightness'],
                        "name": "Brightness",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "form-group-class": "imaging-field",
                        "possible": ""
                     },
                     {
                        "field": lang['ColorSaturation'],
                        "name": "ColorSaturation",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "form-group-class": "imaging-field",
                        "possible": ""
                     },
                     {
                        "field": lang['Contrast'],
                        "name": "Contrast",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "form-group-class": "imaging-field",
                        "possible": ""
                     },
                     {
                        "field": lang['BacklightCompensation'] + ' : ' + lang['Mode'],
                        "name": "BacklightCompensation:Mode",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "form-group-class": "imaging-field",
                        "possible": ""
                     },
                     {
                        "field": lang['Exposure'] + ' : ' + lang['Mode'],
                        "name": "Exposure:Mode",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "form-group-class": "imaging-field",
                        "possible": ""
                     },
                     {
                        "field": lang['Exposure'] + ' : ' + lang['MinExposureTime'],
                        "name": "Exposure:MinExposureTime",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "form-group-class": "imaging-field",
                        "possible": ""
                     },
                     {
                        "field": lang['Exposure'] + ' : ' + lang['MaxExposureTime'],
                        "name": "Exposure:MaxExposureTime",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "form-group-class": "imaging-field",
                        "possible": ""
                     },
                     {
                        "field": lang['Exposure'] + ' : ' + lang['MinGain'],
                        "name": "Exposure:MinGain",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "form-group-class": "imaging-field",
                        "possible": ""
                     },
                     {
                        "field": lang['Exposure'] + ' : ' + lang['MaxGain'],
                        "name": "Exposure:MaxGain",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "form-group-class": "imaging-field",
                        "possible": ""
                     },
                     {
                        "field": lang['Sharpness'],
                        "name": "Sharpness",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "form-group-class": "imaging-field",
                        "possible": ""
                     },
                     {
                        "field": lang['WideDynamicRange'] + ' : ' + lang['Mode'],
                        "name": "WideDynamicRange:Mode",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "form-group-class": "imaging-field",
                        "possible": ""
                     },
                     {
                        "field": lang['WhiteBalance'] + ' : ' + lang['Mode'],
                        "name": "WhiteBalance:Mode",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "form-group-class": "imaging-field",
                        "possible": ""
                     },
                 ]
             },
             "Video Configuration": {
                 "id": "VideoConfiguration",
                 "name": lang["Video Configuration"],
                 "color": "purple",
                 "info": [
                     {
                         hidden: true,
                         "field": lang.Token,
                        "name": "videoToken",
                        "description": "",
                        "default": "",
                        "example": "",
                        "fieldType": "select",
                        "possible": [

                        ]
                     },
                     {
                        "field": lang['Name'],
                        "name": "Name",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                         "field": lang.Resolution,
                        "name": "detail=Resolution",
                        "description": "",
                        "default": "",
                        "example": "",
                        "fieldType": "select",
                        "possible": [

                        ]
                     },
                     {
                         hidden: true,
                        "field": lang['Width'],
                        "name": "Resolution:Width",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                         hidden: true,
                        "field": lang['Height'],
                        "name": "Resolution:Height",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                        "field": lang['Quality'],
                        "name": "Quality",
                        "fieldType": "number",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                        "field": lang['FrameRateLimit'],
                        "name": "RateControl:FrameRateLimit",
                        "fieldType": "number",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                        "field": lang['EncodingInterval'],
                        "name": "RateControl:EncodingInterval",
                        "fieldType": "number",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                        "field": lang['BitrateLimit'],
                        "name": "RateControl:BitrateLimit",
                        "fieldType": "number",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                        "field": lang['GovLength'],
                        "name": "H264:GovLength",
                        "fieldType": "number",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                     {
                        "field": lang['Encoding'],
                        "name": "Encoding",
                        "placeholder": "",
                        "description": "",
                        "default": "H264",
                        "example": "",
                        "fieldType": "select",
                        "possible": [

                        ]
                     },
                     {
                         "field": lang['H264Profile'],
                         "name": "H264:H264Profile",
                        "description": "",
                        "default": "",
                        "example": "",
                        "fieldType": "select",
                        "possible": [

                        ]
                     },
                     {
                         hidden: true,
                        "field": lang['UseCount'],
                        "name": "UseCount",
                        "placeholder": "",
                        "description": "",
                        "default": "",
                        "example": "",
                        "possible": ""
                     },
                 ]
             },
         }
       },
       "Permission Sets": require('./permissionSets.js')(s,config,lang),
       "Sub-Account Manager": require('./subAccountManager.js')(s,config,lang),
       "API Keys": require('./apiKeys.js')(s,config,lang),
     "LDAP": {
         "section": "LDAP",
         "blocks": {
             "LDAP": {
                "evaluation":"details.use_ldap!=='0'",
                "name": lang["LDAP"],
                "color": "forestgreen",
                "info": [
                    {
                       "name": "ldap_url",
                       "field": lang.URL,
                       "description": "",
                       "example": "ldap://127.0.0.1:389",
                       "possible": ""
                    },
                    {
                       "name": "username",
                       "field": lang.Username,
                       "description": "",
                       "example": "",
                       "possible": ""
                    },
                    {
                       "name": "password",
                       "field": lang.Password,
                       "description": "",
                       "example": "",
                       "possible": ""
                    },
                    {
                       "name": "ldap_bindDN",
                       "field": lang.bindDN,
                       "description": "",
                       "example": "cn=admin,dc=test,dc=com",
                       "possible": ""
                    },
                    {
                       "name": "ldap_searchBase",
                       "field": lang['Search Base'],
                       "description": "",
                       "example": "dc=test,dc=com",
                       "possible": ""
                    },
                    {
                       "name": "ldap_searchFilter",
                       "field": lang['Search Filter'],
                       "description": "",
                       "example": "uid={{username}}",
                       "possible": ""
                    },
                    {
                       "fieldType": "btn",
                       "forForm": true,
                       "attribute": `type="submit"`,
                       "class": `btn-success`,
                       "btnContent": `<i class="fa fa-check"></i> &nbsp; ${lang['Save']}`,
                    },
                ]
             }
         }
     },
     "Alarms": require('./alarms.js')(s,config,lang),
     "Region Editor": require('./regionEditor.js')(s,config,lang),
     "Schedules": {
         "section": "Schedules",
         "blocks": {
             "Info": {
                 "name": lang["Monitor States and Schedules"],
                "color": "blue",
                "section-pre-class": "col-md-12",
                "blockquoteClass": "global_tip",
                "blockquote": lang.MonitorStatesText,
                "info": [
                    {
                       "fieldType": "btn",
                       "attribute": `page-open="monitorStates"`,
                       "class": `btn-primary`,
                       "btnContent": `<i class="fa fa-align-right"></i> &nbsp; ${lang["Monitor States"]}`,
                    },
                ]
             },
             "Schedules": {
                "name": lang["Schedules"],
                "color": "orange",
                "section-pre-class": "col-md-6",
                "info": [
                    {
                       "id": "schedulesSelector",
                       "field": lang["Schedules"],
                       "fieldType": "select",
                       "possible": [
                           {
                              "name": lang['Add New'],
                              "value": ""
                           },
                           {
                              "name": lang.Saved,
                              "optgroup": []
                           },
                       ]
                   },
                ]
            },
            "Schedule": {
               "name": lang["Schedule"],
               "headerTitle": `${lang['Schedule']}
                 <div class="pull-right">
                     <a class="btn btn-danger btn-xs delete" style="display:none">&nbsp;<i class="fa fa-trash-o"></i>&nbsp;</a>
                 </div>`,
               "color": "green",
               "section-pre-class": "col-md-6",
               "info": [
                   {
                      "name": "name",
                      "field": lang.Name,
                      "description": "",
                      "example": "Motion Off",
                      "possible": ""
                   },
                   {
                      "name": "enabled",
                      "field": lang.Enabled,
                      "default": "1",
                      "fieldType": "select",
                      "possible": [
                          {
                             "name": lang.No,
                             "value": "0"
                          },
                          {
                             "name": lang.Yes,
                             "value": "1"
                          }
                      ]
                   },
                   {
                      "name": "timezone",
                      "field": lang['Timezone Offset'],
                      "default": config.timeZones.find(tz => !!tz.selected).value,
                      "fieldType": "select",
                      "possible": config.timeZones.map((tz) => {
                          return {
                              "name": tz.text,
                              "value": tz.value
                          }
                      })
                   },
                   {
                      "name": "start",
                      "field": lang.Start,
                      "description": "",
                      "placeholder": "HH:mm",
                      "possible": "1:00"
                   },
                   {
                      "name": "end",
                      "field": lang.End,
                      "description": "",
                      "placeholder": "HH:mm",
                      "possible": "2:00"
                   },
                   {
                      "name": "days",
                      "field": lang.Days,
                      "default": "0",
                      "fieldType": "select",
                      "attribute": "multiple",
                      "possible": [
                          {
                             "name": lang.Sunday,
                             "value": "0"
                          },
                          {
                             "name": lang.Monday,
                             "value": "1"
                          },
                          {
                             "name": lang.Tuesday,
                             "value": "2"
                          },
                          {
                             "name": lang.Wednesday,
                             "value": "3"
                          },
                          {
                             "name": lang.Thursday,
                             "value": "4"
                          },
                          {
                             "name": lang.Friday,
                             "value": "5"
                          },
                          {
                             "name": lang.Saturday,
                             "value": "6"
                          },
                      ]
                   },
                   {
                      "name": "monitorStates",
                      "field": lang['Monitor States'],
                      "fieldType": "select",
                      "attribute": `multiple style="min-height:100px"`,
                      "possible": []
                   },
               ]
           },
         }
     },
     "Monitor States": {
         "section": "Monitor States",
         "blocks": {
             "Info": {
                 "name": lang["Monitor States and Schedules"],
                "color": "blue",
                "section-pre-class": "col-md-12",
                "blockquoteClass": "global_tip",
                "blockquote": lang.MonitorStatesText,
                "info": [
                    {
                       "fieldType": "btn",
                       "attribute": `page-open="schedules"`,
                       "class": `btn-primary`,
                       "btnContent": `<i class="fa fa-clock-o"></i> &nbsp; ${lang["Schedules"]}`,
                    },
                ]
             },
             "Monitor States": {
                 noHeader: true,
                "color": "green",
                "section-pre-class": "col-md-6",
                "info": [
                    {
                       "id": "monitorStatesSelector",
                       "field": lang["Monitor States"],
                       "fieldType": "select",
                       "possible": [
                           {
                              "name": lang['Add New'],
                              "value": ""
                           },
                           {
                              "name": lang['Saved Presets'],
                              "optgroup": []
                           },
                       ]
                   },
                ]
            },
            "Preset": {
               "name": lang["Preset"],
               "color": "green",
               "section-pre-class": "col-md-6",
               "info": [
                   {
                      "fieldType": "btn",
                      "attribute": `type="submit" style="display:none"`,
                      "class": `btn-danger delete`,
                      "btnContent": `<i class="fa fa-trash"></i> &nbsp; ${lang.Delete}`,
                   },
                   {
                      "name": "name",
                      "field": lang.Name,
                      "description": "",
                      "example": "Motion Off",
                      "possible": ""
                   }
               ]
           },
            "Monitors": {
               "name": lang["Monitors"],
               "color": "green",
               "section-pre-class": "col-md-12",
               "info": [
                   {
                      "fieldType": "btn",
                      "class": `btn-success add-monitor`,
                      "btnContent": `<i class="fa fa-plus"></i> &nbsp; ${lang['Add New']}`,
                   },
                  {
                      "fieldType": "div",
                      id: "monitorStatesMonitors",
                  }
               ]
           },
         }
     },
     "Timelapse": {
         "section": "Timelapse",
         "blocks": {
             "Search Settings": {
                "name": lang["Search Settings"],
                "color": "green",
                "section-pre-class": "col-md-4",
                isFormGroupGroup: true,
                "noHeader": true,
                "noDefaultSectionClasses": true,
                "info": [
                    {
                       isFormGroupGroup: true,
                       "noHeader": true,
                       "info": [
                           {
                               "field": lang["Monitor"],
                               "fieldType": "select",
                               "class": "monitors_list",
                               "possible": []
                           },
                           {
                               "id": "timelapsejpeg_date",
                               "field": lang.Date,
                           },
                           {
                               "id": "timelapseJpegFps",
                               "field": lang["Frame Rate"],
                               "fieldType": "range",
                               "min": "1",
                               "max": "30",
                           },
                           {
                              "fieldType": "btn-group",
                              "class": "mb-3",
                              "btns": [
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-primary playPause playPauseText`,
                                      "btnContent": `<i class="fa fa-play"></i> ${lang['Play']}`,
                                  },
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-secondary download_mp4`,
                                      "btnContent": `${lang['Download']}`,
                                  },
                              ],
                          },
                          {
                             "fieldType": "btn-group",
                             "btns": [
                                 {
                                     "fieldType": "btn",
                                     "class": `btn-success fill refresh-data mb-3`,
                                     "icon": `refresh`,
                                     "btnContent": `${lang['Refresh']}`,
                                 },
                             ],
                          },
                      ]
                    },
                    {
                       isFormGroupGroup: true,
                       "headerTitle": `
                         <a class="btn btn-danger btn-sm delete-selected-frames">${lang['Delete selected']}</a>
                         <a class="btn btn-primary btn-sm zip-selected-frames">${lang['Zip and Download']}</a>
                         <div class="pull-right">
                             <input type="checkbox" class="form-check-input select-all">
                         </div>`,
                       "info": [
                           {
                               "fieldType": "form",
                               "class": "frameIcons mt-3 mb-0 row scroll-style-6",
                           }
                      ]
                    }
               ]
           },
           "Watch": {
               noHeader: true,
              "color": "blue",
              style: 'padding:0!important',
              "section-pre-class": "col-md-8",
              "info": [
                  {
                      "fieldType": "div",
                      "class": "playBackView",
                      "divContent": "<img>"
                  }
              ]
          },
        }
      },
     "Event Filters": {
          "section": "Event Filters",
          "blocks": {
              "Saved Filters": {
                 "name": lang["Saved Filters"],
                 "color": "green",
                 "blockquote": lang.eventFilterEnableNoticeText,
                 "info": [
                     {
                        "field": lang["Monitor"],
                        "id": "event_filters_monitors",
                        "fieldType": "select",
                     },
                     {
                        "fieldType": "btn-group",
                        "class": "mb-3",
                        "btns": [
                            {
                                "fieldType": "btn",
                                "class": `btn-success add-filter`,
                                "btnContent": `${lang['Add New']}`,
                            },
                            {
                                "fieldType": "btn",
                                "class": `btn-danger delete-filter`,
                                "btnContent": `${lang['Delete']}`,
                            },
                        ],
                     },
                     {
                        "id": "detector_filters",
                        "field": lang["Filters"],
                        "fieldType": "select",
                     },
                     {
                         hidden:true,
                        "name": "id",
                     },
                     {
                       "name": "enabled",
                       "field": lang.Enabled,
                       "fieldType": "select",
                       "default": "1",
                       "possible": [
                          {
                             "name": "No",
                             "value": "0",
                          },
                          {
                             "name": lang.Yes,
                             "value": "1",
                             "selected": true
                          }
                       ]
                     },
                     {
                        "name": "filter_name",
                        "field": lang['Filter Name'],
                     },
                 ]
             },
             "Conditions": {
                "name": lang["Conditions"],
                "color": "blue",
                "section-class": "where",
                "info": [
                    {
                       "fieldType": "btn-group",
                       "class": "mb-3",
                       "btns": [
                           {
                               "fieldType": "btn",
                               "class": `btn-success add`,
                               "btnContent": `${lang['Add New']}`,
                           },
                       ],
                    },
                    {
                        "id": 'detector_filters_where',
                        "fieldType": 'div',
                    },
                ]
            },
             "Action for Selected": {
                "name": lang["Action for Selected"],
                "color": "red",
                "blockquote": lang.eventFilterActionText,
                "section-class": "actions",
                "info": [
                    {
                      "name": "actions=halt",
                      "field": lang["Drop Event"],
                      "fieldType": "select",
                      "form-group-class": "actions-row",
                      "description": lang["fieldTextActionsHalt"],
                      "default": "0",
                      "possible": [
                         {
                            "name": "No",
                            "value": "0",
                            "selected": true
                         },
                         {
                            "name": lang.Yes,
                            "value": "1",
                         }
                      ]
                    },
                    {
                      "name": "actions=save",
                      "field": lang['Save Events'],
                      "fieldType": "select",
                      "default": "Yes",
                      "form-group-class": "actions-row",
                      "possible": [
                         {
                            "name": lang['Original Choice'],
                            "value": "",
                            "selected": true
                         },
                         {
                            "name": lang.Yes,
                            "value": "1",
                         }
                      ]
                    },
                    {
                       "name": "actions=indifference",
                       "field": lang["Modify Indifference"],
                       "description": lang["fieldTextActionsIndifference"],
                       "form-group-class": "actions-row",
                    },
                    {
                      "name": "actions=webhook",
                      "field": lang['Legacy Webhook'],
                      "fieldType": "select",
                      "form-group-class": "actions-row",
                      "default": "",
                      "example": "1",
                      "possible": [
                         {
                            "name": lang['Original Choice'],
                            "value": "",
                            "selected": true
                         },
                         {
                            "name": lang.Yes,
                            "value": "1",
                         }
                      ]
                    },
                   {
                      "name": "actions=command",
                      "field": lang["Detector Command"],
                      "fieldType": "select",
                      "form-group-class": "actions-row",
                      "description": lang["fieldTextActionsCommand"],
                      "default": "No",
                      "form-group-class": "actions-row",
                      "possible": [
                         {
                            "name": lang['Original Choice'],
                            "value": "",
                            "selected": true
                         },
                         {
                            "name": lang.Yes,
                            "value": "1",
                         }
                      ]
                   },
                   {
                      "name": "actions=record",
                      "field": lang["Use Record Method"],
                      "fieldType": "select",
                      "description": lang["fieldTextActionsRecord"],
                      "default": "",
                      "form-group-class": "actions-row",
                      "possible": [
                         {
                            "name": lang['Original Choice'],
                            "value": "",
                            "selected": true
                         },
                         {
                            "name": lang.Yes,
                            "value": "1",
                         }
                      ]
                   },
                ]
            },
          }
      },
      "ONVIF Scanner": require('./onvifScanner.js')(s,config,lang),
     "Camera Probe": {
          "section": "Camera Probe",
          "blocks": {
              "Search Settings": {
                 "name": lang["FFprobe"],
                 "color": "blue",
                 "blockquote": `<i>"${lang['FFmpegTip']}"</i> - FFmpegTips`,
                 "section-pre-class": "col-md-12",
                 "info": [
                     {
                        "name": "url",
                        "field": lang['Complete Stream URL'],
                        "example": "http://192.168.88.126/videostream.cgi or /dev/video0",
                     },
                     {
                        "fieldType": "btn-group",
                        "btns": [
                            {
                                "fieldType": "btn",
                                "forForm": true,
                                "class": `btn-block btn-success`,
                                "btnContent": `${lang['Check']}`,
                            },
                            {
                                "fieldType": "btn",
                                "class": `btn-default fill`,
                                "btnContent": `${lang['Save']}`,
                            },
                        ],
                     },
                     {
                         "fieldType": "div",
                         "class": "output_data",
                     }
                ]
            },
         }
       },
     "Montior Configuration Finder": {
            "section": "Montior Configuration Finder",
            "blocks": {
                "Search Settings": {
                   "name": lang["Search Settings"],
                   "color": "navy",
                   "blockquote": lang.monitorConfigFinderDescription,
                   "section-pre-class": "col-md-4",
                   "info": [
                       {
                          "id": "shinobihub-sort-by",
                          "field": lang["Sort By"],
                          "fieldType": "select",
                          "possible": [
                              {
                                 "name": lang['Date Updated'],
                                 "value": "dateUpdated"
                              },
                              {
                                 "name": lang['Date Added'],
                                 "value": "dateAdded"
                              },
                              {
                                 "name": lang['Title'],
                                 "value": "heading"
                              },
                              {
                                 "name": lang['Subtitle'],
                                 "value": "opening"
                              },
                          ]
                      },
                       {
                          "id": "shinobihub-sort-direction",
                          "field": lang["Sort By"],
                          "fieldType": "select",
                          "possible": [
                              {
                                 "name": lang['Newest'],
                                 "value": "DESC"
                              },
                              {
                                 "name": lang['Oldest'],
                                 "value": "ASC"
                              },
                          ]
                      },
                      {
                         "id": "shinobihub-search",
                         "field": lang['Search'],
                      },
                      {
                          "id": "shinobihub-pages",
                          "class": "btn-group",
                          "fieldType": "div",
                      }
                  ]
              },
              "Monitor Settings": {
                 "name": lang['Monitor Settings'],
                 "color": "blue",
                 "section-pre-class": "col-md-8",
                 "info": [
                     {
                         "id": "shinobihub-results",
                         "class": "text-center row",
                         "fieldType": "div",
                     }
                 ]
             },
         }
     },
     "Log Viewer": {
          "section": "Log Viewer",
          "blocks": {
              "Saved Logs": {
                 "name": lang["Saved Logs"],
                 "color": "blue",
                 "section-pre-class": "col-md-6 search-parent",
                 "info": [
                     {
                        "id": "log_monitors",
                        "field": lang["Type"],
                        "fieldType": "select",
                        "possible": [
                            {
                               "name": lang['All Logs'],
                               "value": "all"
                            },
                            {
                               "name": lang['For Group'],
                               "value": "$USER"
                            },
                            {
                               "name": lang.Monitors,
                               "optgroup": []
                           }
                        ]
                    },
                     {
                        "field": lang['Search'],
                        "class": 'search-controller',
                     },
                     {
                        "id": "logs_daterange",
                        "field": lang['Date Range'],
                     },
                     {
                        "fieldType": "btn-group",
                        "btns": [
                            {
                                "fieldType": "btn",
                                "class": "btn-default",
                                "forForm": true,
                                "attribute": `download type="button"`,
                                "btnContent": `${lang['Export']}`,
                            },
                            {
                                "fieldType": "btn",
                                "class": "btn-success",
                                "forForm": true,
                                "attribute": `type="submit"`,
                                "btnContent": `${lang['Check']}`,
                            },
                        ],
                     },
                     {
                         "id": "saved-logs-rows",
                         "fieldType": "div",
                         "attribute": `style="max-height: 600px;overflow: auto;"`,
                         "class": "search-body mt-3 px-3 row",
                     }
                ]
            },
            "Streamed Logs": {
               "name": lang['Streamed Logs'],
               "color": "green",
               "section-pre-class": "col-md-6 search-parent",
               "info": [
                   {
                      "field": lang['Search'],
                      "class": 'search-controller',
                   },
                   {
                       "fieldType": "div",
                       "id": "global-log-stream",
                       "attribute": `style="max-height: 600px;overflow: auto;"`,
                       "class": "search-body mt-3",
                   }
               ]
           },
         }
       },
     "Events": {
          "section": "Events",
          "blocks": {
              "Saved Logs": {
                 "name": lang["Search Settings"],
                 "color": "blue",
                 "section-pre-class": "col-md-4",
                 "info": [
                     {
                        "id": "eventListWithPics-monitors-list",
                        "field": lang["Type"],
                        "fieldType": "select",
                        "possible": [
                            {
                               "name": lang['All Monitors'],
                               "value": "all"
                            },
                            {
                               "name": lang.Monitors,
                               "optgroup": []
                           }
                        ]
                     },
                     {
                        "id": "eventListWithPics-daterange",
                        "field": lang['Date Range'],
                     },
                     {
                        "fieldType": "btn-group",
                        "btns": [
                            {
                                "fieldType": "btn",
                                "class": "btn-success",
                                "forForm": true,
                                "attribute": `type="submit"`,
                                "btnContent": `${lang['Check']}`,
                            },
                        ],
                     }
                ]
            },
            "Events Found": {
               "name": lang['Events Found'],
               "color": "green",
               "section-pre-class": "col-md-8 search-parent",
               "info": [
                   {
                      "field": lang['Search'],
                      "class": 'search-controller',
                   },
                   {
                       "fieldType": "div",
                       "id": "eventListWithPics-rows",
                       "class": "search-body mt-3 row",
                   }
               ]
           },
         }
       },
     "Monitor Settings Additional Input Map": {
           "section": "Monitor Settings Additional Input Map",
           "blocks": {
              "Connection" : {
                 "id": `monSectionMap$[TEMP_ID]`,
                 "name": `${lang['Input Map']} $[NUMBER]`,
                 "section-class": "input-map",
                 "color": "orange",
                 "isSection": true,
                 "info": [
                     {
                        "fieldType": "btn-group",
                        "btns": [
                            {
                                "fieldType": "btn",
                                "class": `btn-danger delete mb-2`,
                                "btnContent": `${lang['Delete']}`,
                            }
                        ],
                     },
                     {
                         name:'map-detail=type',
                         field:lang['Input Type'],
                         default:'h264',
                         attribute:'selector="h_i_$[TEMP_ID]"',
                         "fieldType": "select",
                         type:'selector',
                         possible:[
                           {
                              "name": "H.264 / H.265 / H.265+",
                              "value": "h264"
                           },
                           {
                              "name": "JPEG",
                              "value": "jpeg"
                           },
                           {
                              "name": "MJPEG",
                              "value": "mjpeg"
                           },
                           {
                              "name": "HLS (.m3u8)",
                              "value": "hls"
                           },
                           {
                              "name": "MPEG-4 (.mp4 / .ts)",
                              "value": "mp4"
                           },
                           {
                              "name": "Local",
                              "value": "local"
                           },
                           {
                              "name": "Raw",
                              "value": "raw"
                           }
                        ]
                     },
                     {
                         name:'map-detail=fulladdress',
                         field:lang['Full URL Path'],
                         placeholder:'Example : rtsp://admin:password@123.123.123.123/stream/1',
                         type:'text',
                     },
                     {
                         name:'map-detail=sfps',
                         field:lang['Monitor Capture Rate'],
                         placeholder:'',
                         type:'text',
                     },
                     {
                         name:'map-detail=aduration',
                         field:lang['Analyzation Duration'],
                         placeholder:'Example : 1000000',
                         type:'text',
                     },
                     {
                         name:'map-detail=probesize',
                         field:lang['Probe Size'],
                         placeholder:'Example : 1000000',
                         type:'text',
                     },
                     {
                         name:'map-detail=stream_loop',
                         field:lang['Loop Stream'],
                         "form-group-class":'h_i_$[TEMP_ID]_input h_i_$[TEMP_ID]_mp4 h_i_$[TEMP_ID]_raw',
                         hidden:true,
                         default:'0',
                         "fieldType": "select",
                         type:'selector',
                         possible:[
                             {
                                "name": lang.No,
                                "value": "0",
                             },
                             {
                                "name": lang.Yes,
                                "value": "1",
                             }
                         ]
                     },
                     {
                         name:'map-detail=rtsp_transport',
                         field:lang['RTSP Transport'],
                         "form-group-class":'h_i_$[TEMP_ID]_input h_i_$[TEMP_ID]_h264',
                         default:'',
                         "fieldType": "select",
                         type:'selector',
                         possible:[
                             {
                                "name": lang.Auto,
                                "value": "",
                                "info": lang["fieldTextMapRtspTransportAuto"]
                             },
                             {
                                "name": "TCP",
                                "value": "tcp",
                                "info": lang["fieldTextMapRtspTransportTCP"]
                             },
                             {
                                "name": "UDP",
                                "value": "udp",
                                "info": lang["fieldTextMapRtspTransportUDP"]
                             }
                         ]
                     },
                     {
                         name:'map-detail=accelerator',
                         field:lang['Accelerator'],
                         selector:'h_accel_$[TEMP_ID]',
                         default:'0',
                         "fieldType": "select",
                         type:'selector',
                         possible:[
                             {
                                "name": lang.No,
                                "value": "0",
                             },
                             {
                                "name": lang.Yes,
                                "value": "1",
                             }
                         ]
                     },
                     {
                         name:'map-detail=hwaccel',
                         field:lang['hwaccel'],
                         "form-group-class":'h_accel_$[TEMP_ID]_input h_accel_$[TEMP_ID]_1',
                         hidden:true,
                         default:'',
                         "fieldType": "select",
                         type:'selector',
                         possible: s.listOfHwAccels
                     },
                     {
                         name:'map-detail=hwaccel_vcodec',
                         field:lang['hwaccel_vcodec'],
                         "form-group-class":'h_accel_$[TEMP_ID]_input h_accel_$[TEMP_ID]_1',
                         hidden:true,
                         default:'auto',
                         "fieldType": "select",
                         type:'selector',
                         possible:[
                             {
                                "name": lang.Auto + '('+lang.Recommended+')',
                                "value": ""
                             },
                             {
                                "name": lang.NVIDIA,
                                "optgroup": [
                                    {
                                       "name": lang.h264_cuvid,
                                       "value": "h264_cuvid"
                                    },
                                    {
                                       "name": lang.hevc_cuvid,
                                       "value": "hevc_cuvid"
                                    },
                                    {
                                       "name": lang.mjpeg_cuvid,
                                       "value": "mjpeg_cuvid"
                                    },
                                    {
                                       "name": lang.mpeg4_cuvid,
                                       "value": "mpeg4_cuvid"
                                    },
                                ]
                             },
                             {
                                "name": lang["Quick Sync Video"],
                                "optgroup": [
                                    {
                                       "name": lang.h264_qsv,
                                       "value": "h264_qsv"
                                    },
                                    {
                                       "name": lang.hevc_qsv,
                                       "value": "hevc_qsv"
                                    },
                                    {
                                       "name": lang.mpeg2_qsv,
                                       "value": "mpeg2_qsv"
                                    },
                                ]
                             },
                             {
                                "name": lang['Raspberry Pi'],
                                "optgroup": [
                                    {
                                       "name": lang.h264_mmal,
                                       "value": "h264_mmal"
                                    },
                                    {
                                       "name": lang.mpeg2_mmal,
                                       "value": "mpeg2_mmal"
                                    },
                                    {
                                       "name": lang["MPEG-4 (Raspberry Pi)"],
                                       "value": "mpeg4_mmal"
                                    }
                                ]
                             },
                            ]
                     },
                     {
                         name:'map-detail=hwaccel_device',
                         field:lang['hwaccel_device'],
                         "form-group-class":'h_accel_$[TEMP_ID]_input h_accel_$[TEMP_ID]_1',
                         hidden:true,
                         placeholder:'Example : /dev/dri/video0',
                         type:'text',
                     },
                     {
                         name:'map-detail=cust_input',
                         field:lang['Input Flags'],
                         type:'text',
                     },
                 ]
             }
         }
     },
     "Monitor Settings Additional Stream Channel": {
           "section": "Monitor Settings Additional Stream Channel",
           "blocks": {
              "Stream" : {
                  "id": `monSectionChannel$[TEMP_ID]`,
                 "name": `${lang["Stream Channel"]} $[NUMBER]`,
                 "color": "blue",
                 "input-mapping": "stream_channel-$[NUMBER]",
                 "isSection": true,
                 "section-class": "stream-channel",
                 "info": [
                     {
                        "fieldType": "btn-group",
                        "btns": [
                            {
                                "fieldType": "btn",
                                "class": `btn-danger delete mb-2`,
                                "btnContent": `${lang['Delete']}`,
                            }
                        ],
                     },
                     {
                        "field": lang["Stream Type"],
                        "name": `channel-detail="stream_type"`,
                        "description": lang["fieldTextChannelStreamType"],
                        "default": "mp4",
                        "selector": "h_st_channel_$[TEMP_ID]",
                        "fieldType": "select",
                        "attribute": `triggerChange="#monSectionChannel$[TEMP_ID] [channel-detail=stream_vcodec]" triggerChangeIgnore="b64,mjpeg"`,
                        "possible": [
                             {
                                "name": lang.Poseidon,
                                "value": "mp4",
                                "info": lang["fieldTextChannelStreamTypePoseidon"]
                             },
                             {
                                "name": lang["RTMP Stream"],
                                "value": "rtmp",
                             },
                             {
                                "name": lang['MJPEG'],
                                "value": "mjpeg",
                                "info": lang["fieldTextChannelStreamTypeMJPEG"]
                             },
                             {
                                "name": lang['FLV'],
                                "value": "flv",
                                "info": lang["fieldTextChannelStreamTypeFLV"]
                             },
                             {
                                "name": lang['HLS (includes Audio)'],
                                "value": "hls",
                                "info": lang["fieldTextChannelStreamTypeHLS(includesAudio)"]
                             }
                          ]
                     },
                     {
                        "field": lang['Server URL'],
                        "name": `channel-detail="rtmp_server_url"`,
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_rtmp",
                        "example": "rtmp://live-api.facebook.com:80/rtmp/",
                     },
                     {
                        "field": lang['Stream Key'],
                        "name": `channel-detail="rtmp_stream_key"`,
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_rtmp",
                        "example": "1111111111?ds=1&a=xxxxxxxxxx",
                     },
                     {
                        "field": lang['# of Allow MJPEG Clients'],
                        "name": `channel-detail="stream_mjpeg_clients"`,
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_mjpeg",
                        "placeholder": "20",
                     },
                     {
                        "field": lang['Video Codec'],
                        "name": `channel-detail="stream_vcodec"`,
                        "description": lang["fieldTextChannelStreamVcodec"],
                        "default": "no",
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_hls h_st_channel_$[TEMP_ID]_rtmp h_st_channel_$[TEMP_ID]_flv h_st_channel_$[TEMP_ID]_mp4  h_st_channel_$[TEMP_ID]_h264",
                        "fieldType": "select",
                        "selector": "h_hls_v_channel_$[TEMP_ID]",
                        "possible": [
                           {
                              "name": lang.Auto,
                              "value": "no",
                              "info": lang["fieldTextChannelStreamVcodecAuto"]
                           },
                           {
                              "name": "libx264",
                              "value": "libx264",
                              "info": lang["fieldTextChannelStreamVcodecLibx264"]
                           },
                           {
                              "name": "libx265",
                              "value": "libx265",
                              "info": lang["fieldTextChannelStreamVcodecLibx265"]
                           },
                           {
                              "name": lang.copy,
                              "value": "copy",
                              "info": lang["fieldTextChannelStreamVcodecCopy"]
                           },
                           {
                               "name": lang['Hardware Accelerated'],
                               "optgroup": [
                                   {
                                      "name": "H.264 VA-API (Intel HW Accel)",
                                      "value": "h264_vaapi"
                                   },
                                   {
                                      "name": "H.265 VA-API (Intel HW Accel)",
                                      "value": "hevc_vaapi"
                                   },
                                   {
                                      "name": "H.264 NVENC (NVIDIA HW Accel)",
                                      "value": "h264_nvenc"
                                   },
                                   {
                                      "name": "H.264 NVENC Jetson (NVIDIA HW Accel NVMPI)",
                                      "value": "h264_nvmpi"
                                   },
                                   {
                                      "name": "H.265 NVENC (NVIDIA HW Accel)",
                                      "value": "hevc_nvenc"
                                   },
                                   {
                                      "name": "H.264 (Quick Sync Video)",
                                      "value": "h264_qsv"
                                   },
                                   {
                                      "name": "H.265 (Quick Sync Video)",
                                      "value": "hevc_qsv"
                                   },
                                   {
                                      "name": "MPEG2 (Quick Sync Video)",
                                      "value": "mpeg2_qsv"
                                   },
                                   {
                                      "name": "H.264 (Quick Sync Video)",
                                      "value": "h264_qsv"
                                   },
                                   {
                                      "name": "H.265 (Quick Sync Video)",
                                      "value": "hevc_qsv"
                                   },
                                   {
                                      "name": "MPEG2 (Quick Sync Video)",
                                      "value": "mpeg2_qsv"
                                   },
                                   {
                                      "name": "H.264 openMAX (Raspberry Pi)",
                                      "value": "h264_omx"
                                   }
                               ]
                           },
                        ]
                     },
                     {
                        "field": lang["Audio Codec"],
                        "name": `channel-detail="stream_acodec"`,
                        "description": lang["fieldTextChannelStreamAcodec"],
                        "default": "0",
                        "example": "",
                        "fieldType": "select",
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_hls h_st_channel_$[TEMP_ID]_rtmp h_st_channel_$[TEMP_ID]_flv h_st_channel_$[TEMP_ID]_mp4  h_st_channel_$[TEMP_ID]_h264",
                        "possible": [
                           {
                              "name": lang.Auto,
                              "info": lang["fieldTextChannelStreamAcodecAuto"],
                              "value": ""
                           },
                           {
                              "name": lang["No Audio"],
                              "info": lang["fieldTextChannelStreamAcodecNoAudio"],
                              "value": "no"
                           },
                           {
                              "name": "libvorbis",
                              "info": lang["fieldTextChannelStreamAcodecLibvorbis"],
                              "value": "libvorbis"
                           },
                           {
                              "name": "libopus",
                              "info": lang["fieldTextChannelStreamAcodecLibopus"],
                              "value": "libopus"
                           },
                           {
                              "name": "libmp3lame",
                              "info": lang["fieldTextChannelStreamAcodecLibmp3lame"],
                              "value": "libmp3lame"
                           },
                           {
                              "name": "aac",
                              "info": lang["fieldTextChannelStreamAcodecAac"],
                              "value": "aac"
                           },
                           {
                              "name": "ac3",
                              "info": lang["fieldTextChannelStreamAcodecAc3"],
                              "value": "ac3"
                           },
                           {
                              "name": "copy",
                              "info": lang["fieldTextChannelStreamAcodecCopy"],
                              "value": "copy"
                           }
                        ]
                     },
                     {
                        "name": "channel-detail=hls_time",
                        "field": lang["HLS Segment Length"],
                        "description": lang["fieldTextChannelHlsTime"],
                        "default": "2",
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_hls",
                     },
                     {
                        "name": "channel-detail=hls_list_size",
                        "field": lang["HLS List Size"],
                        "description": lang["fieldTextChannelHlsListSize"],
                        "default": "2",
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_hls",
                     },
                     {
                        "name": "channel-detail=preset_stream",
                        "field": lang["HLS Preset"],
                        "description": lang["fieldTextChannelPresetStream"],
                        "example": "ultrafast",
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_hls",
                     },
                     {
                        "name": "channel-detail=stream_quality",
                        "field": lang.Quality,
                        "description": lang["fieldTextChannelStreamQuality"],
                        "default": "15",
                        "example": "1",
                        "form-group-class-pre-layer": "h_hls_v_channel_$[TEMP_ID]_input h_hls_v_channel_$[TEMP_ID]_libx264 h_hls_v_channel_$[TEMP_ID]_libx265 h_hls_v_channel_$[TEMP_ID]_h264_nvenc h_hls_v_channel_$[TEMP_ID]_hevc_nvenc h_hls_v_channel_$[TEMP_ID]_no",
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_mjpeg h_st_channel_$[TEMP_ID]_hls h_st_channel_$[TEMP_ID]_rtmp h_st_channel_$[TEMP_ID]_jsmpeg h_st_channel_$[TEMP_ID]_flv h_st_channel_$[TEMP_ID]_mp4 h_st_channel_$[TEMP_ID]_h264",
                        "possible": "1-23"
                     },
                     {
                        "name": "channel-detail=stream_v_br",
                        "field": lang["Video Bit Rate"],
                        "placeholder": "",
                        "form-group-class-pre-layer": "h_hls_v_channel_$[TEMP_ID]_input h_hls_v_channel_$[TEMP_ID]_libx264 h_hls_v_channel_$[TEMP_ID]_libx265 h_hls_v_channel_$[TEMP_ID]_h264_nvenc h_hls_v_channel_$[TEMP_ID]_hevc_nvenc h_hls_v_channel_$[TEMP_ID]_no",
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_mjpeg h_st_channel_$[TEMP_ID]_hls h_st_channel_$[TEMP_ID]_rtmp h_st_channel_$[TEMP_ID]_jsmpeg h_st_channel_$[TEMP_ID]_flv h_st_channel_$[TEMP_ID]_mp4 h_st_channel_$[TEMP_ID]_h264",
                     },
                     {
                        "name": "channel-detail=stream_a_br",
                        "field": lang["Audio Bit Rate"],
                        "placeholder": "128k",
                        "form-group-class-pre-layer": "h_hls_v_channel_$[TEMP_ID]_input h_hls_v_channel_$[TEMP_ID]_libx264 h_hls_v_channel_$[TEMP_ID]_libx265 h_hls_v_channel_$[TEMP_ID]_h264_nvenc h_hls_v_channel_$[TEMP_ID]_hevc_nvenc h_hls_v_channel_$[TEMP_ID]_no",
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_mjpeg h_st_channel_$[TEMP_ID]_hls h_st_channel_$[TEMP_ID]_rtmp h_st_channel_$[TEMP_ID]_jsmpeg h_st_channel_$[TEMP_ID]_flv h_st_channel_$[TEMP_ID]_mp4 h_st_channel_$[TEMP_ID]_h264",
                     },
                     {
                        "name": "channel-detail=stream_fps",
                        "field": lang['Frame Rate'],
                        "description": lang["fieldTextChannelStreamFps"],
                        "form-group-class-pre-layer": "h_hls_v_channel_$[TEMP_ID]_input h_hls_v_channel_$[TEMP_ID]_libx264 h_hls_v_channel_$[TEMP_ID]_libx265 h_hls_v_channel_$[TEMP_ID]_h264_nvenc h_hls_v_channel_$[TEMP_ID]_hevc_nvenc h_hls_v_channel_$[TEMP_ID]_no",
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_mjpeg h_st_channel_$[TEMP_ID]_hls h_st_channel_$[TEMP_ID]_rtmp h_st_channel_$[TEMP_ID]_jsmpeg h_st_channel_$[TEMP_ID]_flv h_st_channel_$[TEMP_ID]_mp4 h_st_channel_$[TEMP_ID]_h264",
                     },
                     {
                        "name": "channel-detail=stream_scale_x",
                        "field": lang.Width,
                        "description": lang["fieldTextChannelStreamScaleX"],
                        "fieldType": "number",
                        "numberMin": "1",
                        "example": "640",
                        "form-group-class-pre-layer": "h_hls_v_channel_$[TEMP_ID]_input h_hls_v_channel_$[TEMP_ID]_libx264 h_hls_v_channel_$[TEMP_ID]_libx265 h_hls_v_channel_$[TEMP_ID]_h264_nvenc h_hls_v_channel_$[TEMP_ID]_hevc_nvenc h_hls_v_channel_$[TEMP_ID]_no",
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_mjpeg h_st_channel_$[TEMP_ID]_hls h_st_channel_$[TEMP_ID]_rtmp h_st_channel_$[TEMP_ID]_jsmpeg h_st_channel_$[TEMP_ID]_flv h_st_channel_$[TEMP_ID]_mp4 h_st_channel_$[TEMP_ID]_h264",
                     },
                     {
                        "name": "channel-detail=stream_scale_y",
                        "field": lang.Height,
                        "description": lang["fieldTextChannelStreamScaleY"],
                        "fieldType": "number",
                        "numberMin": "1",
                        "example": "480",
                        "form-group-class-pre-layer": "h_hls_v_channel_$[TEMP_ID]_input h_hls_v_channel_$[TEMP_ID]_libx264 h_hls_v_channel_$[TEMP_ID]_libx265 h_hls_v_channel_$[TEMP_ID]_h264_nvenc h_hls_v_channel_$[TEMP_ID]_hevc_nvenc h_hls_v_channel_$[TEMP_ID]_no",
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_mjpeg h_st_channel_$[TEMP_ID]_hls h_st_channel_$[TEMP_ID]_rtmp h_st_channel_$[TEMP_ID]_jsmpeg h_st_channel_$[TEMP_ID]_flv h_st_channel_$[TEMP_ID]_mp4 h_st_channel_$[TEMP_ID]_h264",
                     },
                     {
                        "name": "channel-detail=stream_rotate",
                        "field": lang["Rotate"],
                        "description": lang["fieldTextChannelStreamRotate"],
                        "fieldType": "select",
                        "form-group-class-pre-layer": "h_hls_v_channel_$[TEMP_ID]_input h_hls_v_channel_$[TEMP_ID]_libx264 h_hls_v_channel_$[TEMP_ID]_libx265 h_hls_v_channel_$[TEMP_ID]_h264_nvenc h_hls_v_channel_$[TEMP_ID]_hevc_nvenc h_hls_v_channel_$[TEMP_ID]_no",
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_mjpeg h_st_channel_$[TEMP_ID]_hls h_st_channel_$[TEMP_ID]_rtmp h_st_channel_$[TEMP_ID]_jsmpeg h_st_channel_$[TEMP_ID]_flv h_st_channel_$[TEMP_ID]_mp4 h_st_channel_$[TEMP_ID]_h264",
                        "possible": [
                             {
                                "name": lang["No Rotation"],
                                "value": "no"
                             },
                             {
                                "name": lang["180 Degrees"],
                                "value": "2,transpose=2"
                             },
                             {
                                "name": lang["90 Counter Clockwise and Vertical Flip (default)"],
                                "value": "0"
                             },
                             {
                                "name": lang["90 Clockwise"],
                                "value": "1"
                             },
                             {
                                 "name": lang["90 Counter Clockwise"],
                                 "value": "2"
                             },
                             {
                                "name": lang["90 Clockwise and Vertical Flip"],
                                "value": "3"
                             }
                          ]
                     },
                     {
                         isAdvanced: true,
                        "name": "channel-detail=svf",
                        "field": lang["Video Filter"],
                        "description": lang["fieldTextChannelSvf"],
                        "form-group-class-pre-layer": "h_hls_v_channel_$[TEMP_ID]_input h_hls_v_channel_$[TEMP_ID]_libx264 h_hls_v_channel_$[TEMP_ID]_libx265 h_hls_v_channel_$[TEMP_ID]_h264_nvenc h_hls_v_channel_$[TEMP_ID]_hevc_nvenc h_hls_v_channel_$[TEMP_ID]_no",
                        "form-group-class": "h_st_channel_$[TEMP_ID]_input h_st_channel_$[TEMP_ID]_mjpeg h_st_channel_$[TEMP_ID]_hls h_st_channel_$[TEMP_ID]_rtmp h_st_channel_$[TEMP_ID]_jsmpeg h_st_channel_$[TEMP_ID]_flv h_st_channel_$[TEMP_ID]_mp4 h_st_channel_$[TEMP_ID]_h264",
                    },
                    {
                        "name": "channel-detail=cust_stream",
                        "field": lang["Stream Flags"],
                    },
                 ]
             }
          }
       },
       "Monitor Stream Window": {
           "section": "Monitor Stream Window",
           // gridBlockClass: "",
           // streamBlockPreHtml: `<div class="gps-map-info gps-map-details hidden">
           //     <div><i class="fa fa-compass fa-3x gps-info-bearing"></i></div>
           //     <div><i class="fa fa-compass fa-3x gps-info-speed"></i></div>
           //     <div></div>
           // </div>
           // <div class="gps-map gps-map-info hidden" id="gps-map-$MONITOR_ID"></div>`,
           streamBlockHudHtml: `<div class="camera_cpu_usage">
               <div class="progress">
                   <div class="progress-bar progress-bar-danger" role="progressbar" style="width: 0px;"><span></span></div>
               </div>
           </div>
           <div class="lamp" title="$MONITOR_MODE"><i class="fa fa-eercast"></i></div>`,
           streamBlockHudControlsHtml: `<span title="${lang['Currently viewing']}" class="label label-default">
                <span class="viewers"></span>
           </span>
           <span class="badge btn-success text-white substream-is-on" style="display:none">${lang['Substream']}</span>
           <a class="btn btn-sm badge btn-primary run-monitor-detection-trigger-marker">${lang['Add Marker']}</a>
           <a class="btn btn-sm badge btn-warning run-monitor-detection-trigger-test">${lang['Test Object Event']}</a>
           <a class="btn btn-sm badge btn-warning run-monitor-detection-trigger-test-motion">${lang['Test Motion Event']}</a>
           `,
           gridBlockAfterContentHtml: `<div class="mdl-card__supporting-text text-center">
               <div class="indifference detector-fade">
                   <div class="progress">
                       <div class="progress-bar progress-bar-danger" role="progressbar"><span></span></div>
                   </div>
               </div>
               <div class="monitor_details">
                   <div class="pull-left">
                        $QUICKLINKS
                  </div>
                   <div><span class="monitor_name">$MONITOR_NAME</span></div>
               </div>
           </div>`,
           quickLinks: {
               "Options": {
                  "label": lang['Options'],
                  "class": "default toggle-live-grid-monitor-menu",
                  "icon": "bars"
               },
               "Fullscreen": {
                  "label": lang['Fullscreen'],
                  "class": "default toggle-live-grid-monitor-fullscreen",
                  "icon": "arrows-alt"
               },
               "Monitor Settings": {
                  "label": lang['Monitor Settings'],
                  "class": "default open-monitor-settings",
                  "icon": "wrench",
                  eval: `!isSubAccount || isSubAccount && permissionCheck('monitor_edit',monitorId)`,
               },
               "Toggle Substream": {
                  "label": lang['Toggle Substream'],
                  "class": "warning toggle-monitor-substream",
                  "icon": "eye"
               },
               "Snapshot": {
                  "label": lang['Snapshot'],
                  "class": "primary snapshot-live-grid-monitor",
                  "icon": "camera"
               },
               "Videos List": {
                  "label": lang['Videos List'],
                  "class": "default open-videosTable",
                  "icon": "film",
                  eval: `!isSubAccount || isSubAccount && permissionCheck('video_view',monitorId)`,
               },
               "Reconnect Stream": {
                  "label": lang['Reconnect Stream'],
                  "class": "success signal reconnect-live-grid-monitor",
                  "icon": "plug"
               },
               "Control": {
                  "label": lang['Control'],
                  "class": "default toggle-live-grid-monitor-ptz-controls",
                  "icon": "arrows",
                  eval: `monitor.details.control === '1'`,
               },
               "Show Logs": {
                  "label": lang['Show Logs'],
                  "class": "warning toggle-live-grid-monitor-logs",
                  "icon": "exclamation-triangle"
               },
               "Close": {
                  "label": lang['Close'],
                  "class": "danger close-live-grid-monitor",
                  "icon": "times"
               }
           },
           links: {
              "Mute Audio": {
                  "label": lang['Mute Audio'],
                  "attr": `system="monitorMuteAudioSingle" mid="$MONITOR_ID"`,
                  "class": "primary",
                  "icon": '$MONITOR_MUTE_ICON'
              },
              "Snapshot": {
                 "label": lang['Snapshot'],
                 "class": "primary snapshot-live-grid-monitor",
                 "icon": "camera"
              },
              "Show Logs": {
                 "label": lang['Show Logs'],
                 "class": "warning toggle-live-grid-monitor-logs",
                 "icon": "exclamation-triangle"
              },
              "Toggle Substream": {
                 "label": lang['Toggle Substream'],
                 "class": "warning toggle-monitor-substream",
                 "icon": "eye"
              },
              "Control": {
                 "label": lang['Control'],
                 "class": "default toggle-live-grid-monitor-ptz-controls",
                 "icon": "arrows",
                 eval: `monitor.details.control === '1'`,
              },
              "Reconnect Stream": {
                 "label": lang['Reconnect Stream'],
                 "class": "success signal reconnect-live-grid-monitor",
                 "icon": "plug"
              },
              "Pop": {
                 "label": lang['Pop'],
                 "class": "default run-live-grid-monitor-pop",
                 "icon": "external-link"
              },
              "Zoom In": {
                 "label": lang['Zoom In'],
                 "class": "default magnify-glass-live-grid-stream",
                 "icon": "search-plus"
              },
              // "Calendar": {
              //    "label": lang['Calendar'],
              //    "attr": `monitor="calendar"`,
              //    "class": "default ",
              //    "icon": "calendar"
              // },
              // "Power Viewer": {
              //    "label": lang['Power Viewer'],
              //    "attr": `monitor="powerview"`,
              //    "class": "default",
              //    "icon": "map-marker"
              // },
              "Time-lapse": {
                 "label": lang['Time-lapse'],
                 "attr": `monitor="timelapseJpeg"`,
                 "class": "default",
                 "icon": "angle-double-right",
                 eval: `!isSubAccount || isSubAccount && permissionCheck('video_view',monitorId)`,
              },
              // "Video Grid": {
              //    "label": "Video Grid",
              //    "attr": `monitor="video_grid"`,
              //    "class": "default",
              //    "icon": "th"
              // },
              "Videos List": {
                 "label": lang['Videos List'],
                 "class": "default open-videosTable",
                 "icon": "film",
                 eval: `!isSubAccount || isSubAccount && permissionCheck('video_view',monitorId)`,
              },
              "Monitor Settings": {
                 "label": lang['Monitor Settings'],
                 "class": "default open-monitor-settings",
                 "icon": "wrench",
                 eval: `!isSubAccount || isSubAccount && permissionCheck('monitor_edit',monitorId)`,
              },
              "Fullscreen": {
                 "label": lang['Fullscreen'],
                 "class": "default toggle-live-grid-monitor-fullscreen",
                 "icon": "arrows-alt"
              },
              "Close": {
                 "label": lang['Close'],
                 "class": "danger close-live-grid-monitor",
                 "icon": "times"
              }
           }
       },
       "Monitor Options": {
           "section": "Monitor Options",
           "dropdownClass": `${Theme.isDark ? 'dropdown-menu-dark' : ''} ${mainBackgroundColor}`
       },
       "SideMenu": {
           "section": "SideMenu",
           showMonitors: true,
           "blocks": {
               "Container1": {
                  // "id": "sidebarMenu",
                  "class": `col-md-3 col-lg-2 d-md-block ${mainBackgroundColor} sidebar collapse`,
                  "links": [
                      {
                          icon: 'home',
                          label: lang.Home,
                          pageOpen: 'initial',
                      },
                      {
                          icon: 'th',
                          label: lang['Live Grid'] + ` &nbsp;
                          <span class="badge bg-light text-dark rounded-pill align-text-bottom liveGridOpenCount">0</span>`,
                          pageOpen: 'liveGrid',
                          addUl: true,
                          ulItems: [
                              {
                                  label: lang['Open Wall Display'],
                                  class: 'open-wallview cursor-pointer',
                                  color: 'blue',
                              },
                              {
                                  label: lang['Open All Monitors'],
                                  class: 'open-all-monitors cursor-pointer',
                                  color: 'orange',
                              },
                              {
                                  label: lang['Close All Monitors'],
                                  class: 'close-all-monitors cursor-pointer',
                                  color: 'red',
                              },
                              {
                                  label: lang['Open Next Monitors'],
                                  class: 'open-next-monitors cursor-pointer',
                                  color: 'blue',
                              },
                              {
                                  label: lang['Open Previous'],
                                  class: 'open-previous-monitors cursor-pointer',
                                  color: 'blue',
                              },
                              {
                                  label: lang['Remember Positions'],
                                  class: 'cursor-pointer',
                                  attributes: 'shinobi-switch="monitorOrder" ui-change-target=".dot" on-class="dot-green" off-class="dot-grey"',
                                  color: 'grey',
                              },
                              {
                                  label: lang['Auto Open on Load'],
                                  class: 'cursor-pointer',
                                  attributes: 'shinobi-switch="autoOpenOnLoad" ui-change-target=".dot" on-class="dot-green" off-class="dot-grey"',
                                  color: 'grey',
                              },
                              {
                                  label: lang['Maintain Grid'],
                                  class: 'cursor-pointer',
                                  attributes: 'shinobi-switch="liveGridMaintainGrid" ui-change-target=".dot" on-class="dot-green" off-class="dot-grey"',
                                  color: 'grey',
                              },
                              {
                                  label: lang['Mute Audio'],
                                  class: 'cursor-pointer',
                                  attributes: 'shinobi-switch="monitorMuteAudio" ui-change-target=".dot" on-class="dot-green" off-class="dot-grey"',
                                  color: 'grey',
                              },
                              // {
                              //     label: lang['JPEG Mode'],
                              //     class: 'cursor-pointer',
                              //     attributes: 'shinobi-switch="jpegMode" ui-change-target=".dot" on-class="dot-green" off-class="dot-grey"',
                              //     color: 'grey',
                              // },
                              {
                                  label: lang['Stream in Background'],
                                  class: 'cursor-pointer',
                                  attributes: 'shinobi-switch="backgroundStream" ui-change-target=".dot" on-class="dot-grey" off-class="dot-green"',
                                  color: 'grey',
                              },
                              {
                                  label: lang[`Original Aspect Ratio`],
                                  class: 'cursor-pointer',
                                  attributes: 'shinobi-switch="dontMonStretch" ui-change-target=".dot" on-class="dot-grey" off-class="dot-green"',
                                  color: 'grey',
                              },
                              {
                                  label: lang[`Hide Detection on Stream`],
                                  class: 'cursor-pointer',
                                  attributes: 'shinobi-switch="dontShowDetection" ui-change-target=".dot" on-class="dot-green" off-class="dot-grey"',
                                  color: 'grey',
                              },
                              {
                                  label: lang[`Alert on Event`],
                                  class: 'cursor-pointer',
                                  attributes: 'shinobi-switch="alertOnEvent" ui-change-target=".dot" on-class="dot-green" off-class="dot-grey"',
                                  color: 'grey',
                              },
                              {
                                  label: lang[`Popout on Event`],
                                  class: 'cursor-pointer',
                                  attributes: 'shinobi-switch="popOnEvent" ui-change-target=".dot" on-class="dot-green" off-class="dot-grey"',
                                  color: 'grey',
                              },
                              ...[
                                  1,2,3
                                  //,4,6
                              ].map(gridNumber => {
                                  return {
                                      label: `${gridNumber} x ${gridNumber}`,
                                      class: 'cursor-pointer auto-place-monitors',
                                      attributes: `data-number="${gridNumber}"`,
                                      color: 'purple',
                                  }
                              }),
                          ]
                      },
                      {
                          icon: 'video-camera',
                          label: `${lang.Monitors} &nbsp;
                          <span class="badge bg-light text-dark rounded-pill align-text-bottom cameraCount"><i class="fa fa-spinner fa-pulse"></i></span>`,
                          pageOpen: 'monitorsList',
                      },
                      {
                          icon: 'barcode',
                          label: `${lang['Timeline']}`,
                          pageOpen: 'timeline',
                          addUl: true,
                          ulStyle: `max-height:250px;overflow:auto;`
                      },
                      {
                          icon: 'map-marker',
                          label: `${lang['Monitor Map']}`,
                          pageOpen: 'monitorMap',
                      },
                      {
                          icon: 'film',
                          label: `${lang['Videos']}`,
                          pageOpen: 'videosTableView',
                          addUl: true,
                          ulItems: [
                              {
                                  label: lang[`Save Compressed Video on Completion`],
                                  class: 'cursor-pointer',
                                  attributes: 'shinobi-switch="saveCompressedVideo" ui-change-target=".dot" on-class="dot-green" off-class="dot-grey"',
                                  color: 'grey',
                              },
                          ]
                      },
                      {
                          icon: 'calendar',
                          label: `${lang['Calendar']}`,
                          pageOpen: 'calendarView',
                      },
                      {
                          icon: 'fast-forward',
                          label: `${lang['Time-lapse']}`,
                          pageOpen: 'timelapseViewer',
                          addUl: true,
                          ulItems: [
                              {
                                  label: lang[`Save Built Video on Completion`],
                                  class: 'cursor-pointer',
                                  attributes: 'shinobi-switch="timelapseSaveBuiltVideo" ui-change-target=".dot" on-class="dot-green" off-class="dot-grey"',
                                  color: 'grey',
                              },
                          ]
                      },
                      {
                          icon: 'file-o',
                          label: `${lang['FileBin']}`,
                          pageOpen: 'fileBinView',
                      },
                      {
                          divider: true,
                      },
                      {
                          icon: 'wrench',
                          label: `${lang['Monitor Settings']}`,
                          pageOpen: 'monitorSettings',
                          addUl: true,
                          eval: `!$user.details.sub || $user.details.monitor_create != 0`,
                      },
                      {
                          icon: 'grav',
                          label: `${lang['Region Editor']}`,
                          pageOpen: 'regionEditor',
                          eval: `!$user.details.sub`,
                      },
                      {
                          icon: 'filter',
                          label: `${lang['Event Filters']}`,
                          pageOpen: 'eventFilters',
                          eval: `!$user.details.sub`,
                      },
                      {
                          icon: 'align-right',
                          label: `${lang['Monitor States']}`,
                          pageOpen: 'monitorStates',
                          eval: `!$user.details.sub`,
                      },
                      {
                          icon: 'clock-o',
                          label: `${lang['Schedules']}`,
                          pageOpen: 'schedules',
                          eval: `!$user.details.sub`,
                      },
                      {
                          icon: 'exclamation-triangle',
                          label: `${lang['Logs']}`,
                          pageOpen: 'logViewer',
                          eval: `!$user.details.sub || $user.details.view_logs != 0`,
                      },
                      {
                          divider: true,
                      },
                      {
                          icon: 'gears',
                          label: `${lang['Account Settings']}`,
                          pageOpen: 'accountSettings',
                          eval: `!$user.details.sub || $user.details.user_change != 0`,
                          addUl: true,
                      },
                      {
                          icon: 'group',
                          label: `${lang.subAccountManager}`,
                          pageOpen: 'subAccountManager',
                          addUl: true,
                          eval: `!$user.details.sub`,
                      },
                      {
                          icon: 'group',
                          label: `${lang['Permission Groups']}`,
                          pageOpen: 'permissionSets',
                          eval: `!$user.details.sub || $user.details.edit_permissions != 0`,
                      },
                      {
                          icon: 'key',
                          label: `${lang['API Keys']}`,
                          pageOpen: 'apiKeys',
                      },
                      {
                          divider: true,
                      },
                      {
                          icon: 'search',
                          label: `${lang['ONVIF Scanner']}`,
                          pageOpen: 'onvifScanner',
                          addUl:true,
                          eval: `!$user.details.sub || $user.details.monitor_create != 0`,
                      },
                      {
                          icon: 'opera',
                          label: `${lang['ONVIF Device Manager']}`,
                          pageOpen: 'onvifDeviceManager',
                          eval: `!$user.details.sub || $user.details.monitor_create != 0`,
                      },
                      {
                          icon: 'ravelry',
                          label: `${lang['Rally']}`,
                          pageOpen: 'rally',
                      },
                      {
                          icon: 'eyedropper',
                          label: `${lang['FFprobe']}`,
                          pageOpen: 'cameraProbe',
                      },
                      {
                          icon: 'compass',
                          label: `${lang['XenocipherHub']}`,
                          pageOpen: 'configFinder',
                          addUl: true,
                          eval: `!$user.details.sub || $user.details.monitor_create != 0`,
                      },
                      {
                          divider: true,
                      },
                      {
                          icon: 'info-circle',
                          label: `${lang['Help']}`,
                          pageOpen: 'helpWindow',
                      },
                      // {
                      //     icon: 'exclamation-circle',
                      //     label: `${lang['Events']}`,
                      //     pageOpen: 'eventListWithPics',
                      // },
                      {
                          icon: 'sign-out',
                          label: `${lang['Logout']}`,
                          class: 'logout',
                      },
                  ]
              },
              "SideMenuBeforeList": {
                 "name": "SideMenuBeforeList",
                 "color": "grey",
                 "noHeader": true,
                 "noDefaultSectionClasses": true,
                 "section-class": "px-3",
                 "info": [
                     {
                         isFormGroupGroup: true,
                         "noHeader": true,
                         "noDefaultSectionClasses": true,
                         "section-class": "card btn-default text-white px-3 py-2 mb-3 border-0",
                         info: [
                             {
                                  "fieldType": "div",
                                  "id": `clock`,
                                  "style": `cursor:pointer`,
                                  "attribute": `data-target="#time-hours"`,
                                  "divContent": `<div id="time-date"></div>
                                                    <ul>
                                                        <li id="time-hours"></li>
                                                        <li class="point">:</li>
                                                        <li id="time-min"></li>
                                                        <li class="point">:</li>
                                                        <li id="time-sec"></li>
                                                    </ul>
                                                    `
                             },
                         ]
                     },
                     {
                         "id": "indicator-bars",
                         isFormGroupGroup: true,
                         "noHeader": true,
                         "noDefaultSectionClasses": true,
                         "section-class": "card text-white bg-gradient-blue px-3 py-2 mb-3 border-0",
                         info: [
                             {
                                 "fieldType": "indicatorBar",
                                 "icon": "square",
                                 "name": "cpu",
                                 "label": `<span class="os_cpuCount"><i class="fa fa-spinner fa-pulse"></i></span> ${lang.CPU}<span class="os_cpuCount_trailer"></span> : <span class="os_platform" style="text-transform:capitalize"><i class="fa fa-spinner fa-pulse"></i></span>`,
                             },
                             {
                                 "fieldType": "indicatorBar",
                                 "icon": "microchip",
                                 "name": "ram",
                                 "label": `<span class="os_totalmem used"><i class="fa fa-spinner fa-pulse"></i></span> ${lang.MB} ${lang.RAM}`,
                             },
                             {
                                 id: 'disk-indicator-bars',
                                 isFormGroupGroup: true,
                                 "noHeader": true,
                                 "noDefaultSectionClasses": true,
                                 "section-class": "disk-indicator-bars",
                                 info: [
                                     {
                                         "fieldType": "indicatorBar",
                                         "icon": "hdd-o",
                                         "name": "disk",
                                         "bars": 3,
                                         "color0": "info",
                                         "title0": lang["Video Share"],
                                         "color1": "danger",
                                         "title1": lang["Timelapse Frames Share"],
                                         "color2": "warning",
                                         "title2": lang["FileBin Share"],
                                         "label": `<span class="diskUsed" style="text-transform:capitalize">${lang.Primary}</span> : <span class="value"></span>`,
                                     },
                                 ]
                             },
                             {
                                 "fieldType": "indicatorBar",
                                 "percent": 0,
                                 "color": 'warning',
                                 "indicatorPercentClass": 'activeCameraCount',
                                 "icon": "video-camera",
                                 "name": "activeCameraCount",
                                 "label": lang['Active Monitors'],
                             },
                         ]
                     }
                 ]
              },
              "SideMenuAfterList": {
                 "name": "SideMenuAfterList",
                 "noHeader": true,
                 "noDefaultSectionClasses": true,
                 "info": []
              }
           }
       },
       "Home": {
           "section": "Home",
           "blocks": {
            //   "Container1": {
            //      "name": "Container1",
            //      "color": "grey",
            //      "noHeader": true,
            //      "noDefaultSectionClasses": true,
            //      "section-class": "col-md-3 pt-3",
            //      "info": [
            //          {
            //              "fieldType": "div",
            //              "class": `card ${mainBackgroundColor} mb-3`,
            //              "divContent": `<div class="card-body ${textWhiteOnBgDark}">
            //                  <h5 class="card-title"><i class="fa fa-th text-muted"></i> ${lang['Live Grid']}</h5>
            //                  <p class="card-text">${lang.liveGridDescription}</p>
            //                  <a page-open="liveGrid" class="btn btn-primary">${lang.Open}</a>
            //                </div>`
            //          },
            //          {
            //              "fieldType": "div",
            //              "class": `card ${mainBackgroundColor} mb-3`,
            //              "divContent": `<div class="card-body ${textWhiteOnBgDark}">
            //                  <h5 class="card-title"><i class="fa fa-gears text-muted"></i> ${lang['Account Settings']}</h5>
            //                  <p class="card-text">${lang.accountSettingsDescription}</p>
            //                  <a page-open="accountSettings" class="btn btn-primary">${lang.Open}</a>
            //                </div>`
            //          },
            //      ]
            // },
            "Container4": {
                "name": "Container4",
                "color": "grey",
                "noHeader": true,
                "noDefaultSectionClasses": true,
                "section-class": "col-lg-12",
                "info": [
                    {
                        ejs: 'blocks/home/recentVideos',
                    },
                ]
            }
         }
      },
      "Power Viewer": {
           "section": lang["Power Viewer"],
           "blocks": {
            "Video Playback": {
                id: "powerVideoVideoPlayback",
                noHeader: true,
                noDefaultSectionClasses: true,
               "color": "green",
               "section-pre-class": "col-md-8 search-parent",
               "info": [
                   {
                      "id": "powerVideoMonitorViews",
                      "fieldType": "div",
                   },
                   {
                       "id": "powerVideoMonitorControls",
                       "color": "blue",
                       noHeader: true,
                       isSection: true,
                       isFormGroupGroup: true,
                       'section-class': 'text-center',
                       "info": [
                           {
                              "fieldType": "btn-group",
                              "normalWidth": true,
                              "btns": [
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-success btn-sm`,
                                      "attribute": `powerVideo-control="downloadPlaying" title="${lang['Download']}"`,
                                      "btnContent": `<i class="fa fa-download"></i>`,
                                  }
                              ],
                           },
                           {
                              "fieldType": "btn-group",
                              "normalWidth": true,
                              "btns": [
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-default btn-sm`,
                                      "attribute": `powerVideo-control="toggleZoom" title="${lang['Zoom In']}"`,
                                      "btnContent": `<i class="fa fa-search-plus"></i>`,
                                  },
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-default btn-sm`,
                                      "attribute": `powerVideo-control="toggleMute" title="${lang['Zoom In']}"`,
                                      "btnContent": `<i class="fa fa-volume-off"></i>`,
                                  },
                              ],
                           },
                           {
                              "fieldType": "btn-group",
                              "normalWidth": true,
                              "btns": [
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-default btn-sm`,
                                      "attribute": `powerVideo-control="previousVideoAll" title="${lang['Previous Video']}"`,
                                      "btnContent": `<i class="fa fa-arrow-circle-left"></i>`,
                                  },
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-danger btn-sm`,
                                      "attribute": `powerVideo-control="playAll" title="${lang['Play']}"`,
                                      "btnContent": `<i class="fa fa-play"></i>`,
                                  },
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-default btn-sm`,
                                      "attribute": `powerVideo-control="pauseAll" title="${lang['Pause']}"`,
                                      "btnContent": `<i class="fa fa-pause"></i>`,
                                  },
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-default btn-sm`,
                                      "attribute": `powerVideo-control="nextVideoAll" title="${lang['Next Video']}"`,
                                      "btnContent": `<i class="fa fa-arrow-circle-right"></i>`,
                                  },
                              ],
                           },
                           {
                              "fieldType": "btn-group",
                              "style": "font-family: monospace;",
                              "normalWidth": true,
                              "btns": [
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-default btn-sm`,
                                      "attribute": `powerVideo-control="playSpeedAll" data-speed="1"`,
                                      "btnContent": `1`,
                                  },
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-default btn-sm`,
                                      "attribute": `powerVideo-control="playSpeedAll" data-speed="5"`,
                                      "btnContent": `5`,
                                  },
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-default btn-sm`,
                                      "attribute": `powerVideo-control="playSpeedAll" data-speed="10"`,
                                      "btnContent": `10`,
                                  },
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-default btn-sm`,
                                      "attribute": `powerVideo-control="playSpeedAll" data-speed="15"`,
                                      "btnContent": `15`,
                                  },
                              ],
                           },
                       ]
                   },
               ]
           },
           "Container2": {
               id: "powerVideoTabs",
               noHeader: true,
              "section-pre-class": "col-md-4",
              attribute: `tab-chooser-parent`,
              "info": [
                  {
                      "field": lang['Monitors'],
                      "id": "powerVideoMonitorsList",
                      "fieldType": "form",
                      "style": "overflow-y:auto;max-height:200px;",
                  },
                  {
                     "id": "powerVideo_tag_search",
                     "field": lang["Search Object Tags"],
                     "example": "person",
                  },
                  {
                     "id": "powerVideoDateRange",
                     "field": lang['Date Range'],
                  },
                  {
                     "id": "powerVideoVideoLimit",
                     "field": lang['Video Limit'] + ` (${lang['Per Monitor']})`,
                     "placeholder": "0",
                  },
                  {
                     "id": "powerVideoEventLimit",
                     "field": lang['Event Limit'] + ` (${lang['Per Monitor']})`,
                     "placeholder": "500",
                  },
                  {
                      id:'powerVideoSet',
                      field: lang['Video Set'],
                      default:'h264',
                      "fieldType": "select",
                      possible:[
                        {
                            "name": lang.Local,
                           "value": ""
                        },
                        {
                           "name": lang.Cloud,
                           "value": "cloud"
                        },
                        {
                            "name": lang.Archive,
                           "value": "archive"
                        },
                     ]
                  },
              ]
          },
           "Time Strip": {
               id: "powerVideoTimelineStripsContainer",
               noHeader: true,
              "color": "bg-gradient-blue text-white",
              "section-pre-class": "col-md-12",
              "info": [
                  {
                     "id": "powerVideoTimelineStrips",
                     "fieldType": "div",
                     "divContent": `<div class="loading"><i class="fa fa-hand-pointer-o"></i><div class="epic-text">${lang['Select a Monitor']}</div></div>`,
                  },
              ]
          },
         }
      },
      "Studio": {
           "section": lang["Studio"],
           "blocks": {
            "Video Playback": {
                id: "studioVideoPlayback",
                noHeader: true,
                noDefaultSectionClasses: true,
               "color": "green",
               "section-pre-class": "col-md-8 search-parent",
               "info": [
                   {
                      "id": "studioViewingCanvas",
                      "fieldType": "div",
                   },
                   {
                       "id": "studioMonitorControls",
                       "color": "blue",
                       noHeader: true,
                       isSection: true,
                       isFormGroupGroup: true,
                       'section-class': 'text-center',
                       "info": [
                           {
                              "fieldType": "btn-group",
                              "normalWidth": true,
                              "btns": [
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-default btn-sm play-preview`,
                                      "attribute": `title="${lang['Play']}"`,
                                      "btnContent": `<i class="fa fa-play"></i>`,
                                  },
                                  {
                                      "fieldType": "btn",
                                      "class": `btn-default btn-sm slice-video`,
                                      "attribute": `title="${lang['Slice']}"`,
                                      "btnContent": `<i class="fa fa-scissors"></i>`,
                                  },
                              ],
                           },
                       ]
                   },
                   {
                       "color": "bg-gradient-blue text-white",
                       noHeader: true,
                       isSection: true,
                       isFormGroupGroup: true,
                       'section-class': 'text-center',
                       "info": [
                           {
                              "id": "studioTimelineStrip",
                              "fieldType": "div",
                              "divContent": `
                                  <div id="studio-time-ticks"></div>
                                  <div id="studio-seek-tick"></div>
                                  <div id="studio-slice-selection" style="width: 80%;left: 10%;"></div>
                              `,
                           },
                       ]
                   },
               ]
           },
           "Container2": {
               noHeader: true,
              "section-pre-class": "col-md-4",
              "noDefaultSectionClasses": true,
              "info": [
                  {
                     "id": "studio-completed-videos",
                     "fieldType": "div",
                  },
              ]
          }
         }
      },
      "Calendar": {
          "section": "Calendar",
          "blocks": {
              "Search Settings": {
                 "name": lang["Search Settings"],
                 "color": "green",
                 "section-pre-class": "col-md-4",
                 "info": [
                     {
                         "field": lang["Monitor"],
                         "fieldType": "select",
                         "class": "monitors_list",
                         "possible": []
                     },
                     {
                         "class": "date_selector",
                         "field": lang.Date,
                     },
                     {
                        "fieldType": "btn-group",
                        "btns": [
                            {
                                "fieldType": "btn",
                                "class": `btn-success fill refresh-data mb-3`,
                                "icon": `refresh`,
                                "btnContent": `${lang['Refresh']}`,
                            },
                        ],
                     }
                ]
            },
            "Calendar": {
                noHeader: true,
               "section-pre-class": "col-md-8",
               "info": [
                   {
                       "fieldType": "div",
                       "id": "calendar_draw_area",
                       "divContent": ""
                   }
               ]
           },
         }
      },
      "FileBin": {
          "section": "FileBin",
          "blocks": {
              "Search Settings": {
                 "name": lang["Search Settings"],
                 "color": "green",
                 "section-pre-class": "col-md-4",
                 "info": [
                     {
                         "field": lang["Monitor"],
                         "fieldType": "select",
                         "class": "monitors_list",
                         "possible": []
                     },
                     {
                         "class": "date_selector",
                         "field": lang.Date,
                     },
                     {
                        "fieldType": "btn-group",
                        "btns": [
                            {
                                "fieldType": "btn",
                                "class": `btn-success fill refresh-data mb-3`,
                                "icon": `refresh`,
                                "btnContent": `${lang['Refresh']}`,
                            }
                        ],
                     },
                     {
                         "fieldType": "div",
                         "id": "fileBin_preview_area",
                         "divContent": ""
                     }
                ]
            },
            "FileBin": {
                noHeader: true,
               "section-pre-class": "col-md-8",
               "info": [
                   {
                       "fieldType": "table",
                       "attribute": `data-classes="table table-striped"`,
                       "id": "fileBin_draw_area",
                       "divContent": ""
                   }
               ]
           },
         }
      },
      "Videos Table": {
          "section": "Videos Table",
          "blocks": {
              "Search Settings": {
                 "name": lang["Search Settings"],
                 "color": "green",
                 "section-pre-class": "col-md-4",
                 "info": [
                     {
                         "field": lang["Monitor"],
                         "fieldType": "select",
                         "class": "monitors_list",
                         "possible": []
                     },
                     {
                        "id": "videosTable_tag_search",
                        "field": lang["Search Object Tags"],
                        "example": "person",
                     },
                     {
                         id:'videosTable_tag_search_andonly',
                         field: lang['Search Type'],
                         default: '0',
                         "fieldType": "select",
                         possible:[
                             {
                                 "name": lang.OR,
                                 "value": "0",
                                 selected: true,
                             },
                             {
                                 "name": lang.AND,
                                 "value": "1"
                             },
                        ]
                     },
                     {
                         "class": "date_selector",
                         "field": lang.Date,
                     },
                     {
                         id:'videosTable_cloudVideos',
                         field: lang['Video Set'],
                         default: 'local',
                         "fieldType": "select",
                         possible:[
                           {
                               "name": lang.Local,
                              "value": "local"
                           },
                           {
                               "name": lang.Archive,
                              "value": "archive"
                           },
                           {
                              "name": lang.Cloud,
                              "value": "cloud"
                           },
                        ]
                     },
                     {
                        "fieldType": "btn-group",
                        "btns": [
                            {
                                "fieldType": "btn",
                                "class": `btn-success fill refresh-data mb-3`,
                                "icon": `search`,
                                "btnContent": `${lang['Search']}`,
                            },
                        ],
                     },
                     {
                         "fieldType": "div",
                         "id": "videosTable_preview_area",
                         "divContent": ""
                     },
                ]
            },
            "theTable": {
                noHeader: true,
               "section-pre-class": "col-md-8",
               "info": [
                   {
                       "fieldType": "div",
                       "id": "videosTable_draw_area_notice",
                       "divContent": `<div class="text-center">
                            <i class="fa fa-5x mb-3 fa-hand-pointer-o fa-rotate-270"></i>
                        </div>
                        <h3 class="text-center">
                            <div>${lang['Ready to Search']}</div>
                        </h3>`
                   },
                   {
                       "fieldType": "table",
                       "attribute": `data-classes="table table-striped"`,
                       "id": "videosTable_draw_area",
                       "divContent": ""
                   }
               ]
           },
         }
      },
      "Admin Account Settings": {
           "section": "Admin Account Settings",
           "blocks": {
               "Editor": {
                  "name": lang["Admin Account Settings"],
                  "color": "blue",
                  "info": [
                      {
                         "name": "mail",
                         "field": lang.Email,
                      },
                      {
                         "name": "ke",
                         "field": lang['Group Key'],
                      },
                      {
                         "name": "pass",
                         "type": "password",
                         "field": lang['Password'],
                         "fieldType": "password",
                      },
                      {
                         "name": "password_again",
                         "type": "password",
                         "field": lang['Password Again'],
                         "fieldType": "password",
                      },
                      {
                          "field": lang['2-Factor Authentication'],
                          "name": "detail=factorAuth",
                          "default":'0',
                          "fieldType": "select",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      {
                         "name": "detail=size",
                         "field": lang['Max Storage Amount'],
                         "default": '10000'
                      },
                      {
                         "name": "detail=days",
                         "field": `${lang['Number of Days to keep']} ${lang['Videos']}`,
                         "default": '5'
                      },
                      {
                         "name": "detail=event_days",
                         "field": `${lang['Number of Days to keep']} ${lang['Events']}`,
                         "default": '10'
                      },
                      {
                         "name": "detail=log_days",
                         "field": `${lang['Number of Days to keep']} ${lang['Logs']}`,
                         "default": '10'
                      },
                      // {
                      //    "name": "detail=log_timelapseFrames",
                      //    "field": `${lang['Number of Days to keep']} ${lang['Timelapse Frames']}`,
                      //    "default": '10'
                      // },
                      {
                         "name": "detail=max_camera",
                         "field": lang['Max Number of Cameras'],
                         "placeholder": lang['Leave blank for unlimited']
                      },
                      {
                          "field": lang.Permissions,
                          "name": "detail=permissions",
                          "default":'1',
                          "fieldType": "select",
                          selector:'more_perms',
                          possible: [
                            {
                                "name": lang['All Privileges'],
                               "value": "all"
                            },
                            {
                               "name": lang.Limited,
                               "value": "limited"
                            },
                         ]
                      },
                      {
                          "field": lang['Can edit Max Storage'],
                          "name": "detail=edit_size",
                          "default":'1',
                          "fieldType": "select",
                          "form-group-class":"more_perms_input more_perms_limited",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      {
                          "field": lang['Can edit Max Days'],
                          "name": "detail=edit_days",
                          "default":'1',
                          "fieldType": "select",
                          "form-group-class":"more_perms_input more_perms_limited",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      {
                          "field": lang['Can edit how long to keep Events'],
                          "name": "detail=edit_event_days",
                          "default":'1',
                          "fieldType": "select",
                          "form-group-class":"more_perms_input more_perms_limited",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      {
                          "field": lang['Can edit how long to keep Logs'],
                          "name": "detail=edit_log_days",
                          "default":'1',
                          "fieldType": "select",
                          "form-group-class":"more_perms_input more_perms_limited",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      // NEEDS TO MOVE DESIGNATED FILES AFTER TESTING >
                      {
                          "field": lang['Can use Amazon S3'],
                          "name": "detail=use_aws_s3",
                          "default":'1',
                          "fieldType": "select",
                          "form-group-class":"more_perms_input more_perms_limited",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      {
                          "field": lang['Can use Wasabi Hot Cloud Storage'],
                          "name": "detail=use_whcs",
                          "default":'1',
                          "fieldType": "select",
                          "form-group-class":"more_perms_input more_perms_limited",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      {
                          "field": lang['Can use SFTP'],
                          "name": "detail=use_sftp",
                          "default":'1',
                          "fieldType": "select",
                          "form-group-class":"more_perms_input more_perms_limited",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      {
                          "field": lang['Can use WebDAV'],
                          "name": "detail=use_webdav",
                          "default":'1',
                          "fieldType": "select",
                          "form-group-class":"more_perms_input more_perms_limited",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      {
                          "field": lang['Can use Discord Bot'],
                          "name": "detail=use_discordbot",
                          "default":'1',
                          "fieldType": "select",
                          "form-group-class":"more_perms_input more_perms_limited",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      {
                          "field": lang['Can use LDAP'],
                          "name": "detail=use_ldap",
                          "default":'1',
                          "fieldType": "select",
                          "form-group-class":"more_perms_input more_perms_limited",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      {
                          "field": lang['Use Global Amazon S3 Video Storage'],
                          "name": "detail=aws_use_global",
                          "default":'0',
                          "fieldType": "select",
                          "form-group-class":"more_perms_input more_perms_limited",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      {
                          "field": lang['Use Global Wasabi Hot Cloud Storage Video Storage'],
                          "name": "detail=whcs_use_global",
                          "default":'0',
                          "fieldType": "select",
                          "form-group-class":"more_perms_input more_perms_limited",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      {
                          "field": lang['Use Global Backblaze B2 Video Storage'],
                          "name": "detail=b2_use_global",
                          "default":'0',
                          "fieldType": "select",
                          "form-group-class":"more_perms_input more_perms_limited",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      {
                          "field": lang['Use Global WebDAV Video Storage'],
                          "name": "detail=webdav_use_global",
                          "default":'0',
                          "fieldType": "select",
                          "form-group-class":"more_perms_input more_perms_limited",
                          possible: [
                            {
                                "name": lang.No,
                               "value": "0"
                            },
                            {
                               "name": lang.Yes,
                               "value": "1"
                            },
                         ]
                      },
                      // NEEDS TO MOVE DESIGNATED FILES AFTER TESTING />
                      {
                         "fieldType": "btn-group",
                         "btns": [
                             {
                                 "fieldType": "btn",
                                 "class": `submit btn-success fill`,
                                 "btnContent": `${lang['Save']}`,
                             },
                         ],
                      },
                 ]
             },
          }
        },
    "Super User Preferences": {
         "section": "Super User Preferences",
         "blocks": {
             "Editor": {
                noHeader: true,
                "color": "grey",
                "noDefaultSectionClasses": true,
                "box-wrapper-class": "row",
                "info": [
                    {
                        isFormGroupGroup: true,
                        "noHeader": true,
                        "section-pre-class": "col-md-6",
                        info: [
                            {
                               "name": "mail",
                               "field": lang.Email,
                            },
                            {
                               "name": "pass",
                               "type": "password",
                               "fieldType": "password",
                               "field": lang['Password'],
                            },
                            {
                               "name": "pass_again",
                               "type": "password",
                               "fieldType": "password",
                               "field": lang['Password Again'],
                            },
                            {
                               "fieldType": "btn-group",
                               "btns": [
                                   {
                                       "fieldType": "btn",
                                       "class": `submit btn-success`,
                                       "btnContent": `${lang['Save']}`,
                                   },
                               ],
                            },
                        ]
                    },
                    {
                        isFormGroupGroup: true,
                        "name": lang["API Keys"],
                        "section-pre-class": "col-md-6",
                        info: [
                            {
                               "fieldType": "btn-group",
                               "btns": [
                                   {
                                       "fieldType": "btn",
                                       "class": `new-token btn-success`,
                                       "btnContent": `${lang['Add']}`,
                                   },
                               ],
                            },
                            {
                               "id": "super-tokens",
                               "fieldType": "div",
                            },
                        ]
                    },
                ]
            }
        }
    },
    "Help Window": {
           "section": "Help Window",
           "blocks": {
               "Column1": {
                   "name": lang["Helping Hand"],
                  "color": "navy",
                  "blockquote": lang.helpFinderDescription,
                  "section-pre-class": "col-md-4",
                  "info": [
                       {
                         "id": "helpinghand-options",
                         "field": lang["Active Tutorial"],
                         "fieldType": "select",
                         "possible": [
                             // {
                             //    "name": lang['Date Updated'],
                             //    "value": "dateUpdated"
                             // },
                         ]
                      },
                      {
                          "field": lang["Monitor"],
                          "form-group-class": "helping-hand-target-monitor",
                          "fieldType": "select",
                          "class": "monitors_list",
                     },
                     {
                         "fieldType": "btn",
                         "class": `btn-primary fill watch-helping-hand mb-1`,
                         "btnContent": lang.Run,
                     },
                     {
                         "id": "helpinghand-results",
                         "fieldType": "div",
                     },
                 ]
             },
             "Column2": {
                noHeader: true,
                "color": "blue",
                "section-pre-class": "col-md-8",
                "noDefaultSectionClasses": true,
                "box-wrapper-class": "row",
                "info": [
                    {
                        title: lang["New to Xenocipher?"],
                        info: `Try reading over some of these links to get yourself started.`,
                        buttons: [
                            {
                                icon: 'newspaper-o',
                                color: 'default',
                                text: lang.afterInstallationGuides,
                                href: 'https://shinobi.video/docs/configure'
                            },
                            {
                                icon: 'plus',
                                color: 'default',
                                text: lang.addingAnH264Camera,
                                href: 'https://shinobi.video/docs/configure#content-adding-an-h264h265-camera'
                            },
                            {
                                icon: 'plus',
                                color: 'default',
                                text: lang.addingAnMJPEGCamera,
                                href: 'https://shinobi.video/articles/2018-09-19-how-to-add-an-mjpeg-camera'
                            },
                            {
                                icon: 'gears',
                                color: 'default',
                                text: lang.rtspCameraOptimization,
                                href: 'https://shinobi.video/articles/2017-07-29-how-i-optimized-my-rtsp-camera'
                            },
                            {
                                icon: 'comments-o',
                                color: 'info',
                                text: lang.communityChat,
                                href: 'https://discord.gg/ehRd8Zz'
                            },
                            {
                                icon: 'reddit',
                                color: 'info',
                                text: lang.forumOnReddit,
                                href: '#'
                            },
                            {
                                icon: 'file-o',
                                color: 'primary',
                                text: lang.Documentation,
                                href: 'http://shinobi.video/docs'
                            }
                        ]
                    },
                    {
                        bigIcon: "smile-o",
                        title: lang.itsAProvenFact,
                        info: lang.generosityHappierPerson,
                        buttons: [
                            {
                                icon: 'share-square-o',
                                color: 'default',
                                text: lang['XenocipherShop Subscriptions'],
                                href: 'https://licenses.shinobi.video/subscribe'
                            },
                            {
                                icon: 'paypal',
                                color: 'default',
                                text: lang['Donate by PayPal'],
                                href: '#'
                            },
                            {
                                icon: 'bank',
                                color: 'default',
                                text: 'University of Zurich (UZH)',
                                href: 'https://www.zora.uzh.ch/id/eprint/139275/'
                            },
                        ]
                    },
                    {
                        title: lang["Xenocipher Mobile"],
                        info: lang.yourSubscriptionText,
                        buttons: [
                            {
                                icon: 'star',
                                color: 'success',
                                text: lang['Get the Mobile App'],
                                href: 'https://shinobi.video/mobile'
                            },
                            {
                                icon: 'comments-o',
                                color: 'primary',
                                text: lang['#mobile-client Chat'],
                                href: 'https://discord.gg/ehRd8Zz'
                            },
                        ]
                    },
                    {
                        title: lang.activateXenocipher,
                        info: lang.howToActivate,
                        buttons: [
                            {
                                icon: 'share-square-o',
                                color: 'default',
                                text: 'Xenocipher Mobile License ($5/m)',
                                href: 'https://licenses.shinobi.video/subscribe?planSubscribe=plan_G31AZ9mknNCa6z',
                            },
                            {
                                icon: 'share-square-o',
                                color: 'default',
                                text: 'Tiny Support Subscription ($10/m)',
                                href: 'https://licenses.shinobi.video/subscribe?planSubscribe=plan_G42jNgIqXaWmIC',
                            },
                            {
                                icon: 'share-square-o',
                                color: 'default',
                                text: '100 Camera License ($75/m)',
                                href: 'https://licenses.shinobi.video/subscribe?planSubscribe=plan_G3LGdNwA8lSmQy',
                            },
                        ]
                    },
                    {
                        title: lang['Donations, One-Time Boost'],
                        info: lang.donationOneTimeText,
                        width: 12,
                        buttons: [
                            {
                                icon: 'paypal',
                                color: 'default',
                                text: lang['Donate by PayPal'],
                                href: '#'
                            },
                        ]
                    },
                ].map((block) => {
                    var parsedButtons = block.buttons.map((btn) => {
                        return {
                            "fieldType": "btn",
                            "class": `btn-${btn.color} fill mb-1`,
                            "icon": btn.icon,
                            "attribute": `href="${btn.href}" target="_blank"`,
                            "btnContent": btn.text,
                        }
                    });
                    return {
                       noHeader: true,
                       isFormGroupGroup: true,
                       "section-pre-class": `col-md-${block.width || '6'} mb-3`,
                       "info": [
                           {
                               "fieldType": "div",
                               divContent: `<h3>${block.title}</h3>`
                           },
                           {
                               "fieldType": "div",
                               class: 'mb-3',
                               divContent: block.info
                           },
                           ...parsedButtons
                       ]
                    }
                })
            },
        }
    },
    "Monitor Map": {
         "section": "Monitor Map",
         "blocks": {
             "Search Settings": {
                "name": lang["Monitor Map"],
                "color": "blue",
                "noHeader": true,
                "noDefaultSectionClasses": true,
                "info": [
                    {
                        "fieldType": "div",
                        "id": "monitor-map-canvas",
                    }
               ]
           },
        }
      },
      "Timeline": {
           "section": "Timeline",
           "blocks": {
               "Search Settings": {
                  "name": lang["Timeline"],
                  "color": "blue",
                  "noHeader": true,
                  "noDefaultSectionClasses": true,
                  "box-wrapper-class": "flex-direction-column",
                  "info": [
                      {
                          "fieldType": "div",
                          "class": "row m-0",
                          "id": "timeline-video-canvas",
                      },
                      {
                          "fieldType": "div",
                          "class": "row p-1 m-0",
                          "id": "timeline-info",
                          "divContent": `
                          <div class="text-center">
                            <span class="current-time font-monospace ${textWhiteOnBgDark}"></span>
                          </div>`
                      },
                      {
                          "fieldType": "div",
                          "class": "p-2",
                          "id": "timeline-controls",
                          "divContent": `
                          <div class="text-center">
                              <div class="btn-group">
                                  <a class="btn btn-sm btn-default" timeline-action="jumpPrev" title="${lang.jumptoPreviousVideo}"><i class="fa fa-angle-double-left"></i></a>
                                  <a class="btn btn-sm btn-default" timeline-action="jumpLeft" title="${lang.jumpFiveSeconds}"><i class="fa fa-arrow-circle-left"></i></a>
                                  <a class="btn btn-sm btn-primary" timeline-action="playpause" title="${lang.Play}/${lang.Pause}"><i class="fa fa-play-circle-o"></i></a>
                                  <a class="btn btn-sm btn-default" timeline-action="jumpRight" title="${lang.jumpFiveSeconds}"><i class="fa fa-arrow-circle-right"></i></a>
                                  <a class="btn btn-sm btn-default" timeline-action="jumpNext" title="${lang.jumptoNextVideo}"><i class="fa fa-angle-double-right"></i></a>
                              </div>
                              <div class="btn-group">
                                  <a class="btn btn-sm btn-default btn-success" timeline-action="speed" speed="1" title="${lang.Speed} x1">x1</a>
                                  <a class="btn btn-sm btn-default" timeline-action="speed" speed="2" title="${lang.Speed} x2">x2</a>
                                  <a class="btn btn-sm btn-default" timeline-action="speed" speed="5" title="${lang.Speed} x5">x5</a>
                                  <a class="btn btn-sm btn-default" timeline-action="speed" speed="7" title="${lang.Speed} x7">x7</a>
                                  <a class="btn btn-sm btn-default" timeline-action="speed" speed="10" title="${lang.Speed} x10">x10</a>
                              </div>
                              <div class="btn-group">
                                  <a class="btn btn-sm btn-default" timeline-action="gridSize" size="md-12">1</a>
                                  <a class="btn btn-sm btn-default btn-success" timeline-action="gridSize" size="md-6">2</a>
                                  <a class="btn btn-sm btn-default" timeline-action="gridSize" size="md-4">3</a>
                              </div>
                              <div class="btn-group">
                                  <input class="form-control form-control-sm" id="timeline-video-object-search" placeholder="${lang['Search Object Tags']}">
                              </div>
                              <div class="btn-group">
                                  <select class="form-control form-control-sm" id="timeline-video-type">
                                    <option value="">${lang.Local}</option>
                                    <option value="cloud">${lang.Cloud}</option>
                                    <option value="archive">${lang.Archive}</option>
                                  </select>
                              </div>
                              <div class="btn-group">
                                  <a class="btn btn-sm btn-primary" timeline-action="autoGridSizer" title="${lang.autoResizeGrid}"><i class="fa fa-expand"></i></a>
                                  <a class="btn btn-sm btn-primary" timeline-action="playUntilVideoEnd" title="${lang.playUntilVideoEnd}"><i class="fa fa-step-forward"></i></a>
                                  <a class="btn btn-sm btn-primary btn-warning" timeline-action="dontShowDetection" title="${lang['Hide Detection on Stream']}"><i class="fa fa-grav"></i></a>
                              </div>
                              <div class="btn-group">
                                  <a class="btn btn-sm btn-success" timeline-action="downloadAll" title="${lang.Download}"><i class="fa fa-download"></i></a>
                              </div>
                              <div class="btn-group">
                                  <a class="btn btn-sm btn-default" class_toggle="show-non-playing" data-target="#timeline-video-canvas" icon-toggle="fa-eye fa-eye-slash" icon-child="i" title="${lang['Show Only Playing']}"><i class="fa fa-eye-slash"></i></a>
                                  <a class="btn btn-sm btn-default" timeline-action="refresh" title="${lang.Refresh}"><i class="fa fa-refresh"></i></a>
                              </div>
                              <div class="btn-group">
                                  <a class="btn btn-sm btn-primary" id="timeline-date-selector" title="${lang.Date}"><i class="fa fa-calendar"></i></a>
                              </div>
                              <div class="btn-group">
                                  <button type="button" class="btn btn-primary btn-sm dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown" aria-expanded="false">
                                      <i class="fa fa-video-camera"></i>
                                  </button>
                                  <ul class="dropdown-menu px-3 bg-dark" id="timeline-monitor-list"></ul>
                              </div>
                          </div>
                          `,
                      },
                      {
                          "fieldType": "div",
                          "id": "timeline-bottom-strip",
                      },
                      {
                          "fieldType": "div",
                          "id": "timeline-pre-buffers",
                          "class": "hidden",
                      }
                 ]
             },
          }
      },
      "Rally": {
            "section": "Rally",
            "name": "Rally",
            "blocks": {
                "Search Settings": {
                   "id": "rallyConfigure",
                   "name": lang.Scan,
                   "blockquote": lang.RallyDescription,
                   "color": "green",
                   "section-pre-class": "col-md-4",
                   isFormGroupGroup: true,
                   "info": [
                       {
                           "name": "host",
                           "field": lang["Host"],
                           "placeholder": "http://shinobi_host:8080",
                       },
                       {
                           "name": "groupKey",
                           "field": lang["Group Key"],
                       },
                       {
                           "name": "apiKey",
                           "field": lang["API Key"],
                           "description": lang.rallyApiKeyFieldText,
                       },
                       {
                           "name": "channel",
                           "field": lang["Channel"],
                           "description": lang.rallyChannelDescription,
                       },
                       {
                         "fieldType": "btn-group",
                         "btns": [
                             {
                                 forForm: true,
                                 "fieldType": "btn",
                                 "class": `btn-success fill mb-3`,
                                 "icon": `search`,
                                 "attribute": `type="submit"`,
                                 "btnContent": `${lang['Scan']}`,
                             }
                          ]
                       }
                  ]
              },
              "Management": {
                 "id": "rallyManagement",
                 "noHeader": true,
                 "color": "blue",
                 "section-pre-class": "col-md-8",
                 "info": [
                     {
                         "id":"rallyServerInfo",
                         "fieldType": "div",
                         "class": "mb-3",
                     },
                     {
                        "fieldType": "btn-group",
                        "class": "mb-3",
                        "btns": [
                            {
                                "fieldType": "btn",
                                "class": `btn-success add-all`,
                                "btnContent": `<i class="fa fa-plus"></i> ${lang['Add All (Rallied)']}`,
                            },
                            // {
                            //     "fieldType": "btn",
                            //     "class": `btn-success add-all-direct`,
                            //     "btnContent": `<i class="fa fa-plus"></i> ${lang['Add All (Direct)']}`,
                            // },
                        ],
                     },
                     {
                         "id":"rallyCameras",
                         "fieldType": "table",
                         "attribute": `data-classes="table table-striped"`,
                         "divContent": ""
                     }
                 ]
             },
           }
       }
  })
}
