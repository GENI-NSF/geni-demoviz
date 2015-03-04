Site Map Test
=============

{{{

widget:
  type: data/map_l
  caption: Site Status
  data_sources:
    nodes:
      schema: [['id', 'int'], ['name'], ['site_id', 'int'], ['site_name'], ['status'], 
               ['lat', 'float'], ['lon', 'float']]
      database:
        query: SELECT n.id, n.client_id as name, s.id as site_id, s.am_name as site_name, 
               n.status, s.latitude as lat, s.longitude as lon 
               FROM lwtesting_stitchtest_node as n, allsites as s WHERE n.site_id = s.id
        peg_offset: true # resend entire node status every few seconds
        mode: update
        check_interval: 4
        url: postgres://oml2:0mlisg00d4u@155.99.144.110:5432/gec22

    links:
      schema: [['id', 'int'], ['from_id', 'int'], ['from_if_name'], ['to_id', 'int'], 
        ['to_if_name'], ['status'], ['link_id'], ['from_site_id', 'int'], ['to_site_id', 'int']]
      database:
        query: SELECT l.*, fn.site_id as from_site_id, tn.site_id as to_site_id 
               FROM lwtesting_stitchtest_link as l, lwtesting_stitchtest_node as fn, 
                    lwtesting_stitchtest_node as tn 
               WHERE l.from_id = fn.id AND l.to_id = tn.id
        peg_offset: true # resend entire node status every few seconds
        mode: update
        check_interval: 4
        url: postgres://oml2:0mlisg00d4u@155.99.144.110:5432/gec22

  width: 1.0
  hide_site_internals: {to: 6} # visible from and including 6
  map:
    center: [-98.0, 35.0]
    zoom: 4
    grayscale: true
    tile_provider: esri_world_topo
  mapping:
    nodes:
      id: id
      site: site_id # identify site
      status: status
      latitude:
        property: lat
      longitude:
        property: lon
      radius: 10
      fill_color:
        property: status
        color:
          unknown: gray
          down: lightblue
          up: green
          error: red
    links:
      from: from_id
      to: to_id
      from_site: from_site_id # identify site
      to_site: to_site_id
      stroke_color:
        property: status
        color:
          unknown: gray
          down: orange
          up: green
          error: red
      stroke_width: 4
      
}}}
