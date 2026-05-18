module.exports = (s,config,lang) => {
    const yesNoPossibility = [
        { "name": lang.No, "value": "0" },
        { "name": lang.Yes, "value": "1" }
    ];
    function addMenuItem(newMenuItem, afterPageOpen){
        // const newMenuItem = {
        //     icon: 'barcode',
        //     label: `${lang['Power Viewer']}`,
        //     pageOpen: 'powerVideo',
        // }
        const sideMenuContents = s.definitions.SideMenu.blocks.Container1.links;
        const linkIndex = sideMenuContents.findIndex(x => x.pageOpen === afterPageOpen);
        sideMenuContents.splice(linkIndex + 1, 0, newMenuItem)
    }
    return {
        yesNoPossibility,
        addMenuItem,
    }
}
