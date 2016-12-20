/*****************************************************************************
 * FILE:      Main.js
 * DATE:      11 November 2016
 * AUTHOR:    Sarva Pulla
 * COPYRIGHT: (c) Brigham Young University 2016
 * LICENSE:   BSD 2-Clause
 *
 *****************************************************************************/

/*****************************************************************************
 *                      LIBRARY WRAPPER
 *****************************************************************************/

var HYDRO_CATALOG_PACKAGE = (function(){
    // Wrap the library in a package function
    "use strict"; // And enable strict mode for this library


    /************************************************************************
     *                      MODULE LEVEL / GLOBAL VARIABLES
     ***************************************************************************/
    var ContextMenuBase,
        colors,
        current_layer,
        element,
        layers,
        layersDict,
        map,
        popup,
        wmsLayer,
        wmsSource;
    /************************************************************************
     *                    PRIVATE FUNCTION DECLARATIONS
     *************************************************************************/
    var addContextMenuToListItem,
        add_soap,
        generate_plot,
        get_his_server,
        get_catalog_list,
        init_map,
        init_menu,
        init_jquery_var,
        init_events,
        load_catalog,
        $modalAddSOAP,
        set_color,
        $SoapVariable,
        $modalHIS,
        $modalDelete,
        $modalInterface,
        onClickZoomTo,
        onClickDeleteLayer,
        $hs_list,
        update_catalog;

    /************************************************************************
     *                    PRIVATE FUNCTION IMPLEMENTATIONS
     *************************************************************************/
    colors = ['#ff0000','#0033cc','#000099','#ff0066','#ff00ff','#800000','#6699ff','#6600cc','#00ffff'];
    set_color = function(){
        var color = colors[Math.floor(Math.random() * colors.length)];
        return color;
    };
    init_map = function(){
        var projection = ol.proj.get('EPSG:3857');
        var baseLayer = new ol.layer.Tile({
            source: new ol.source.BingMaps({
                key: '5TC0yID7CYaqv3nVQLKe~xWVt4aXWMJq2Ed72cO4xsA~ApdeyQwHyH_btMjQS1NJ7OHKY8BK-W-EMQMrIavoQUMYXeZIQOUURnKGBOC7UCt4',
                imagerySet: 'AerialWithLabels' // Options 'Aerial', 'AerialWithLabels', 'Road'
            })
        });
        var fullScreenControl = new ol.control.FullScreen();
        var view = new ol.View({
            center: [-11500000, 4735000],
            projection: projection,
            zoom: 4
        });

        layers = [baseLayer];

        layersDict = {};

        map = new ol.Map({
            target: document.getElementById("map"),
            layers: layers,
            view: view
        });
        //Zoom slider
        map.addControl(new ol.control.ZoomSlider());
        map.addControl(fullScreenControl);
        map.crossOrigin = 'anonymous';
        element = document.getElementById('popup');

        popup = new ol.Overlay({
            element: element,
            positioning: 'bottom-center',
            stopEvent: true
        });
        map.addOverlay(popup);


    };

    init_jquery_var = function () {
        $modalAddSOAP = $('#modalAddSoap');
        $SoapVariable = $('#soap_variable');
        $modalDelete = $('#modalDelete');
        $modalHIS = $('#modalHISCentral');
        $modalInterface = $('#modalInterface');
        $hs_list = $('#current-servers-list');
    };

    // Reset the success on clicking settings
    $(".settings").click(function(){
        $modalInterface.find('.success').html('');
    });

    get_his_server = function () {
        var datastring = $modalHIS.serialize();
        $.ajax({
            type: "POST",
            url: '/apps/hydrocatalog/his-server/',
            data:datastring,
            dataType: 'HTML',
            success: function (result) {
                var json_response = JSON.parse(result);
                var url = json_response.url;
                $('#soap-url').val(url);
                $('#modalHISCentral').modal('hide');

                $( '#modalHISCentral' ).each(function(){
                    this.reset();
                });
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                console.log(Error);
            }
        });
    };
    $("#add-from-his").on('click',get_his_server);

    get_catalog_list = function(){
        $.ajax({
            type: "GET",
            url: '/apps/hydrocatalog/catalog/',
            dataType: 'JSON',
            success: function (result) {
                var server = result['hydroserver'];
                var HSTableHtml = '<table id="tbl-hydroservers"><thead><th></th><th>Title</th><th>URL</th></thead><tbody>';
                if (server.length === 0) {
                    $modalDelete.find('.modal-body').html('<b>There are no hydroservers in the Catalog.</b>');
                } else{
                    for (var i = 0; i < server.length; i++) {
                        var title = server[i].title;
                        var url = server[i].url;
                        HSTableHtml += '<tr>' +
                            '<td><input type="radio" name="server" id="server" value="' + title + '"></td>' +
                            '<td class="hs_title">' + title + '</td>' +
                            '<td class="hs_url">' + url + '</td>' +
                            '</tr>';
                    }
                    HSTableHtml += '</tbody></table>';
                    $modalDelete.find('.modal-body').html(HSTableHtml);
                }


            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                console.log(Error);
            }

        });
    };
    $("#delete-server").on('click',get_catalog_list);

    load_catalog = function () {
        $.ajax({
            type: "GET",
            url: '/apps/hydrocatalog/catalog/',
            dataType: 'JSON',
            success: function (result) {
                var servers = result['hydroserver'];
                $('#current-servers').empty();
                servers.forEach(function (server) {
                    var title = server.title;
                    var url = server.url;
                    var geoserver_url = server.geoserver_url;
                    var layer_name = server.layer_name;
                    var extents = server.extents;
                    $('<li class="ui-state-default"' + 'layer-name="' + title + '"' + '><input class="chkbx-layer" type="checkbox" checked><span class="server-name">' + title + '</span><div class="hmbrgr-div"><img src="/static/servir/images/hamburger.svg"></div></li>').appendTo('#current-servers');
                    addContextMenuToListItem($('#current-servers').find('li:last-child'));
                    var sld_string = '<StyledLayerDescriptor version="1.0.0"><NamedLayer><Name>'+layer_name+'</Name><UserStyle><FeatureTypeStyle><Rule><PointSymbolizer><Graphic><Mark><WellKnownName>circle</WellKnownName><Fill><CssParameter name="fill">'+set_color()+'</CssParameter></Fill></Mark><Size>10</Size></Graphic></PointSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';
                    wmsSource = new ol.source.TileWMS({
                        url: geoserver_url,
                        params: {'LAYERS':layer_name,
                            'SLD_BODY':sld_string},
                        serverType: 'geoserver',
                        crossOrigin: 'Anonymous'
                    });
                    wmsLayer = new ol.layer.Tile({
                        extent:ol.proj.transformExtent([extents['minx'],extents['miny'],extents['maxx'],extents['maxy']],'EPSG:4326','EPSG:3857'),
                        source: wmsSource
                    });

                    map.addLayer(wmsLayer);

                    layersDict[title] = wmsLayer;
                    // var layer_extent = wmsLayer.getExtent();
                    // map.getView().fit(layer_extent,map.getSize());
                });

                // rand_lyr.getSource().changed();
                // var layer_extent = layersDict[Object.keys(layersDict)[2]].getExtent();
                // var layer_true = ol.proj.transformExtent(layer_extent,'EPSG:3857','EPSG:4326');
                var layer_extent = [-15478192.4796,-8159805.6435,15497760.3589,8159805.6435];
                map.getView().fit(layer_extent,map.getSize());
                map.updateSize();
                // Object.keys(layersDict).forEach(function (key) {
                //     var layer_extent = layersDict[key].getExtent();
                //     map.getView().fit(layer_extent,map.getSize());
                // });
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                console.log(Error);
            }

        });


    };

    update_catalog = function () {
        $modalInterface.find('.success').html('');
        var datastring = $modalDelete.serialize();
        $.ajax({
            type: "POST",
            url: '/apps/hydrocatalog/delete/',
            data: datastring,
            dataType: 'HTML',
            success: function (result) {
                var json_response = JSON.parse(result);
                var title = json_response.title;
                $('#current-servers').empty();

                $('#modalDelete').modal('hide');
                $( '#modalDelete' ).each(function(){
                    this.reset();
                });
                map.removeLayer(layersDict[title]);
                delete layersDict[title];
                map.updateSize();
                load_catalog();
                $modalInterface.find('.success').html('<b>Successfully Updated the Catalog!</b>');
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                console.log(Error);
            }

        });

    };
    $("#btn-del-server").on('click',update_catalog);


    add_soap = function () {
        $modalInterface.find('.success').html('');
        if(($("#extent")).is(':checked')){
            var zoom = map.getView().getZoom();
            if (zoom < 7){
                $modalAddSOAP.find('.warning').html('<b>The zoom level has to be 7 or greater. Please check and try again.</b>');
                return false;
            }else{
                $modalAddSOAP.find('.warning').html('');
            }
            $("#chk_val").empty();
            var level = map.getView().calculateExtent(map.getSize());
            $('<input type="text" name="extent_val" id="extent_val" value='+'"'+level+'"'+' hidden>').appendTo($("#chk_val"));
            // $(this).val(level);
        }
        if(($("#soap-title").val())==""){
            $modalAddSOAP.find('.warning').html('<b>Please enter a title. This field cannot be blank.</b>');
            return false;
        }else{
            $modalAddSOAP.find('.warning').html('');
        }
        if(($("#soap-url").val())==""){
            $modalAddSOAP.find('.warning').html('<b>Please enter a valid URL. This field cannot be blank.</b>');
            return false;
        }else{
            $modalAddSOAP.find('.warning').html('');
        }
        if(($("#soap-url").val())=="http://hydroportal.cuahsi.org/nwisdv/cuahsi_1_1.asmx?WSDL" || ($("#soap-url").val())=="http://hydroportal.cuahsi.org/nwisuv/cuahsi_1_1.asmx?WSDL"){
            $modalAddSOAP.find('.warning').html('<b>Please zoom in further to be able to access the NWIS Values</b>');
            return false;
        }else{
            $modalAddSOAP.find('.warning').html('');
        }
        if(($("#soap-title").val()) != ""){
            var regex = new RegExp("^[a-zA-Z ]+$");
            var title = $("#soap-title").val();
            if (!regex.test(title)) {
                $modalAddSOAP.find('.warning').html('<b>Please enter Letters only for the title.</b>');
                return false;
            }
        }else{
            $modalAddSOAP.find('.warning').html('');
        }
        var datastring = $modalAddSOAP.serialize();
        $.ajax({
            type: "POST",
            url: '/apps/hydrocatalog/soap/',
            dataType: 'HTML',
            data: datastring,
            success: function(result)
            {
                var json_response = JSON.parse(result);
                if (json_response.status === 'true')
                {

                    var title= json_response.title;
                    var wms_url = json_response.wms;
                    var extents = json_response.bounds;
                    var rest_url = json_response.rest_url;
                    var zoom = json_response.zoom;
                    if (zoom == 'true'){
                        var level = json_response.level;
                    }

                    $('<li class="ui-state-default"'+'layer-name="'+title+'"'+'><input class="chkbx-layer" type="checkbox" checked><span class="server-name">'+title+'</span><div class="hmbrgr-div"><img src="/static/servir/images/hamburger.svg"></div></li>').appendTo('#current-servers');

                    addContextMenuToListItem($('#current-servers').find('li:last-child'));

                    $('#modalAddSoap').modal('hide');

                    //map.addLayer(new_layer);
                    $( '#modalAddSoap' ).each(function(){
                        this.reset();
                    });
                    var sld_string = '<StyledLayerDescriptor version="1.0.0"><NamedLayer><Name>'+wms_url+'</Name><UserStyle><FeatureTypeStyle><Rule><PointSymbolizer><Graphic><Mark><WellKnownName>circle</WellKnownName><Fill><CssParameter name="fill">'+set_color()+'</CssParameter></Fill></Mark><Size>10</Size></Graphic></PointSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';
                    wmsSource = new ol.source.TileWMS({
                        url: rest_url,
                        params: {'LAYERS':wms_url,
                            'SLD_BODY':sld_string},
                        serverType: 'geoserver',
                        crossOrigin: 'Anonymous'
                    });
                    wmsLayer = new ol.layer.Tile({
                        extent:ol.proj.transformExtent([extents['minx'],extents['miny'],extents['maxx'],extents['maxy']],'EPSG:4326','EPSG:3857'),
                        source: wmsSource
                    });

                    map.addLayer(wmsLayer);

                    layersDict[title] = wmsLayer;

                    var layer_extent = wmsLayer.getExtent();
                    map.getView().fit(layer_extent,map.getSize());
                    $modalInterface.find('.success').html('<b>Successfully Added the HydroServer to the Map!</b>');
                }
                else{
                    $modalAddSOAP.find('.warning').html('<b>Failed to add server. Please check Url and try again.</b>');
                }

            },
            error: function(XMLHttpRequest, textStatus, errorThrown)
            {
                $modalAddSOAP.find('.warning').html('<b>Invalid Hydroserver SOAP Url. Please check and try again.</b>');
                if(($("#extent")).is(':checked')){
                    $modalAddSOAP.find('.warning').html('<b>The requested area does not have any sites. Please try another area.</b>');
                    return false;
                }else{
                    $modalAddSOAP.find('.warning').html('');
                }

            }
        });

    };
    $('#btn-add-soap').on('click', add_soap);

    generate_plot = function(){
        $(document).find('.warning').html('');
        var datastring = $SoapVariable.serialize();
        var $loading = $('#view-file-loading');
        $loading.removeClass('hidden');
        $("#plotter").addClass('hidden');
        $.ajax({
            type: "POST",
            url: '/apps/hydrocatalog/soap-api/',
            dataType: 'JSON',
            data: datastring,
            success: function(result){
                $('#plotter').highcharts({
                    chart: {
                        type:'area',
                        zoomType: 'x'
                    },
                    title: {
                        text: result['title'],
                        style: {
                            fontSize: '11px'
                        }
                    },
                    xAxis: {
                        type: 'datetime',
                        labels: {
                            format: '{value:%d %b %Y}',
                            rotation: 45,
                            align: 'left'
                        },
                        title: {
                            text: 'Date'
                        }
                    },
                    yAxis: {
                        title: {
                            text: result['unit']
                        }

                    },
                    exporting: {
                        enabled: true,
                        width: 5000
                    },
                    series: [{
                        data: result['values'],
                        name: result['variable']
                    }]

                });
                $("#download-xml").removeClass('hidden');
                $loading.addClass('hidden');
                $("#plotter").removeClass('hidden');
            },
            error: function(XMLHttpRequest, textStatus, errorThrown)
            {
                $(document).find('.warning').html('<b>Unable to generate graph. Please check the start and end dates and try again.</b>');
                console.log(Error);
            }
        });
        return false;
    };

    $('#generate-plot').on('click',generate_plot);





    init_events = function(){
        (function () {
            var target, observer, config;
            // select the target node
            target = $('#app-content-wrapper')[0];

            observer = new MutationObserver(function () {
                window.setTimeout(function () {
                    map.updateSize();
                }, 350);
            });
            $(window).on('resize', function () {
                map.updateSize();
            });

            config = {attributes: true};

            observer.observe(target, config);
        }());

        map.on("moveend", function() {
            var zoom = map.getView().getZoom();
            var zoomInfo = '<h6>Current Zoom level = ' + zoom+'</h6>';
            document.getElementById('zoomlevel').innerHTML = zoomInfo;

        });

        map.on("singleclick",function(evt){
            //Check for each layer in the baselayers

            $(element).popover('destroy');


            if (map.getTargetElement().style.cursor == "pointer") {
                var clickCoord = evt.coordinate;
                popup.setPosition(clickCoord);

                var view = map.getView();
                var viewResolution = view.getResolution();

                var wms_url = current_layer.getSource().getGetFeatureInfoUrl(evt.coordinate, viewResolution, view.getProjection(), {'INFO_FORMAT': 'application/json'});
                if (wms_url) {
                    $.ajax({
                        type: "GET",
                        url: wms_url,
                        dataType: 'json',
                        success: function (result) {
                            var site_name = result["features"][0]["properties"]["sitename"];
                            var site_code = result["features"][0]["properties"]["sitecode"];
                            var network = result["features"][0]["properties"]["network"];
                            var hs_url = result["features"][0]["properties"]["url"];
                            var service = result["features"][0]["properties"]["service"];
                            var details_html = "/apps/hydrocatalog/details/?sitename="+site_name+"&sitecode="+site_code+"&network="+network+"&hsurl="+hs_url+"&service="+service+"&hidenav=true";

                            $(element).popover({
                                'placement': 'top',
                                'html': true,
                                // 'content': '<b>Name:</b>'+site_name+'<br><b>Code:</b>'+site_code+'<br><button type="button" class="mod_link btn-primary" data-html="'+details_html+'" >Site Details</button>'
                                'content':'<table border="1"><tbody><tr><th>Site Name</th><th>Site Id</th><th>Details</th></tr>'+'<tr><td>'+site_name +'</td><td>'+ site_code + '</td><td><button type="button" class="mod_link btn-primary" data-html="'+details_html+'" >Site Details</button></td></tr>'
                            });

                            $(element).popover('show');
                            $(element).next().css('cursor', 'text');
                            $('.mod_link').on('click',function(){
                                var $loading = $('#view-file-loading');
                                $('#iframe-container').addClass('hidden');
                                $loading.removeClass('hidden');
                                var details_url = $(this).data('html');
                                $('#iframe-container')
                                    .empty()
                                    .append('<iframe id="iframe-details-viewer" src="' + details_url + '" allowfullscreen></iframe>');
                                $('#modalViewDetails').modal('show');
                                $('#iframe-details-viewer').one('load', function () {
                                    $loading.addClass('hidden');
                                    $('#iframe-container').removeClass('hidden');
                                    $loading.addClass('hidden');
                                });
                            });
                        },
                        error: function (XMLHttpRequest, textStatus, errorThrown) {
                            console.log(Error);
                        }
                    });
                }
            }

        });

        map.on('pointermove', function(evt) {
            if (evt.dragging) {
                return;
            }
            var pixel = map.getEventPixel(evt.originalEvent);
            var hit = map.forEachLayerAtPixel(pixel, function(layer) {
                if (layer != layers[0] ){
                    current_layer = layer;
                    return true;}
            });
            map.getTargetElement().style.cursor = hit ? 'pointer' : '';
        });


    };

    $(document).on('change', '.chkbx-layer', function () {
            var displayName = $(this).next().text();
            layersDict[displayName].setVisible($(this).is(':checked'));
        });


    init_menu = function(){
        ContextMenuBase = [
            {
                name: 'Zoom To',
                title: 'Zoom To',
                fun: function (e) {
                    onClickZoomTo(e);
                }
            },
            {
                name: 'Delete',
                title: 'Delete',
                fun: function (e) {
                    onClickDeleteLayer(e);
                }
            }
        ];
    };
    onClickZoomTo = function(e){
        var clickedElement = e.trigger.context;
        var $lyrListItem = $(clickedElement).parent().parent();
        var layer_name = $lyrListItem.attr('layer-name');
        var layer_extent = layersDict[layer_name].getExtent();
        map.getView().fit(layer_extent,map.getSize());
        map.updateSize();
    };

    onClickDeleteLayer = function(e){
        var clickedElement = e.trigger.context;
        var $lyrListItem = $(clickedElement).parent().parent();
        var layer_name = $lyrListItem.attr('layer-name');
        map.removeLayer(layersDict[layer_name]);
        delete layersDict[layer_name];
        $lyrListItem.remove();
        map.updateSize();
    };



    $('#close-modalViewDetails').on('click', function () {
            $('#modalViewDetails').modal('hide');
        });

    addContextMenuToListItem = function ($listItem) {
        var contextMenuId;

        $listItem.find('.hmbrgr-div img')
            .contextMenu('menu', ContextMenuBase, {
                'triggerOn': 'click',
                'displayAround': 'trigger',
                'mouseClick': 'left',
                'position': 'right',
                'onOpen': function (e) {
                    $('.hmbrgr-div').removeClass('hmbrgr-open');
                    $(e.trigger.context).parent().addClass('hmbrgr-open');
                },
                'onClose': function (e) {
                    $(e.trigger.context).parent().removeClass('hmbrgr-open');
                }
            });
        contextMenuId = $('.iw-contextMenu:last-child').attr('id');
        $listItem.attr('data-context-menu', contextMenuId);
    };

    /************************************************************************
     *                  INITIALIZATION / CONSTRUCTOR
     *************************************************************************/
    $(function () {
        init_jquery_var();
        init_menu();
        init_map();
        init_events();
        load_catalog();
    });





}());