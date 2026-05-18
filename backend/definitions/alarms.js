module.exports = (s,config,lang) => {
    const {
        yesNoPossibility,
    } = require('./fieldValues.js')(s,config,lang);
    return {
        "section": "Alarms",
        "blocks": {
            "Alarms Search Settings": {
               "name": lang["Alarms"],
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
                   },
                   {
                       "fieldType": "div",
                       "id": "alarms_preview_area",
                       "divContent": ""
                   },
              ]
          },
          "theTable": {
              noHeader: true,
             "section-pre-class": "col-md-8",
             "info": [
                 {
                     "fieldType": "table",
                     "attribute": `data-classes="table table-striped"`,
                     "id": "alarms_draw_area",
                     "divContent": ""
                 }
             ]
         },
       }
    }
}
