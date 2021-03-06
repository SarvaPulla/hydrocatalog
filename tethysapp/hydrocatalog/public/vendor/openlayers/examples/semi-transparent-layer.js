var map = new ol.Map({
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    }),
    new ol.layer.Tile({
      source: new ol.source.TileJSON({
        url: 'http://api.tiles.mapbox.com/v3/mapbox.va-quake-aug.json',
        crossOrigin: 'anonymous'
      })
    })
  ],
  renderer: common.getRendererFromQueryString(),
  target: 'map',
  view: new ol.View({
    center: ol.proj.fromLonLat([-77.93255, 37.9555]),
    zoom: 7
  })
});
