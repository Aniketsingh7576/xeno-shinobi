module.exports = (s,config,lang) => {
    const {
        yesNoPossibility,
    } = require('./fieldValues.js')(s,config,lang);
    return {
         "section": "ONVIF Scanner",
         "blocks": {
             "Search Settings": {
                "name": lang["Scan Settings"],
                "color": "navy",
                "blockquote": lang.ONVIFnote,
                "section-pre-class": "col-md-4",
                "info": [
                    {
                       "name": "ip",
                       "field": lang['IP Address'],
                       "description": lang["fieldTextIp"],
                       "example": "10.1.100.1-10.1.100.254",
                    },
                    {
                       "name": "port",
                       "field": lang['Port'],
                       "description": lang.separateByCommasOrRange,
                       "example": "80,7575,8000,8080,8081",
                    },
                    {
                       "name": "user",
                       "field": lang['Camera Username'],
                       "placeholder": "Can be left blank.",
                    },
                    {
                       "name": "pass",
                       "field": lang['Camera Password'],
                       "fieldType": "password",
                    },
                    {
                       "fieldType": "div",
                       "class": "view-running view-paused mb-3",
                       "divContent": `<div id="onvifScanner-progress" style="height:1rem" class="progress" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                            <div class="progress-bar" style="width: 0%"><span class="progress-text"></span></div>
                        </div>`,
                    },
                    {
                       "fieldType": "btn-group",
                       "class": "view-running",
                       "btns": [
                           {
                               "fieldType": "btn",
                               "class": `btn-info scan-pause view-running`,
                               "btnContent": `${lang['Pause']}`,
                           },
                           {
                               "fieldType": "btn",
                               "class": `btn-danger scan-cancel view-running`,
                               "btnContent": `${lang['Stop']}`,
                           },
                       ],
                    },
                    {
                       "fieldType": "btn-group",
                       "class": "view-paused",
                       "btns": [
                           {
                               "fieldType": "btn",
                               "class": `btn-success scan-resume`,
                               "btnContent": `${lang['Resume']}`,
                           },
                           {
                               "fieldType": "btn",
                               "class": `btn-default add-all`,
                               "btnContent": `${lang['Add All']}`,
                           },
                       ],
                    },
                    {
                       "fieldType": "btn-group",
                       "class": "view-idle",
                       "btns": [
                           {
                               "fieldType": "btn",
                               "forForm": true,
                               "class": `btn-success`,
                               "btnContent": `${lang['Search']}`,
                           },
                           {
                               "fieldType": "btn",
                               "class": `btn-default add-all`,
                               "btnContent": `${lang['Add All']}`,
                           },
                       ],
                    },
               ]
           },
           "Found Devices": {
              "name": lang['Found Devices'],
              "color": "blue",
              "section-pre-class": "col-md-8",
              "info": [
                  {
                      "fieldType": "div",
                      "class": "onvif_result row",
                  }
              ]
          },
          "Other Devices": {
             "name": lang['Other Devices'],
             "color": "danger",
             "section-pre-class": "col-md-12",
             "info": [
                 {
                     "fieldType": "div",
                     "class": "onvif_result_error row",
                 }
             ]
         },
        }
      }
}
